// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

"use strict";
var fs = require( "fs" );
var path = require( "path" );
var string = require( "canis/string" );
var object = require( "canis/object" );

process.on( 'uncaughtException', function (err,origin) {
	console.log( err );
	console.log( origin );
} );

exports.stage = function ( config, url, ctx ) {
	var stage;
	for (;;) {
		var i = ctx.i;
		if ( i === undefined ) i = 0;
		if ( config.stage !== undefined ) {
			// ignore preceding path separator to find stage
			if ( url.charAt(ctx.i) == '/' ) ctx.i = i + 1;
			stage = match ( config.stage, url, ctx );
			if ( stage !== undefined ) {
				var apikey = stage.apiKey;
				if ( apikey !== undefined ) {
					ctx.apiKey = apikey;
					break;
				}
			}
		} else {
			ctx.i = i;
			stage = null;
		}
		ctx.apiKey = config.apiKey;
		break;
	}
	return stage;
};

// ctx : { i(in out), part(out) }
function
match( api, url, ctx ) {
	var start = ctx.i;
	var i = url.indexOf( "/", start + 1 );
	ctx.i = i;
	ctx.prev = start;
	ctx.part = url.substring
		( start, i > 0 ? i : undefined );
	// include api == null or api === undefined
	if ( api == undefined ) return null;
	return api[ctx.part];
}

function
resource( m, p, response )
{
	p = path.normalize( p );
	if ( p.charAt(0) == "." ) {
		console.log( "Suspicious request using relative path :", p );
	} else {
		p = m.path + p;
		if ( m.base ) {
			var base = process.env[m.base];
			if ( base )
			p = base + "/" + p;
		}
console.log( p );

		fs.readFile( p, function(err,data) {
			if ( err ) {
				console.log( err );
			} else {
				var type = "text/html";
				var index = p.lastIndexOf(".");
				if ( index > 0 ) {
					switch( p.substring( index + 1 ) ) {
						case "jpg" : case "jpeg":
						type = "image/jpeg";
						break;
						case "png" :
						type = "image/png";
						break;
						case "gif" :
						type = "image/gif";
						break;
					}
				}
				response.writeHead(200, {
					'Content-Type' : type
					/*"application/octet-stream"*/ });
				response.write( data );
				response.end();
			}
		} );
	}
}

function
invoke(api,basepath,request,response,param)
{
	var url = request.url;
	if ( !url ) return;
	var ctx = {};
	var a;
	var ev = {};

	if ( api.apiSet ) {
		ctx.i = 1;
		api = match( api, url, ctx );
		if ( api === undefined ) {
			console.log( "Unknown API set", ctx.part );
			return;
		}
	}

	var config = api.configuration;
	if ( config === undefined ) config = {};
	if ( exports.stage( config, url, ctx ) === undefined ) {
		console.log( "Unknown stage", ctx.part ); // XXX
		return;
	}

	var queryParam;
	/* don't use lastIndexOf to guarantee url doesn't
	 contain '?' */
	var queryParamIndex = url.indexOf('?');
	if ( queryParamIndex > 0 ) {
		queryParam = {}; // AWS supplies null object if query string param is absent
		// XXX duplicated in ueParameter
		var p = url.substring( queryParamIndex + 1 ).split('&');
		for ( var i = 0; i < p.length; i++ ) {
			var v = p[i].split('=');
			if ( v.length > 1 ) queryParam[v[0]] = v[1];
		}
		url = url.substring( 0, queryParamIndex );
	}

	var requestContext = {
		stage : ctx.part,
		resourcePath : url.substring( ctx.i ),
		httpMethod: request.method
	};
	var pathParameters; // pathParameter is undefined if no path parameters in AWS
	function addPathParameter( name ) {
		if ( pathParameters === undefined )
			pathParameters = {};
		// automatically transfer path parameter without mapping template
		pathParameters[name] = ctx.part.substring( 1 );
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
						var name = prop.substring( 2, prop.length - 1  );
						addPathParameter( name );
						// add alias to avoid loop next time
						a = api[prop];
						api["?"] = {
							name: name,
							child: a
						};
						break;
					}
				}
				if ( a === undefined ) {
					api["?"] = null;
					break;
				}
			} else {
				addPathParameter( a.name );
				a = a.child;
			}
		}
		if ( ctx.i < 0 ) break;
		api = a;
	}
	var m;
	if ( a !== undefined ) {
		m = a[request.method];
		if ( m !== undefined ) {
			if ( m.apiKeyRequired == true ||
			  ( m.apiKeyRequired != false && config.apiKeyRequired == true ) ) {
				if ( ctx.apiKey !== undefined ) {
					if ( request.headers['x-api-key'] != ctx.apiKey ) {
						console.log( "API key mismatch", request.headers['x-api-key'], ctx.apiKey );
						return;
					}
				}
			}
			try {
				var lambda = m.lambda;
console.log( lambda );
				var l = require( basepath ?
					basepath + "/" + lambda : lambda  );
				var str = '';
				request.on('data', function(d) { str += d; } );
				request.on('end', function() {
					var lpi = m.lambdaProxyIntegration;
					if ( lpi === undefined ) lpi = config.lambdaProxyIntegration;
					var lpii = m.lambdaProxyIntegrationInput;
					if ( lpii === undefined ) lpii = config.lambdaProxyIntegrationInput;
					if ( lpi || lpii ) {
						ev.body = str;
						ev.queryStringParameters = queryParam;
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
					var ctx;
					do {
						var fn = m.lambdaName;
						if ( !fn ) {
							fn = lambda.substring
							(lambda.lastIndexOf("/") + 1);
						}
						if ( param ) {
							ctx = param.context;
							if ( ctx ) {
								ctx.functionName = fn;
								break;
							}
						}
						ctx = {
							functionName: fn
						};
					} while( 0 );
					l.handler ( ev, ctx,
					function(xxx,result) {
						var type;
						var stat;
						var hdr;
						if ( lpi ) {
							stat = result.statusCode;
							hdr = result.headers;
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
						response.writeHead(stat, hdr? hdr : {
							'Content-Type' : type
						});
						response.write( result );
						response.end();
}
					} );
				} );
				request.on('error', function(e) {
					console.log( e ); // XXX do response here
				});
				return 0;
			} catch ( e ) {
				console.log( e );
			}
		} else {
			console.log( "Unknown method " + request.method );
		}
	} else {
		a = api["/"];
		if ( a === undefined ) a = api;
		m = a[request.method];
		if ( m && m.path ) {
			resource( m, url.substring( ctx.prev ),
				response );
		} else {
			console.log( "Unknown API " + request.url );
		}
	}
}
exports.match = match;
exports.invoke = invoke;

exports.run = function(apiset,basepath,param) {
	function dispatch( request, response ) {
		invoke( apiset, basepath, request, response, param );
	}

	if ( apiset ) {
		const http = require( "http" );

		var listener = dispatch;
	/*
	var express = require( 'express' );
	const app = express();
	app.all('*', dispatch );
	listener = app;
	*/	// XXX testing now
		var port;
		var client;
		do {
			if ( param ) {
				client = param.client;
				port = param.port;
				if ( port ) break;
			}
			port = 3000;
		} while ( 0 );

		var server = http.createServer( listener ).listen( port );

		if ( client ) {
			server.client = {};
			server.on( "connection", function(socket) {
console.log( "New client", socket.remoteAddress );
				string.unique( function( id ) {
					socket.id = id;
					server.client[id] = socket;
					socket.on( "close", function() {
						delete server.client[id];
					});
				} );
			} );

		}

		return server;
	}
};

exports.close = function( server ) {
	if ( typeof server === "object" ) {
		server.close();
		var client = server.client;
		for ( var c in client ) {
			if ( client.hasOwnProperty(c) )
				client[c].destroy();
		}
	}
};

// return 0 if no problem
// -1 if module not found
// undefined if no api body
// param :
//   run
//   interactive
//   module : external module
//   context : 2nd param of handler

exports.main = function(apidef,param)
{
	var run;
	if ( typeof param === "function" ) {
		run = param;
	} else if ( param ) {
		run = param.run;

		if ( param.parse ) {
			var readline = require( "readline" );
			var rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
			(function interactive() {
				var p = param.prompt;
				rl.question(p? p : "> ", function (input) {
					var state;
					try {
						param.parse(input,function(pause) {
							if ( pause === false )
								interactive();
							else if ( !pause ) {
								rl.close();
								var fin = param.finalize;
								if ( fin ) fin();
							}
							state = true;
						});
					} catch ( e ) {
						console.log( e );
					}
					if ( state === undefined )
						interactive();
				} );
			} )();
		}
	}
	if ( !run ) run = exports.run;

	function getAPI( cwd, name ) {
		try {
			return object.load(cwd + "/" + name );
		} catch ( e ) {
			if ( e.code === "MODULE_NOT_FOUND" ) {
				// so user supplied run function will have
				// change to be run
				return null;
			} else {
			//	require( file ); // raise exception again to know datails
console.log( e ); // resolve this XXX not to use console.log : above doesn't work correctly
			}
		}
		return undefined;
	}

	var apiset;
	const cwd = process.cwd();

	if ( Array.isArray(apidef) ) {
		apiset = { apiSet: true };
		for ( var i = 0; i < apidef.length; i++ ) {
			var alias = undefined;
			var name = apidef[i];
			if ( typeof name === "object" ) {
				alias = name.alias;
				name = name.name;
			}
			if ( alias === undefined ) {
				var end = name.lastIndexOf(".");
				if ( end < 0 ) end = undefined;
				alias = name.substring
					( name.lastIndexOf( "/" ) + 1, end );
			}
			var a = getAPI(cwd,name);
			if ( a === undefined ) return undefined;
			if ( a === null ) {
				apiset = null;
				break;
			}
			apiset[alias] =	a;
		}
	} else {
		apiset = getAPI(cwd,apidef);
	}

	if ( apiset === undefined ) return undefined;
	var r = run( apiset, cwd, param );
	if ( r !== undefined ) return r;
	// so below default api run will do nothing
	return false;
};

if ( exports.main( "api" ) === undefined )
	console.log( "No body in api.js" );
