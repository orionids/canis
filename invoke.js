// vim:ts=4 sw=4:
// Copyright (C) 2018, adaptiveflow
// Distributed under ISC License

module.exports = function ( context, caller, name, param, callback ) {
	var prefix = context.localPrefix;
	if ( prefix ) {
		try {
			var l = require( prefix + name );
			setTimeout( function() { // simulate async
				l.handler( param, null, callback );
			} );
			return;
		} catch ( e ) {
			if ( e.code !== "MODULE_NOT_FOUND" ) {
				callback( e );
				return;
			}
		}
	}

	// try AWS lambda
	prefix = context.lambdaPrefix;
	caller.invoke( {
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
}
