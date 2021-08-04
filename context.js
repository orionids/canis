// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2018, adaptiveflow
// Distributed under ISC

// on-demand implementation for AWS context will cause
// task timeout if initialization is done in lambda handler
// when lambda in running on AWS server ( no problem in local ),
// so do this here
var aws = require("canis/awssdk").initialize();

module.exports = function()
{
	Object.assign(this, module.exports);
	this._entity = {};
};

module.exports._entity = {};

module.exports.aws = function () {
	return aws;
};

module.exports.ddbcli = function () {
	var ddbcli = this._entity._ddbcli;
	if (!ddbcli) {
		ddbcli = new aws.DynamoDB.DocumentClient();
		this._entity._ddbcli = ddbcli;
	}
	return ddbcli;
};

module.exports.lambda = function () {
	var lambda = this._entity._lambda;
	if (!lambda) {
		lambda = new aws.Lambda();
		this._entity._lambda = lambda;
	}
	return lambda;
};

module.exports.service = function(name,param)
{
	var service = this._entity[name];
	if (!service) {
		service = new aws[name](param);
		this._entity[name] = service;
	}
	return service;
}

// this used to prevent cross reference
// register self: context.module( "my/module1", this );
// load external: context.module( "my/module2", __dirname );
// cross referenced module also does the same
// context.module( "my/module2", this );
// context.module( "my/module1", __dirname );
module.exports.module = function (name,loc,lazy) {
	var entity = this._entity;
	function r() {
		var m = entity[name];
		if (m !== undefined) {
			//console.log( name + ": cached=======" );
			return m;
		}
		//console.log( name + ": required=======" );
		return (entity[name] = require(loc + "/" + name));
	}
	if (typeof loc === "string") {
		if (lazy === undefined) return r();
		this[lazy] = r; // so call context[lazy]() for lazy binding
	} else {
		//console.log( name + ": self registered=======" );
		entity[name] = loc;
	}
};

module.exports.set = function(name,value)
{
	if (value === undefined) delete this._entity[name];
	else this._entity[name] = value;
};

module.exports.get = function(name)
{
	return this._entity[name];
};

module.exports.delay = function(prop,f,param)
{
	var delay = this.get(prop);
	if (delay !== undefined) {
		this.setProperty(prop);
		setTimeout(function () {
			f.apply(this, param);
		}, delay);
		return true;
	}
};

