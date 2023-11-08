// vim:ts=4 sw=4:
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

"use strict";
var fs = require("fs");
var context = require("canis/context");
var string = require("canis/string");
var otp = require("canis/otp");

function recoverConfig(aws) {
	if ( aws ) {
var param;
		var region = process.env.AWS_DEFAULT_REGION;
		if ( region != "" ) param = { region : region }
// aws.config.update( { region : region } );
		var ddblocal = process.env.DYNAMODB_LOCAL;
		if ( ddblocal != "" ) //aws.config.update( { endpoint: ddblocal } );
		param? param.endpoint = ddblocal : { endpoint: ddblocal };
		aws.config.update( param );
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

		var oldcred = aws.config.credentials;
		class cred extends aws.Credentials {
			constructor() {
				super();
				var c = process.env.AWS_TEMPORARY_CREDENTIAL.split(",");
				this.serialNumber = "arn:aws:iam::" + string.resolve(c[0]) + ":mfa/" + string.resolve(c[1]);
				this.mfaKey = string.resolve(c[2]);
				var duration = parseInt(string.resolve(c[3]));
				this.duration = duration < 900 ? 900 : duration > 129600 ? 129600 : duration;
				this.path = string.resolve(c[4]);
				try {
					c = JSON.parse(fs.readFileSync(this.path));
					this.expireTime = new Date(c.expireTime);
					this.accessKeyId = c.accessKeyId;
					this.secretAccessKey = c.secretAccessKey;
					this.sessionToken = c.sessionToken;
				} catch (e) {
					this.expireTime = "1970-01-01 00:00:00Z";
				}
			}

			refresh(callback) {
				var p = otp.google(this.mfaKey);
				var param = {
					DurationSeconds: this.duration, 
					SerialNumber: this.serialNumber,
					TokenCode: p.code
				};
				var newcred = this;
				aws.config.credentials = oldcred;
				process.nextTick(function() {
					context.service("STS").getSessionToken(
						param, function(err, data) {
							if (err) {
								console.log(err);
							} else {
								var c = data.Credentials;
								aws.config.credentials = newcred;
								newcred.expired = false;
								newcred.expireTime = c.Expiration;
								newcred.accessKeyId = c.AccessKeyId;
								newcred.secretAccessKey = c.SecretAccessKey;
								newcred.sessionToken = c.SessionToken;
								fs.writeFileSync(newcred.path, JSON.stringify({
									expireTime: newcred.expireTime,
									accessKeyId: newcred.accessKeyId,
									secretAccessKey: newcred.secretAccessKey,
									sessionToken: newcred.sessionToken
								}, null, 3));
							}
							callback();
						});
				});
			}
		};
		aws.config.credentials = new cred();
	}
	recoverConfig(aws);
	return aws;
};

function
callAWSAPI( iter, instance, name, param, callback ) {
	// refer to below document : now just use constant 100msec delay for each API call
	// https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html
	var timeout = 100;
	iter.prevCall = {
		instance : instance,
		name : name,
		param : param,
		callback : callback,
		timeout : timeout
	};
	setTimeout( function() {
		instance[name]( param, callback );
	}, timeout );
}

function
retryAWSAPI( iter, err ) {
	if ( err.code == "TooManyRequestsException" ) {
		console.log( "- Retry by TooManyRequestsException" );
		const prevCall = iter.prevCall;
		setTimeout( function() {
			prevCall.instance[prevCall.name]( prevCall.param, prevCall.callback );
		}, prevCall.timeout );
		return true;
	}
}
function getAPISet( iter, name, symbol, f ) {
	var resolved = string.resolve( name, symbol );
	function getapi(param) {
		callAWSAPI( iter, iter.apictx.apigw,
			"getRestApis", param, callback );
	}
	function callback( err, data ) {
		if ( err == null ) {
			var found = data.items.find
				( (i) => { return i.name == resolved; } );
			if ( found ) {
				f( null, found );
			} else if ( data.position ) {
				getapi( { position : data.position } );
			} else {
				f ( new CanisError( "NotFoundException",
					"REST API not found" ) );
			}
		} else {
			if ( retryAWSAPI( iter, err ) ) return;
			f( err );
		}
	}
	getapi( null );
	return resolved;
};

function
getResource(iter,restapi,callback)
{
	// 500 is maximum of current aws-sdk implementation
	callAWSAPI( iter, iter.apictx.apigw, "getResources",
		{ restApiId: restapi.id, limit: 500 }, callback );
}

function
createResource( iter, root, path, callback )
{
	callAWSAPI( iter, iter.apictx.apigw, "createResource", {
		parentId: root,
		pathPart : path,
		restApiId : iter.restapi.id
	}, function (err, data ) {
		if ( err ) if ( retryAWSAPI( iter, err ) ) return;
		callback( err, data );
	} );
}

function
createMethod( iter, method, info, res, callback )
{
	var apictx = iter.apictx;
	var apigw = apictx.apigw;
	var apiKeyRequired = info["apiKeyRequired"];
	callAWSAPI( iter, apigw, "putMethod", {
		authorizationType: "NONE", // XXX
		apiKeyRequired : apiKeyRequired === undefined ?
			iter.config["apiKeyRequired"] : apiKeyRequired,
		httpMethod: method,
		restApiId: iter.restapi.id,
		resourceId: res
	}, function ( err ) {
		if ( err ) {
			if ( !retryAWSAPI( iter, err ) )
				callback( err );
			return;
		}
		var gwregion = info["aws-gatewayRegion"];
		if ( gwregion === undefined )
			gwregion = iter.config["aws-gatewayRegion"]; // XXX if still undefined?
		var lregion = info["aws-lambdaRegion"];
		if ( lregion === undefined ) {
			lregion = iter.config["aws-lambdaRegion"];
		}
		var lprefix = info["lambdaPrefix"];
		if ( lprefix === undefined ) {
			lprefix = iter.config["lambdaPrefix"];
		}

		var role = info["lambdaRole"];
		if ( role === undefined ) {
			role = iter.config["lambdaRole"]; // XXX if still undefined
		}
		var lambda = info.lambdaName;
		if ( lambda == undefined ) {
			lambda = info.lambda; // XXX still undefined ?
			lambda = lambda.substring( lambda.lastIndexOf( "/" ) + 1 );
		}
		var account = iter.config["aws-account"]; // XXX undefined?

		function putopt() {
			var lpi = info["lambdaProxyIntegration"];
			if ( lpi === undefined ) {
				lpi = iter.config["lambdaProxyIntegration"];
			}
			var lpii = info["lambdaProxyIntegrationInput"];
			if ( lpii === undefined ) {
				lpii = iter.config["lambdaProxyIntegrationInput"];
			}

			var type = "AWS";
			var param, end, reqctx;
			if ( lpi || lpii ) {
				if ( lpi ) type = "AWS_PROXY";
				if ( iter.paramIndex >= 0 ) {
					param = "\"pathParameters\":{";
					end = "},";
				} else {
					param = "";
					end = "";
				}
				reqctx = "\"requestContext\":{\"stage\": \"$context.stage\",\"resourcePath\":\"$context.resourcePath\",\"httpMethod\":\"$context.httpMethod\"}";
			} else {
				param = "";
				end = iter.paramIndex >= 0 ? ", " : "";
				reqctx = "\"stage\":\"$context.stage\", \"path\": \"$context.resourcePath\",\"method\":\"$context.httpMethod\"";
			}

			for ( var i = 0; i <= iter.paramIndex; i++ ) {
				var p = iter.param[i];
				if ( i != 0 ) param += ", ";
				param += "\"" + p + "\":\"$input.params('" + p + "')\"";
			}
			if ( i > 0 ) param += end;
			callAWSAPI( iter, apictx.apigw, "putIntegration", {
				httpMethod: method,
				restApiId: iter.restapi.id,
				resourceId: res,
				type: type,
				integrationHttpMethod : "POST",
				uri: "arn:aws:apigateway:" + gwregion +
					":lambda:path/2015-03-31/functions/arn:aws:lambda:" +
					( lregion === undefined? gwregion : lregion ) + ":" +
					account + ":function:" +
					string.resolve( lprefix, iter.symbol ) +
					lambda + "/invocations",
				credentials: "arn:aws:iam::" + account + ":role/" + role,
				passthroughBehavior: "WHEN_NO_TEMPLATES",
				requestTemplates : {
					"application/json" : "{" + param +
					"\"body\" : $input.json('$'),\"headers\": { #foreach($header in $input.params().header.keySet()) \"$header\": \"$util.escapeJavaScript($input.params().header.get($header))\" #if($foreach.hasNext),#end #end }," + reqctx + "}"
				}
			}, function ( err ) {
				if ( err == null ) {
					callAWSAPI( iter, apigw, "putIntegrationResponse", {
						httpMethod: method,
						restApiId: iter.restapi.id,
						resourceId: res,
						statusCode: "200"
					}, function ( err ) {
						if ( err ) {
							if ( !retryAWSAPI( iter, err ) ) callback( err );
						} else {
							callAWSAPI( iter, apigw, "putMethodResponse", {
								httpMethod: method,
								restApiId: iter.restapi.id,
								resourceId: res,
								statusCode: "200",
								responseModels: {
									"application/json" : "Empty"
								}
							}, function ( err, data ) {
								if ( err ) {
									if ( !retryAWSAPI( iter, err ) )
										iter.progress( iter, -1, err );
								} else {
									iter.progress( iter, exports.METHOD, method ); 
									callback( err, data );
								}
							} );
						}
					} );
				} else {
					if ( !retryAWSAPI( iter, err ) ) callback( err );
				}
			} );
		} // end of internal function putopt

		if ( account === undefined ) {
			callAWSAPI( iter, new apictx.aws.STS(), "getCallerIdentity", {},
			function ( err, data ) {
				if ( err ) {
					if ( !retryAWSAPI( iter, err ) )
						console.log( err );
				} else {
					iter.prevCall = undefined;
					account = iter.config["aws-account"] =
						data.Account;
					putopt();
				}
			} );
		} else {
			putopt();
		}
	} );
}

exports.getAPIContext = function(aws) {
	return {
		aws: aws, // XXX
		apigw: new aws.APIGateway(),
		getAPISet: getAPISet,
		getResource: getResource,
		createResource : createResource,
		createMethod: createMethod
	}
}
