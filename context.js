// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2018, adaptiveflow
// Distributed under ISC

// on-demand implementation for AWS context will cause
// task timeout if initialization is done in lambda handler
// when lambda in running on AWS server ( no problem in local ),
// so do this here
"use strict";
var fs = require("fs");
var path = require("path");
var storage = require("canis/storage");
var child_process = require("child_process");
var List = require("canis/list");
var aws;

function awsContext(name, param)
{
	if (aws === undefined)
		aws = require("canis/awssdk").initialize();
	return name? new aws[name](param) : aws;
}

function
githubUrl(account, path)
{
	var i = path.indexOf("/", 1);
	if (i > 0) {
		var path =  "/" + account + path.substring(0, i) +
			"/master" + path.substring(i);
		return {
			"protocol": "https",
			"host": "raw.githubusercontent.com",
			"path": path
		}
	}
}

function defaultEntity()
{
	var map = new Map();
	map.set("@orionids", githubUrl);
	return map;
}

module.exports = function()
{
	Object.assign(this, module.exports);
	this._entity = defaultEntity();
};

module.exports.modulePath = undefined;

module.exports._entity = defaultEntity();

module.exports.aws = awsContext;

module.exports.ddbcli = function() {
	var ddbcli = this._entity.get("_ddbcli");
	if (!ddbcli) {
		ddbcli = awsContext("DynamoDB").DocumentClient();
		this._entity.set("_ddbcli", ddbcli);
	}
	return ddbcli;
};

module.exports.lambda = function() {
	var lambda = this._entity.get("_lambda");
	if (!lambda) {
		lambda = new awsContext("Lambda");
		this._entity.set("_lambda", lambda);
	}
	return lambda;
};

module.exports.service = function(name,param)
{
	var service = this._entity.get(name);
	if (!service) {
		service = awsContext(name, param);
		this._entity.set(name, service);
	}
	return service;
}

// this used to download module dynamically or
// to prevent cross reference
// register self: context.module( "my/module1", this );
// load external: context.module( "my/module2", __dirname );
// cross referenced module also does the same
// context.module( "my/module2", this );
// context.module( "my/module1", __dirname );
// = to download module dynamically (URL as loc)
module.exports.module = function(name, loc, lazy) {
	var entity = this._entity;
	function r() {
		var m = entity.get(name);
		if (m === undefined) {
			m = require(loc);
			entity.set(name, m);
		}
		return m;
	}

	if (loc == null) {
		loc = name;
	} else if (typeof loc !== "string") {
		entity[name] = loc;
		return;
	} else {
		loc += "/" + name;
	}
	if (loc.charAt(0) === "@") {
		var i = loc.indexOf("/");
		if (i > 0) {
			var account = loc.substring(0, i);
			if (path.extname(loc).length <= 0)
				loc += ".js";

			var p = this.get("modulePath");
			if (p === undefined) p = __dirname + "/module";
			p += "/" + loc.substring(1);
			if (!fs.existsSync(p)) {
				var req = entity.get(account)(
					account.substring(1), loc.substring(i));
				var result = child_process.spawnSync(
					process.argv[0], [
						__dirname + "/getsync",
						req.protocol, req.host, req.path
					]);
				if (result.status == 0) {
					storage.createDirectory(p, 1);
					fs.writeFileSync(p, result.stdout);
				}
			}
			loc = p;
		}
	}
	if (lazy === undefined) return r();
	if (lazy !== true) entity.set(lazy, r);
};

module.exports.bind = function(lazy)
{
	return this._entity.get(lazy)();
};

module.exports.set = function(name,value)
{
	if (value === undefined) this._entity.delete(name);
	else this._entity.set(name, value);
};

module.exports.get = function(name)
{
	return this._entity.get(name);
};

module.exports.delay = function(prop,f,param)
{
	var delay = this.get(prop);
	if (delay !== undefined) {
		this.set(prop);
		setTimeout(function() {
			f.apply(this, param);
		}, delay);
		return true;
	}
};

module.exports.Runtime = class {
	constructor(init, exec, ext, path, altered, arg, extra, symbol) {
		this.init = init;
		this.exec = exec;
		this.ext = ext;
		this.path = path;
		this.altered = altered;
		this.arg = arg;
		this.extra = extra;
		this.symbol = symbol;
		this.active = new List(true);
		this.idle = new List(true);
	}
}
