// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2020, adaptiveflow
// adaptiveflow@gmail.com
// Distributed under ISC

var context = require( "canis/context" );
var object = require( "canis/object" );
var mysql = require( "mysql2" );

exports.initialize = function( param, callback ) {
	var tmp = object.move( param,
		[ "name", "prefix", "schema" ] );
//	return mysql.createPool({
//		param
//	});
//	  const promisePool = pool.promise();

//	pool.query( "select * from tb_nuzin_dc_fee_policy",
//	function ( err, data ) {
//		console.log( err );
//		console.log( data );
//	} );
	var pool = mysql.createPool( param );
	Object.assign( param, tmp );
	process.nextTick( function() {
		callback( null, pool );
	} );
}

exports.put = function
	(  pool, context, tblpref, name, key, body, unlock, callback )
{
	pool.getConnection( function(err,conn) {
		if ( err ) {
			callback(err);
		} else {
			conn.beginTransaction( function(err) {
				if ( err ) {
					callback(err);
				} else {
					conn.query( "INSERT INTO tb_bblist" +
" VALUES ('u1','t1','X')",
					function(err) {
						if ( err ) conn.rollback(callback);
						else conn.commit( callback );
					} );
				}
			});
//	pool.query( "select * from tb_nuzin_dc_fee_policy",
//		callback );
		}
	});
}

exports.finalize = function(pool) {
	pool.end();
}
