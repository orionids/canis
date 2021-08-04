// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

exports.handler = function( event, context, callback ) {
	callback( null, {
			statusCode: 200,
			headers : {},
			body: {
				"hello" : "world"
			}
		}
	);
}
