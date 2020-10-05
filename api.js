// vim:ts=4 sw=4:
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

"use strict";
exports.iterator = require( "canis/iterator" );
var server = require( "canis/server" );
var string = require( "canis/string" );

exports.PATH = 0;
exports.METHOD = 1;
exports.EXISTING_PATH = 2;
exports.EXISTING_METHOD = 3;

//exports.AWS = aws;

//const apigw = new aws.APIGateway();



function CanisError( code, message ) {
	this.code = code;
	this.message = message;
}

CanisError.prototype = new Error();
CanisError.prototype.constructor = CanisError;



exports.removeAPISet = function( iter, name, symbol, f ) {
	function callback( err, data ) {
		if ( err && retryAWSAPI( iter, err ) ) return;
		f( err, data );
	}
	var apictx = iter.apictx;
	if ( typeof name === 'string' ) {
		apictx.getAPISet( iter, name, symbol, function( err, data ) {
			if ( err ) {
				f ( err );
			} else {
				callAWSAPI( iter, apigw, "deleteRestApi",
					{ restApiId: data.id }, callback );
			}
		} );
	} else {
		callAWSAPI( iter, apigw, "deleteRestApi",
			{ restApiId: name.id }, callback );
	}
};


function pushParam( iter, s ) {
	var t = ++iter.paramIndex;
	s = s.substring(2, s.length - 1);
	if ( t >= iter.param.length ) iter.param.push( s );
	else iter.param[t] = s;
}

function
iterateResource( iter, c, i ) {
	var apictx = iter.apictx;
	function callback( err, data ) {
		var id;
		var k = c.key[i];
		if ( err ) {
			if ( err.code != 'ConflictException' ) {
				iter.end( err );
				return;
			}
			var path = iter.path + k;
			iter.progress( iter, exports.EXISTING_PATH, path );
/*iter.run();
return;*/
			id = iter.resource[path];
		} else {
			iter.prevCall = undefined;
			id = data.id;
			iter.progress( iter, exports.PATH, k );
		}
		if ( k.charAt( 1 ) == '{' ) pushParam( iter, k );
		var apiset = c.apiset[k];
		var key = Object.keys(apiset);
		if ( key ) {
			iter.path += k;
			iter.add( key.length, {
				apiset: apiset,
				key: key,
				root: id,
			}, iterateResource, function (iter/*, c*/) {
				var path = iter.path;
				if ( path.charAt( path.length - 1 ) == '}' )
					iter.param[iter.paramIndex--] = undefined;
				iter.path = path.substring(0,path.lastIndexOf("/"));
			} );
		}
		iter.run();
	} // end of inner function callback
	var k = c.key[i];
	if ( k.length > 0 ) {
		var apiset = c.apiset[k];
		var first = k.charAt(0);
		if ( first == '/' ) {
			if ( k.charAt(1) != '^' ) {
				var stage = apiset["^stage"];
				if ( stage ) {
					var currentStage = string.symbol
						( "stage", iter.symbol );
					if ( Array.isArray(stage) ?
						!stage.find( function(s) {
							return s === currentStage;
						} ) : stage !== currentStage ) {
						console.log( "mismatching stage :", k );
						return;
					}
				}
				var path = k.substring(1);
				apictx.createResource
					( iter, c.root, path, callback );
				return exports.iterator.PENDING;
			}
		} else if ( first != '^' && k != "configuration" ) {
			apictx.createMethod( iter, k, apiset, c.root,
				function( err ) {
					if ( err ) {
						if ( err.code == 'ConflictException' ) {
							iter.progress( iter,
								exports.EXISTING_METHOD, k );
						} else {
							console.log( err );
							return;
						}
					}
					iter.run();
				} );
			return exports.iterator.PENDING;
		}
	} else { // first call
		callback( null, { id: c.root } );
	}
}

exports.create = function
	( iter, api, name, symbol, path, subset ) {

	var apictx = iter.apictx;

	function newapi( err, restapi ) {
		if ( err ) {
			if ( !retryAWSAPI( iter, err ) ) console.log( err );
			return;
		}

		apictx.getResource(iter, restapi, function (err,data) {
			if ( err ) {
				if ( retryAWSAPI( iter, err ) ) return;
				iter.progress( null, -1, err );
			} else {
				var root;
				var i;
				iter.param = [];
				iter.paramIndex = -1;
				iter.resource = {};
				for ( i = 0; i < data.items.length; i++ ) {
					iter.resource[data.items[i].path] =
						data.items[i].id;
				}
				var p;
				if ( path ) {
					var a, ctx;
					if ( subset == null ) {
						// if subset was not supplied
						// find it from given api object
						ctx = { i : 0 };
						a = api;
						for (;;) {
							subset = server.match( a, path, ctx );
							if ( subset == undefined );// break;
							if ( ctx.i < 0 ) break;
							a = subset;
						}
					}
					p = path;
					for (;;) {
						root = iter.resource[p];
						if ( root !== undefined ) break;
						i = p.lastIndexOf( "/" );
						if ( i < 0 ) break;
						a = {};
						a[p.substring(i)] = subset;
						subset = a;
						p = p.substring( 0, i );
					}
					ctx = { i : 0 };
					for (;;) {
						server.match( null, p, ctx );
						if ( ctx.part.charAt(1) == '{' )
							pushParam( iter, ctx.part );
						if ( ctx.i < 0 ) break;
					}
				} else {
					subset = api;
					p = "";
				}
				if ( root === undefined ) {
//					var r = data.items.find
//						( (o) => { return o.path.charAt(0) == '/' &&
//						o.path.indexOf( "/", 1 ) < 0; } );
//					root =  r.path == "/" ? r.id : r.parentId;
					root = iter.resource["/"];
				}

				iter.restapi = restapi;
				iter.config = api.configuration;
				iter.symbol = symbol;
				iter.path = p;
				iterateResource( iter, {
					apiset: { "": subset },
					key: [""],
					root: root
				}, 0 );
			}
		} );
	}

	var apictx = iter.apictx;
	if ( name == null ) name = api.configuration.name;
	if ( typeof name === 'string' ) {
		var resolved = apictx.getAPISet( iter, name, symbol, function( err, data ) {
			if ( err ) {
				if ( err.code != "NotFoundException" ) {
					iter.progress( null, -1, err );
					return;
				} else {
					callAWSAPI( iter, apigw, "createRestApi", {
						name : resolved
					}, newapi );
				}
			} else {
				newapi( null, data );
			}
		} );
		if ( resolved == null ) {
			iter.progress( null, -1, new CanisError( "SymbolNotFound",
				"Fail to resolve symbol in string [" + name + "]." ) );
		}
	} else {
		newapi( null, name );
	}
};


// EOF
