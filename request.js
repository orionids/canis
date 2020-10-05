// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2017, 2018 adaptiveflow
// Distributed under ISC

"use strict";

var rl = require( "readline" );
var fs = require( "fs" );
var string = require( "canis/string" );
var object = require( "canis/object" );
var parser = require( "canis/parser" );
var context = require( "canis/context" );
var server = require( "canis/server" );
var path = require("path");

function
clone( request, symbol, callback )
{
	var resolve = {
		symbol : symbol === undefined ?
			[ process.env ] : symbol,
		ctx : { loose: true }
	}
	var r = object.clone( request, resolve );
	if ( r.init ) r.init( r, callback, resolve );
	else process.nextTick( callback, r );
}

exports.override = function( target, source ) {
	for ( var s in source ) {
		if ( source.hasOwnProperty(s) ) {
			var sv = source[s];
			if ( typeof sv === 'object' ) {
				exports.override( target[s], sv );
			} else {
				target[s + "_orig"] = target[s];
				target[s] = sv;
			}
		}
	}
};

function
invokeLambda(api,symbol,request,response,local)
{
	var invoke = require( "canis/invoke" );

	var name = request.url;
	if ( local ) {
//		context.['^' +  = api;
	} else if ( context.lambdaPrefix === undefined ) {
// XXX overwritten case
		context.lambdaPrefix =
			string.resolve(api.configuration.lambdaPrefix,symbol);
	}

	invoke( context, request.url, request.body,
		local? invoke.DISABLE_REMOTE : invoke.DISABLE_LOCAL,
		function(err,data) {
			response.writeHead(err?err.statusCode:200,{});
			response.write(data?typeof(data)=="string"?
				data:JSON.stringify(data):"");
		}, api.configuration );
}

exports.https = function
( context, api, basepath, request, response, param ) {
	var httpreq, https, symbol;
	if ( param ) {
		httpreq = param.httpreq;
		https = param.https;
		symbol = param.symbol;
	}
	clone( request, symbol, function(r) {
		if( r ) {
			var apiInfo = param.apiInfo ? param.apiInfo(r) : {};

			if ( request.method == "INVOKE" ) {
					invokeLambda(api,symbol,request,response);
			} else {
				if ( httpreq === undefined ) httpreq = require( "canis/httpreq" );
				if ( https === undefined ) https = require( "https" );
				var url = apiInfo.stage ? r.url : r.urlStage + r.url;
				r.path = basepath && !apiInfo.set ?
					basepath + url : url;
				httpreq( https, r, function( err, data, res ) {
					if ( err ) {
						response.writeHead( err.statusCode );
						response.write( err.message );
						response.end( err.message );
						//console.log( err );
					} else {
						response.writeHead( res.statusCode, res.headers );
						response.write( data );
						response.end( data );
					}
				} );
			}
		}
	} );
//XXX exception
};

exports.http = function
( context, api, basepath, request, response, param ) {
	var p = {
		https: require("http")
	};
	Object.assign( p, param );
	exports.https( server, api, basepath,
		request, response, p );
}

exports.local = function
( context, api, basepath, request, response, param ) {
	var symbol;
	if ( param ) symbol = param.symbol;
	if ( request.method == "INVOKE" ) {
		context.fork = param.fork;
		invokeLambda(api,symbol,request,response, true);
	} else {
		clone( request, symbol, function (r) {
			if( r ) {
				r.on = function(n,f) {
					switch ( n ) {
						case "data" :
						f( Buffer.from( r.body === undefined? "" :
							JSON.stringify(r.body,0,2) ) );
						break;
						case "end": f(); break;
					}
				};
				if ( r.urlStage ) r.url = r.urlStage + r.url;
				return server.invoke( context, api, basepath, r, response, param );
			}
	// XXX exception
		} );
	}
};

function
postman_evaluator(detail,req)
{
	function fconv(f) {
		return f.toString().replace(/this\.getvar/g,"pm.environment.get")
	}

	var statusCode = req.statusCode;
	var code = [
//		"if (pm.environment.get('region') !== 'kic') return;"
	];
	var conditional = req.conditional;
	if ( conditional )
		code.push( "if ( !(" + fconv(conditional) + ")() ) return;" );

	code.push( "pm.test(\"" + detail + "\", function() {" );

	code.push(
		"\tpm.expect(pm.response.code).to.be.oneOf([" +
		(statusCode? statusCode : 200) + "]);" );

	var sym = req.symbol;
	var result = req.result;
	if ( sym || result ) {
		code.push( "\tvar headers = {};\n" +
		"\tvar h = pm.response.headers.all();\n" +
		"\tfor ( var i = 0; i < h.length; i++) {\n" +
		"\t\tvar hi = h[i];\n" +
		"\t\theaders[hi.key] = hi.value;\n" +
		"\t}\n" );
		code.push( "\tvar response = { \"headers\": headers,\"body\" : JSON.parse(responseBody) };" );
	}
	if ( sym ) {
		for ( var attr in sym ) {
			code.push( "\tpm.environment.set( \"" + attr +
				"\", response.body." + sym[attr] + " );" );
		}
	}

	if ( result ) {
		code.push( "\t(" + fconv(result) +
			")(response,function(r){" );
		code.push(	"\t\tpm.expect(r).to.be.true;\n\t});" );
	}
	code.push( "});" );

	return code;
}


/*
		{
			"name": "/NAME",
			"item": [
				{
					"name": "Normal Case",

					"item": [
					],
					"_postman_isSubFolder": true
				}
			]
		},

*/
function
postman_generate(context,request,param)
{
	var config = param.postman
	var method = request.method

	var header = []
	for ( var key in request.headers ) {
		if ( key.toLowerCase() != "origin" ) {
			var constant = request.constant;
			var cfgval = config.header[key];
			header.push( {
				"key": key,
				"value": (constant && constant[key]) || !cfgval?
					request.headers[key] : cfgval
			})
		}
	}


	//XXX
	header.push( 
					{
						"key": "Content-Type",
						"name": "Content-Type",
						"value": "application/json",
						"type": "text"
					}
	);

	var body = {};
	switch ( method ) {
		case "POST":
		case "PUT":
		body.mode = "raw";
		body.raw = JSON.stringify(request.body);
	}

	var url = request.url;
	var qp = server.queryParameter(url);
	var qpi = qp.index;
	var name = url.substring(0,qpi > 0? qpi : undefined);

	var path = config.path;
	var info = {};
	var information = request.information;
	if ( information ) {
		information( info );
		if ( path === undefined ) path = info.path;
	}

	if ( path === undefined ) {
		var apiset = request.apiSet;
		if ( apiset ) {
			if ( Array.isArray(apiset) ) apiset = apiset[0];
			path = [apiset.substring(apiset.lastIndexOf('/') + 1)]
		} else {
			path = [];
		}
	}

	var i = 1, j;
	var p = name;
	while ( (j = name.indexOf('/',i) ) > 0 ) {
		path.push( name.substring(i,j) );
		i = j + 1;
	}
	path.push( name.substring(i) );

	name = request.name? request.name : method + " " + name;
	if ( request.nameSuffix ) {
		if ( config.nameSuffixSeparator )
			name += config.nameSuffixSeparator;
		name += request.nameSuffix;
	}
	var base = config.base;
	var pmurl = { "raw": base + url, "path": path }
	i = base.indexOf(":");
	if ( i > 0 ) {
		pmurl.protocol = base.substring(0,i);
		i += 2;
	}

	var host = [];
	while ( i !== undefined ) {
		j = base.indexOf('.',++i);
		if ( j < 0 ) {
			j = base.indexOf('/',i);
			if ( j < 0 ) j = undefined;
		}
		host.push( base.substring(i,j) );
		i = j;
	}
	pmurl.host = host;

	if ( qpi > 0 ) {
		var query = []
		for ( var a in qp.param ) {
			query.push( { key : a, value: qp.param[a] } )
		}
		pmurl.query = query;
	}

	var detail = request.detail;
	var tc = {
		name: name,
		event: [
			{
				"listen": "test",
				"script": {
					"exec": postman_evaluator
						( detail? detail : name, request ),
				}
			}
		],
		request: {
			"method": method,
			"header": header,
			"body": body,
			"url": pmurl
		},
		response: []
	};

	if ( config.id ) {
		tc.event[0].script.id = config.id;
		tc.event[0].script.type = "text/javascript";
	}

	if ( request.sleep > 0 ) {
		tc.event.push( {
			"listen": "prerequest",
			"script": {
				"exec": [
					"async function sleep(dt) {",
					"    await new Promise(resolve => setTimeout(resolve, dt));",
					"}",
					"",
					"sleep(" + request.sleep + ");"
				]
			}
		})
		//if ( config.id ) {
		//	tc.event[0].script.id = config.id;
		//	tc.event[0].script.type = "text/javascript";
		//}
	}

//	console.log( tc );
	var tab = config.tab;
	var s = JSON.stringify(tc,null,tab? tab : "\t");
	var shift = config.shift;
	if ( shift === undefined ) shift = "";
	s = shift + s.replace(/\n/g,"\n" + shift)
	console.log( s );
//		r = c + "\"" + r.replace(/\t/g,"\\t" ).
}

exports.postman = function
	( context, api, basepath, request, response, param ) {
	var symbol;
	if ( param ) symbol = param.symbol;
	clone( request, symbol, function(r) {
		postman_generate(context,r,param);
	});
}


exports.resolve = function
	( server, api, base, request, response, param )
{

	function modify( s, op ) {
		if ( s ) {
			switch ( op ) {
				case "lower": return s.toLowerCase();
				case "upper": return s.toUpperCase();
				case "upperFirst":
				case "camel":
				return s.charAt(0).toUpperCase() +
					s.substring(1);
			}
		}
		return s;
	}

//	console.log( Object.keys(param) )
	var resolve = param.resolve;

	var symbol = object.clone
		( param.symbol, { recursive: false } );
	if ( symbol ) {
		var f, target;
		if ( Array.isArray( symbol ) ) {
			target = {}
			symbol.push( target );
		} else {
			target = symbol;
			f = symbol['?']
		}
		target['?'] = function(ctx,s) {
		/*	if ( s.startsWith( "API_PATH" ) ) {
				var resolved, sep;
				var path;
				var op;
				var i = s.indexOf( ".", 8 );
				if ( i > 0 ) {
					op = s.substring( i + 1 );
				} else {
					i = s.length;
				}
				var from;
				from = s.indexOf("_ONLY",8) == 8 ? 13 : 8;
				sep = from < i ? s.charAt(from) : "";
				var matched = resolve.matched;
				for ( i = 0; i < matched.length; i++ ) {
					var m = matched[i];
					if ( i == 0 ) resolved = m;
					else resolved += sep + m;
				}
				return resolved;
			}*/
			var pc = parser.context(s);
			var name = parser.token(pc);
			var op;
			var val;
			var sep;
			var last;

			while ( (last=parser.last(pc)) == '.' || last == '=' ) {
				var operand = parser.token(pc);
				if ( operand ) {
					if ( last == '.' ) op = operand;
					else val = operand;
				} else {
					sep = last;	
				}
			}
			if ( sep === undefined ) sep = last;

			var path;
			switch ( name ) {
				case "API_PATH_ONLY": path = true;
				case "API_PATH":
				var matched = resolve.matched;
				var resolved;
				for ( var i = 0; i < matched.length; i++ ) {
					var m = matched[i];
					if ( path && m.charAt(0) == '{' )
						continue;
					if ( resolved === undefined )
						resolved = op == "camel" ?
							m : modify(m,op);
					else
						resolved += sep + modify(m,op);
				}
				return resolved;
				case "API_METHOD":
				return modify(request.method,op);
				case "LAMBDA_HANDLER":
				return "lambda_handler"; // XXX
				case "LAMBDA_RUNTIME":
				return "python3.8"; // XXX
				default:
				if ( name.startsWith("ARG") ) {
					// XXX ARG support
					if ( val ) return val;
				} else {
					var r = string.symbol(name,param.symbol);
					if ( val !== undefined ) {
						if ( r != val ) return undefined;
					}
					return modify(r,op);
				}
			}
			//if ( f ) return f( ctx, s );
		}
	}
	clone( request, param.symbol, function (r) {
		// XXX dup code
		if ( r.urlStage ) r.url = r.urlStage + r.url;
		server.invoke( api, base, r, response, param, param.resolve );

		var t = 0;
		var template = resolve.template;
		( function iterate() {
			var fileName = template[t];
			var rlif = rl.createInterface( {
				input: fs.createReadStream(fileName),
				console: false
			} );
			var contents = [];
			rlif.on( "line", function(l) {
				l = string.resolve( l, symbol, {
					delim: resolve? resolve.delim : undefined
				} );
				if ( l ) contents.push(l);
			} );
			rlif.on( "close", function() {
				var i = t++;
				resolve.complete( i, fileName,
					contents.join('\n'),
					t < template.length ? iterate : undefined )
			} );
		})();
	});
}

var callee = {
	"local" : exports.local,
	"https" : exports.https,
	"http" : exports.http,
	"postman" : exports.postman,
	"resolve" : exports.resolve
};

exports.callee = function (name ) {
	var i;
	return callee
		[ name === undefined? 0 :
			(i = name.indexOf(".")) > 0 ?
				name.substring(0,i) : name];
};

// iterate run a request applying varios inputs specified by 'symbol'
exports.iterate = function( context, target, symbol,
	callback, api, basepath, request, response, param )
{
	var i;
	var r = {
		writeHead: response.writeHead,
		write : response.write,
		end : function () {
			response.end();
			perform();
		}
	};

	function perform() {
		callback( i, symbol.length );
		if ( i < symbol.length ) {
			e.symbol[0] = symbol[i++];
			callee[target]( context, api, basepath,
				request, r, e );
		}
	}
	var e = {};
	for ( var p in param ) {
		if ( param.hasOwnProperty(p) ) e[p] = param[p];
	}

	var s = e.symbol;
	if ( s === undefined ) {
		e.symbol = [ null, process.env ];
	} else if ( Array.isArray(s) ) { // assume array
		e.symbol = [ null ];
		for ( i = 0; i < s.length; i ++ ) {
			e.symbol.push( s[i] );
		}
		e.symbol.push( process.env );
	} else { // assume object
		e.symbol = [ null, s, process.env ];
	}

	i = 0;
	if ( !symbol || symbol.length <= 0 ) symbol = [ null ];
	perform();
};

exports.basePath = function(tc)
{
	var base = tc.base;
	if ( base !== null && base !== undefined ) return base;
	var apiset = tc.apiSet;
	if ( apiset ) {
		if ( Array.isArray(apiset) ) apiset = apiset[0];
		var i = apiset.lastIndexOf("/")
		if ( i > 0 ) return apiset.substring(i);
	}
}

exports.load = function( context, basepath, filePath, target, serverPath )
{
	function loadAPI(from,to) {
		var name = filePath.substring(from,to);
		var api = server.loadAPI
			( context, name, serverPath );
		if ( api )
			return { api: api, name: name }
	}
	if ( serverPath ) {
		var i = filePath.indexOf( "/" );
		var basePath;
		var feature = "";
		if ( i > 0 ) {
			var apiInfo;

			apiInfo = loadAPI( 0, i )
			if ( !apiInfo ) {
				var j = filePath.indexOf( "/", ++i );
				apiInfo = loadAPI( 0, j );
				if ( !apiInfo ) {
					apiInfo = loadAPI( i, j );
					// - <--- XXX
					feature = apiInfo.name + "-"
				}
			}

			basePath = apiInfo.api.configuration.basePath;
			serverPath += "/" + apiInfo.name;
		}

		var index = filePath.lastIndexOf("/");
		var name = feature + ( index >= 0 ? filePath.substring(index + 1 ) : filePath );
		var src = basepath + "/" + filePath + ".py";
		src = path.normalize(src);
		var cwd = process.cwd();
		server.registerLambda( context, {
			[name] : {
				lambda : src.indexOf(cwd) == 0 ?
					src.substring(cwd.length + 1) : src
			}
		}, basePath );	
		return {
			apiSet: serverPath,
			method: "INVOKE",
			url: name
		}
	}
	return object.load( basepath + "/" + filePath );
}
// EOF
