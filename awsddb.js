// Copyright (c) 2018, adaptiveflow
// Distributed under ISC

'use strict'

exports.hashKeyQuery = function( ddbcli, tblname, key, val, callback ) {
	ddbcli.query( {
		TableName: tblname,
		KeyConditionExpression: "#key=:val",
		ExpressionAttributeNames: {
			"#key" : key
		},
		ExpressionAttributeValues: {
			":val" : val
		}
	}, callback );
}

/*
exports.primaryKeyQuery = function
	( ddbcli, tblname, hashkey, hashval, sortkey, sortval, cond, callback ) {
	ddbcli.query( {
		TableName: tblname,
		KeyConditionExpression: "#hk=:hk and begins_with(#sk,:sv)",
		ExpressionAttributeNames: {
			"#hk" : hashkey,
			"#sk" : sorttkey,
		},
		ExpressionAttributeValues: {
			":hv" : hashval,
			":sv" : sortval,
		}
	}, function(err,data) {
}*/
