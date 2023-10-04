// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

'use strict'
var object = require("canis/object");
var context = require("canis/context");
var request = require("canis/request");
var syntax = require("canis/syntax");
var mime = require("canis/mime");
//var htmlutil = require("canis/htmlutil");

var headers;
var contentType;
exports.payloadOnly = false;


exports.writeHead = function (s,h) {
	headers = h;
	if (!exports.payloadOnly) {
		if (h) {
			contentType = h['Content-Type'];
			h = syntax.highlight(JSON.stringify(h,null,3));
		} else {
			h = "No header";
		}

		request.evaluate(context.testCase, s);
		console.log( "--- RESPONSE(status " + s + ")---", h);
	}
}

function
getvar(name)
{
	var value = process.env[name];
	if (value === undefined) {
		var tc = context.testCase;
		if (tc) {
			var resolved = tc.resolved;
			if (resolved)
				return resolved[name];
		}
	}
	return value;
}

//var validator = require("jsonschema").Validator;

exports.write = function (result) {
	function next() {
		var nextTC = tc.next;
		var run = tc.run;
		if (nextTC && run) {
				// update TC
				context.testCase = nextTC;
				// propagate executor and resolved symbols
				nextTC.run = run;
				nextTC.resolved = tc.resolved;
				run(nextTC);
		}
	}
	var r;
	var tc = context.testCase;
    var tcres = tc.result;
	if (result) {
		var resstr = result.toString();
		switch (resstr.charAt(resstr.search(/\S|$/))) {
			case '{':
			case '[':
			r = JSON.parse(resstr);
			break;
			default:
			r = result;
		}
        // tc.response function can edit response
		var json = tc && tc.response? tc.response(r) : r;
		if (json) {
			for (var e in mime.extension) {
				var type = mime.extension[e];
				var text;
				if (typeof type === "object") {
					type = type.type;
					text = type.text;
				} else {
					text = false;
				}
				if (contentType && contentType.includes(type)) {
					if (type.startsWith("text/") || text)
						json = json.toString();
					break;
				}
			}
			json = JSON.stringify(json, null, 3);
			console.log(syntax.highlight(json));
			if (!exports.payloadOnly)
				console.log( request.evaluate(
					context.testCase, null, json)?
					"\x1b[92mPass\x1b[0m":
					"\x1b[91mFail\x1b[0m");
		} else {
			console.log("Error in response")
			postproc = undefined;
		}
	} else {
		r = {};
	}
	if (tc !== undefined) {
		var s = tc.symbol;
		if (s) {
			var resolved = tc.resolved;
			if (resolved === undefined)
				resolved = tc.resolved = {};
				for (var a in s) {
					try {
						resolved[a] = object.attribute(r, s[a]);
					} catch (e) {
					}
				}
		}
		if (tcres) {
			tc.getvar = getvar;
			tcres( {headers:headers, body:r}, function(r) {
				console.log(tc.method, tc.url, ": " + (r? "success" : "FAIL"));
				next();
			});
		} else {
			next();
		}
	}
}

exports.end = function () {
}
