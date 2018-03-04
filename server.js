// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

'use strict'

exports.symbol = function ( s, symbol ) {
	function onDemandSymbol( sl, s ) {
		var r = sl[s];
		if ( r ) return r;
		r = sl['?'];
		if ( r instanceof Function ) {
			var ctx = sl['??'];
			return r( ctx? ctx : sl, s );
		}
		return undefined;
	}

	var resolved;
	if ( Array.isArray(symbol) ) {
		for ( var l = 0; l < symbol.length; l++ ) {
			var sl = symbol[l];
			if ( sl ) {
				resolved = onDemandSymbol( sl, s );
				if ( resolved ) return resolved;
			}
		}
		return undefined;
	}
	if ( symbol ) return onDemandSymbol( symbol, s );
	return undefined;
}

exports.resolve = function( s, symbol, ctx ) {
	var i;
	var delim;
	function replace( resolved, end ) {
		s = s.substring( 0, i ) + resolved +
			s.substring( end + delim.close.length );
	}
	for (;;) {
		if ( ctx ) {
			i = ctx.i;
			delim = ctx.delim;
			if ( delim !== undefined ) break;
		} else {
			ctx = {};
			i = 0;
		}
		ctx.delim = delim = {
			open: "[", close: "]", escape: "\\",
		}
		break;
	}

	if ( ctx.resolved !== undefined ) {
		replace( ctx.resolved, ctx.end );
	}

	if ( s === undefined ) return "";
	while ( ( i = s.indexOf( delim.open, i ) ) >= 0 ) {
		var prev = i - 1;
		var next = i + delim.open.length;
		if ( s.charAt(prev) === delim.escape ) {
			s = s.substring( 0, prev ) + s.substring( i );
		} else {
			var end = s.indexOf( delim.close, next );
			if ( end < 0 ) return null;
			var sym = s.substring( next, end );
			var resolved = exports.symbol( sym, symbol );
			if ( resolved === undefined ) {
				ctx.i = i;
				ctx.end = end;
				ctx.s = s;
				ctx.symbol = sym;
				ctx.resolved = undefined;
				return undefined;
			}
			replace( resolved, end );
		}
	}
	return s;
}

exports.stage = function ( config, url, ctx ) {
	var stage;
	for (;;) {
		if ( config.stage !== undefined ) {
			// ignore preceding path separator to find stage
			// TODO: need to check the first char is '/' ?
			ctx.i = 1;
			stage = match ( config.stage, url, ctx );
			if ( stage !== undefined ) {
				var apikey = stage.apiKey;
				if ( apikey !== undefined ) {
					ctx.apiKey = apikey;
					break;
				}
			}
		} else {
			ctx.i = 0;
			stage = null;
		}
		ctx.apiKey = config.apiKey;
		break;
	}
	return stage;
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
invoke(context,api,basepath,request,response) {
	// match API
	const url = request.url;
	var ctx = {};
	var a;
	var ev = {}

	var config = api.configuration;
	if ( config === undefined ) config = {};
	if ( exports.stage( config, url, ctx ) === undefined ) {
		console.log( "Unknown stage " + ctx.part ); // XXX
		return;
	}

	var requestContext = { stage : ctx.part, resourcePath : url.substring( ctx.i ) };
	var pathParameters;

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
						var name = prop.substring( 2, prop.length - 1  );
						// automatically transfer path parameter without mapping template
						if ( pathParameters === undefined )
							pathParameters = {};
						pathParameters[name] = ctx.part.substring( 1 );
						// add alias to avoid loop next time
						a = api[prop];
						api["?"] = {
							name: name,
							child: a
						}
						break;
					}
				}
				if ( a === undefined ) {
					api["?"] = null;
					break;
				}
			} else {
				ev[a.name] = ctx.part.substring( 1 );
				a = a.child;
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
				if ( ctx.apiKey !== undefined ) {
					if ( request.headers['x-api-key'] != ctx.apiKey ) {
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
					var lpi = m.lambdaProxyIntegration;
					if ( lpi === undefined ) lpi = config.lambdaProxyIntegration;
					var lpii = m.lambdaProxyIntegrationInput;
					if ( lpii === undefined ) lpii = config.lambdaProxyIntegrationInput;
					if ( lpi || lpii ) {
						ev.body = str;
						ev.requestContext = requestContext;
						ev.pathParameters = pathParameters;
					} else {
						try {
							ev.body = JSON.parse(str);
						} catch ( e ) {
//XXX
						}
						Object.assign( ev, pathParameters );
						ev.stage = requestContext.stage;
						ev.path = requestContext.resourcePath;
					}
					ev.headers = request.headers;
					l.handler ( ev, context, function(xxx,result) {
						var type;
						var stat;
						if ( lpi ) {
							stat = result.statusCode;
							result = result.body;
							// XXX case when result has headers
						} else {
							stat = 200;
						}
						if ( typeof result === 'object' ) {
							result = JSON.stringify( result, undefined, 2 );
							type = 'application/json';
						} else if ( m.header === undefined ||
							(type = m.header["Content-Type"]) === undefined ) {
							type = "text/plain";
						}
if ( xxx ) { // XXX more test is needed for exception case
	console.log( xxx );
} else {
						response.writeHead(stat, {'Content-Type' : type });
						response.write( result );
						response.end();
}
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

exports.run = function(context,api,basepath,module) {
	if ( api ) {
		function dispatch( request, response ) {
			invoke( context, api, basepath, request, response );
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
exports.main = function(context,name,run) {
	const cwd = process.cwd()
	const file = cwd + "/" + name;
	if ( run == undefined ) run = exports.run;
	try {
		var api = exports.load( file );
		if ( api === undefined ) return undefined;
		run( context, api, cwd, null );
		return 0;
	} catch ( e ) {
		if ( e.code === "MODULE_NOT_FOUND" ) run( context, null, cwd, null );
		else {
		//	require( file ); // raise exception again to know datails
console.log( e ); // resolve this XXX not to use console.log : above doesn't work correctly
		}
	}
	return 0;
}

if ( exports.main( "api" ) === undefined )
	console.log( "No body in api.js" );
