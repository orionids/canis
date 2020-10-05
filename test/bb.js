// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2018, adaptiveflow
var context = require( "canis/context" );
context.localPrefix = [process.env.MK_OUT_ROOT + "/"];
var bb = require( "canis/bb" );

var config = {
	context: context,
	prefix: undefined,
	list: "qnalist",
	content: "qna"
};

bb.put( config, "user1", "tid1", "hello!",
	"I love this!", function(err) {
	console.log( "Done" );
} );
