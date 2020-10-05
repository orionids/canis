// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2018, adaptiveflow
// adaptiveflow@gmail.com
// Distributed under ISC

var redis = require( "redis" );

exports.initialize = function( param, callback )
{
	let client = redis.createClient
		( param.port, param.host );

	client.on('error', function (err ) {
		callback( err, client );
	} );

	client.on('connect', function ( err) {
		if ( err ) {
			callback( err, client );
		} else {
			callback( null, client );
		}
	} );
};

exports.finalize = function( client )
{
	client.end( true );
};

exports.query = function( client, context, tblpref, name, key, callback )
{
	var tbl = tblpref.table[name];
	if ( tbl.index ) {
		client.zrange( name + key.pval, 0, -1, function ( err, data ) {
				console.log( err );
				console.log( data );
console.log( typeof data[0] );
				callback();
		} );
/*		client.zrangebyscore( name + key.pval, 0, 5, "WITHSCORES", function (err,data) {
			console.log( err );
			console.log( data );
			callback();
		} );*/
		return;
	}
/*	client.get( name + key.pval + key.sval, function(err,data) {
			console.log( err );
			console.log( data );
		callback( err, data );
	});*/
};

exports.put = function( client, context, tblpref, name,
	key, body, unlock, callback )//, expr )
{
	var index = key.sval;
	function put() {
		if ( body ) {
			var sbody = JSON.stringify(body);
			if ( index === undefined ) {
				client.set( name, sbody, callback );
			} else {
				if ( typeof index === "string" ) {
					var sname = name + index;
					client.set( sname, sbody,
					function (err) {
						if ( err ) {
							callback( err );
						} else {
							client.zadd( name, 0, index,
							function (err) {
								if ( err ) {		
									client.del( sname,
									function() {
										callback(err);
									} );
								} else {
									callback();
								}
							} );
						}
					} );
					
				} else {
					client.zadd( name, index, sbody, callback );
				}
			}
		} else {
			callback();
		}
	}

	function mput( err, data ) {
		if ( err )
			callback( err );
		else if ( data == null )
			callback( {
				code: "ConditionalCheckFailedException"
			} );
		else
			put();
	}

	var sync = key.sync;
	name += key.pval;
	if ( sync ) {

		var mname = index !== undefined ? name + index : name;

		var mutex = Array.isArray(sync) ? sync[0] : sync;
		mname += mutex.cond == "lock" ?
			mutex.name : "mutex_";

		if ( unlock ) {
			client.del( mname, function( err ) {
				callback( err );
			} );
		} else {
			var to = mutex.timeout;
			if ( to > 0 )
				client.set( mname, "1", "NX",
					"PX", to, mput );
			else
				client.set( mname, "1", "NX", mput );
		}
	} else {
		put();
	}
};

exports.delete = function
	( client, context, tblpref, name, key, callback )
{
	client.del( name + key.pval + key.sval, callback );
};

