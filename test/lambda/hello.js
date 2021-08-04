exports.handler = function( event, context, callback ) {
	callback( null, "hello!" );
	setTimeout( function() {
	}, 3000 );
}
