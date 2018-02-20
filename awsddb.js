// Copyright (c) 2018, adaptiveflow
// Distributed under ISC

'use strict';

exports.partitionKeyQuery = function( ddbcli, tblname, key, val, callback )
{
	ddbcli.query( {
		TableName: tblname,
		KeyConditionExpression: "#k=:v",
		ExpressionAttributeNames: {
			"#k" : key
		},
		ExpressionAttributeValues: {
			":v" : val
		}
	}, callback );
};

exports.primaryKeyQuery = function
	( ddbcli, tblname, key, val, sortkey, sortval, extra, cond, callback )
{
	var c = "#k=:v and " + ( cond == null ?
		"begins_with(#sk,:sv)" : "#sk" + cond + ":sv" );
	if ( extra ) c += "and :x";
	ddbcli.query( {
		TableName: tblname,
		KeyConditionExpression: c,
		ExpressionAttributeNames: {
			"#k" : key,
			"#sk" : sortkey,
		},
		ExpressionAttributeValues: {
			":v" : val,
			":sv" : sortval,
			":x" : extra
		}
	}, callback );
};

exports.updateExpression = function( param, action, state, name, value )
{
	var cmd;
	var expr = "#" + name;
	if ( param.ExpressionAttributeNames === undefined )
		param.ExpressionAttributeNames = {};
	param.ExpressionAttributeNames[expr] = name;
	if ( value !== undefined ) {
		if ( param.ExpressionAttributeValues === undefined )
			param.ExpressionAttributeValues = {};
		param.ExpressionAttributeValues[":" + name] = value;
	}
	if ( action == state ) expr = "," + expr;
	switch ( action ) {
		case 0: cmd = "set"; expr += "=:" + name; break;
		case 1 : cmd = "add"; expr += " :" + name; break;
		case -1: cmd = "delete"; break;
		default: cmd = "remove";
	}
	if ( action != state ) {
		if ( param.UpdateExpression === undefined ) param.UpdateExpression = "";
		param.UpdateExpression += cmd + expr;
	} else {
		param.UpdateExpression +=expr;
	}
	return action;
};

// delete queried result
exports.delete = function( ddbcli, tblname, data, key, cond, callback )
{
	if ( data ) {
		var item = data.Items;
		if ( item ) {
			var param = {
				TableName: tblname,
			};
			var i = 0;
			(function del(e,d) {
				for (;;) {
					if ( i < item.length ) {
						var di = data.Items[i++];
						if ( cond ) {
							if ( !cond(di) ) continue;
						}
						param.Key = {};
						for ( var j = 0; j < key.length; j++ ) {
							var k = key[j];
							param.Key[k] = di[k];
						}
						ddbcli.delete( param, del );
					} else {
						callback( e, d);
					}
					break;
				}
			})();
			return;
		}
	}
	callback( null, data );
};
