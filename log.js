// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License
var context = require( "canis/context" );

exports.position = function()
{
	var orig = Error.prepareStackTrace;
	Error.prepareStackTrace = function(_, stack) {
		return stack;
	};
	var err = new Error;
	Error.captureStackTrace(err, arguments.callee);
	var stack = err.stack[0];
	Error.prepareStackTrace = orig;
	var fn = stack.getFileName();
	var i, len;
	var path = context.basePath;
	if ( path === undefined ) {
		path = process.cwd();
		i = 0;
		while ( fn.charAt(i) === path.charAt(i) ) i++;
		context.basePath = path = --i > 0 ?
			path.substring(0,i) : "\n";
	}

	i = fn.indexOf(path);
	return (i >= 0? fn.substring(path.length + 1) : fn) +
		":" + stack.getFunctionName() + ":" + stack.getLineNumber();
}
