// vim: ts=4 sw=4 noet :

var crypto = require("crypto")
var string = require("canis/string");
var memutil = require("canis/memutil");
var base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function
hotp(key, counter, digits, digest)
{
	if (!key) return null;
	var n = 8 - key.length;
	key = key.toUpperCase() + '='.repeat(
		n - Math.floor(n / 8) * 8)

	var buf = Buffer.alloc(memutil.memDestBufferSize(
		8, 5, key.length));
	memutil.memConvert( buf, key, key.length, null,
		base32Chars, 8, 5, memutil.MEM_DESTINATION);

	var b = Buffer.alloc(8);
	b.writeUInt32BE(counter, 4); // XXX

	var hmac = crypto.createHmac(digest, buf);
	hmac.update(b);
	var mac = hmac.digest();
	var num = mac.readUInt32BE(mac[mac.length - 1] & 0x0f)

	num = (num > 0x80000000? num -= 0x80000000 : num).toString().substr(-digits);
	return num.padStart(digits,'0');
}

exports.totp = function(key, time_step, digits, digest)
{
	var sec = Date.now() / 1000
	var counter = (sec / time_step) | 0;
	var code = hotp(key, counter, digits, digest)
	return code? {
		time: sec - counter * time_step,
		step: time_step,
		code: code
	} : null;
}

exports.google = function(key)
{
	return exports.totp(key, 30, 6, "sha1");
}
