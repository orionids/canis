// vim: ts=4 sw=4 :
var context = require( "canis/context" );
var storage = require( "canis/storage" );

var pref = undefined;//process.env.AWS_TABLE_PREFIX;
context.localPrefix = [process.env.MK_OUT_ROOT + "/"];

/*
storage.begin( context, pref, function(err,t) {
	storage.put( context, pref, "qna",
	{
		p: "threadId",
		pval: "12345",
		s: "date",
		sval: "1974-02-26",
		t: t
	}, {
		content: "Hello!"
	},
	function ( err ) {
		storage.update( context, pref, "qna",
		{
			p: "threadId",
			pval: "123456",
			s: "date",
			sval: "1974-02-27",
			t: t
		}, {
			name: "a",
			value: 1
		},
		function ( err ) {
			storage.end( t, function(err,data) {
				console.log( err );
			} );
		} );
	} );
} );
*/

storage.transact( context, pref, [
	{
		op: "put",
		arg: [
			"qna",
			{
				p: "threadId",
				pval: "12345",
				s: "date",
				sval: "1974-02-26",
			},
			{
				content: "Hello"
			}
		],
	},
	{
		op: "update",
		arg: [
			"qna",
			{
				p: "threadId",
				pval: "123456",
				s: "date",
				sval: "1974-02-27",
			}, {
				name: "a",
				value: 1
			}
		]

	}
], function( err ) {
	storage.snapshot( context, pref, "qna", null,
	function(err) {
		console.log( err );
	} );
} );
