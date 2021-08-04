// vim:ts=4 sw=4:
// jshint curly:false
// Copyright (C) 2018, adaptiveflow
// Distributed under ISC License
'use strict';

var list;
var child_process;
var context = require("canis/context");
var server = require("canis/server");
var string = require("canis/string");
var object = require("canis/object");
var commLog = false;

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

module.exports =
function ( context, name, param, flag, callback, config )
{
	function invokeLocal ( prefix ) {
			if ( ! prefix.runtime ) {
					prefix.runtime = "python"; // XXX
			}
		var rtctx = {
			functionName: name,
		};
		if ( config ) {
			rtctx.lambdaPrefix = string.resolveCache
				( config, "lambdaPrefix" )
		}
//		Object.assign( rtctx, param.context );

rtctx.log_group_name = "group";
rtctx.aws_request_id = 'reqid'
		module.exports.handler( context, prefix.runtime,
			prefix.lambda, server.invocationPath(
				process.cwd(), string.path(prefix.basePath)),
			prefix.handler, param, rtctx, callback )
		return;
		try {
			param.method = "POST";
			param.url = "/";
			var r = param;

			/* XXX routine in request.js */
			r.on = function(n,f) {
					switch ( n ) {
						case "data" :
						f( Buffer.from( r.body === undefined? "" :
							JSON.stringify(r.body,0,2) ) );
						break;
						case "end": f(); break;
					}
				}
			if ( ! prefix.runtime ) {
					prefix.runtime = "python"; // XXX
			}
			return server.invoke( {
				"/" : {
					"POST" : prefix,
				}
			}, process.cwd(), r, {
				writeHead: function(s,h) {
					console.log( s, h );
				},
				write: function(res) {
//					console.log( r, typeof(r) );
					callback( null, res );
				},
				end: function() {
//					callback();
				}
			}, { fork: context.fork } );
		} catch ( e ) {
			if ( e.code !== "MODULE_NOT_FOUND" ) {
				setTimeout( function() {
					callback( e );
				} );
				return true;
			}
		}
	}

	var f = context.get( "canis_invoke" );
	if ( f !== undefined ) flag = f;

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

	if ( false && !(flag & module.exports.DISABLE_REMOTE) ) {
		// try AWS lambda
		prefix = context.lambdaPrefix;
		context.lambda().invoke( {
			FunctionName: prefix ? prefix + name : name,
			InvocationType: 'RequestResponse',
			LogType: 'Tail',
			Payload: typeof param === 'string' ? param : JSON.stringify(param)
		}, function ( err, data ) {
			if ( err ) {
				callback( err );
			} else if ( data.StatusCode == 200 ) {
				// to maintain consistency with calling local function,
				// assume json formatted result
				var payload = JSON.parse(data.Payload);
				if ( data.FunctionError ) callback( payload );
				else callback( null, payload );
			} else {
				callback( new Error( 'UnexpectedException' ) );
			}
		} );
	} else {
		callback( { code: "ResourceNotFoundException" } );
	}
};

function
matchPath(filename, pathenv, plain) {
	if (!plain && process.platform === "win32" &&
		!pathLib.extname(filename)) filename += ".exe";
	if (pathenv === undefined)
		pathenv = process.env.PATH.split(pathLib.delimiter);

	for (var i in pathenv) {
		var fn = pathenv[i] + pathLib.sep + filename;
		if (fs.existsSync(fn)) return fn;
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
			// XXX callback with error
		});
	}
	function activate() {
		list.linkCircularNode(rt.active, idle);
	}
	function sendInvoke() {
		child.callback = callback; // XXX is this needed ?
		child.send({
			action: "invoke",
			src: src,
			path: rtpath,
			handler: handlerName,
			altered: {
				name: "utrun", /* XXX this should be variable */
				package: undefined
			},
			ev: ev,
			ctx: rtctx
		});
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
		var runtime = fork.runtime;
		if (runtime === undefined)
			runtime = fork.runtime = {};
		rt = runtime[rtname];
		for (;;) {
			if (rt === undefined)
				runtime[rtname] = rt = {};
			else if (rt.idle)
				break;

			var head = {};
			head.prev = head.next = head;
			rt.idle = head;
			head = {};
			head.prev = head.next = head;
			rt.active = head;
			break;
		}

		idle = rt.idle.next;
		if (idle !== rt.idle) {
			list.unlinkCircularNode(idle);
			child = idle.child;
		} else {
			if (child_process === undefined) {
				child_process = require("child_process");
				list = require("canis/list");
			}

			var dispatchMessage = function(msg) {
				switch (msg.action) {
					case "result":
					child.callback(msg.err, msg.data);
					break;
					case "reuse":
					list.unlinkCircularNode(idle);
					if (fork.reuse) {
						console.log("REUSING PROCESS"); //XXX
						list.linkCircularNode(rt.idle, idle);
					} else {
						child.send({action: "exit"});
					}
					break;
					case "invoke":
					invokeLambda(
						rtctx.lambdaPrefix, msg, child);
				}
			};

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
				}
				var arg = rt.arg? object.clone(
					rt.arg, rtparam) : [];
				if (rt.ext) arg.push(
                    __dirname + "/runtime/invoke." + rt.ext);
				if (rt.callback) arg.push(rt.callback);
                if (rt.extra) {
                    arg.push(".")
                    arg = arg.concat(rt.extra);
                }
                rtparam.partial = true;
				rtpath = rt.path? object.clone(
					rt.path, rtparam) : {};
				if (rtpath.major)
					rtpath.major.unshift(path);
				else
					rtpath.major = [path];

				var exname = rt.exec? rt.exec : rtname
				child = child_process.spawn(
					process.platform != "win32" ? exname:
					matchPath(exname, pathEnv, false, pathLib),
					arg, {stdio: ["pipe", "pipe", 2]});
				var chunk = [];
				var size, current = 0;
				child.stdout.on("data", function(d) {
					while (true) {
						if (size === undefined) {
							current += d.length;
							if (current < 4) {
								chunk.push(d);
								return;
							}
							if (chunk.length > 0) {
								d = Buffer.concat(chunk);
								chunk = [];
							}
							if (current == 4) {
	if ( commLog) console.log( ">>>>> only size field received :", size );
								return;
							}
							size = parseInt(d.slice(0,4).toString("hex"),16);
							d = d.slice(4);
							current = 4;
	if ( commLog) console.log( ">>>>> size ", size,"with payload : ", d.length );
						}
						current += d.length;
						if (current >= size) {
							var dispatchPacket = function() {
								dispatchMessage(
									JSON.parse(Buffer.concat(chunk)));
								chunk = [];
								size = undefined;
								current = 0;
							};
							if (current > size) {
								var end = d.length +
									size - current;
								chunk.push(d.slice(0,end));
	if (commLog) console.log( ">>>>> Exceeding payload received, end=", end );
								dispatchPacket();
								d = d.slice(end);
								continue;
							} else {
	if ( commLog) console.log( ">>>>> Exact payload received" );
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
				});

				child.send = function(o) {
					var s = Buffer.from(JSON.stringify(o));
					var b = Buffer.alloc(4);
					b.writeUInt32BE(s.length);
					child.stdin.write(b);
					child.stdin.write(s);
				};
				var init = rt.init;
				if (init) {
					registerOnClose();
					activate();
					/*var i = 0;
					(function initialize() {
						if (i < init.length) {
							child.callback = initialize;
							child.send({
								action: "init",
								src: init[i],
								path: path
							});
							i++;
						} else {			
							sendInvoke();
						}
					})();*/
					child.callback = sendInvoke;
					child.send( { action: "init",
						src: init,
						path: path
					} );
					return;
				}
			}
			registerOnClose();
		}
		activate();
		rtpath = { major: [path] }
		sendInvoke();
	}
}

