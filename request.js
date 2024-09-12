// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2017, 2018 adaptiveflow
// Distributed under ISC

"use strict";

var rl = require("readline");
var fs = require("fs");
var string = require("canis/string");
var object = require("canis/object");
var parser = require("canis/parser");
var context = require("canis/context");
var server = require("canis/server");
var iterator = require("canis/iterator");
var syntax = require("canis/syntax");
var path = require("path");
var mime = require("canis/mime");

function
clone(request, symbol, callback, kill, loose)
{
	var resolve = {
		symbol : symbol === undefined ?
			[process.env] : symbol,
		ctx : {loose: loose == null? true : loose},
		include: true,
		kill: kill
	};
	var r = object.clone(request, resolve);
	if (r) {
		if (r.init) r.init(r, callback, resolve);
		else process.nextTick(callback, r);
	} else {
		callback(null, resolve.ctx.symbol);
	}
}

function
cloneTC(request, symbol, param, callback, kill, loose)
{
	var next = request.next;
	var resolved = request.resolved;
	request.next = undefined
	clone(request, symbol, function(r,symbol) {
		if (r && param.initializer)
			param.initializer(r, param);
		context.set("tc", r);
		if (next) {
			if (r) r.next = next
			request.next = next;
		}
		if (resolved) {
			if (r) r.resolved = resolved;
			request.resolved = resolved;
		}
		callback(r, symbol);
	}, kill, loose);
}

if (context.get("resolve") === undefined)
	context.set("resolve", clone);

exports.override = function(target, source) {
	for (var s in source) {
		if (source.hasOwnProperty(s)) {
			var sv = source[s];
			if (typeof sv === 'object') {
				exports.override(target[s], sv);
			} else {
				target[s + "_orig"] = target[s];
				target[s] = sv;
			}
		}
	}
};

function
invokeLambda(api, symbol, request, response, local)
{
	var invoke = require("canis/invoke");

	var apiConfig = api? api.configuration : undefined
	if (local) {
//		context.['^' +  = api;
	} else if (context.lambdaPrefix === undefined && apiConfig) {
// XXX overwritten case
		context.lambdaPrefix =
			string.resolve(apiConfig.lambdaPrefix,symbol);
	}

	invoke(context, request.api, request.payload, null,
		local? response.remark === false?
		invoke.DISABLE_REMOTE | invoke.NO_REMARK :
		invoke.DISABLE_REMOTE : invoke.DISABLE_LOCAL,
		function(err,data) {
            if (err) process.exitCode = 1;
			response.writeHead(err?err.statusCode:200,{});
			response.write(data?typeof(data)=="string"?
				data:JSON.stringify(data):"");
			response.end();
		}, apiConfig, symbol);
}

exports.https = function(
	context, api, basepath, request, response, param)
{
	var httpreq, https, symbol, kill;
	if (param) {
		httpreq = param.httpreq;
		https = param.https;
		symbol = param.symbol;
		kill = param.kill;
	}
	cloneTC(request, symbol, param, function(r) {
		if(r) {
			var apiInfo = param.apiInfo ? param.apiInfo(r) : {};

			if (request.method == "INVOKE") {
					invokeLambda(api,symbol,r,response);
			} else {
				if (httpreq === undefined ) httpreq = require( "canis/httpreq");
				if (https === undefined ) https = require( "https");
				var apipath = apiInfo.stage ? r.api : r.stage + r.api;
				r.path = basepath && !apiInfo.set?
					(apiInfo.base? apiInfo.base : basepath) + apipath : apipath;
				httpreq(https, r, function( err, data, res) {
					if (err) {
						response.writeHead(err.statusCode, res.headers);
						response.write(err.message);
						response.end(err.message);
					} else {
						response.writeHead(res.statusCode, res.headers);
						response.write(data);
						response.end(data);
					}
				} );
			}
		}
	}, kill, true);
//XXX exception
};

exports.http = function
(context, api, basepath, request, response, param) {
	var p = {
		https: require("http")
	};
	Object.assign(p, param);
	exports.https( server, api, basepath,
		request, response, p );
}

exports.show = function
(context, api, basepath, request, response, param) {
	var symbol;
	var kill;
	if (param) {
		if (param.arg != "raw") symbol = param.symbol;
		kill = param.kill;
	}
	cloneTC(request, symbol, param, function (r, name) {
		console.log(syntax.highlight(JSON.stringify(r, null, 3)));
	}, kill);
}

exports.local = function
(context, api, basepath, request, response, param) {
	var symbol, kill;
	if (param) {
		symbol = param.symbol;
		kill = param.kill;
	}
	cloneTC(request, symbol, param, function (r, name) {
		if (r) {
			if (r.method == "INVOKE") {
				context.fork = param.fork;
				invokeLambda(api, symbol, r, response, true);
			} else {
				r.on = function(n,f) {
					switch (n) {
						case "data" :
						f( Buffer.from( r.body === undefined? "" :
							JSON.stringify(r.body,0,2) ) );
						break;
						case "end": f(); break;
					}
				};
				if (r.stage) r.api = r.stage + r.api;
				return server.invoke(context, api, basepath, r, response, param);
			}
		} else {
console.log("Symbol not found!!!!!!!!!!1", name)
response.end();
		}
	}, kill, false);
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
	if (conditional)
		code.push("if ( !(" + fconv(conditional) + ")() ) return;");

	code.push("pm.test(\"" + detail + "\", function() {");

	code.push(
		"\tpm.expect(pm.response.code).to.be.oneOf([" +
		(statusCode? statusCode : 200) + "]);" );

	var sym = req.symbol;
	var result = req.result;
	if (sym || result) {
		code.push( "\tvar headers = {};\n" +
		"\tvar h = pm.response.headers.all();\n" +
		"\tfor ( var i = 0; i < h.length; i++) {\n" +
		"\t\tvar hi = h[i];\n" +
		"\t\theaders[hi.key] = hi.value;\n" +
		"\t}\n" );
		code.push("\tvar response = { \"headers\": headers,\"body\" : JSON.parse(responseBody) };");
	}
	if (sym) {
		for (var attr in sym) {
			code.push( "\tpm.environment.set( \"" + attr +
				"\", response.body." + sym[attr] + " );" );
		}
	}

	if (result) {
		code.push( "\t(" + fconv(result) +
			")(response,function(r){" );
		code.push(	"\t\tpm.expect(r).to.be.true;\n\t});" );
	}
	code.push("});");

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
	for (var key in request.headers) {
		if (key.toLowerCase() != "origin") {
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
	switch (method) {
		case "POST":
		case "PUT":
		body.mode = "raw";
		body.raw = JSON.stringify(request.body);
	}

	var apipath = request.api;
	var qp = server.queryParameter(apipath);
	var qpi = qp.index;
	var name = apipath.substring(0,qpi > 0? qpi : undefined);

	var path = config.path;
	var info = {};
	var information = request.information;
	if (information) {
		information(info);
		if (path === undefined) path = info.path;
	}

	if (path === undefined) {
		var apiset = request.apiSet;
		if (apiset) {
			if (Array.isArray(apiset)) apiset = apiset[0];
			path = [apiset.substring(apiset.lastIndexOf('/') + 1)]
		} else {
			path = [];
		}
	}

	var i = 1, j;
	var p = name;
	while ((j = name.indexOf('/',i) ) > 0) {
		path.push(name.substring(i,j));
		i = j + 1;
	}
	path.push(name.substring(i));

	name = request.name? request.name : method + " " + name;
	if (request.nameSuffix) {
		if (config.nameSuffixSeparator)
			name += config.nameSuffixSeparator;
		name += request.nameSuffix;
	}
	var base = config.base;
	var pmurl = { "raw": base + apipath, "path": path }
	i = base.indexOf(":");
	if (i > 0) {
		pmurl.protocol = base.substring(0,i);
		i += 2;
	}

	var host = [];
	while (i !== undefined) {
		j = base.indexOf('.',++i);
		if (j < 0) {
			j = base.indexOf('/',i);
			if (j < 0) j = undefined;
		}
		host.push(base.substring(i,j));
		i = j;
	}
	pmurl.host = host;

	if (qpi > 0) {
		var query = []
		for (var a in qp.param) {
			query.push({ key : a, value: qp.param[a] })
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
						(detail? detail : name, request),
				}
			}
		],
		request: {
			"method": method,
			"header": header,
			"body": body,
			"api": pmurl
		},
		response: []
	};

	if (config.id) {
		tc.event[0].script.id = config.id;
		tc.event[0].script.type = "text/javascript";
	}

	if (request.sleep > 0) {
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
		//if (config.id) {
		//	tc.event[0].script.id = config.id;
		//	tc.event[0].script.type = "text/javascript";
		//}
	}

//	console.log(tc);
	var tab = config.tab;
	var s = JSON.stringify(tc,null,tab? tab : "\t");
	var shift = config.shift;
	if (shift === undefined) shift = "";
	s = shift + s.replace(/\n/g,"\n" + shift)
	console.log(s);
//		r = c + "\"" + r.replace(/\t/g,"\\t" ).
}

function
upperFirst(s)
{
	var i = s.charAt(0) == '/'? 1 : 0;
	return s.charAt(i).toUpperCase() + s.substring(i + 1);
}

exports.postman = function
	(context, api, basepath, request, response, param) {
	var symbol, kill;
	if (param) {
		symbol = param.symbol;
		kill = param.kill;
	}
	cloneTC( request, symbol, param, function(r) {
		postman_generate(context,r,param);
	}, kill);
}


exports.resolve = function
	(context, api, base, request, response, param)
{
	function modify(s, op) {
		if (s) {
			for (var o in op) {
				switch (op[o]) {
					case "lower": s = s.toLowerCase(); break;
					case "upper": s = s.toUpperCase(); break;
					case "upperFirst":
					s = upperFirst(s);
					break;
					case "camel":
					var pc = parser.context(s);
					var t;
					s = parser.token(pc);
					while ((t= parser.token(pc))) {
						s += upperFirst(t);
					}
					break;
				}
			}
		}
		return s;
	}

	var method;
	var arg = []
	var matched = request.api.substring(1).split('/');
	var resolve = param.resolve;

	var symbol = object.clone(
		param.symbol, {recursive: false});
	if (symbol) {
		var f, target;
		if (Array.isArray(symbol)) {
			target = {}
			symbol.unshift(target);
		} else {
			target = symbol;
			f = symbol['?']
		}
		target['?'] = function
		resolveSymbol(ctx, s, symbol, explicit) {
			var val;
			var i = s.indexOf('=');
			if (i > 0) {
				val = resolveSymbol(ctx, s.substring(0, i),
					symbol, explicit);
				if (val) return val;
				arg.push(s); // only undefined symbols as arg
				return s.substring(i + 1);
			} else {
			}
			var last;
			var op = [];
			var pc = parser.context(s);
			var name = parser.token(pc);

			while ((last = parser.last(pc)) == '.' || last == '=') {
				var operand = parser.token(pc);
				if (operand) {
					if (last == '.') {
						op.push(operand);
					} else {
						val = operand;
						break;
					}
				} else {
				}
			}
			var r, pathOnly;
			switch (name) {
				case "API_PATH_ONLY": pathOnly = true;
				case "API_PATH":
				var resolved;
				for (i = 0; i < matched.length; i++) {
					var m = matched[i];
					if (pathOnly) {
						if (m.charAt(1) == '{') continue;
					}
					resolved = resolved === undefined?
						(op == "camel" ? m : modify(m,op)) :
						(resolved + modify(
							last + m, op));
				}
				return resolved;
				case "API_METHOD":
				return modify(request.method,op);
				case "LAMBDA_PATH":
				var l = method.lambda;
				return l.substring(
					0, l.length - path.extname(l).length);
				case "LAMBDA_HANDLER":
				return "lambda_handler"; // XXX
				case "LAMBDA_RUNTIME":
				return "python3.11"; // XXX
			}
			name = string.symbol(name, param.symbol, true);
//				if (val !== undefined) { // there is conditional value
//					if (r != val) return undefined; // resolved value doesn't match conditional value
//				}
			if (name === undefined) return undefined;
			return modify(name, op);
			//if (f ) return f( ctx, s);
		}
	}
	clone(request, param.symbol, function (r) {
		// XXX dup code
		if (r.stage) r.api = r.stage + r.api;
		// to get matched, call server.invoke
		r.on = function() {};
//		method = server.invoke(
//			context, api, base, r, response, param, matched);

		var t = 0;
		var template = resolve.template;
		(function iterate() {
			var fileName = template[t];
			var rlif = rl.createInterface( {
				input: fs.createReadStream(fileName),
				console: false
			} );
			var contents = [];
			rlif.on( "line", function(l) {
				if (l = string.resolve(l, symbol, {
					delim: resolve? resolve.delim : undefined
				})) contents.push(l);
			} );
			rlif.on( "close", function() {
				var i = t++;
				resolve.complete( i, fileName,
					arg, contents.join('\n'),
					t < template.length ?
					iterate : undefined );
				arg = [];
			} );
		})();
	});
}

var callee = {
	"local" : exports.local,
	"https" : exports.https,
	"http" : exports.http,
	"postman" : exports.postman,
	"resolve" : exports.resolve,
	"show": exports.show
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
	callback, api, basepath, request, param )
{
	var i;
	var elapsed;
	function perform() {
		var response = callback(
			i, symbol.length,
			elapsed === undefined? undefined : Date.now() - elapsed, perform);
		if (i < symbol.length) {
			e.symbol[0] = symbol[i++];
			elapsed = Date.now();
			callee[target]( context, api, basepath, request, response, e );
		} else {
			require("canis/invoke").gc();
		}
	}
	var e = {};
	for (var p in param) {
		if (param.hasOwnProperty(p)) e[p] = param[p];
	}

	var s = e.symbol;
	if (s === undefined) {
		e.symbol = [null, process.env];
	} else if (Array.isArray(s)) { // assume array
		e.symbol = [null];
		for (i = 0; i < s.length; i ++) {
			e.symbol.push(s[i]);
		}
		e.symbol.push(process.env);
	} else { // assume object
		e.symbol = [null, s, process.env];
	}

	i = 0;
	if (!symbol || symbol.length <= 0) symbol = [null];
	perform();
};

exports.basePath = function(tc, apiset)
{
	var base = tc.base;
	if (base !== null && base !== undefined) return base;
	if (apiset) {
		if (Array.isArray(apiset)) apiset = apiset[0];
		var i = apiset.lastIndexOf("/")
		if (i > 0) return apiset.substring(i);
	}
}

exports.load = function(
	context, basepath, filePath, target, lambdaInfo)
{
	var serverPath;
	function loadAPI(name) {
		var api = server.loadAPI(context, name, serverPath);
		if (api)
			return {api: api, name: name}
	}
	if (lambdaInfo) {
		var i = filePath.indexOf("/");
		var basePathConf;
		var feature = "";
		var handler;
		var type;
		var feature;
		if (typeof lambdaInfo === 'object') {
			serverPath = lambdaInfo.serverPath;
			handler = lambdaInfo.handlerName;
			type = lambdaInfo.type;
			feature = lambdaInfo.feature;
			basePathConf = lambdaInfo.basePath;
		} else {
			serverPath = lambdaInfo;
			handler = undefined;
		}
		while (i > 0) {
			var apiInfo = loadAPI(
				type? type : filePath.substring(0, i));
			if (!apiInfo) {
				var j = filePath.indexOf("/", ++i);
				apiInfo = loadAPI(type && feature?
					type + "/" + feature :
					filePath.substring(0, j));
				if (!apiInfo) {
					apiInfo = loadAPI( feature? feature :
						filePath.substring(i, j));
					if (!apiInfo) break;
					feature = apiInfo.name + "-";
				}
			}

			basePathConf = apiInfo.api.configuration.basePath;
			serverPath += "/" + apiInfo.name;
			break;
		}

		if (basepath == null) basepath = ".";
		var index = filePath.lastIndexOf("/");
		var name = feature + (index >= 0 ? filePath.substring(index + 1 ) : filePath);
		var src = path.normalize(string.path(basepath)) + path.sep + filePath + ".py";
		var cwd = process.cwd();
		src = (process.platform === "win32"?
			src.toLowerCase().indexOf(cwd.toLowerCase()) :
			src.indexOf(cwd)) == 0 ?
			src.substring(cwd.length + 1) : src;
		server.registerLambda( context, {
			[name] : {
				lambda : path.normalize(process.platform === "win32"?
					src.replace(/\\/g,"/") : src),
				handler: handler
			}
		}, basePathConf );
		return {
			apiSet: serverPath,
			method: "INVOKE",
			api: name
		}
	}
	return object.load(basepath + "/" + filePath);
}

exports.traverse = function(
	base, attr, recursive, progress, callback)
{
	var executed = {};
	do {
		var space = object.load(base);
		if (!attr || (space = object.attribute(space, attr)))
			break;
		if (!recursive) return;
	} while (0);
	var iter = new iterator(progress)

	return (function add(space) {
		iter.add(space.length, space, function(iter, test, i) {
			try {
				var t = test[i];
				var path = t.path;
				if (t.run == "recursive") {
//					if (path === undefined)
//						path = recursive;
//					console.log(fs.readdirSync(path));
				} else {
					if (executed[path] != true) {
						executed[path] = true;

						callback( base + "/" + t.path, t.input,
						function(response) {
							// XXX evaluate result
							if (t.test)
								add(t.test);
	console.log(path);
							iter.run();
						} )
					} else {
						console.log("EXE", path, i);
						process.exit(1);
					}
				}
			} catch(e) {
				console.log("---",e);
				return iterator.END;
			}
			return iterator.PENDING;
		});
		return iter;
	})(space);
}

try {
	var validator = require("jsonschema").Validator;
} catch(e) {
	validator = require("canis/validator");
}

exports.evaluate = function(tc, code, response)
{
	if (!tc) return true;
	var success = tc.success;
	if (!success) return false;
	if (typeof success === 'string')
		success = tc.success = require(success);

	var error = tc.error;
	if (code != null && code != success.statusCode) {
		tc.error = true;
		return false;
	}
	if (response != null && success.response) {
		var result = new validator().validate(
			response, success.response);
		if (result.errors.length > 0) {
			tc.error = true;
			return false;
		}
	}
	return error? false : true;
}

function
getvar(name)
{
	var value = process.env[name];
	if (value === undefined) {
		var tc = context.get("tc");
		if (tc) {
			var resolved = tc.resolved;
			if (resolved)
				return resolved[name];
		}
	}
	return value;
}

exports.Response = class {
	constructor(perform, remark) {
		this.text = null;
		this.headers = null;
		this.contentType = null;
		this.perform = null;
		this.remark = remark === undefined? true : remark;
	}

	writeHead(s, h) {
		this.headers = h;
		if (this.remark !== false) {
			if (h) {
				this.contentType = h['Content-Type'];
				h = syntax.highlight(JSON.stringify(h,null,3));
			} else {
				h = "No header";
			}

			exports.evaluate(context.get("tc"), s);
			console.log( "----- RESPONSE(status " + s + ")-----", h);
		}
	}

	write(result) {
		function next() {
			var nextTC = tc.next;
			var run = tc.run;
			if (nextTC && run) {
					// update TC
					context.set("tc", nextTC);
					// propagate executor and resolved symbols
					nextTC.run = run;
					nextTC.resolved = tc.resolved;
					run(nextTC);
			}
		}
		var r;
		var tc = context.get("tc");
		var tcres = tc.result;
		if (result) {
			var resstr = this.text = result.toString();
			switch (resstr.charAt(resstr.search(/\S|$/))) {
				case '{':
				case '[':
				try {
					r = JSON.parse(resstr);
					break;
				} catch(e) {
				}
				default:
				r = result;
			}
			// tc.response function can edit response
			var json = tc && tc.response? tc.response(r) : r;
			if (json) {
				for (var e in mime.extension) {
					var type = mime.extension[e];
					var text;
					if (typeof type === "object") {
						type = type.type;
						text = type.text;
					} else {
						text = false;
					}
					if (this.contentType && this.contentType.includes(type)) {
						if (type.startsWith("text/") || text)
							json = json.toString();
						break;
					}
				}
				json = JSON.stringify(json, null, 3);
				console.log(syntax.highlight(json));
				if (exports.remark !== false)
					console.log(exports.evaluate(context.get("tc"), null, json)?
						"\x1b[92mPass\x1b[0m" : "\x1b[91mFail\x1b[0m");
			} else {
				console.log("Error in response")
			}
		} else {
			r = {};
		}
		if (tc !== undefined) {
			var s = tc.symbol;
			if (s) {
				var resolved = tc.resolved;
				if (resolved === undefined)
					resolved = tc.resolved = {};
					for (var a in s) {
						try {
							resolved[a] = object.attribute(r, s[a]);
						} catch (e) {
						}
					}
			}
			if (tcres) {
				tc.getvar = getvar;
				tcres({
					headers: this.headers,
					body: r
				}, function(r) {
					console.log(
						tc.method, tc.url, ": " + (r? "success" : "FAIL"));
					next();
				});
			} else {
				next();
			}
		}
	}

	end() {
		if (this.perform) this.perform();
	}
};
// EOF
