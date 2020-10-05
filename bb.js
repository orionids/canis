// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2018, adaptiveflow
// adaptiveflow@gmail.com
// Distributed under ISC
var storage = require( "canis/storage" );

exports.put = function
	( config, uid, tid, title, content, callback )
{
	var context = config.context;
	var prefix = config.prefix;
	storage.transact( context, prefix, [
		{
			op: "put",
			arg: [
				config.list,
				{
					p: "userId", pval : uid,
					s: "threadId", sval : tid,
				},
				{
					title : title
				}
			]
		},
		{
			op: "put",
			arg: [
				config.content,
				{
					p: "threadId", pval: tid,
					s: "date", sval: "1974-02-26",
				},
				{
					content: content
				}
			]
		}
	], function (err) {
		if ( err ) {
			callback(err);
		} else {
			storage.snapshot( context, prefix,
				config.list, null, function() {
				storage.snapshot( context, prefix,
					config.content, null, callback );
			} );
		}
	} );
}
