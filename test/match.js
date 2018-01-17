const server = require( "../server.js" );

server.main( "testapi", function (api) {
	var ctx = { i : 0 };
	var a = server.match( api, "/hello/{param1}/world", ctx );
	console.log( a );
} );

