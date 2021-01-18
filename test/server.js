process.chdir( __dirname );
var server = require( "canis/server.js" );
console.log( "Type quit() to terminate server" );

// multiple API set so url will be apiset/stage/url, i.e
// GET /testapi/test1/hello
var s = server.main ( [ { name: "testweb", alias : "" },
"testapi" ]
,

// this parameter is optional
{
//	fork: server.fork(),
	cert: {
//		pub:
//		pri:
	},
	parse: // supply this for interactive mode
	function(input,quit){
		try {
			eval(input);
		} catch ( e ) {
			console.log( e );

		}
	},
	finalize: function() {
		server.close( s );
		console.log( "Bye~" );
	},
	port : 5000, // default is 3000
	client: true // manage clients

} );

