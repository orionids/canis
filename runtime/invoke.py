# vim:ts=4 sw=4 noet filetype=freepy:
# Copyright (C) 2020, adaptiveflow
# Distributed under ISC License

import logging
old_format_exception = logging.Formatter.formatException
def format_exception(self, ei):
	e = old_format_exception(self, ei)
	print("\033[33m" + e + "\033[0m")
	return "listed"
logging.Formatter.formatException = format_exception

import traceback
from importlib import import_module
import sys
import os
import json
import threading
import builtins
from canis.runtime import io

_pydevd = None
_event = []

orig_exit = sys.exit
def _do_exit(code):
	_exit()
	raise Exception("Exit code: " + str(code))
sys.exit = _do_exit

def _cygtodos(path):
	return path[10] + ':' + path[11:] if path.startswith(
		"/cygdrive/") else path

def _color(c):
	if os.environ.get("OUTPUT_FORMAT") == "html":
		if c == "reset":
			return "</font>"
		return "<font color=magenta>"
	c = {
		"black": "0",
		"reset": "0",
		"magenta": "95",
		"cyan": "96"
	}.get(c)
	return "\033[" + ( "95" if c is None else c ) + "m"

def resolve(body):
	io.send({
		"action": "resolve",
		"body": body
	})
	return io.recv()["body"]

def initialize(cmd):
	sys.stderr.new_line = None if cmd.get("remark") is False else True
	path = cmd.get("rtpath")
	if path:
		def _cvt(name):
			return [_cygtodos(p) for p in path.get(name, [])]
		sys.path =  _cvt("major") + sys.path + _cvt("minor")

	path = cmd.get("root")
	io.process_root = path
	for i in range(0,2):
		if path:
			sys.path.insert(0, _cygtodos(path))
		path = cmd.get("path")

	init = cmd.get("init")
	if init:
		for src in init:
			lst = src.get("fromlist")
			_tried = {}
			try:
				imp = __import__(src["name"], fromlist=lst)
			except ModuleNotFoundError as e:
				print(e, "while loading", src["name"] + "." + lst[0])
#					for evt in _event:
#						if evt("install", e.name):
#							print(sys.executable + " -m pip install " + e.name)
#							continue
#					sys.exit(1)
				continue
			except Exception as e:
				raise e
			log = src.get("log")
			param = src.get("param")
			for l in lst:
				i = getattr(imp, l, None)
				if i:
					p = getattr(i, log, None)
					if p:
						log_edit.append(p)
					p = getattr(i, "initialize", None)
					if p:
						p(sys.modules[__name__], param)
					p = getattr(i, "event", None)
					if p and callable(p):
						_event.append(p)

def _exit():
	io.send({"action": "reuse"})


def _invoke(cmd, action_thread):
	_notify("before_lambda")
	initialize(cmd)
	path, name = _module_info(cmd["src"])
	if path:
		i = 0
		while path.startswith("../", i):
			i += 3

		if i > 0:
			relpath = path[:i]
			if relpath not in sys.path:
				sys.path.append(relpath)
			path = path[i:]
		l = import_module("." + name, path.replace("/", "."))
	else:
		sys.path.append(os.getcwd())
		l = import_module(name)

#---
#			import unittest
#			unittest.TextTestRunner().run(
#			unittest.TestSuite([ unittest.TestLoader().loadTestsFromModule(
#				l
#			) ]))
#			io.send({
#				"action": "result",
#				"err": None,
#				"data": {}
#			})
#			mt = threading.currentThread()
#			for t in threading.enumerate():
#				if t != mt and t.daemon is not True:
#					t.join()
#			io.send({"action": "reuse"})
#			continue
	ctx = _Context()
	ctx.__dict__ = cmd["ctx"]
	handler = cmd.get("handler")
	handler = getattr(l, handler if handler else "lambda_handler", None)
	if handler:
		err = None
		try:
			r = handler(cmd.get("ev", {}), ctx)
		except Exception as e:
			traceback.print_exc()
			r = str(e)
			try:
				# because stringified object can
				# use quot instead of double quot,
				# try to parse json
				r = json.loads(r)
			except:
				err = r
		io.send({
			"action": "result",
			"err": err,
			"data": r
		})
	else:
		altered = cmd.get("altered")
		if altered:
			a = import_module(
				altered["name"], altered.get("package"))
			handler = altered.get("handler")
			r = getattr(a, handler if handler else "handler")(l)
			io.send({
				"action": "result",
				"err": None,
				"data": r
			})
		else:
			_exception(e)
	_notify("after_lambda")

	if _pydevd is None:
		# wait all threads terminate, like sys.exit
		# TODO not compatible to AWS lambda written in python
		mt = threading.current_thread() if hasattr(threading, "current_thread") else threading.currentThread()
		for t in threading.enumerate():
			if t != mt and t != action_thread and t.daemon is not True:
				t.join()
	_exit()

if __name__ == "__main__":

	_lambda_waiter = threading.Semaphore(0)
	_lambda_cmd = None

	def log(p):
		def wrap(*args,**kwargs):
			if not "file" in kwargs:
				kwargs["file"] = sys.stderr
			return p(*args,**kwargs)
		return wrap

	# print uses stderr, because garbage like error message can be written
	# into stderr it disturbs communication
	builtins.print = log(print)

	old = sys.stderr
	if sys.platform == "win32":
		from ctypes import windll, Structure, wintypes, byref
		stdout_handle = windll.kernel32.GetStdHandle(-11)
		SetConsoleTextAttribute = windll.kernel32.SetConsoleTextAttribute
		GetConsoleScreenBufferInfo = windll.kernel32.GetConsoleScreenBufferInfo
		def get_default_color():
			class CONSOLE_SCREEN_BUFFER_INFO(Structure):
				_fields_ = [
					("dwSize", wintypes.SHORT * 2),
					("dwCursorPostion", wintypes.SHORT * 2),
					("wAttributes", wintypes.WORD),
					("srWindow", wintypes.SHORT * 4),
					("dwMaximumWindowSize", wintypes.SHORT * 20)]
			csbi = CONSOLE_SCREEN_BUFFER_INFO()
			GetConsoleScreenBufferInfo(stdout_handle, byref(csbi))
			return csbi.wAttributes
		default_color = get_default_color()
		ansi_to_win32 = {
			'95': 0xc,
			'96': 0xd, # light magenta
			'0': default_color
		}
		old_write = old.write
		def color_write(s):
			start = 0
			i = 0
			l = len(s)
			while i < l:
				if s[i] == '\033' and s[i + 1] == '[':
					j = s.find('m',i + 1)
					# TODO not found?
					# ignore digits + 1 char
					# todo ansi style support
					code = ansi_to_win32.get(s[i+2:j])
					if code is None:
						code = default_color
					if start < i:
						old_write(s[start:i])
						old.flush()
					SetConsoleTextAttribute(stdout_handle, code)
					start = i = j + 1
				else:
					i += 1
			old_write(s[start:])
			old.flush()
		old.write = color_write
	log_edit = []
	class StdErr:
		def __init__(self):
			self.new_line = True
			self.lock = threading.Lock()

		def flush(self):
			pass

		def write(self, s):
			self.lock.acquire();
			if self.new_line:
				if not s.startswith(io.status_line):
					old.write( _color("magenta") + str(os.getpid()) + _color("reset") + " " )
				self.new_line = False
			old.write(s)
			if s and s[len(s) - 1] == '\n' and self.new_line is not None:
				self.new_line = True
			self.lock.release();

	sys.stdout = sys.stderr = StdErr()
	port = os.environ.get("PYDEV_PORT")
	if port is not None:
		_pydevd = __import__("pydevd")
		_pydevd.settrace("localhost", port=int(port), suspend=False)

	def _action():
		global _lambda_cmd
		while cmd := io.recv():
			action = cmd["action"]
			if action == "invoke":
				_lambda_cmd = cmd
				_lambda_waiter.release()
			elif action == "control":
				if io.process_control:
					io.process_control(cmd["payload"])
				else:
					io.process_command.append(cmd["payload"])
			elif action == "exit":
				if _pydevd:
					_pydevd.stoptrace()
				_lambda_cmd = None
				_lambda_waiter.release()
				break
			elif action == "reuse":
				print("REUSE!!!!!!!!!!!!!!!!")
			else:
				io.RPC.result(cmd)

	class _Context:
		@classmethod
		def __init__(cls):
			cls.function_name = "-handler"
			cls.function_version = "1.0.0"
		def get_remaining_time_in_millis(self):
			return 10000

	def _module_info(fn):
		path, name = os.path.split( fn )
		return path, os.path.splitext(name)[0]

	def _notify(action):
		if callback is not None:
			f = getattr(callback,action,None)
			if callable(f):
				f()

	def _exception(e):
		traceback.print_exc()
		io.send({
			"action": "result",
			"err": str(e)
		})

	callback = None
	def _initialize():
		global callback
		i = 1
		addr = None
		while len(sys.argv) > i:
			arg = sys.argv[i]
			if arg == '.':
				break

			if arg[0] == ':':
				addr = arg[1:]
			else:
				path, name = _module_info(arg)
				sys.path.insert(0, path)
				callback = import_module(name)
			i += 1
		sys.argv = sys.argv[i:]
		io.initialize(addr)
	_initialize()

	t = threading.Thread(target=_action)
	t.start()
#	_notify("before_loop")
#	while _action():
#		pass
#	_notify("after_loop")

	while True:
		_lambda_waiter.acquire()
		cmd = _lambda_cmd
		print(cmd)
		if cmd:
			_invoke(cmd, t)
		else:
			t.join()
			break
