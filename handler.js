// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2019, adaptiveflow
// Distributed under ISC License

function
message( msg ) {
	switch ( msg.action ) {
		case "invoke":
		// if uncaughtException occurs in handler
		// IPC will be confused so safely return
		// message handler
		process.nextTick( function() {
			require( msg.src ).handler( msg.ev, msg.ctx,
			function( err, data ) {
				process.send( { action: "result",
					err: err, data: data } );
			} );
		} );
		break;
		case "exit":
		process.exit(0); // XXX graceful exit is possible ?
	}
}

process.on( "uncaughtException", function (err,origin) {
	console.log( err );
	console.log( origin );
} );

process.on( "beforeExit", function() {
	process.once( "message", message );
	process.send( { action: "reuse" } );
} );

process.once( "message", message );
