exports.handler = function( event, context, callback ) {
	callback( null, { "param1" : event.param1 } );
}
