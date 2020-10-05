// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

'use strict'
var object = require( "canis/object" )

exports.testCase;
var headers

exports.writeHead = function (s,h) {
	headers = h;
	console.log( "----- RESPONSE  (status " +
		s + ")-----", JSON.stringify(h,null,3) );
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
	if ( result ) {
		r = result.charAt(result.search(/\S|$/)) == '{' ?
			JSON.parse(result) : result;
		console.log( JSON.stringify( r, null, 2 ) );
	} else {
		r = {};
	}
	var tc = exports.testCase;
	if ( tc !== undefined ) {
		var s = tc.symbol;
		if ( s ) {
			var resolved = tc.resolved;
			if ( resolved === undefined )
				resolved = tc.resolved = {};
			for ( var a in s ) {
				resolved[a] = object.attribute(r,s[a]);
			}
		}
		if ( tc.result ) {
			tc.getvar = getvar;
			tc.result( {headers:headers,body:r}, function(r) {
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
