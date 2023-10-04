// vim:ts=4 sw=4 noet:
// jshint curly:false
// Copyright (C) 2018, adaptiveflow
// Distributed under ISC License
'use strict';

var list;
var child_process;
var net;
var context = require("canis/context");
var server = require("canis/server");
var string = require("canis/string");
var object = require("canis/object");
var commLog = false;
var processServer;
var gcRequested;

if (process.platform == "win32") {
	var fs = require("fs");
	var pathLib = require("path");
	var pathEnv = process.env.PATH.split(pathLib.delimiter);
}

function
invokeLambda(prefix, msg, child)
{
	var name = msg.name;
	if (name.indexOf(prefix) === 0)
		name = name.substring(prefix.length);

	module.exports(context, name, JSON.parse(msg.ev), 0,
	function(err, data) {
		if (msg.response)
			child.send({
				action: "result",
				payload: JSON.stringify(data)
			});
	})
}

module.exports = function(
	context, name, param, flag, callback, config, symbol)
{
	function invokeLocal (prefix) {
		if (!prefix.runtime) {
				prefix.runtime = "python"; // XXX
		}
		var rtctx = {
			functionName: name,
			symbol: symbol
		};
		if (config) {
			rtctx.lambdaPrefix = string.resolveCache(
				config, "lambdaPrefix" )
		}
//		Object.assign(rtctx, param.context);

rtctx.log_group_name = "group";
rtctx.aws_request_id = 'reqid'
		module.exports.handler(
			context, prefix.runtime, prefix.lambda,
			server.invocationPath(
				process.cwd(), string.path(prefix.basePath)),
			prefix.handler, param, rtctx, callback)
		return;
		try {
			param.method = "POST";
			param.url = "/";
			var r = param;

			/* XXX routine in request.js */
			r.on = function(n,f) {
					switch (n) {
						case "data" :
						f( Buffer.from( r.body === undefined? "" :
							JSON.stringify(r.body,0,2) ) );
						break;
						case "end": f(); break;
					}
				}
			if (! prefix.runtime) {
					prefix.runtime = "python"; // XXX
			}
			return server.invoke( {
				"/" : {
					"POST" : prefix,
				}
			}, process.cwd(), r, {
				writeHead: function(s,h) {
					console.log(s, h);
				},
				write: function(res) {
//					console.log(r, typeof(r));
					callback(null, res);
				},
				end: function() {
//					callback();
				}
			}, { fork: context.fork } );
		} catch (e) {
			if (e.code !== "MODULE_NOT_FOUND") {
				setTimeout( function() {
					callback(e);
				} );
				return true;
			}
		}
	}

	var f = context.get("canis_invoke");
	if (f !== undefined) flag = f;

	var prefix;
	if (!(flag & module.exports.DISABLE_LOCAL)) {
		var lambdaTable = context["^"];
		if (lambdaTable) {
			var info = lambdaTable[name];
			if (info) {
				invokeLocal(info);
				return;
			}
		}
		prefix = context.localPrefix;
		if (prefix) {
			if (Array.isArray(prefix)) {

			} else if (invokeLocal(prefix)) {
				return;
			}
		}
	}

	if (true || !(flag & module.exports.DISABLE_REMOTE)) {
		// try AWS lambda
		prefix = context.lambdaPrefix;
		context.service("Lambda").invoke( {
			FunctionName: prefix ? prefix + name : name,
			InvocationType: 'RequestResponse',
			LogType: 'Tail',
			Payload: typeof param === 'string' ? param : JSON.stringify(param)
		}, function (err, data) {
			if (err) {
				callback(err);
			} else if (data.StatusCode == 200) {
				// to maintain consistency with calling local function,
				// assume json formatted result
				var payload = JSON.parse(data.Payload);
				if (data.FunctionError)
					callback(null, JSON.parse(
						payload.errorMessage));
				else callback(null, payload);
			} else {
				callback(new Error('UnexpectedException'));
			}
		} );
	} else {
		callback({code: "ResourceNotFoundException"});
	}
};

function
matchPath(filename, pathenv, plain) {
	if (pathLib.isAbsolute(filename)) return filename;
	if (!plain && process.platform === "win32" &&
		!pathLib.extname(filename)) filename += ".exe";
	if (pathenv === undefined)
		pathenv = process.env.PATH.split(pathLib.delimiter);

	for (var i in pathenv) {
		var fn = pathenv[i] + pathLib.sep + filename;
		if (fs.existsSync(fn)) return fn;
	}
}

var childTable = {};

function
executeLocal(exname, arg, option)
{
	return child_process.spawn(
		process.platform != "win32" ? exname :
		matchPath(exname, pathEnv, false, pathLib),
		arg, option);
}

function
execute(exname, arg, socket, callback)
{
	if (socket) {
		socket(function() {
			var child = executeLocal(
				exname, arg, {stdio: ["pipe", "pipe", 2]});
			childTable[child.pid] = {
				child: child,
				callback: callback
			};
		});
	} else {
		var child = executeLocal(
			exname, arg, {stdio: ["pipe", "pipe", 2]});
		callback(child, child.stdout, child.stdin);
	}
}

function
requireList()
{
	if (list === undefined) list = require("canis/list");
	return list;
}

module.exports.getRuntime = function()
{
	requireList();
	return this.runtime === undefined ? (this.runtime = {
		active: list.circularHead(),
		idle: list.circularHead()
	}) : this.runtime;
}

if (false) {
process.on("SIGTTOU", function() {
	console.log("SIGTERM!!!!!!!!!!!!!");
});
child_process = require("child_process");
execute("bash", ["-i"], false, function(child, input, output) {
	var node = {
		child: child,
		quit: function() {
			list.unlinkCircularNode(this);
			output.write("exit\n");
		}
	};
	requireList().linkCircularNode(
		module.exports.getRuntime().active, node);
	input.on("data", function(d) {
		console.log(d.toString("UTF-8"));
	});
	child.on("close", function() {
		list.unlinkCircularNode(node);
	});
});
}

module.exports.gc = function()
{
	if (processServer) {
		gcRequested = true;
		processServer.getConnections(function(err,count) {
			if (count <= 0) {
				processServer.close();
				processServer = undefined;
			}
		});
	}
}

module.exports.DISABLE_LOCAL = 0x1;
module.exports.DISABLE_REMOTE = 0x2;
module.exports.handler = function(
	context, rtname, src, path, handlerName, ev, rtctx, callback)
{
	var rt;
	var rtpath;
	var idle;
	var child;
	function registerOnClose() {
		idle = {child: child};
		child.on("close", function() {
			list.unlinkCircularNode(idle);
			if (rt.active.next == rt.active && gcRequested)
				module.exports.gc();
			// XXX callback with error
		});
	}
	function activate() { /* XXX this need not to be function*/
		list.linkCircularNode(rt.active, idle);
	}
	function sendInvoke() {/* XXX this need not to be function*/
		child.send({
			action: "invoke",
			src: src,
			init: rt.init,
			path: path,
			rtpath: rtpath,
			handler: handlerName,
			altered: {
				name: rt.altered,
				package: undefined
			},
			ev: ev,
			ctx: rtctx
		});
	}

	function sendResolved(r)
	{
		child.send({
			action: "resolved",
			body: r
		});
	}

	function receiveMessage(d, message) {
		while (true) {
			if (size === undefined) {
				current += d.length;
				if (current <= 4) {
					chunk.push(d);
					return;
				}
				if (chunk.length > 0) {
					chunk.push(d);
					d = Buffer.concat(chunk);
					chunk = [];
				}
				size = parseInt(d.slice(0,4).toString("hex"),16);
				d = d.slice(4);
				current = 4;
if (commLog) console.log( ">>>>> size ", size,"with payload : ", d.length);
			}
			current += d.length;
			if (current >= size) {
				var dispatchPacket = function() {
					message(
						JSON.parse(Buffer.concat(chunk)));
					chunk = [];
					size = undefined;
					current = 0;
				};
				if (current > size) {
					var end = d.length +
						size - current;
					chunk.push(d.slice(0,end));
if (commLog) console.log(">>>>> Exceeding payload received, end=", end);
					dispatchPacket();
					d = d.slice(end);
					continue;
				} else {
if (commLog) console.log(">>>>> Exact payload received");
					chunk.push(d);
					dispatchPacket();
				}

/*							dispatchMessage(
					JSON.parse(r.slice( 2,
					2 + parseInt( r.slice(0,2).
					toString("hex"),16) )) );
				size = undefined;
				current = 0;*/
			} else {
				chunk.push(d);
			}
			break;
		}
	}

	var fork = context.get("fork");

	if (path && path.startsWith("/cygdrive/"))
		path = path.charAt(10) + ':' + path.substring(11);

	if (fork === undefined) {
		try {
			require(path? path + "/" + src : src)[
				handlerName ? handlerName : "handler"]
				(ev, rtctx, callback);
		} catch (e) {
			throw (e);
		}
	} else {
		requireList();
		var runtime = fork.runtime;
		if (runtime === undefined)
			runtime = fork.runtime = {};
		rt = runtime[rtname];
		for (;;) {
			if (rt === undefined)
				runtime[rtname] = rt = {};
			else if (rt.idle)
				break;

			rt.idle = list.circularHead();
			rt.active = list.circularHead();
			break;
		}

		idle = rt.idle.next;
		if (idle !== rt.idle) {
			list.unlinkCircularNode(idle);
			child = idle.child;
		} else {
			if (child_process === undefined) {
				child_process = require("child_process");
			}

			var dispatchMessage = function(msg) {
				switch (msg.action) {
					case "result":
					callback(msg.err, msg.data);
					break;
					case "reuse":
					list.unlinkCircularNode(idle);
					if (fork.reuse) {
						list.linkCircularNode(rt.idle, idle);
					} else {
						child.send({action: "exit"});
						if (child.client) {
							child.client.normalExit = true;
							delete child.client
						}
					}
					break;
					case "invoke":
					invokeLambda(
						rtctx.lambdaPrefix, msg, child);
					break;
					case "resolve":
					var resolve = context.get("resolve")
					if (resolve) {
						resolve(
							msg.body, rtctx.symbol,
							sendResolved
						);
					} else {
						sendResolved(
							object.clone(msg.body, rtctx));
					}
					break;
					case "command":
					child.send({
						action: "command",
						body: "HELLO!!!"
					});
					break;
					case "credential":
					var aws = require("canis/context").aws();
					var cred = aws.config.credentials;
					function sendCredential() {
						child.send({
							"action": "credential",
							"body": [
								cred.accessKeyId,
								cred.secretAccessKey,
								cred.sessionToken,
								cred.expireTime]
						});
					}
					if (cred.needsRefresh())
						cred.refresh(sendCredential);
					else
						sendCredential();
				}
			};
			function socket(done) {
				if (net) {
					done();
				} else {
					net = require("net");
					processServer = net.createServer(function(client) {
						client.on("data", function(d) {
							receiveMessage(d, function(msg) {
								if (msg.action == "pid") {
									var t = childTable[msg.pid];
									delete childTable[msg.pid]
									t.child.client = client;
									t.callback(t.child, client, client);
								}
							});
						});
						client.on("close", function(err) {
							if (!client.normalExit)
								callback(new Error(
									'UNEXPECTED_CLIENT_DISCONNECTION'));
						});
					});
					processServer.listen(31000, function() {
//						processServer.on('close', function() {
//							console.log("SOCKCLOSE");
//						});
						processServer.on('error', function(err) {
							console.log("SOCK", err);
						});
						done();
					});
				}
			}

			// XXX number of processes should be limited
			if (rtname === "nodejs") {
				child = child_process.fork(
					__dirname + "/handler");
				child.on("message", dispatchMessage);
			} else {
				var rtparam = {
					symbol: [
						rt.symbol,
						{ "path": path },
						process.env
					]
				};
				var arg = rt.arg? object.clone(
					rt.arg, rtparam) : [];
				if (rt.ext) arg.push(
					__dirname + "/runtime/invoke." + rt.ext);

// use socket or pipe
var sock;// = socket;
//arg.push(':127.0.0.1');

				if (rt.callback) arg.push(rt.callback);
				if (rt.extra) {
					arg.push(".")
					arg = arg.concat(rt.extra);
				}
				rtparam.partial = true;
				rtpath = rt.path? object.clone(
					rt.path, rtparam) : {};

				var exname = rt.exec? rt.exec : rtname
				var chunk = [];
				var size, current = 0;
				execute( exname, arg, sock,
				function(newChild, input, output) {
					child = newChild;
					input.on("data", function(d) {
						receiveMessage(d, dispatchMessage);
					});
					child.send = function(o) {
						var s = Buffer.from(
							JSON.stringify(o));
						var b = Buffer.alloc(4);
						b.writeUInt32BE(s.length);
						output.write(b);
						output.write(s);
					};
					registerOnClose();
					activate();
					sendInvoke();
				});
				return;
			}
			registerOnClose(); /* XXX need not to be a func */
		}
		activate();
		sendInvoke();
	}
}
