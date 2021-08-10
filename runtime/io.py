# vim:ts=4 sw=4 noet filetype=freepy:
# Copyright (C) 2020, adaptiveflow
# Distributed under ISC License

import sys
import json
import decimal

_stdout = sys.stdout
sys.stdout = sys.stderr
stdin_buf = sys.stdin.buffer;


class encdec(json.JSONEncoder):
    def default(self, o):
        return float(o) if isinstance(o, decimal.Decimal)\
            else super(encdec, self).default(o)


def send(e, b=None):
    res = e if isinstance(e, str) else json.dumps(e, separators=(',', ':'), cls=encdec)
    reslen = len(res)
    _stdout.buffer.write(
        (4 + reslen).to_bytes(4, byteorder="big"))
#    _stdout.buffer.write(
#        reslen.to_bytes(2, byteorder="big"))
    _stdout.buffer.write(bytes(res, 'UTF-8'))
    _stdout.flush()


def recv():
	return json.loads(stdin_buf.read(
		int.from_bytes(stdin_buf.read(4), byteorder='big')))

