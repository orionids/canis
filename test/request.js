// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2020, adaptiveflow
// Distributed under ISC License

"use strict";
const request = require( "canis/request" );
const server = require( "canis/server" );
const object = require( "canis/object" );

const response = require( "./response" );

const api = object.load( __dirname + "/testapi" );
const tc = object.load( __dirname + "/tc1" );

var cwd = process.cwd();


request.iterate( "local", undefined, function(i,n) {
	if ( i < n ) console.log( i + "/", n );
	else console.log( "Done" );
}, server, api, cwd + "/canis/test", tc, response,
{
	fork: {
		runtime: {
			"python" : {
				"ext": "py",
			}
		}
	}
} );
