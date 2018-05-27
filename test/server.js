var server = require( "canis/server.js" );

console.log( "Type quit() to terminate server" );
var s = server.main ( "testapi",

// this parameter is optional
{
	parse: // suppy this for interactive mode
	function(input,quit){
		try {
			eval(input);
		} catch ( e ) {
			console.log( e );
			quit(false);
		}
	},
	finalize: function() {
		server.close( s );
		console.log( "Bye~" );
	},
	port : 5000, // default is 3000
	client: true // manage clients
} );

