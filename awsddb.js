// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2018, adaptiveflow
// Distributed under ISC

'use strict';

exports.partitionKeyQuery =
function( storage, context, tblname, key, callback )
{
	context.ddbcli().query( {
		IndexName: storage.getIndexName(key),
		TableName: tblname,
		KeyConditionExpression: "#k=:v",
		ExpressionAttributeNames: {
			"#k" : key.p
		},
		ExpressionAttributeValues: {
			":v" : key.pval
		},
		Limit: key.limit
	}, callback );
};

exports.primaryKeyQuery = function
	( ddbcli, tblname, key, val, sortkey, sortval, extra, cond, callback )
{
	var c = "#k=:v and " +
		( cond === null ? "begins_with(#sk,:sv)" :
			"#sk" + (cond? cond : "=" ) + ":sv" );
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
		},
		Limit: key.limit
	}, callback );
};

function
attr( param, name, value, valueName )
{
	var expr = "#" + name;
	if ( param.ExpressionAttributeNames === undefined )
		param.ExpressionAttributeNames = {};
	param.ExpressionAttributeNames[expr] = name;
	if ( value !== undefined ) {
		if ( param.ExpressionAttributeValues === undefined )
			param.ExpressionAttributeValues = {};
		param.ExpressionAttributeValues[":" +
			(valueName? valueName : name )] = value;
	}
	return expr;
}

exports.updateExpression = function
	( param, action, state, name, value )
{
	var cmd;
	var expr = attr( param, name, value );
	if ( action === state ) expr = "," + expr;
	switch ( action ) {
		case 0: cmd = "set"; expr += "=:" + name; break;
		case 1 : cmd = "add"; expr += " :" + name; break;
		case -1 : cmd = "delete"; expr += " :" + name; break;
		default: cmd = "remove";
	}
	if ( action !== state ) {
		if ( param.UpdateExpression === undefined )
			param.UpdateExpression = cmd + expr;
		else
			param.UpdateExpression += " " + cmd + expr;
	} else {
		param.UpdateExpression += expr;
	}
	return action;
};

exports.putExpression = function
	( param, action, state, name, value )
{
	param.Item[name] = value;
};

exports.conditionExpression = function( param, sync, action, unlock )
{
	var state;
	var condexpr = "";
	var comb = true;

	function append( si ) {
		switch ( si ) {
			case "|":
			condexpr += " OR ";
			comb = true;
			break;

			case "(":
			if ( comb === false ) condexpr += " AND "; // default
			comb = true;
			/* falls through */
			case ")":
			condexpr += si;
			break;

			default:
			if ( comb === true ) comb = false;
			else condexpr += " AND "; // default
			var expr, value;
			switch ( si.cond ) {
				case "present":
				expr = attr( param, si.name );
				condexpr += "attribute_exists(" +
					expr + ")";
				break;
				case "absent":
				expr = attr( param, si.name );
				condexpr += "attribute_not_exists(" +
					expr + ")";
				break;
				case "lock":
				if ( condexpr.length > 0 ) break;
				if ( unlock ) {
					state = exports[action]( param, null, undefined, si.name );
					break;
				}

				comb = true;
				append( { name: si.name, cond: "absent" } );
				if ( si.timeout > 0 ) {
					append( "|" );
					value = Date.now();
					append( { name: si.name, cond: "<", opd: "t", value: value - si.timeout } );
				} else {
					value = true;
				}
				state = exports[action]
					( param, 0, undefined, si.name, value );
				break;
				default:
				expr = attr( param,
					si.name, si.value, si.opd );
				condexpr += expr + si.cond + ":" + si.opd;
			}
		}
	}

	if ( Array.isArray(sync) ) {
		for ( var i = 0; i < sync.length; i++ )
			append( sync[i] );
	} else {
		append( sync );
	}
	if ( condexpr.length > 0 )	param.ConditionExpression = condexpr;
	return state;
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
