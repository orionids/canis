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
#sys.stderr.write( os.environ['PYTHONPATH'] + "---------\n" )
#from canis.runtime import call 

def log(p):
	def wrap(*args,**kwargs):
		if not "file" in kwargs:
			kwargs["file"] = sys.stderr
		return p(*args,**kwargs)
	
	return wrap

builtins.print = log(print)

old = sys.stderr
log_edit = []
class StdErr:
	def __init__(self):
		self.new_line = True
		self.lock = threading.Lock()

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
			old.write( "\033[95m" + str(os.getpid()) + "\033[97m " )
			self.new_line = False
		old.write( s )
		if last == '\n':
			self.new_line = True
		self.lock.release();

sys.stderr = StdErr()

sys.path.insert( 0,"." )
#dir, file = os.path.split( sys.argv[1] )
#os.chdir( dir );
#__import__( "hello" )

#def invoke( cmd ) :
	

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
	cwd = os.getcwd()
	path, name = _module_info( sys.argv[1] )
	os.chdir(path)
	callback = import_module( name )

def _notify(action):
	if callback is not None and hasattr(callback,action):
		f = getattr(callback,action)
		if callable(f):
			f()

def _path(cmd):
	path = cmd.get("path")
	if path:
		os.chdir(path)

_notify( "before_loop" )
while True:
	cmd = io.recv()
	action = cmd["action"]
	if action == "invoke":
		_notify( "before_lambda" )
		_path(cmd)
		path, name = _module_info( cmd["src"] )
		i = 0
		while path.startswith( "../",i):
			i += 3

		if i > 0:			
			relpath = path[:i]
			if relpath not in sys.path:
				sys.path.append( relpath )
			path = path[i:]
		l = import_module(
			"." + name, path.replace("/",".") )
		ctx = _Context()
		ctx.__dict__ = cmd["ctx"]
		try:
			handler = cmd.get("handler")
			r = getattr(l,handler if handler else
					"lambda_handler")( cmd.get("ev",{}), ctx )
			io.send({ "action": "result", "err": None, "data": r })
		except Exception as e:
			traceback.print_exc()
			io.send({"action":"result","err": str(e) })
		_notify( "after_lambda" )

		# wait all threads terminate, like sys.exit
		mt = threading.currentThread()
		for t in threading.enumerate():
			if t != mt and t.daemon is not True:
				t.join()

		io.send( { "action": "reuse" } )
	elif action == "init":
		_path(cmd)
		src = cmd["src"]
		lst = src.get("fromlist")
		try:
			imp = __import__( src["name"], fromlist=lst )
			log = src.get("log")
			for l in lst:
				i = getattr(imp,l)
				log = getattr(i,log if isinstance(log,str) else "log",None )
				if log:
					log_edit.append(log)
		except Exception as e:
			print( str(e) + " : ", src, lst )
		io.send({"action":"result"})
	elif action == "exit":
		break
_notify( "after_loop" )
