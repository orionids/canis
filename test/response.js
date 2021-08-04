// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

'use strict'
var object = require( "canis/object" )

var htmlutil = require("canis/htmlutil")

exports.testCase;
var headers

function
format(s)
{
    if (process.env.OUTPUT_FORMAT == "html")
        return htmlutil.json(s);
    return s;
}

exports.writeHead = function (s,h) {
	headers = h;
	console.log( "----- RESPONSE (status " +
		s + ")-----", format(JSON.stringify(h,null,3)) );
}

function
getvar(name)
{
	var value = process.env[name];
	if ( value === undefined ) {
		var tc = exports.testCase;
		if ( tc ) {
			var resolved = tc.resolved;
			if ( resolved )
				return resolved[name];
		}
	}
	return value;
}

exports.write = function ( result ) {
	function next() {
		var nextTC = tc.next;
		var run = tc.run;
		if ( nextTC && run ) {
				// update TC
				exports.testCase = nextTC;
				// propagate executor and resolved symbols
				nextTC.run = run;
				nextTC.resolved = tc.resolved;
				run( nextTC );
		}
	}
	var r;
	var tc = exports.testCase;
    var tcres = tc.result;
	if (result) {
		r = result.charAt(result.search(/\S|$/)) == '{' ?
			JSON.parse(result) : result;
        // tc.response function can edit response
		var json = tc && tc.response? tc.response(r) : r;
		if (json) {
			console.log(format(JSON.stringify(json, null, 3)));
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
				resolved[a] = object.attribute(r, s[a]);
			}
		}
		if (tcres) {
			tc.getvar = getvar;
			tcres( {headers:headers, body:r}, function(r) {
				console.log( tc.method, tc.url, ": " + (r? "success" : "FAIL") );
				next();
			});
		} else {
			next();
		}
	}
}

exports.end = function () {
}
