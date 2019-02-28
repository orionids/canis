// vim:ts=4 sw=4:
// jshint curly:false
// Copyright (C) 2018, adaptiveflow
// Distributed under ISC License
'use strict';

module.exports =
function ( context, name, param, flag, callback ) {
	function invokeLocal ( prefix ) {
		try {
			var l = require( prefix + name );
			if ( l.handler ) {
				setTimeout( function() { // simulate async
					l.handler( param, null, callback );
				} );
				return true;
			}
		} catch ( e ) {
			if ( e.code !== "MODULE_NOT_FOUND" ) {
				callback( e );
				return true;
			}
		}
	}

	var f = context.getProperty( "canis_invoke" );
	if ( f !== undefined ) flag = f;

	var prefix;
	if ( !(flag & module.exports.DISABLE_LOCAL) ) {
		prefix = context.localPrefix;
		if ( prefix ) {
			if ( Array.isArray(prefix) ) {
				for ( var i = 0; i < prefix.length; i++ )
					if ( invokeLocal( prefix[i] ) ) return;
			} else if ( invokeLocal( prefix ) ) {
				return;
			}
		}
	}

	if ( !(flag & module.exports.DISABLE_REMOTE) ) {
		// try AWS lambda
		prefix = context.lambdaPrefix;
		context.lambda().invoke( {
			FunctionName: prefix ? prefix + name : name,
			InvocationType: 'RequestResponse',
			LogType: 'Tail',
			Payload: typeof param === 'string' ? param : JSON.stringify(param)
		}, function ( err, data ) {
			if ( err ) {
				callback( err );
			} else if ( data.StatusCode == 200 ) {
				// to maintain consistency with calling local function,
				// assume json formatted result
				var payload = JSON.parse(data.Payload);
				if ( data.FunctionError ) callback( payload );
				else callback( null, payload );
			} else {
				callback( new Error( 'UnexpectedException' ) );
			}
		} );
	} else {
		callback( { code: "ResourceNotFoundException" } );
	}
};

module.exports.DISABLE_LOCAL = 0x1;
module.exports.DISABLE_REMOTE = 0x2;
