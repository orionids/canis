var server = require( "canis/server" );

var config = {
	stage: {
		"test" : {
			"apiKey" : "key1"
		},
		"release" : {
			"apiKey" : "key2"
		}
	}
};

var ctx = {};
server.stage(  config, "test", ctx );

console.log( ctx );
