// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

'use strict'

exports.resolve = function( s, symbol ) {
	var i = 0;
	if ( s === undefined ) return "";
	while (  ( i = s.indexOf( "{", i ) ) >= 0 ) {
		var next = i + 1;
		if ( s.charAt(next) == '{' ) {
			s = s.substring( 0, i ) + s.substring( next );
			i = next;
		} else {
			var end = s.indexOf( "}", next );
			var sym = s.substring( next, end );
			var resolved;
			if ( Array.isArray(symbol) ) {
				for ( var l = 0; l < symbol.length; l++ ) {
					var r = symbol[l][sym];
					if ( r !== undefined ) {
						resolved = r;
						break;
					}
				}
			} else {
				resolved = symbol[sym];
			}
			if ( resolved === undefined ) return null;
			s = s.substring( 0, i ) + resolved + s.substring( end + 1 );
		}
	}
	return s;
}

// ctx : { i(in out), part(out) }
function
match( api, url, ctx ) {
	var start = ctx.i;
	var i = url.indexOf( "/", start + 1 );
	ctx.i = i;
	ctx.part = url.substring
		( start, i > 0 ? i : undefined );
	// include api == null or api === undefined
	if ( api == undefined ) return null;
	return api[ctx.part];
}

function
invoke(api,basepath,request,response) {
	// match API
	const url = request.url;
	var ctx = { i : 0 };
	var a;
	var ev = {}

	var config = api.configuration;
	var apikey;
	if ( config !== undefined && config.stage !== undefined ) {
		// ignore preceding path separator to find stage
		// TODO: need to check the first char is '/' ?
		ctx.i = 1;
		var stage = match ( config.stage, url, ctx );
		if ( stage === undefined ) {
			console.log( "Unknown stage " + ctx.part );
			return;
		}
		apikey = stage.apiKey;
		ev.path = url.substring( ctx.i );
		ev.stage = ctx.part;
	}

	for (;;) {
		a = match ( api,url, ctx );
		if ( a === undefined ) { // path parameter
			a = api["?"]; // get alias of path parameter
			if ( a === null ) {
				a = undefined;
				break;
			} else if ( a === undefined ) {
				for ( var prop in api ) {
					if ( prop.charAt(1) == '{' ) {
						a = api[prop];
						// automatically transfer path parameter without mapping template
						ev[prop.substring( 2, prop.length - 1  )] =
							ctx.part.substring( 1 );
						api["?"] = a; // add alias to avoid loop next time
						break;
					}
				}
				if ( a === undefined ) {
					api["?"] = null;
					break;
				}
			}
		}
		if ( ctx.i < 0 ) break;
		api = a;
	}
	if ( a !== undefined ) {
		var m = a[request.method];
		if ( m !== undefined ) {
			if ( m.apiKeyRequired == true ||
			  ( m.apiKeyRequired != false && config.apiKeyRequired == true ) ) {
				if ( apikey === undefined )
					apikey = config.apiKey;
				if ( apikey !== undefined ) {
					if ( request.headers['x-api-key'] != apikey ) {
						console.log( "API key mismatch" );
						return;
					}
				}
			}
			try {
				var l = require( basepath ? basepath + "/" + m.lambda : m.lambda  );
				var str = '';
				request.on('data', function(d) { str += d; } );
				request.on('end', function() {
					try {
						ev.body = JSON.parse(str);
					} catch ( e ) {
					}
					ev.headers = request.headers;
					l.handler ( ev, null, function(xxx,result) {
						var type;
						if ( typeof result === 'object' ) {
							result = JSON.stringify( result, undefined, 2 );
							type = 'application/json';
						} else if ( m.header === undefined ||
							(type = m.header["Content-Type"]) === undefined ) {
							type = "text/plain";
						}
						response.writeHead(200, {'Content-Type' : type });
						response.write( result );
						response.end();
					} );
				} );
				request.on('error', function(e) {
					console.log( e ); // XXX do response here
				});
			} catch ( e ) {
				console.log( e );
			}
		} else {
			console.log( "Unknown method " + request.method );
		}
		return 0;
	} else {
		console.log( "Unknown API " + request.url );
	}
}
exports.match = match;
exports.invoke = invoke;

exports.run = function(api,basepath,module) {
	if ( api ) {
		function dispatch( request, response ) {
			invoke( api, basepath, request, response );
		}

		const http = require( "http" );

		var listener = dispatch;
	/*
	var express = require( 'express' );
	const app = express();
	app.all('*', dispatch );
	listener = app;
	*/	// XXX testing now
		http.createServer( listener ).listen( 3000 );
	}
}

// __dirname + "/" + relpath to use relative path
// like 'require' in an arbitrary module
const path = require( "path" );
exports.load = function( file ) {
	var module = require( file );
	if ( path.extname( require.resolve( file ) ) == ".js" ) {
		module = module.body;
		if ( module === undefined ) return undefined;
	}
	return module;
}

// return 0 if no problem
// -1 if module not found
// undefined if no api body
exports.main = function(name,run) {
	const cwd = process.cwd()
	const file = cwd + "/" + name;
	if ( run == undefined ) run = this.run;
	try {
		var api = this.load( file );
		if ( api === undefined ) return undefined;
		run( api, cwd, null );
		return 0;
	} catch ( e ) {
		if ( e.code === "MODULE_NOT_FOUND" ) run( null, cwd, null );
		else require( file ); // raise exception again to know datails
	}
	return 0;
}

if ( this.main( "api" ) === undefined )
	console.log( "No body in api.js" );
