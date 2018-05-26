// Copyright (c) 2018, adaptiveflow
// Distributed under ISC

// on-demand implementation for AWS context will cause
// task timeout if initialization is done in lambda handler
// when lambda in running on AWS server ( no problem in local ),
// so do this here
var aws = require( "canis/awssdk" ).initialize();

module.exports = function() {
	for ( p in module.exports ) {
		if ( p.charAt(0) !== '_' )
			this[p] = module.exports[p];
	}
	console.log( this );
};

module.exports.aws = function () {
	return aws;
};

module.exports.ddbcli = function () {
	var ddbcli = this._ddbcli;
	if ( !ddbcli ) {
		ddbcli = new aws.DynamoDB.DocumentClient();
		this._ddbcli = ddbcli;
	}
	return ddbcli;
};

module.exports.lambda = function () {
	var lambda = this._lambda;
	if ( !lambda ) {
		lambda = new aws.Lambda();
		this._lambda = lambda;
	}
	return lambda;
};

module.exports.cwe = function () {
	var cwe = this._cwe;
	if ( !cwe ) {
		cwe = new aws.CloudWatchEvents();
		this._cwe = cwe;
	}
	return cwe;
};

