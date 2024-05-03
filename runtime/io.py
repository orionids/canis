# vim:ts=4 sw=4 noet filetype=freepy:
# Copyright (C) 2020, adaptiveflow
# Distributed under ISC License

import sys
import os
import json
import decimal
import socket # not always needed

status_line="[[[STATUS]]]"
process_root = None
_process_client = sys.stderr
_process_host = ("127.0.0.1", 31000)
_lambda_client = None
_pid_packet = {
	"action": "pid",
	"pid": (os.getppid if sys.platform == "win32" else os.getpid)()
}

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

def recv_socket(client, addr):
	while True:
		try:
			r = _deserialize(client.recv)
			return r;
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
		return recv_socket(_lambda_client, addr)
	else:
		send(cmd)
		return recv()  # TODO: if lambda dies this causes deadlock

def send(e):
	if isinstance(_process_client, socket.socket):
		send_socket(_process_client, _process_host, e)
	else:
		l, p = _serialize(e)
		_process_client.buffer.write(l)
		_process_client.buffer.write(p)
		_process_client.flush()


def recv():
	if isinstance(_process_client, socket.socket):
		return recv_socket(_process_client, _process_host)
	return _deserialize(sys.stdin.buffer.read)


def _new_socket():
	return socket.socket(socket.AF_INET, socket.SOCK_STREAM)

def initialize(addr = None):
	if addr:
		global recv, send, _process_client
		_process_client = _new_socket()
		if addr != "default" and addr != True:
			_process_host = addr
		_process_client.connect(_process_host)
	send(_pid_packet)

if tmpcred := os.environ.get("AWS_TEMPORARY_CREDENTIAL"):
	def get_credential(refresh=True):
		send({
			"action": "credential",
			"refresh": refresh
		})
		return dict(zip(["access_key", "secret_key", "token", "expiry_time"], recv()["body"]))

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
