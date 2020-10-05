// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2018, adaptiveflow

var context = require( "canis/context" );
var storage = require( "canis/storage" );
var dbconfig = {
	name: "mysql",
	prefix: "tb_", // XXX
	port: 3310,
	host: 'host',
	database: 'db',
	user: 'app',
	password: '',
	schema : {
		"bblist": [
			{ field: "title", type: "string" }
		]
	}
};

storage.put( context, dbconfig, "bblist", {
	p: "userId", pval: "user1",
	s: "threadId", sval: "abcd"
}, {
	title: "Hello!"
}, function (err, data) {
	console.log( err );
	console.log( data );
	storage.finalize( context );
}
);

