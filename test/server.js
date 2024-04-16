// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

var context = require("canis/context")

process.chdir( __dirname );
var server = require( "canis/server.js" );
console.log( "Type quit() to terminate server" );

// multiple API set so url will be apiset/stage/url, i.e
// GET /testapi/test1/hello
var s = server.main ( context, [
	{name: "testweb", alias : ""},
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
if (input == "") {
	quit(true);
console.log("XX");
	quit(false);
	return;
}
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
	port : 50000, // default is 3000
	client: true // manage clients

} );

