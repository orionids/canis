// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

"use strict";
var fs = require( "fs" );
var path = require( "path" );
var tls = require( "tls" );
var string = require( "canis/string" );
var object = require( "canis/object" );
var invoke = require( "canis/invoke" );
var log = require( "canis/log" );

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
resource( m, stage, p, response, config, param )
{
	function result(fn, data) {
		var type = "text/html";
		var index = fn.lastIndexOf(".");
		if ( index > 0 ) {
			switch( fn.substring
				(index + 1).toLowerCase() ) {
				case "jpg" : case "jpeg":
				type = "image/jpeg";
				break;
				case "png" :
				type = "image/png";
				break;
				case "gif" :
				type = "image/gif";
				break;
				case "css" :
				type = "text/css";
				break;
				case "js":
				type = "application/js";
				break;
				case "json":
				type = "application/json";
				break;
				case "woff":
				type = "application/x-font-woff";
			}
		}
		response.writeHead(200, {
			'Content-Type' : type
			/*"application/octet-stream"*/ });
		response.write( data );
		response.end();
	}

	function index(name,next) {
		var fn = p + "/" + name;
		fs.readFile( fn, function(err,data) {
			if ( err ) {
				next();
			} else {
				result( fn, data );
			}
		} );
	}

	function notFound() {
		response.writeHead(404, {
			'Content-Type' : "text/plain"
		} );
// TODO: support not found page
		response.write( "Not found" );
		response.end();
	}

	if ( stage ) p = "/" + stage + p;
	p = m.path + p;
	var base = m.base;
	if ( base ) base = process.env[base];
	if ( !base ) base = m.basePath;
	if ( base ) p = base + "/" + p;
	p = path.normalize( p );
	if ( p.charAt(0) == "." ) {
		console.log( "Suspicious request using relative path :", p );
		notFound();
	} else if ( param.ignore && param.ignore.exec(p) ) {
		console.log( "ignored :" + p );
		notFound();
	} else {
		console.log( log.position(), "STAGE=", stage, p );
		fs.readFile( p, function(err,data) {
			if ( err ) {
//				do {
				if ( err.code == "EISDIR" ) {
					var di = config.directoryIndex;
					if ( di ) {
						if ( !Array.isArray(di) )
							di = ["index.html", "index.htm"];
						var i = 0;
						(function iter() {
							if ( i < di.length ) {
								index(di[i++],iter);
							} else {
								notFound();
							}
						})();
					} else {
						index( di, notFound );
					}
				} else {
					notFound();
				}
//				} while ( 0 );
			} else {
				result(p, data);
			}
		} );
	}
}

function
corsHeader( hdr, param, extra )
{
	if ( param.cors == undefined )
		return extra;
	var h = {
		"Access-Control-Allow-Origin": hdr.origin,
		"Access-Control-Allow-Credentials" : true,
		"Access-Control-Allow-Headers": "*" ,
		"Access-Control-Max-Age": 3600,
	};

	Object.assign( h, extra );

	return h;
}


function
options( api, hdr, response, param )
{
				// XXX config for this response
	var m = "OPTIONS";
	var k = Object.keys( api );
	for ( var i = 0; i < k.length; i++ ) {
		var a = k[i];
		var c = a.charAt(0);
		if ( c != '^' && c !=  "/" ) {
			m += "," + a;
		}
	}
	response.writeHead(200, corsHeader(hdr,param,{
		"Access-Control-Allow-Methods" : m
	}) );
	response.end();
}

exports.queryParameter = function(url) {
	var param;
	/* don't use lastIndexOf to guarantee url doesn't
	 contain '?' */
	var index = url.indexOf('?');
	if ( index > 0 ) {
		param = {}; // AWS supplies null object if query string param is absent
		// XXX duplicated in ueParameter
		var p = url.substring( index + 1 ).split('&');
		for ( var i = 0; i < p.length; i++ ) {
			var v = p[i].split('=');
			if ( v.length > 1 ) param[v[0]] = v[1];
		}
		url = url.substring( 0, index );
	}
	return { param: param, index: index, url: url };
}


function
invokeAPI(context,api,basepath,request,response,param)
{
	var url = request.url;
	if ( !url ) return;
	var ctx = {};
	var a;
	var ev = {};

	if ( !param ) param = {};

	var apiInfo;
	if ( param.apiInfo && request.headers ) {
		apiInfo = param.apiInfo(request.headers);
	}
	if ( !apiInfo ) apiInfo = {};

	if ( api.apiSet ) {
		if ( apiInfo.set ) {
			api = api[apiInfo.set];
		} else {
			ctx.i = 1;
			a = match( api, url, ctx );
			if ( a === undefined ) {
				// check there is anonymous api set
				api = api[""];
				ctx = {};
			} else {
				api = a;
			}
		}
		if ( api === undefined ) {
			console.log( "Unknown API set", ctx.part );
			return;
		}
	}

	var config = api.configuration;
	if ( config === undefined ) config = {};

	var stage = apiInfo.stage;
	if ( stage ) {
		var sctx = config.stage[stage];
		if ( sctx === undefined ) {
			console.log( "Unknown stage", stage );
		}
		if ( ctx.i == undefined ) ctx.i = 0;
		ctx.apiKey = sctx.apiKey;
	} else {
		if ( exports.stage
			( config, url, ctx ) === undefined ) {
			console.log( "Unknown stage", ctx.part ); // XXX
			return;
		}
		stage = ctx.part;
	}

	var qp = exports.queryParameter( url )
	var queryParam = qp.param;
	url = qp.url;

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
				var chunk = [];
				request.on('data', function(d) {
					chunk.push(d);
				} );
				request.on('end', function() {
					var lpi = m.lambdaProxyIntegration;
					if ( lpi === undefined ) lpi = config.lambdaProxyIntegration;
					var lpii = m.lambdaProxyIntegrationInput;
					if ( lpii === undefined ) lpii = config.lambdaProxyIntegrationInput;

					var hdr = request.headers;
					var str = Buffer.concat(chunk);
					outer:
					for (;;) {
						for ( var h in hdr ) {
							if ( h.toLowerCase() ===
									"content-type" ) {
								h = hdr[h];
								var i = h.indexOf(";");
								if ( i >= 0 )
									h = h.substring
										(0,i).trim();
								i = h.indexOf("/");
								var sub;
								if ( i >= 0 ) {
									sub = h.substring(i + 1);
									h = h.substring(0,i);
								} else {
									sub = "";
								}
								switch ( h  ) {
									case "multipart":
									str = str.toString
										("base64");
									ev.isBase64Encoded =
										true;
									break outer;
								}
								break;
							}
						}
						str = str.toString();
						break;
					}
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
ev.params = pathParameters;
ev.queries = queryParam;
					}
					ev.headers = hdr;
					var fn = m.lambdaName;
					if ( !fn ) {
						fn = lambda.substring
							(lambda.lastIndexOf("/") + 1);
					}
					var rtctx = {
						functionName: fn,
						lambdaPrefix: string.resolveCache( config, "lambdaPrefix" )
					};
					Object.assign( rtctx, param.context );

rtctx.log_group_name = "group";
rtctx.aws_request_id = 'reqid'
					var rtname = m.runtime;
					if ( rtname === undefined ) {
						rtname = config.runtime;
						if ( rtname === undefined )
							rtname = "nodejs";
					}
					var configPath = m.basePath;
					if ( configPath === undefined )
						configPath = config.basePath;
					// request.lambda is not a regular attr
					// so no security issue to
					// externally submit lambda path
					invoke.handler( context, rtname,
						request.lambda? request.lambda : lambda,
						basepath? configPath?
							basepath + "/" + configPath :
							basepath : configPath,
							m.handler,
						ev, rtctx, function(xxx,result) {
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
//https://github.com/feross/is-buffer/blob/master/index.js
						if ( typeof result === 'object' ) {
							result = JSON.stringify( result );
							type = 'application/json';
						} else if ( m.header === undefined ||
							(type = m.header["Content-Type"]) === undefined ) {
							type = "text/plain";
						}
if ( xxx ) { // XXX more test is needed for exception case
	console.log( xxx );
} else {
						response.writeHead(stat,
							corsHeader( request.headers,
								param, hdr? hdr : {
									'Content-Type' : type
								} ) );
						if ( result )
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
			if ( request.method === "OPTIONS" )
				options( a, request.headers, response, param );
			else
				console.log
					( "Unknown method " + request.method );
		}
	} else {
		a = api[""];
//console.log( "ROOT entry--", a, url.substring( ctx.prev ) );
//		m = a[request.method];
		if ( a && (m = a[request.method] ) && m.path ) {
			resource( m, stage, url.substring( ctx.prev ),
				response, config, param );
		} else {
			console.log( "Unknown API " + request.url );
		}
	}
}
exports.match = match;
exports.invoke = invokeAPI;

exports.registerLambda = function(context, apiLambdaTable,basePath)
{
	if ( apiLambdaTable ) {
		var lambdaTable = context["^"];
		if ( lambdaTable === undefined )
			context["^"] = lambdaTable = {};	
		for ( var lambdaName in apiLambdaTable ) {
			var item = apiLambdaTable[lambdaName];
			if ( basePath && !item.basePath )
				item.basePath = basePath;
			lambdaTable[lambdaName] = item;
		}
	}
};

exports.loadAPI = function( context, name, cwd )
{
	try {
		var api = object.load( path.isAbsolute(name) || !cwd?
			name : cwd + "/" + name );
		var apiLambdaTable = api["^"];
		var basePath;
		var config = api.configuration;
		if ( config ) basePath = config.basePath;
		exports.registerLambda( context, api["^"], basePath );
		return api;
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

exports.run = function(context,apiset,basepath,param) {
	function dispatch( request, response ) {
		invokeAPI( context, apiset, basepath, request, response, param );
	}

	if ( apiset ) {
		//const http = require( "http" );
		var listener = dispatch;
	/*
	var express = require( 'express' );
	const app = express();
	app.all('*', dispatch );
	listener = app;
	*/	// XXX testing now
		var client;
		do {
			var server;
			var port;
			if ( param ) {
				client = param.client;
				port = param.port;
				tls = param.tls
				if ( tls ) {
					const https = require( "https" );
					var options = {
						key: fs.readFileSync(tls.key),
						cert: fs.readFileSync(tls.cert),
						SNICallback: function (domain, cb) {
						// XXX test in progress
/*							console.log( domain, "<---" );
const secondContext = tls.createSecureContext({
    key: [key2],
    cert: [cert2]
});
cb( null, secondContext );
*/
							cb();
						}
					};
					server = https.createServer
						( options, dispatch ).listen( port ? port : 443 );
					break;
				}
			}
			const http = require( "http" );
			server = http.createServer
				( dispatch ).listen(port? port : 80 );
		} while ( 0 );


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

exports.main = function(context,apidef,param)
{
	var rl;

	function clearChildren( head, callback, kill ) {
		function clearChild( l ) {
			if ( l !== head ) {
				l.child.on( "close", function() {
console.log( "child closed" );
					clearChild( l.next );
				} );
console.log( "send exit" );
				if ( kill ) l.child.kill( "SIGINT" );
				else l.child.send( { action: "exit" } );
			} else {
				callback();
			}
		}
		clearChild( head.next );
	}

	function finalize() {
		rl.close();
		var fin = param.finalize;
		if ( fin ) fin();
	}

	var term;
	function terminate() {
		if ( term ) return;
		term = true;
		// XXX disable request no more variance
		// in process list
		var fork = context.get("fork");
		if ( fork && fork.runtime ) {
			var rtl = Object.keys(fork.runtime);
			var rti = 0;
			(function clearRuntime() {
				if ( rti < rtl.length ) {
					var rt = rtl[rti++];
					var active = rt.active.next;
					if ( active != rt.active ) {
						// XXX wait few seconds  for active
						// processes before killing them
						console.log( "Waiting 5 seconds for active processes" );
						setTimeout( function() {
							clearChildren( rt.active, function() {
								clearChildren( rt.idle,
									clearRuntime );
							}, true );
						}, 5000 );
					} else {
						clearChildren( rt.idle,
							clearRuntime );
					}
				} else {
					finalize();
				}
			})();
		} else {
			finalize();
		}
	}
	var run;
	if ( typeof param === "function" ) {
		run = param;
	} else if ( param ) {
		run = param.run;
		if ( param.parse ) {
			var readline = require( "readline" );
			rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
            rl.on( "SIGINT", function() {
				param.parse(null,terminate);
            } );
			(function interactive() {
				var p = param.prompt;
				rl.question(p? p : "> ", function (input) {
					var state;
					try {
						param.parse(input,function(pause) {
							if ( pause === false )
								interactive();
							else if ( !pause )
								terminate();
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
			var a = exports.loadAPI(context,name,cwd);
			if ( a === undefined ) return undefined;
			if ( a === null ) {
				apiset = null;
				break;
			}
			apiset[alias] =	a;
		}
	} else {
		apiset = exports.loadAPI(context,apidef,cwd);
	}

	if ( apiset === undefined ) return undefined;
	var r = run( context, apiset, cwd, param );
	if ( r !== undefined ) return r;
	// so below default api run will do nothing
	return false;
};

if ( exports.main(
		require("canis/context"), "restapi" ) === undefined )
	console.log( "No body in restapi.js" );
