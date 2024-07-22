// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

"use strict";

var string = require("canis/string");

// __dirname + "/" + relpath to use relative path
// like 'require' in an arbitrary module
const path = require("path");
exports.load = function(file, param) {
	var module = require(file);
	if (path.extname(require.resolve(file)) == ".js" ) {
		module = module.body;
		if (module === undefined) return undefined;
		if (typeof module === "function") {
			return module.apply(this, param);

		}
	}
	return module;
};



exports.attribute = function(o, a, tag, sep)
{
	if (!sep) sep = ".";
	if (typeof a === "string") a = a.split(sep);
	var pref = "";
	retry:
	for (var i = 0; i < a.length; i++) {
		if (o === undefined) break;
		pref += tag? tag + a[i] : a[i];
		var list = pref.split("[");
		for (var l = 0; l < list.length; l++) {
			var item = list[l];
			if (item.indexOf(']') > 0)
				o = o[parseInt(item)];
			else if (o.hasOwnProperty(item))
				o = o[item];
			else {
				// for example, for attribute a.b.c.d,
				// assume "a": { "b": { "c": ... or
				// "a": { "b.c": ... are possible but
				// "a.b.c": ... is not possible and
				// some mixed cased with . and [ can cause
				// potential conflicts ignored in the impl.
				if (i + 1 < a.length) {
					pref += sep;
					continue retry;
				}
				throw TypeError("NO_ATTRIBUTE");
			}
			if (o === undefined) break;
		}
		pref = "";
	}
	return o;
};

exports.conditional = function(o, a, i)
{
	var v = o[a];
	return v === undefined?
		(o[a] = i === undefined? {} : i) : v;
}


// object -> object : assign
// array -> object : unavailable
// object -> array : an item
// array -> array : insert

exports.clone = function(o, r, base)
{
	function clone(o, r, base, attr) {
		var result;
		if (attr && r.push) {
			result = r.push(attr, o);
			if (result !== undefined) return result;
		}
		result = r.recursive === false ?
			o : exports.clone(o, r, base);
		if (attr && r.pop)
			r.pop(attr);
		return result;
	}

	function include(o, perform, k, l, li) {
		if (Array.isArray(k))
			k = k[0];
		if (k !== inc) return false;
		var len;
		if (Array.isArray(l)) {
			len = l.length;
		} else {
			l = [l];
			len = 1;
		}
		while (li < len) {
			var p = l[li];
			if (typeof(p) === 'string') {
				p = string.resolve(p, r.symbol, r.ctx);
				if (p === undefined) return undefined;
				try {
					p = incload(p);
				} catch(e) {
					return undefined;
				}
			}
			p = clone(p, r);
			perform(o, p, li)
			li++;
		}
		return true;
	}
	if (o === null) return null;
	if (r === undefined) r = {};
	var incload;
	var inc = r.include;
	if (inc) {
		for(;;) {
			if (typeof(inc) === 'object') {
				incload = inc.load;
				inc = inc.keyword;
				if (inc) break;
			}
			inc = "[[INCLUDE]]";
			break;
		}
		if (incload === undefined) incload = require;
	}
	if (Array.isArray(o)) {
		var newa;
		if (base) {
			if (base.lenth < o.length)
				base.concat(new Array(o.length - base.length));
			newa = base;
			if (r.list) r.list(newa, false);
		} else {
			newa = new Array(o.length);
			if (r.list) r.list(newa, true);
		}
		for (var i = 0, newi = 0; i < o.length; i++, newi++) {
			var oi = o[i];
			if (oi !== undefined) {
				switch (include(newa, function(dst, src, li) {
					function add(s) {
						if (li > 1) {
							newa.push();
							newi++;
						}
						newa[newi] = s;
					}
					if (Array.isArray(src))
						for (var s = 0; s < src.length; s++)
							add(src[s]);
					else add(src);
					return true;
				}, oi, oi, 1)) {
					case undefined:
					if (!r.partial) return undefined;
					case true:
					continue;
				}
				if ((oi = clone(oi, r, newa[newi])) === undefined)
					return undefined;
				newa[newi] = oi;
				if (r.list) r.list(oi, newi);
			}
		}
		if (r.list) r.list(undefined, undefined);
		return newa;
	} else switch (typeof o) {
		case "object":
		var newo = base? base : {};
		for (var p in o) {
			if (o.hasOwnProperty(p)) {
				var op = o[p];
				if (op !== undefined) {
					switch (include(newo, function(dst,src) {
						if (Array.isArray(src)) return false;
						Object.assign(dst, src);
						return true;
					}, p, op, 0)) {
						case undefined:
						if (!r.partial) return undefined;
						case true:
						continue;
					}
					if (r.ctx) r.ctx.property = p;
					var resolved = typeof p === "string" && r?
						string.resolve(p, r.symbol, r.ctx) : p
					if (r.partial && !resolved) continue;
					var cloned = clone(o[p], r, newo[resolved], resolved);
					if (cloned === undefined) {
						if (r.partial) continue;
						return undefined;
					}
					if (!r.kill || cloned !== r.kill)
						newo[resolved] = cloned;
				}
			}
		}
		return newo;
		case "string":
		if (r) {
			var resolved = string.resolve(o, r.symbol, r.ctx);
			if (typeof resolved === "object")
				return exports.clone(resolved, r, base);
			return resolved;
		}
	}
	return o;
};

exports.move = function(o,attr)
{
	var tmp = {};
	for (var i = 0; i < attr.length; i++) {
		var a = attr[i];
		tmp[a] = o[a];
		delete o[a];
	}
	return tmp;
}
