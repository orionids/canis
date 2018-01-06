// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

'use strict'
const  iterator = require( "./iterator" );

var server = require( "./server" );

exports.PATH = 0;
exports.METHOD = 1;

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
	if ( aws == null ) aws = require( 'aws-sdk' );
	recoverConfig(aws);
	return aws;
}

const aws = this.initialize(null);
exports.AWS = aws;

const apigw = new aws.APIGateway();

function CanisError( code, message ) {
	this.code = code;
	this.message = message;
}

CanisError.prototype = new Error();
CanisError.prototype.constructor = CanisError;
exports.getAPISet = function( name, symbol, f ) {
	var resolved = server.resolve( name, symbol );
	apigw.getRestApis( null, function ( err, data ) {
		if ( err == null ) {
			var found = data.items.find( (i) => { return i.name == resolved } );
			if ( found ) {
				f( null, found );
			} else {
				f ( new CanisError( "NotFoundException", "REST API not found" ) );
			}
		} else {
			f( err );
		}
	} );
	return resolved;
}


exports.removeAPISet = function( name, symbol, f ) {
	if ( typeof name === 'string' ) {
		this.getAPISet( name, symbol, function( err, data ) {
			if ( err ) {
				f ( err );
			} else {
				apigw.deleteRestApi( { restApiId: data.id }, f );
			}
		} );
	} else {
		apigw.deleteRestApi( { restApiId: name.id }, f );
	}
}


function
createMethod( iter, method, info, res, callback ) {
	var apikey = info["apiKey"];
	apigw.putMethod( {
		authorizationType: "NONE", // XXX
		apiKeyRequired : apikey === undefined ?
			iter.config["apiKey"] : apikey,
		httpMethod: method,
		restApiId: iter.restapi.id,
		resourceId: res
	}, function ( err, data ) {
		if ( err == null ) {
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
				apigw.putIntegration( {
					httpMethod: method,
					restApiId: iter.restapi.id,
					resourceId: res,
					type: "AWS", // XXX AWS_PROXY
					integrationHttpMethod : "POST",
					uri: "arn:aws:apigateway:" + gwregion +
						":lambda:path/2015-03-31/functions/arn:aws:lambda:" +
						( lregion === undefined? gwregion : lregion ) + ":" +
						account + ":function:" +
						server.resolve( lprefix, iter.symbol ) +
						lambda + "/invocations",
					credentials: "arn:aws:iam::" + account + ":role/" + role,
					passthroughBehavior: "WHEN_NO_TEMPLATES",
					requestTemplates : {
						"application/json" : "{\"body\" : $input.json('$'),\"headers\": { #foreach($header in $input.params().header.keySet()) \"$header\": \"$util.escapeJavaScript($input.params().header.get($header))\" #if($foreach.hasNext),#end #end }, \"stage\": \"$context.stage\" }"
					}
				}, function ( err, data ) {
					if ( err == null ) {
						apigw.putIntegrationResponse( {
							httpMethod: method,
							restApiId: iter.restapi.id,
							resourceId: res,
							statusCode: "200"
						}, function ( err, data ) {
							apigw.putMethodResponse( {
								httpMethod: method,
								restApiId: iter.restapi.id,
								resourceId: res,
								statusCode: "200",
								responseModels: {
									"application/json" : "Empty"
								}
							}, function ( err, data ) {
								if ( err ) {
									iter.progress( iter, -1, err );
								} else {
									iter.progress( iter, exports.METHOD, method ); 
									callback( err, data );
								}
							} );
						} );
					} else {
					}
				} );
			} // end of internal function putopt

			if ( account === undefined ) {
				new aws.STS().getCallerIdentity( {}, function ( err, data ) {
					if ( err ) {
						console.log( err );
					} else {
						account = iter.config["aws-account"] =
							data.Account;
						putopt();
					}
				} );
			} else {
				putopt();
			}
		} else {
//XXX
		}
	} );
}


function
iterateResource( iter, c, i ) {
	function callback( err, data ) {
		if ( err ) {
			console.log( err );
		} else {
			var k = c.key[i];
			var apiset = c.apiset[k];
			var key = Object.keys(apiset);
			if ( key ) {
				iter.path += k;
				iter.progress( iter, exports.PATH );
				iter.add( key.length, {
					apiset: apiset,
					key: key,
					root: data.id,
				}, iterateResource, function (iter, c) {
					var path = iter.path;
					iter.path = path.substring(0,path.lastIndexOf("/"));
				} );
			}
			iter.run();
		}
	}
	var k = c.key[i];
	if ( k.length > 0 ) {
		if ( k.charAt(0) == '/' ) {
			var path = k.substring(1);
			apigw.createResource( {
				parentId: c.root,
				pathPart : path,
				restApiId : iter.restapi.id
			}, callback );
			return iterator.PENDING;
		} else if ( k != "configuration" ) {
			createMethod( iter, k, c.apiset[k], c.root,
				function( err, data ) {
					if ( err ) {
						console.log( err );
					} else {
						iter.run();
					}
				} );
			return iterator.PENDING;
		}
	} else { // first call
		callback( null, { id: c.root } );
	}
}

exports.createAPI = function
	( api, name, symbol, path, subset, progress ) {
	function newapi( err, restapi ) {
		if ( err ) {
			console.log( err );
			return;
		}
		apigw.getResources( { restApiId: restapi.id }, function (err,data) {
			if ( err ) {
				progress( null, -1, err );
			} else {
				var root = null;
				if ( path ) {
					if ( subset == null ) {
						// if subset was not supplied
						// find it from given api object
						var ctx = { i : 0 };
						var a = api;
						for (;;) {
							subset = server.match( a, path, ctx );
							if ( subset == undefined ) break;
							if ( ctx.i < 0 ) break;
							a = subset;
						}
					}

					var p = path;
					for (;;) {
						var r = data.items.find
							( (o) => { return o.path == p; } );
						if ( r != null ) {
							root = r.id;
							break;
						}
						var i = p.lastIndexOf( "/" );
						if ( i < 0 ) break;
							var a = {};
						a[p.substring(i)] = subset;
						subset = a;
						p = p.substring( 0, i );
					}
				} else {
					subset = api;
				}
				if ( root == null ) {
					var r = data.items.find
						( (o) => { return o.path.charAt(0) == '/' &&
						o.path.indexOf( "/", 1 ) < 0; } );
					root =  r.path == "/" ? r.id : r.parentId;
				}

				var iter = new iterator( progress );
				iter.restapi = restapi;
				iter.config = api.configuration;
				iter.symbol = symbol;
				iter.path = "";
				iterateResource( iter, {
					apiset: { "": subset },
					key: [""],
					root: root
				}, 0 );
			}
		} );
	}

	if ( typeof name === 'string' ) {
		if ( name == null ) api.configuration.name;
		var resolved = this.getAPISet( name, symbol, function( err, data ) {
			if ( err ) {
				if ( err.code != "NotFoundException" ) {
					progress( null, -1, err );
					return;
				} else {
					apigw.createRestApi( {
						name : resolved
					}, newapi );
				}
			} else {
				newapi( null, data );
			}
		} );
		if ( resolved == null ) {
			progress( null, -1, new CanisError( "SymbolNotFound",
				"Fail to resolve symbol in string [" + name + "]." ) );
		}
	} else {
		newapi( null, name );
	}
}


// EOF
