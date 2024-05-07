// vim:ts=4 sw=4 noet:
// jshint curly:false
// Copyright (C) 2018, adaptiveflow
// Distributed under ISC License
'use strict';

var child_process;
var net;
var pathLib = require("path");
var List = require("canis/list");
var context = require("canis/context");
var server = require("canis/server");
var string = require("canis/string");
var object = require("canis/object");
var commLog = false;
var processServer;
var gcRequested;
var childMap = new Map();
var packetContext;

class MessageContext extends List {
	constructor(rtctx, callback) {
		super();
		//this.idle = undefined; // idle.child[.client], but idle can be null
		this.child = undefined;
		this.rt = undefined;
		this.rtctx = rtctx;
		this.output = undefined;
		this.invoke = undefined;
		this.callback = callback;
	}
	send(o) {
		var s = Buffer.from(JSON.stringify(o));
		var b = Buffer.alloc(4);
		b.writeUInt32BE(s.length);
		this.output.write(b);
		this.output.write(s);
	}
}

class PacketContext extends List {
	constructor(reuse, client, msgctx) {
		super();
		this.chunk = [];
		this.size = undefined;
		this.current = 0;
		this.reuse = reuse;
		this.normalExit = false;
		this.client = client;
		this.msgctx = msgctx;
		if (client) this.linkCircular(packetContext, this);
	}
};

if (process.platform == "win32") {
	var fs = require("fs");
	var pathEnv = process.env.PATH.split(pathLib.delimiter);
}

function
invokeLambda(msgctx, prefix, msg)
{
	var name = msg.name;
	if (name.indexOf(prefix) === 0)
		name = name.substring(prefix.length);

	var flag = 0;
	var option = msg.option;
	if (option) {
		if (!Array.isArray(option)) option = [option];
		var i = option.length;
		while (i > 0) {
			var f = module.exports[option[--i]];
			if (f) flag |= f;
		}
	}

	module.exports(context, name, JSON.parse(msg.ev), msg.root,
		msg.forget? flag | module.exports.FORGET : flag,
		function(err, data) {
			// correctly updated msgctx.callback should be called when "result"
			// event is raised, packet from subprocess should be transferred
			// via this msgctx (closure of this callback) of remote client :
			// subprocess -> lambda server -> client
			msgctx.send(err? err : {
				statusCode: msg.forget? 202 : 200,
				action: "result",
				payload: JSON.stringify(data),
			});
		})
}

module.exports = function(
	context, name, param, root, flag, callback, config, symbol)
{
	function invokeLocal (prefix) {
		if (!prefix.runtime) {
				prefix.runtime = "python"; // XXX
		}
		var rtctx = {
			functionName: name,
			symbol: symbol,
			root: root
		};
		if (config) {
			rtctx.lambdaPrefix = string.resolveCache(
				config, "lambdaPrefix" )
		}
//		Object.assign(rtctx, param.context);

rtctx.log_group_name = "group";
rtctx.aws_request_id = 'reqid'
		if (flag & module.exports.FORGET) {
			callback(null, {});
			callback = function() {}
		}
		module.exports.handler(
			context, prefix.runtime, rtctx, {
				src: prefix.lambda,
				path: server.invocationPath(
					process.cwd(), string.path(prefix.basePath)),
				handler: prefix.handler,
				param: param,
				remark: flag & module.exports.NO_REMARK? false : true,
			}, callback);
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

	if (!(flag & module.exports.DISABLE_REMOTE)) {
		// try AWS lambda
		prefix = context.lambdaPrefix;
		context.lambda().invoke( {
			FunctionName: prefix ? prefix + name : name,
			InvocationType: flag & module.exports.FORGET? 'Event' : 'RequestResponse',
			LogType: 'Tail',
			Payload: typeof param === 'string' ? param : JSON.stringify(param)
		}, function (err, data) {
			if (err) {
				callback(err, {});
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
		callback({
			code: "ResourceNotFoundException",
			message: "Function not found: " + name,
			statusCode: 404
		});
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


function
executeLocal(exname, arg, option)
{
	return child_process.spawn(
		process.platform != "win32" ? exname :
		matchPath(exname, pathEnv, false, pathLib),
		arg, option);
}

function
execute(msgctx, exname, arg, socket, reuse, invoke, callback)
{
	if (socket) {
		socket(reuse, function() {
			msgctx.child = executeLocal(
				exname, arg, {stdio: ["pipe", 1, "pipe"]});
			childMap.set(msgctx.child.pid, msgctx);
			msgctx.invoke = invoke; // XXX
		}, callback);
	} else {
		var child = executeLocal(
			exname, arg, {stdio: ["pipe", 1, "pipe"]});
		msgctx.child = child;
		invoke(child.stdin);
		var pktctx = new PacketContext(reuse, undefined, msgctx);
		child.stderr.on("data", function(d) {
			receiveMessage(pktctx, d, function (msg) {
				dispatchMessage(null, pktctx, msg);
			});
		});
	}
}


module.exports.getRuntime = function()
{
	return this.runtime === undefined ? (this.runtime = {
		active: new List(true),
		idle: new List(true)
	}) : this.runtime;
}


module.exports.gc = function(code, callback)
{
	if (processServer) {
		gcRequested = true;
		processServer.close(); // do this first so clear child processes
		processServer.getConnections(function(err,count) {
			if (processServer && (count <= 0 || code == "SIGTERM")) {
				if (packetContext) {
					for (var pktctx = packetContext.next;
						pktctx != packetContext; pktctx = pktctx.next) {
						pktctx.normalExit = true;
						pktctx.client.destroy();
					}
				}
				processServer = undefined;
			} else if (typeof(callback) === "function") {
				callback(count);
			}
		});
	}
}

function
receiveMessage(ctx, d, message)
{
	var chunk = ctx.chunk;
	while (true) {
		var size = ctx.size;
		if (size === undefined) {
			if ((ctx.current += d.length) <= 4) {
				chunk.push(d);
				return;
			}
			if (chunk.length > 0) {
				chunk.push(d);
				d = Buffer.concat(chunk);
				ctx.chunk = chunk = [];
			}
			ctx.size = size = parseInt(d.slice(0,4).toString("hex"),16);
			d = d.slice(4);
			ctx.current = 4;
if (commLog) console.log( ">>>>> size ", size,"with payload : ", d.length);
		}
		var current = (ctx.current += d.length);
		if (current >= size) {
			var dispatchPacket = function() {
				message(JSON.parse(Buffer.concat(chunk)));
				ctx.chunk = chunk = [];
				ctx.size = undefined;
				ctx.current = 0;
			};
			if (current > size) {
				var end = d.length + size - current;
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

function
dispatchMessage(client, pktctx, msg)
{
	function sendResolved(r)
	{
		msgctx.send({
			action: "resolved",
			body: r
		});
	}
	var msgctx = pktctx.msgctx; // redundant for pid
	switch (msg.action) {
		case "pid":
		if (client && (msgctx = childMap.get(msg.pid))) {
			childMap.delete(msg.pid);
			if (msgctx.invoke) msgctx.invoke(client);
			pktctx.msgctx = msgctx;
		}
		break;
		case "result":
		msgctx.callback(msg.err, msg.data);
		break;
		case "reuse":
		msgctx.unlinkCircular();
		if (pktctx.reuse) {
			msgctx.linkCircular(msgctx.rt.idle);
		} else {
			msgctx.send({action: "exit"});
			if (pktctx.client) {	
				pktctx.normalExit = true;
				//delete pktctx.client;
			}
		}
		break;
		case "invoke":
		invokeLambda(msgctx, msgctx.rtctx.lambdaPrefix, msg);
		break;
		case "resolve":
		var rtctx = msgctx.rtctx;
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
		msgctx.send({
			action: "command",
			body: "HELLO!!!"
		});
		break;
		case "credential":
		var aws = require("canis/context").aws();
		var cred = aws.config.credentials;
		function sendCredential() {
			msgctx.send({
				"action": "credential",
				"body": [
					cred.accessKeyId,
					cred.secretAccessKey,
					cred.sessionToken,
					cred.expireTime]
			});
		}
		if (msg.refresh && cred.needsRefresh())
			cred.refresh(sendCredential);
		else
			sendCredential();
	}
}


module.exports.exit = function()
{
	var cnt = 0;
	var runtime = context.get("fork").runtime;
	for (var r in runtime) {
		r = runtime[r];
		var head = r.idle;
		for (var i = 0; i < 2; i++ ) {
			if (head)
				for (var i = head.next; i != head; i = i.next, cnt++)
					i.send({action: "exit"});
			head = r.active;
		}
	}
	return cnt;
}

module.exports.socket = function (reuse, done, callback, quit, port, report)
{
	if (net) {
		done();
	} else {
		net = require("net");
		packetContext = new List(true);
		var msgctx = new MessageContext({}, callback);
		processServer = net.createServer(function(client) {
			var msgctx = new MessageContext({}, callback);
			var pktctx = new PacketContext(reuse, client, msgctx);
			msgctx.output = client;
			client.on("data", function(d) {
				receiveMessage(pktctx, d, function(msg) {
					dispatchMessage(client, pktctx, msg);
				});
			});
			client.on("close", function(err) {
				client.destroy();
				pktctx.unlinkCircular();
				if (!pktctx.normalExit) {
					if (pktctx.msgctx && !pktctx.msgctx.child && gcRequested)
						module.exports.gc();
					callback(new Error('UNEXPECTED_CLIENT_DISCONNECTION'));
				}
			});
		});
		processServer.listen(port? port : 31000, function() {
			var reporterServer;
			processServer.on("close", function() {
				module.exports.exit();
				if (reporterServer) reporterServer.close();
				if (quit) quit();
			});
			processServer.on('error', function(err) {
				console.log("SOCK", err);
			});

			if (report) {
				reporterServer = require("canis/reporter")(report.port,
				function(cmd) {
					switch (cmd[0]) {
						case "clear":
						return "Broadcasted: " + module.exports.exit().toString();

						case "state":
						var s = "";
						var runtime = context.get("fork").runtime;
						for (var r in runtime) {
							s += r + ":";
							r = runtime[r];
							s += " active=" + r.active.countCircular(
								r.active).toString() + ", idle=" +
								r.idle.countCircular().toString();
						}
						return s;

					}
				}, report.manageClient);
			}
			done();
		});
	}
};

module.exports.DISABLE_LOCAL = 0x1;
module.exports.DISABLE_REMOTE = 0x2;
module.exports.NO_REMARK = 0x4
module.exports.FORGET = 0x8

module.exports.handler = function(
	context, rtname, rtctx, callee, callback)
{
	var rtpath;

	function registerOnClose() {
//		msgctx.idle = {child: msgctx.child, msgctx: msgctx/*XXX*/};
		msgctx.child.on("close", function(code) {
			if (process.exitCode == 0)
				process.exitCode = code;
			msgctx.unlinkCircular();
			if (msgctx.rt.active.next == msgctx.rt.active && gcRequested)
				module.exports.gc();
			// XXX callback with error
		});
	}

	function activate() { /* XXX this need not to be function*/
		msgctx.linkCircular(msgctx.rt.active);
	}

	function sendInvoke() {/* XXX this need not to be function*/
		msgctx.send({
			action: "invoke",
			src: src,
			init: msgctx.rt.init,
			path: path,
			root: rtctx && rtctx.root? rtctx.root : null,
			rtpath: rtpath,
			handler: handlerName,
			altered: {
				name: msgctx.rt.altered,
				package: undefined
			},
			ev: ev,
			ctx: rtctx,
			remark: callee.remark
		});
	}

	var fork = context.get("fork");

	var path = callee.path;
	if (path && path.startsWith("/cygdrive/"))
		path = path.charAt(10) + ':' + path.substring(11);

	var src = callee.src;
	var handlerName = callee.handler;
	var ev = callee.param;
	if (fork === undefined) {
		try {
			require(!path || pathLib.isAbsolute(src)? src : path + "/" + src)[
				handlerName ? handlerName : "handler"]
				(ev, rtctx, callback);
		} catch (e) {
			throw (e);
		}
	} else {
		var runtime = fork.runtime;
		if (runtime === undefined)
			runtime = fork.runtime = {};

		var rt = runtime[rtname];

		for (;;) {
			/*if (msgctx.rt === undefined)
				runtime[rtname] = msgctx.rt = {};
			else if (msgctx.rt.idle)
				break;*/
			if (rt === undefined) runtime[rtname] = rt = {};
			else if (rt.idle) break;

			rt.idle = new List(true);
			rt.active = new List(true);
			break;
		}

		var msgctx = rt.idle.next;
		if (rt.idle !== msgctx) {
			msgctx.unlinkCircular();
			msgctx.callback = callback;
			msgctx.rtctx = rtctx;
		} else {
			msgctx = new MessageContext(rtctx, callback);
			msgctx.rt = rt;
			if (child_process === undefined)
				child_process = require("child_process");

			// XXX number of processes should be limited
			if (rtname === "nodejs") {
				msgctx.child = child_process.fork(__dirname + "/handler"); 
				msgctx.child.on("message", function (msg) {
					dispatchMessage(null, msgctx, msg);
				});
			} else {
				var rtparam = {
					symbol: [
						msgctx.rt.symbol,
						{ "path": path },
						process.env
					]
				};
				var arg = msgctx.rt.arg? object.clone(
					msgctx.rt.arg, rtparam) : [];
				if (msgctx.rt.ext) arg.push(
					__dirname + "/runtime/invoke." + msgctx.rt.ext);

// use socket or pipe
var sock;// = module.exports.socket;
//arg.push(':127.0.0.1');

				if (msgctx.rt.callback) arg.push(msgctx.rt.callback);
				if (msgctx.rt.extra) {
					arg.push(".")
					arg = arg.concat(msgctx.rt.extra);
				}
				rtparam.partial = true;
				rtpath = msgctx.rt.path? object.clone(
					msgctx.rt.path, rtparam) : {};

				var exname = msgctx.rt.exec? msgctx.rt.exec : rtname
				execute(msgctx, exname, arg, sock, fork.reuse, function(output) {
					msgctx.output = output;
					registerOnClose();
					activate();
					sendInvoke();
				}, callback);
				return;
			}
			registerOnClose(); /* XXX need not to be a func */
		}
		activate();
		sendInvoke();
	}
}
