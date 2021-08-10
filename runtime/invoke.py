# vim:ts=4 sw=4 noet filetype=freepy:
# Copyright (C) 2020, adaptiveflow
# Distributed under ISC License

import traceback
from importlib import import_module
import sys
import os
import json
import threading
import builtins
from canis.runtime import io

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

def initialize(cmd):
	path = cmd.get("rtpath")
	if path:
		def _cvt(name):
			return [_cygtodos(p) for p in path.get(name, [])]
		sys.path =  _cvt("major") + sys.path + _cvt("minor")
	path = cmd.get("path")
	if path:
		sys.path.insert(0, _cygtodos(path))

	init = cmd.get("init")
	if init:
		for src in init:
			lst = src.get("fromlist")
			try:
				imp = __import__(src["name"], fromlist=lst)
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
						p(param)

if __name__ == "__main__":
	def log(p):
		def wrap(*args,**kwargs):
			if not "file" in kwargs:
				kwargs["file"] = sys.stderr
			return p(*args,**kwargs)
		return wrap

	builtins.print = log(print)

	old = sys.stderr
	if sys.platform == "win32":
		from ctypes import windll, Structure, wintypes, byref
		stderr_handle = windll.kernel32.GetStdHandle(-12)
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
			GetConsoleScreenBufferInfo(stderr_handle, byref(csbi))
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
					SetConsoleTextAttribute(stderr_handle, code)
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

		def write(self,s):
			if s:
				last = s[len(s) - 1]

		#		for log in log_edit:
		#			s = log_edit(s,last)
				if s[0] == '{':
					try:
						payload = json.loads(s)
						e = payload.get("exception")
						if e:
							print( "\033[33m" +  bytes(e, "utf-8").decode("unicode_escape") )
							payload["exception"] = "listed"
							s = json.dumps(payload)
							if last == '\n':
								s += last
					except:
						pass
			else:
				last = ''
			self.lock.acquire();
			if self.new_line:
				old.write( _color("magenta") + str(os.getpid()) + _color("reset") + " " )
				self.new_line = False
			old.write( s )
			if last == '\n':
				self.new_line = True
			self.lock.release();

	sys.stderr = StdErr()

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

	callback = None
	if len(sys.argv) > 1:
		i = 1
		if sys.argv[1] != '.':
			cwd = os.getcwd()
			path, name = _module_info(sys.argv[1])
			sys.path.insert(0, path)
			callback = import_module(name)
			i += 1
		sys.argv = sys.argv[i:]

	def _notify(action):
		if callback is not None and hasattr(callback,action):
			f = getattr(callback,action)
			if callable(f):
				f()

	def _exception(e):
		traceback.print_exc()
		io.send({
			"action": "result",
			"err": str(e)
		})

	_notify("before_loop")
	while True:
		cmd = io.recv()
		action = cmd["action"]
		if action == "invoke":
			_notify("before_lambda")
			initialize(cmd)
			path, name = _module_info(cmd["src"])
#			sys.path.append('/home/dan.park/opt/pycharm-2020.3.3/plugins/python/helpers/pycharm')
			if path:
				i = 0
				while path.startswith("../", i):
					i += 3

				if i > 0:
					relpath = path[:i]
					if relpath not in sys.path:
						sys.path.append(relpath)
					path = path[i:]
				l = import_module(
					"." + name, path.replace("/", "."))
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
			handler = getattr(
				l,handler if handler else "lambda_handler", None)
			if handler:
				r = handler(cmd.get("ev", {}), ctx)
				io.send({
					"action": "result",
					"err": None,
					"data": r
				})
			else:
				altered = cmd.get("altered")
				if altered:
					a = import_module(
						altered["name"], altered.get("package"))
					handler = altered.get("handler")
					io.send({
						"action": "result",
						"err": None,
						"data": getattr(a, handler if handler else "handler")(l)
					})
					pass
				else:
					_exception(e)
			_notify("after_lambda")

			# wait all threads terminate, like sys.exit
			# TODO not compatible to AWS lambda written in python
			mt = threading.currentThread()
			for t in threading.enumerate():
				if t != mt and t.daemon is not True:
					t.join()
			io.send({"action": "reuse"})
		elif action == "exit":
			break
	_notify("after_loop")
