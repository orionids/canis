// vim: ts=4 sw=4 noet :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

var server = require("canis/server");
var context = require("canis/context");

context.testCase = {
	success: {
		statusCode: 200
	}
};
server.invoke(
	context,
	{
		"": {
			GET: {
				path: "canis/test"
			}
		}
	},
	undefined,
	{
		"url": "/html/index.html",
		"method": "HEAD"
	},
	require("canis/test/response")
);
