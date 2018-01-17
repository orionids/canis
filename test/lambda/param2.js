exports.handler = function( event, context, callback ) {
	callback( null, {
		"param1" : event.param1,
		"param2" : event.param2,
		body : event.body
	} );
}
