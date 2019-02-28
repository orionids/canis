// vim:ts=4 sw=4:
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

"use strict";
function recoverConfig(aws) {
	if ( aws ) {
		var region = process.env.AWS_DEFAULT_REGION;
		if ( region != "" ) aws.config.update( { region : region } );
		var ddblocal = process.env.DYNAMODB_LOCAL;
		if ( ddblocal != "" ) aws.config.update( { endpoint: ddblocal } );
	}
}

exports.recover = recoverConfig;
exports.initialize = function(aws) {
	if ( !aws ) {
		var awssdk = process.env.AWS_SDK;
		try {
			aws = require(  awssdk === undefined ?
				'aws-sdk' : awssdk );
		} catch (e) {
		}
	}
	recoverConfig(aws);
	return aws;
};
