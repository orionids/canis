// vim:ts=4 sw=4:
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

"use strict";
var fs = require("fs");
//var ws = require("ws");
var path = require("path");
var tls = require("tls");
var string = require("canis/string");
var object = require("canis/object");
var invoke = require("canis/invoke");
var log = require("canis/log");
var mime = require("canis/mime");

process.on('uncaughtException', function (err,origin) {
	console.log(err);
	console.log(origin);
});

exports.stage = function (config, url, ctx)
{
	var stage;
	for (;;) {
		var i = ctx.i;
		if (i === undefined) i = 0;
		if (config.stage !== undefined) {
			// ignore preceding path separator to find stage
			if (url.charAt(ctx.i) == '/') ctx.i = i + 1;
			stage = match (config.stage, url, ctx);
			if (stage !== undefined) {
				var apikey = stage.apiKey;
				if (apikey !== undefined) {
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
match(api, url, ctx) {
	var start = ctx.i;
	if (start < 0) {
        // this means root (/) API of an element in API set is called
		ctx.part = "/";
	} else {
		var i = url.indexOf("/", start + 1);
		ctx.i = i;
		if (i >=0) {
			var j = i + 1;
			for (;;) {
				var next = url.charAt(j++);
				if (next == "?" || next == "") {
					ctx.i = -1;
					break;
				}
				if (next != "/") break;
			}
		}
/*        if (i >= url.length - 1) {
			ctx.i = -1;
			return api;
		}*/
		ctx.prev = start;
		ctx.part = url.substring
			(start, i > 0 ? i : undefined);
		// include api == null or api === undefined
		if (api == undefined) return null;
	}
	return api[ctx.part];
}

function absence(response, method, config) {
	response.writeHead(404, {
		'Content-Type' : "text/plain"
	} );
// TODO: support not found page
// XXX DUP
	if (method != "HEAD")
		response.write("Not found");
	response.end();
}

function
resource(context, m, method, stage, url, baseLength, response, config, param)
{
	function result(fn, data, r) {
		var text;
		var type;
		var index = fn.lastIndexOf(".");
		if (index > 0) {
			type = mime.extension[fn.substring(
				index + 1).toLowerCase()];
			if (typeof type === "object") {
				text = type.text;
				type = type.type;
			}
		}
		if (type === undefined) {
			text = true;
			type = "text/html";
		}
		var header = {
			'Content-Type' : type
		};
		var code;
		if (r) {
			if (r.code !== undefined) code = r.code;
			if (r.header !== undefined)
				Object.assign(header, r.header);
		} else {
			code = 200;
		}
		response.writeHead(
			code === undefined? 200 : code, header);
		if (method != "HEAD")
			response.write(data);
		response.end();
	}

	function index(name,next) {
		var fn = filePath + "/" + name;
		fs.readFile( fn, function(err,data) {
			if (err) {
				next();
			} else {
				var i = url.lastIndexOf('/');
				var p = i < 0? url : url.substring(i);
				if (p.charAt(p.length - 1) != '/')
					p += '/';
				result(fn, data, {
					code: 307,
					header: {'Location': "." + p + name}
				});
			}
		} );
	}

	function notFound() {
		absence(response, method, config);
	}

	var p = decodeURI(baseLength ? url.substring(baseLength) : url);
	var filePath = m.path + (
		stage? "/" + stage + "/" + p : p);
	var base = m.base;
	if (base) base = process.env[base];
	if (!base) base = m.basePath;
	if (base) filePath = base + "/" + filePath;
	filePath = path.normalize(filePath);
	if (filePath.charAt(0) == ".") {
		console.log("Suspicious request using relative path :", filePath);
		notFound();
	} else if (param.ignore && param.ignore.exec(filePath)) {
		console.log("ignored :" + filePath);
		notFound();
	} else {
//		console.log(log.position(), "STAGE=", stage, filePath);
		fs.readFile(filePath, function(err,data) {
			if (err) {
				if (err.code == "EISDIR" || (err.code == "EINVAL" &&
					fs.lstatSync(filePath).isDirectory())) {
					var di = config.directoryIndex;
					if (di) {
						if (typeof di === "function" ) {
//							di(filePath);
							result(filePath,
"<a href=https://google.com>GOOGLE</a>");
						} else {
							if (!Array.isArray(di))
								di = [
									"index.html",
									"index.htm"
								];
							var i = 0;
							(function iter() {
								if (i < di.length)
									index(di[i++],iter);
								else
									notFound();
							})();
						}
					} else {
						index(di, notFound);
					}
				} else {
					if (m.runtime) {
						// XXX do async
						context.module("ge/glue/ue.js", "@orionids/Orion", true);
						fs.readFile(filePath, function(err,data) {
							if (err) notFound();
							else result(filePath, data);
						});
					} else {
						notFound();
					}
				}
			} else {
				result(filePath, data);
			}
		} );
	}
}

function
corsHeader(hdr, param, extra)
{
	if (param.cors == undefined)
		return extra;
	var h = {
		"Access-Control-Allow-Origin": hdr.origin,
		"Access-Control-Allow-Credentials" : true,
		"Access-Control-Allow-Headers": "*" ,
		"Access-Control-Max-Age": 3600,
	};

	Object.assign(h, extra);

	return h;
}


function
options(api, hdr, response, param)
{
				// XXX config for this response
	var m = "OPTIONS";
	var k = Object.keys(api);
	for (var i = 0; i < k.length; i++) {
		var a = k[i];
		var c = a.charAt(0);
		if (c != '^' && c !=  "/") {
			m += "," + a;
		}
	}
	response.writeHead(200, corsHeader(hdr,param,{
		"Access-Control-Allow-Methods" : m
	}) );
	response.end();
	return 0;
}

exports.queryParameter = function(apipath) {
	var param = {};
	/* don't use lastIndexOf to guarantee api path doesn't
	 contain '?' */
	var index = apipath.indexOf('?');
	if (index > 0) {
		// XXX duplicated in ueParameter
		var p = apipath.substring(index + 1).split('&');
		for (var i = 0; i < p.length; i++) {
			var v = p[i].split('=');
			if (v.length > 1) param[v[0]] = v[1];
		}
		apipath= apipath.substring(0, index);
	}
	return { param: param, index: index, api: apipath };
}

exports.invocationPath = function(basePath, configPath)
{
	return configPath?
		path.isAbsolute(configPath)? configPath :
		basePath? basePath + "/" + configPath :
		configPath : basePath;
}

function
invokeAPI(
context, api, basepath, request, response, param)//, matched)
{
	function addPathParameter(name, all) {
		var s;
		var base;
		if (all) {
			ctx.i = -1;
//			last--;
			s = apipath;
			base = ctx.prev;
		} else {
			s = ctx.part;
			base = 0;
		}
		if (pathParameters === undefined)
			pathParameters = {};
		// automatically transfer path parameter without mapping template
		pathParameters[name] = s.substring(base + 1);
	}

	var pathParameters; // pathParameter is undefined if no path parameters in AWS
	var apipath = request.url; // std form of nodejs
	if (!apipath) {
		apipath = request.api; // support api attr too
		if (!apipath) throw new Error("NO_API");
	}
	var ctx = {i: 0};
	var a;
	var base;
	var last = 0;
	var ev = {};

	if (!param) param = {};

	var apiInfo;
	if (param.apiInfo && request.headers)
		apiInfo = param.apiInfo(request.headers, apipath, ctx);
	if (!apiInfo) apiInfo = {};

	if (api.apiSet) {
		var name = apiInfo.set;
		if (name) {
			api = api[name];
		} else {
			ctx.i += 1;
			a = match(api, apipath, ctx);
			name = ctx.part;
			if (a === undefined) {
				// check there is anonymous api set
				api = api[""];
				ctx = {};
			} else {
				api = a;
			}
		}
		if (api === undefined) {
			if (name === "/favicon.ico" || name === "favicon.ico") {
				absence(response, request.method, null);
				return;
			}
			throw new Error("UNKNOWN_API_SET." + name);
		}
	}

	var config = api.configuration;
	if (config === undefined) config = {};

	var stage = apiInfo.stage;
	if (stage) {
		var sctx = config.stage[stage];
		if (sctx === undefined)
			throw new Error("UNKNOWN_EXPLICIT_STAGE.", stage);
		if (ctx.i == undefined) ctx.i = 0;
		ctx.apiKey = sctx.apiKey;
	} else if(stage === null) {
		if (exports.stage(config, apipath, ctx) === undefined) {
			throw new Error("UNKNOWN_STAGE.", ctx.part); // XXX
		}
		stage = ctx.part;
	}

	var baseLength;
	if (ctx.prev) baseLength = ctx.prev + ctx.part.length;
	var qp = exports.queryParameter(apipath)
	var queryParam = qp.param;
	apipath = qp.api;

	var requestContext = {
		stage : ctx.part,
		resourcePath : apipath.substring(ctx.i),
		httpMethod: request.method
	};

	for (;;) {
		a = match(api, apipath, ctx);
		if (a === undefined) { // path parameter
			a = api["?"]; // get alias of path parameter
			if (a === null) {
				a = undefined;
				break;
			} else if (a === undefined) {
				for (var prop in api) {
					last = prop.length - 1;
					if (prop.charAt(1) == '{' &&
						prop.charAt(last) == '}') {
						var all = prop.charAt(last - 1) == '+';
						var name = prop.substring(2, all? last - 1 : last);
						addPathParameter(name, all);
						// add alias to avoid loop next time
						a = api[prop];
						api["?"] = {
							name: name,
							child: a,
							all: all
						};
						break;
					}
				}
				if (a === undefined) {
					api["?"] = null;
					break;
				}
			} else {
				addPathParameter(a.name, a.all);
				a = a.child;
			}
		}
//		if (matched) matched.push(ctx.part);
		if (ctx.i < 0) break;
		api = a;
	}
	var m;
	if (a !== undefined) {
		m = a[request.method];
		if (m !== undefined) for (;;) {
			var root;
			if (m.domain) {
				var c = config.server.endpoint[m.domain]
				if (!c || !(c = c[m.protocol + "." + m.port]) ||
					!(c = config.server.api[c])) break;
				m = object.attribute(
					c, m.path.substring(1), "/", "/")[request.method];
				if (!m) break;
 				root = config.basePath;
				config = c.configuration;
			}
			if (m.apiKeyRequired == true ||
			  (m.apiKeyRequired != false && config.apiKeyRequired == true)) {
				if (ctx.apiKey !== undefined) {
					if (request.headers['x-api-key'] != ctx.apiKey)
						throw new Error("API_KEY_MISMATCH." + request.headers['x-api-key'] + "." +  ctx.apiKey);
				}
			}
			var lambda = m.lambda;
			var chunk = [];
			request.on('data', function(d) {
				chunk.push(d);
			} );
			request.on('end', function() {
				var lpi = m.lambdaProxyIntegration;
				if (lpi === undefined) lpi = config.lambdaProxyIntegration;
				var lpii = m.lambdaProxyIntegrationInput;
				if (lpii === undefined) lpii = config.lambdaProxyIntegrationInput;

				var hdr = request.headers;
				var str = Buffer.concat(chunk);
				outer:
				for (;;) {
					for (var h in hdr) {
						if (h.toLowerCase() ===
							"content-type") {
							h = hdr[h];
							var i = h.indexOf(";");
							if (i >= 0)
								h = h.substring
									(0,i).trim();
							i = h.indexOf("/");
							var sub;
							if (i >= 0) {
								sub = h.substring(i + 1);
								h = h.substring(0,i);
							} else {
								sub = "";
							}
							switch (h) {
								case "multipart":
								str = str.toString("base64");
								ev.isBase64Encoded = true;
								break outer;
							}
							break;
						}
					}
					str = str.toString();
					break;
				}
				if (lpi || lpii) {
					ev.body = str;
					ev.queryStringParameters = queryParam;
					ev.requestContext = requestContext;
					ev.pathParameters = pathParameters;
				} else {
					if (str)
						try {
							ev.body = JSON.parse(str);
						} catch (e) {
						}
					Object.assign(ev, pathParameters);
					ev.stage = requestContext.stage;
					ev.path = requestContext.resourcePath;
ev.params = pathParameters;
ev.queries = queryParam;
				}
				ev.headers = hdr;
				var fn = m.lambdaName;
				if (!fn) {
					fn = lambda.substring
						(lambda.lastIndexOf("/") + 1);
				}
				var rtctx = {
					functionName: fn,
					lambdaPrefix: string.resolveCache(config, "lambdaPrefix"),
					root: root? exports.invocationPath(basepath, root) : null,
				};
				Object.assign(rtctx, param.context);

rtctx.log_group_name = "group";
rtctx.aws_request_id = 'reqid'
rtctx.symbol = param.symbol;
				var rtname = m.runtime;
				if (rtname === undefined) {
					rtname = config.runtime;
					if (rtname === undefined) {
						switch (path.extname(lambda)) {
							case ".py":
							rtname = "python";
							break;
							default:
							rtname = "nodejs";
						}
					}
				}
				var configPath = m.basePath;
				if (configPath === undefined) configPath = config.basePath;
				// request.lambda is not a regular attr
				// so no security issue to
				// externally submit lambda path
				invoke.handler(context, rtname, rtctx, {
					src: request.lambda? request.lambda : lambda,
					path: exports.invocationPath(basepath, configPath),
					handler: m.handler,
					param: ev
				}, function(xxx,result) {
					var type;
					var stat;
					var hdr;
if (xxx) result = xxx;
					if (lpi) {
						hdr = result.headers;
						result = result.body;
						// XXX case when result has headers
					} else {
                        //XXX if statusCode should be 200 here,
                        // consider running command as lambda, causing an exception
					}
					stat = result.statusCode;
//if (stat === undefined) stat = 200;
//https://github.com/feross/is-buffer/blob/master/index.js
					if (typeof result === 'object') {
						result = JSON.stringify(result);
						type = 'application/json';
					} else if (m.header === undefined ||
						(type = m.header["Content-Type"]) === undefined) {
						type = "text/plain";
					}
if (false && xxx) { // XXX more test is needed for exception case
//console.log(xxx,"!!!!!!!!!!!!!", stat);
//process.exit(1)
	response.end();
} else {
					response.writeHead(stat,
						corsHeader(request.headers,
							param, hdr? hdr : {
								'Content-Type' : type
							}));
					if (result)
						response.write(result);
					response.end();
}
				});
			});
			request.on('error', function(e) {
				console.log(e); // XXX do response here
			});
			return m;
		} else {
			if (request.method === "OPTIONS")
				return options(a, request.headers, response, param);
		}
		throw new Error(
			"UNKNOWN_METHOD." + request.method);
	} else {
		a = api[""];
		m = request.method;
		if (a && (m = a[m == "HEAD"? "GET": m])) {
			if (Array.isArray(m)) {
				m = m[0];
				var i = apipath.indexOf("/", baseLength + 1);
				if (i < 0) {
					m = m[""];
				} else {
					m = m[apipath.substring(baseLength, i)];
					if (m === undefined) {
						m = m[""];
					} else {
						baseLength = i;
					}
				}
			}
			if (m.path) {
				resource(context, m, request.method, stage, apipath,
					baseLength, response, config, param);
				return;
			}
		}
		throw new Error("UNKNOWN_API: " +
			request.method + " " + request.url);
	}
}
exports.match = match;
exports.invoke = invokeAPI;

exports.registerLambda = function(context, apiLambdaTable, basePath)
{
	if (apiLambdaTable) {
		var lambdaTable = context["^"];
		if (lambdaTable === undefined)
			context["^"] = lambdaTable = {};	
		for (var lambdaName in apiLambdaTable) {
			var item = apiLambdaTable[lambdaName];
			if (basePath && !item.basePath)
				item.basePath = basePath;
			lambdaTable[lambdaName] = item;
		}
	}
};

exports.loadAPI = function(context, name, cwd)
{
	try {
		var api = object.clone(
					typeof(name) === "string" ?
						object.load(
							path.isAbsolute(name) || !cwd?
							name : cwd + "/" + name) : name, process.env);
		var apiLambdaTable = api["^"];
		var basePath;
		var config = api.configuration;
		if (config) basePath = config.basePath;
		exports.registerLambda(context, api["^"], basePath);
		return api;
	} catch (e) {
		if (e.code === "MODULE_NOT_FOUND") {
			// so user supplied run function will have
			// change to be run
			return null;
		} else {
		//	require(file); // raise exception again to know datails
console.log(e); // resolve this XXX not to use console.log : above doesn't work correctly
		}
	}
	return undefined;
}

exports.run = function(context,apiset,basepath,param) {
	function dispatch(request, response) {
		try {
			invokeAPI(
				context, apiset, basepath,
				request, response, param);
		} catch (e) {
			console.log(e, e.stack);
		}
	}

	if (apiset) {
		//const http = require("http");
		var listener = dispatch;
	/*
	var express = require('express');
	const app = express();
	app.all('*', dispatch );
	listener = app;
	*/	// XXX testing now
		var client;
		do {
			var server;
			var port;
			if (param) {
				client = param.client;
				port = param.port;
				var tlsinfo = param.tls
				if (tlsinfo) {
					const https = require("https");
					var options = {
						key: fs.readFileSync(tlsinfo.key),
						cert: fs.readFileSync(tlsinfo.cert),
						SNICallback: function (domain, cb) {
							var sd = tlsinfo[domain];
							if ( sd === undefined) {
								cb();
							} else {
								if (sd.context === undefined)
									sd.context = tls.createSecureContext({
										key: fs.readFileSync(sd.key),
										cert: fs.readFileSync(sd.cert)
									})
								cb(null, sd.context);
							}
						}
					};
					server = https.createServer
						(options, dispatch ).listen( port ? port : 443);
					break;
				}
			}

			const http = require("http");
			server = http.createServer(dispatch).listen(port? port : 80);
		} while (0);

//var w = ws.WebSocketServer;
//var wss = new w({server});
/*var wss = new ws.Server({server});
wss.on("connection", function(socket) {
	console.log("WEBSOCKET!");
	socket.on("message", function(data) {
		console.log(data.toString());
	});
	socket.on("close", function() {
		console.log("CLOSED");
	});
	socket.send("HELLO!!!");
});*/

		if (client) {
			server.client = {};
			server.on("connection", function(socket) {
console.log("New client", socket.remoteAddress);
				string.unique(function(id) {
					socket.id = id;
					server.client[id] = socket;
					socket.on("close", function() {
						delete server.client[id];
					});
				});
			});

		}

		return server;
	}
};

exports.close = function(server) {
	if (typeof server === "object") {
		server.close();
		var client = server.client;
		for (var c in client) {
			if (client.hasOwnProperty(c))
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

exports.main = function(context, apidef, param)
{
//	var rl;

	function clearChildren(head, callback, kill) {
		function clearChild(l) {
			if (l !== head) {
				l.child.on( "close", function() {
console.log("child closed");
					clearChild(l.next);
				} );
console.log("send exit");
				if (kill ) l.child.kill( "SIGINT");
				else l.child.send({ action: "exit" });
			} else {
				callback();
			}
		}
		clearChild(head.next);
	}

	function finalize() {
//		if (rl) rl.close();
		invoke.gc();
		var fin = param.finalize;
		if (fin) fin();
	}

	var term;
	function terminate() {
		if (term) return;
		term = true;
		// XXX disable request no more variance
		// in process list
		var fork = context.get("fork");
		var rtl;
		if (fork && fork.runtime) {
			rtl = Object.keys(fork.runtime);
			rtl.push(invoke.getRuntime());
		} else {
			rtl = [invoke.getRuntime()];
		}
		var rti = 0;
		(function clearRuntime() {
			while (rti < rtl.length) {
				var rt = rtl[rti++];
				var active = rt.active;
				if (active === undefined) continue;
				active = active.next;
				while (active != rt.active) {
					if (active.quit) active.quit();
					active = active.next;
				}
				active = active.next;
				if (active != rt.active) {
					// XXX wait few seconds  for active
					// processes before killing them
					console.log("Waiting 5 seconds for active processes");
					setTimeout(function() {
						clearChildren(rt.active, function() {
							clearChildren(
								rt.idle, clearRuntime);
						}, true);
					}, 5000);
				} else {
					clearChildren( rt.idle, clearRuntime );
				}
				return;
			}
			finalize();
		})();
	}
	var run;
	if (typeof param === "function") {
		run = param;
	} else if (param) {
		run = param.run;
		if (param.parse) require("canis/monitor")(param, terminate);
	}
	if (!run) run = exports.run;


	var apiset;
	const cwd = process.cwd();

	if (Array.isArray(apidef)) {
		apiset = { apiSet: true };
		for (var i = 0; i < apidef.length; i++) {
			var alias = undefined;
			var name = apidef[i];
			if (typeof name === "object") {
				alias = name.alias;
				name = name.name;
			}
			if (alias === undefined) {
				var end = name.lastIndexOf(".");
				if (end < 0) end = undefined;
				alias = name.substring
					(name.lastIndexOf("/") + 1, end);
			}
			var a = exports.loadAPI(context, name, cwd);
			if (a === undefined) return undefined;
			if (a === null) {
				apiset = null;
				break;
			}
			apiset[alias] =	a;
		}
	} else {
		apiset = exports.loadAPI(context, apidef, cwd);
	}

	if (apiset === undefined) return undefined;
	var r = run(context, apiset, cwd, param, terminate);
	if (r !== undefined) return r;
	// so below default api run will do nothing
	return false;
};

if (exports.main(require("canis/context"), "restapi") === undefined)
	console.log("No body in restapi.js");
