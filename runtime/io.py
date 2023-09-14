# vim:ts=4 sw=4 noet filetype=freepy:
# Copyright (C) 2020, adaptiveflow
# Distributed under ISC License

import sys
import os
import json
import decimal

_stdout = sys.stdout
#sys.stdout = sys.stderr
stdin_buf = sys.stdin.buffer;
_client = None

class encdec(json.JSONEncoder):
	def default(self, o):
		return float(o) if isinstance(o, decimal.Decimal)\
			else super(encdec, self).default(o)

def _serialize(e):
	res = bytes(e if isinstance(e, str) else json.dumps(e, separators=(',', ':'), cls=encdec), 'UTF-8')
	reslen = len(res)
	return (4 + reslen).to_bytes(4, byteorder="big"), res

def _deserialize(read):
	def fullread(n):
		full = b''
		while True:
			p = read(n)
			if len(p) == 0:
				raise Exception
			full += p
			if len(p) == n:
				return full
			n -= len(p)

	return json.loads(fullread(
		int.from_bytes(fullread(4), byteorder='big')))
	

def send_stdio(e):
	l, p = _serialize(e)
	_stdout.buffer.write(l)
	_stdout.buffer.write(p)

#	i = 0
#	total = len(p)
#	while True:
#		j = i + 8192
#		if total <= j:
#			print("\033[96m", i, "\033[0m")
#			_stdout.buffer.write(p[i:])
#			break
#		print("\033[96m", i, j, "\033[0m")
#		_stdout.buffer.write(p[i:j])
#		i = j

	_stdout.flush()


def recv_stdio():
	return _deserialize(stdin_buf.read)

def send_socket(e):
	l, p = _serialize(e)
	def mysend(msg):
		totalsent = 0
		while totalsent < len(msg):
			sent = _client.send(msg[totalsent:])
			if sent == 0:
				raise RuntimeError("socket connection broken")
			totalsent = totalsent + sent
	_client.sendall(l + p)
#	mysend(l)
#	mysend(p)
#	print(len(l) + len(p), "written")
#	import time
#	_client.sendall(l)
#	i = 0
#	total = len(p)
#	while True:
#		j = i + 4
#		if total <= j:
#			print("\033[96m", i, "\033[0m")
#			_client.sendall(p[i:])
#			break
#		print("\033[96m", i, j, "\033[0m")
#		_client.sendall(p[i:j])
#		i = j

def recv_socket():
	r = _deserialize(_client.recv)
	return r;

recv = recv_stdio
send = send_stdio

def connect(addr):
	global recv, send, _client
	if addr:
		import socket
		_client = socket.socket(
			socket.AF_INET, socket.SOCK_STREAM)
		_client.connect((addr, 31000))
		recv = recv_socket
		send = send_socket
	send({
		"action": "pid",
		"pid": (os.getppid if sys.platform == "win32"
			else os.getpid)()
	})


