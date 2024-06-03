# vim:ts=4 sw=4 noet filetype=freepy:
# Copyright (C) 2020, adaptiveflow
# Distributed under ISC License

import sys
import os
import json
import decimal
from select import select
import socket # not always needed
import threading # not always needed

status_line="[[[STATUS]]]"
process_root = None
process_control = None
process_command = []
_process_client = sys.stdout
_process_host = ("127.0.0.1", 31000)
_lambda_client = None
_event_pipe = os.pipe()
_event_receiver = os.fdopen(_event_pipe[0], "r")
_pid_packet = {
	"action": "pid",
	"pid": (os.getppid if sys.platform == "win32" else os.getpid)()
}

class RPC:
	_waiter = threading.Semaphore(0)
	_terminator = threading.Semaphore(0)
	_lock = threading.Lock()
	_result = None

	@classmethod
	def result(cls, r):
		cls._lock.acquire()
		cls._result = r
		cls._waiter.release()
		cls._terminator.acquire()
		cls._lock.release()

	@classmethod
	def wait(cls):
		cls._waiter.acquire()
		r = cls._result
		cls._terminator.release()
		return r

class encdec(json.JSONEncoder):
	def default(self, o):
		return float(o) if isinstance(o, decimal.Decimal)\
			else super(encdec, self).default(o)

def _serialize(e):
	res = bytes(e if isinstance(e, str) else json.dumps(e, separators=(',', ':'), cls=encdec), 'UTF-8')
	reslen = len(res)
	return (4 + reslen).to_bytes(4, byteorder="big"), res

def _deserialize(read, timeout):
	def fullread(n):
		full = b''
		while True:
			p = read(n, timeout)
			if p is None:
				return None
			if len(p) == 0:
				raise Exception
			full += p
			if len(p) == n:
				return full
			n -= len(p)
	packet = fullread(4)
	if packet is None:
		return None
	return json.loads(fullread(int.from_bytes(packet, byteorder='big')))

def event(cmd):
	os.write(_event_pipe[1], bytes(json.dumps(cmd) + "\n", "UTF-8"))

def _wait(o, timeout):
	while True:
		trigger = select([o, _event_receiver], [], [], timeout)[0]
		if trigger:
			if _event_receiver not in trigger:
				return True
			for line in _event_receiver:
				print(line)
				break
		return False

def send_socket(client, addr, e):
	l, p = _serialize(e)
	while True:
		try:
			client.sendall(l + p)
		except OSError as e:
			if e.errno == 57:
				client.connect(addr)
				send_socket(client, addr, _pid_packet)
				continue
		break

def recv_socket(client, addr, timeout):
	def recv(n, timeout):
		if not _wait(client, timeout):
			return None
		return client.recv(n)

	while True:
		try:
			return _deserialize(recv, timeout)
		except OSError as e:
			if e.errno != 57:
				return None
			client.connect(addr)
			send_socket(client, addr, _pid_packet)

def invoke(name, payload, root, option, forget, addr=None):
	cmd = {
		'action': 'invoke',
		'name': name,
		'ev': payload,
		'root': root if root else process_root,
		'option': option,
		'forget': forget
	}

	if addr:
		global _lambda_client
		if _lambda_client == None:
			_lambda_client = _new_socket()
			_lambda_client.connect(addr)
			send_socket(_lambda_client, addr, _pid_packet)

		send_socket(_lambda_client, addr, cmd)
		return recv_socket(_lambda_client, addr, None)

	send(cmd)
	return RPC.wait()
#	return wait()  # TODO: if lambda dies this causes deadlock

def send(e):
	if isinstance(_process_client, socket.socket):
		send_socket(_process_client, _process_host, e)
	else:
		l, p = _serialize(e)
		_process_client.buffer.write(l)
		_process_client.buffer.write(p)
		_process_client.flush()

#sys.stdin.close()
#_stdin = os.fdopen(0, "rb")

def recv_stdin(n, timeout):
	fd = sys.stdin.fileno()
	if not _wait(fd, timeout):
		return None
	return os.read(fd, n)



	if len(sys.stdin.buffer.peek()) < n:
		if not _wait(sys.stdin, timeout):
			return None
		# reading specified size after returning select can cause blocking
		# I/O if readable size is insufficient, but those packets follows
		# internal protocol so if any input was notified it means proper
		# packet will be transferred within reasonable period:
		# To avaoid complicated buffering implementation,
		# just do this if sufficiently works

	return sys.stdin.buffer.read(n)

def recv(timeout=None):
	if isinstance(_process_client, socket.socket):
		return recv_socket(_process_client, _process_host, timeout)
	return _deserialize(recv_stdin, timeout)


def _new_socket():
	return socket.socket(socket.AF_INET, socket.SOCK_STREAM)

def initialize(addr = None):
	if addr:
		global recv, send, _process_client, _process_host
		_process_client = _new_socket()
		if addr != "default" and addr != True:
			_process_host = (addr, _process_host[1])
		_process_client.connect(_process_host)
	send(_pid_packet)

def tag(control, t = None):
	global process_control
	process_control = control
	for cmd in process_command:
		control(cmd)
	if t:
		send({
			"action": "tag",
			"tag": t,
			"pid": _pid_packet["pid"]
		})


tmpcred = os.environ.get("AWS_TEMPORARY_CREDENTIAL")
if tmpcred:
	def get_credential(refresh=True):
		send({
			"action": "credential",
			"refresh": refresh
		})
		return dict(zip(["access_key", "secret_key", "token", "expiry_time"], RPC.wait()["body"]))

	from botocore.credentials import RefreshableCredentials
	from botocore import session
	class TemporaryCredentialSession(session.Session):
		def __init__(self, *args, **kwargs):
			super().__init__(*args, **kwargs)
			self._credentials = RefreshableCredentials.create_from_metadata(
				metadata=get_credential(False),
				refresh_using=get_credential,
				method=''
			)
		def set_credentials(self, access_key, secret_key, token=None):
			# just ignore this, we have refreshable credential
			pass
	session.Session = TemporaryCredentialSession
