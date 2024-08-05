// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

"use strict";

if (String.prototype.padStart === undefined)
    String.prototype.padStart = function(len, c) {
        return this.length >= len ? this :
            c.repeat(len - this.length) + this;
    };

if (String.prototype.padEnd === undefined)
    String.prototype.padEnd = function(len, c) {
        return this.length >= len ? this :
            this + c.repeat(len - this.length);
    };

// explicit???
exports.symbol = function (s, symbol, delim)
{
	function onDemandSymbol(sl, s) {
		// BSD series trim key which contains equal sign
		if (sl !== process.env || !s.includes("=")) {
			var r = sl[s];
			switch (typeof r) {
				case "string": case "object": return r;
			}
		}
		r = sl['?'];
		if (r instanceof Function) {
			var ctx = sl['??'];
			return r(ctx? ctx : sl, s, symbol);
		}
		return undefined;
	}

	function resolvedSymbol(s) {
		if (s && typeof s === "string") {
			if (s.startsWith("json:")) return JSON.parse(s.slice(5));
			if (prefix) s = prefix + s;
			if (suffix) s = s + suffix;
		}
		return s;
	}

	var value, l = -1;
	while ((l = s.indexOf(delim.value, l + 1)) >= 0) {
		if (l === 0 || s.charAt(l - 1) != delim.escape) {
			value = s.substring(l + 1);
			s = s.substring(0, l);
			break;
		}
	}

	l = s.search(/[A-Za-z0-9_]/);
	var prefix, suffix;
	if (l > 0) {
		prefix = s.substring(0, l);
		s = s.slice(l);
	}

	l = s.search(/[^A-Za-z0-9_]/);
	if (l > 0) {
		suffix = s.substring(l);
		s = s.slice(0, l);
	}

	var resolved;
	if (Array.isArray(symbol)) {
		for (l = 0; l < symbol.length; l++) {
			var sl = symbol[l];
			if (sl) {
				resolved = onDemandSymbol(sl, s);
				// exclude both null and undefined
				if (resolved != null) return resolvedSymbol(resolved);
			}
		}
	} else if (symbol) {
		resolved = onDemandSymbol(symbol, s);
	} else {
		resolved = process.env[s];
	}
	return resolvedSymbol(resolved == null? value : resolved);
};

exports.resolve = function(s, symbol, ctx)
{
	var i;
	var delim;
	function replace(resolved, end) {
		s = s.substring(0, i) + resolved +
			s.substring(end + delim.close.length);
	}
	for (;;) {
		if (ctx) {
			i = ctx.i;
			delim = ctx.delim;
			if (delim) break;
		} else {
			ctx = {};
			i = 0;
		}
		ctx.delim = delim = {
			open: "[", close: "]", escape: "\\", value: ":"
		};
		break;
	}

	if (ctx.preproc)
		s = ctx.preproc(s, ctx);

	if (ctx.resolved !== undefined) {
		replace(ctx.resolved, ctx.end);
	}

	if (s === undefined) return "";
	if (s === null) return null;
	while ((i = s.indexOf(delim.open, i)) >= 0) {
		var prev = i - delim.escape.length;
		var next = i + delim.open.length;
		if (s.substring(prev, i) === delim.escape) {
			s = s.substring(0, prev) + s.substring(i);
		} else {
			prev = next;
			while (true) {
				var end = s.indexOf(delim.close, prev);
				if (end < 0) return null;
				prev = end - delim.escape.length;
				if (s.substring(prev, end) !== delim.escape)
					break;
				s = s.substring(0, prev) + s.substring(end);
				prev = prev + delim.close.length;
			}
			var sym = s.substring(next, end);
			var resolved = exports.symbol(sym, symbol, delim);
			if (resolved === undefined) {
				if (ctx.loose || !isNaN(sym)) {
					replace(delim.open + sym + delim.close, end);
					i = end + 1;
				} else if (ctx.loose === null) {
					replace('', end);
				} else {
					ctx.i = i;
					ctx.end = end;
					ctx.s = s;
					ctx.symbol = sym;
					ctx.resolved = undefined;
					return undefined;
				}
			} else {
				if (typeof resolved === "object")
					return resolved;
				replace(resolved, end);
			}
		}
	}

	//XXX
	var from = 0;
	var news = '';
	while ((i = s.indexOf("\\u", i)) >= 0) {
		var prev = s.substring(from, i);
		from = i + 6;
		news += prev + String.fromCharCode(
		parseInt(s.substring(i + 2, from), 16)	) 
		i = from;
	}
	return from <= 0 ? s : news + s.substring(from);
};

exports.resolveCache = function(cache, name, symbol)
{
	var resolved = cache.__resolved;
	if (resolved === undefined)
		resolved = cache.__resolved = {};
	var s = resolved[name];
	if (s === undefined) {
		s = cache[name];
		if (s) {
			s = exports.resolve(s, symbol);
			resolved[name] = s;
			delete cache[name];
		}
	}
	return s;
};

/* XXX share prevTime bet proc? -> from redis */
//XXX restricted word???
var prevTime;
exports.unique = function(callback, current)
{
	(function wait(t) {
		setTimeout( function() {
			var now = current === undefined?
				Date.now() : current;
			if (now === prevTime) {
				wait(1);
			} else {
				prevTime = now;
				callback(now.toString(36));
			}
		}, t );
	})();
};

exports.path = function(l, path)
{
	var env;
	var s;

	if (l === undefined) return undefined;
	if (path === undefined) path = require("path");
	var delim = path.delimiter;
	var sep = path.sep;
	if (!Array.isArray(l)) l = [l];
	for (var i = 0; i < l.length; i++) {
		var li = l[i];
		if (typeof(li) !== "string") {
			env = li.name? process.env[li.name] : undefined;
			li = li.path;
			if (env)
				li = li? env + sep +
					li.replace("/", sep) : env
		}
		if (li)
			s = s? s + (li.charAt(0) == delim?
				li :  delim + li) : li;
	}
	return s && s.startsWith("/cygdrive/")?
		s.charAt(10) + ':' + s.substring(11) : s;
};

var crypto;
exports.uuid4 = function() {
	if (crypto === undefined)
		crypto = require("crypto");
	var b = crypto.randomBytes(16);
	var uuid = b.toString("hex");
	return uuid.substring(0, 8) + "-" +
		uuid.substring(8, 12) + "-4" +
		uuid.substring(12, 15) + '-' +
		(b.readUInt8(7) & 3 | 8).toString(16) +
		uuid.substring(16, 19) + "-" +
		uuid.substring(19, 31);
};

/* XXX */
exports.csv = function(s)
{
	var i = 0;
	while ((i = s.indexOf('"',i)) > 0) {
		if (i + 1 < s.length)
			s = s.substring(0,i) + '"' + s.substring(i);
		i += 2;
	}

	return s.indexOf(',') >=0 ? '"' + s + '"' : s;
};
