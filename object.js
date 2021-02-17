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



exports.attribute = function(o, a) {
	if (typeof a === 'string') a = a.split(".");
	for (var i = 0; i < a.length; i++) {
		if (o === undefined) break;
		o = o[a[i]];
	}
	return o;
};

exports.clone = function(o, r)
{
	function clone(o, r) {
		return r && r.recursive === false ?
			o : exports.clone(o, r);
	}
	if (o === null) return null;
	if (Array.isArray(o)) {
		var newa = new Array(o.length);
		for (var i = 0; i < o.length; i++) {
			var oi = o[i];
			if (oi !== undefined) {
				if ((newa[i] = clone(oi, r)) === undefined)
					return undefined;
			}
		}
		return newa;
	} else switch (typeof o) {
		case "object":
		var newo = {}; 
		for (var p in o) {
			if (o.hasOwnProperty(p)) {
				var op = o[p];
				if (op !== undefined) {
					if (r && r.ctx) r.ctx.property = p;
					if ((newo[typeof p === "string"? string.resolve(p, r.symbol, r.ctx) : p] = clone(o[p], r)) === undefined)
						return undefined;
				}
			}
		}
		return newo;
		case "string":
		if (r) return string.resolve(o, r.symbol, r.ctx);
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
