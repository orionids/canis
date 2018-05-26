// vim: ts=4 sw=4 :
// Copyright (c) 2018, adaptiveflow
// Distributed under ISC

'use strict';

var server = require( "canis/server" );

function
searchSortKey( p, keyname, key ) 
{
	var m = 0, n = p.length - 1, l = 0;
	while ( l <= n ) {
		m = l + ( ( n - l ) >>> 1 );
		var cl = p[m][keyname].localeCompare(key);
		if ( cl == 0 ) return m;
		if ( cl < 0 ) l = m + 1;
		else n = m - 1;
	}
	return -l - 1;
}

function
insertSortKey( p, keyname, key )
{
	var i = searchSortKey( p, keyname, key );
	if ( i < 0 ) {
		i = -i - 1;
		p.splice( i, 0, null );
	}
	return i;
}

exports.getIndexName = function(key)
{
	var index = key.index;
	return index? typeof index === "string" ? index :
			key.p + "-index" : undefined;
}


exports.query = function
	( context, tblpref, name, key, callback )
{
	function checkSortKey( data ) {
		if ( data ) {
			if ( key.s === undefined ||
			     key.sval === undefined ) return true;
			var sval = data[key.s];
			if ( sval != null ) {
				switch ( key.cond ) {
					default:
throw new Error( "Unexpected operator " + cond );
					case null:
					case undefined:
					return sval.startsWith( key.sval );
					case "=":
					if ( sval == key.sval ) return true;
					break;
					case "between":
					if ( key.sval <= sval &&
					     sval <= key.extra ) return true;
				}
			}
		}
		return false;
	}
	if ( tblpref !== undefined ) {
		if ( key.s === undefined || key.sval === undefined ) {
			require( "canis/awsddb" ).partitionKeyQuery
			( this, context, tblpref? tblpref + name : name,
			key, callback );
		} else {
			require( "canis/awsddb" ).primaryKeyQuery
			( context.ddbcli(), tblpref? tblpref + name : name,
			key.p, key.pval, key.s, key.sval,
			key.extra, key.cond, callback );
		}
	} else {
		var invoke = require("canis/invoke");
		invoke( context, name, null, invoke.DISABLE_REMOTE,
		function( err, data ) {
			if ( err ) {
				callback( err );
			} else {
				var cnt;
				if ( key.index ) {
					data = data["~index"];
					do {
						if ( data ) {
							data = data[exports.
								getIndexName(key)];
							if ( data ) {
								data = data.table;
								break;
							}
						}
						callback( new Error("NoSuchIndex") );
						return;
					} while(0);
				}
				data = data[key.pval];
				var item;
				if ( Array.isArray(data) ) {
					cnt = 0;
					for ( var i = 0; i < data.length; i++ ) {
						var di = data[i];
						if ( checkSortKey(di) ) {
							di = server.object(di);
							if ( item ) item.push( di );
							else item = [ di ];
							cnt++;
						}
					}
				} else if ( checkSortKey(data) ) {
					cnt = 1;
					item = [ server.object(data) ];
				} else {
					cnt = 0;
				}
				callback( null, {
					Items: item,
					Count: cnt,
					ScannedCount: cnt
				} );
			}
		} );
	}
};

function
put( context, name, key, body, callback, expr )
{
	function merge( prev ) {
// XXX only set and remove operation is defined now
		if ( Array.isArray(expr) ) {
			var action = 0;
			for ( var i = 0; i < expr.length; i ++ ) {
				var e = expr[i];
				if ( typeof e === "object" ) {
					switch ( action ) {
						case 0:
						prev[e.name] = e.value;
						break;
						default:
						delete prev[e.name];
					}
				} else {
					action = e;
				}
			}
		} else if ( typeof expr === "object" ) {
			prev[expr.name] = expr.value;
		}
	}

	var invoke = require("canis/invoke");
	invoke( context, name, null, invoke.DISABLE_REMOTE,
	function( err, data ) {
		if ( err ) {
			callback(err);
		} else {
			body = server.object( body );
			body[key.p] = key.pval;
			function store( table, body, key ) {
				do {
					var prev = table[key.pval];
					if ( key.s ) {
						body[key.s] = key.sval;
						if ( prev !== undefined ) {
							if ( !Array.isArray(prev) ) {
								prev = [ prev ];
								table[key.pval] = prev;
							}
							var i = insertSortKey
								( prev, key.s, key.sval );
							var pi = prev[i];
							if ( expr ) {
								if ( pi ) {
									merge( pi );
									break;
								}
								merge( body );
							}
							prev[i] = body;
							break;
						}
					} else if ( expr ) {
						if ( prev ) {
							merge( prev );
							break;
						}
						merge( body );
					}
					table[key.pval] = body;
				} while(0);
			}

			store( data, body, key );

			// global secondary index
			var index = data["~index"];
			for ( var p in index ) {
				var i = index[p];
				if ( !i.table ) i.table = {};
				var p = i.key.p;
				var s = i.key.s;
				store( i.table, body, {
					p: p, pval: body[p],
					s: s, sval: body[s],
				} );
			}
			callback();
		}
	} );
}

exports.put = function( context, tblpref, name,
	key, body, callback )
{
	if ( tblpref !== undefined ) {
		var item = {};
		item[key.p] = key.pval;
		if ( key.s ) item[key.s] = key.sval;
		Object.assign( item, body );
		var param = {
			TableName: tblpref? tblpref + name : name,
			Item: item
		};
		context.ddbcli().put( param, callback );
	} else {
		put( context, name, key, body, callback );
	}
};

exports.update = function( context, tblpref, name,
	key, expr, callback )
{
	if ( tblpref !== undefined ) {
		var Key = {};
		Key[key.p] = key.pval;
		if ( key.s ) Key[key.s] = key.sval;
		var param = {
			TableName: tblpref? tblpref + name : name,
			Key: Key
		};
		if ( Array.isArray(expr) ) {
			var state;
			var action = 0;
			for ( var i = 0; i < expr.length; i ++ ) {
				var e = expr[i];
				if ( typeof e === "object" ) {
					state = require( "canis/awsddb" ).
						updateExpression( param, action,
							state, e.name, e.value );
				} else {
					action = e;
				}
			}
			// don't do this, key only item can be saved
			//if ( state === undefined ) break;
		} else if ( typeof expr === "object" ) {
			require( "canis/awsddb" ).updateExpression
			( param, 0, undefined, expr.name, expr.value );
		}
		context.ddbcli().update( param, callback );
	} else {
		put( context, name, key, {}, callback, expr );
	}
}

// common: p, s
// to delete queried result: queried, cond
// to delete an item : pval, sval

exports.delete = function
	( context, tblpref, name, key, callback )
{
	var item;
	var i, cnt;
	var cond;
	var queried = key.queried;
	if ( queried ) {
		item = queried.Items;
		cnt = queried.Count;
		cond = key.cond;
	}

	if ( tblpref !== undefined ) {
		var param = {
			TableName: tblpref? tblpref + name : name,
			Key: {}
		};
		function delItem( pval, sval, done ) {
			param.Key[key.p] = pval;
			if ( key.s ) param.Key[key.s] = sval;
			context.ddbcli().delete( param, done );
		}
		if ( queried ) {
			i = 0;
			(function del(e,d) {
				do {
					if ( i < cnt ) {
						var di = item[i++];
						if ( cond && !cond(di) ) continue;
						delItem( di[key.p], di[key.s], del );
					} else {
						callback( e, d);
					}
				} while( 0 );
			})();
		} else {
			delItem( key.pval, key.sval, callback );
			return;
		}
	} else {
		function delMemoryItem( data, pval, sval ) {
			do {
				var p = data[pval];
				if ( p ) {
					if ( key.s === undefined ) break;
					if ( sval === undefined ) {
						callback( new Error( "SortKeyNeeded" ) );
						return true;
					}

					if ( Array.isArray(p) ) {
						var i = searchSortKey
							( p, key.s, sval );
						if ( i >= 0 ) {
							p.splice( i, 1 );
							return;
						}
					} else {
						if ( p[key.s] === sval ) break;
					}
				}
				callback( new Error( "NoSuchItem" ) );
				return true;
			} while ( 0 );
			// current memorydb implementation
			// cannot determine this case
			// requires sort key
			delete data[pval];
		}
		var invoke = require("canis/invoke");
		invoke( context, name, null, invoke.DISABLE_REMOTE,
		function( err, data ) {
			var val;
			if ( err ) {
				callback(err);
			} else {
				if ( queried ) {
					for ( i = 0; i < cnt; i++ ) {
						var qi = item[i];
						if ( !cond || cond(qi) ) {
							if ( delMemoryItem( data,
								qi[key.p], qi[key.s] ) )
								return;
						}
					}
				} else {
					if ( delMemoryItem
						( data, key.pval, key.sval ) )
						return;
				}
				callback();
			}
		} );
	}
};

exports.snapshot = function
	( context, tblpref, name, path, callback )
{
	if ( tblpref !== undefined ) {
	} else {
		var invoke = require("canis/invoke");
		invoke( context, name,
		null, invoke.DISABLE_REMOTE,
		function( err, data ) {
			var val;
			if ( err ) {
				callback(err);
			} else {
				var s = JSON.stringify(data,null,4);
				if ( path ) {
					var fs = require("fs");
					fs.open( path, "w", function( err, fd ) {
						if ( err ) {
							callback( err );
						} else {
							fs.write( fd, s, function () {
								fs.close( fd, callback );
							} );
						}
					} );
				} else {
					console.log( s );
					callback();
				}
			}
		} );
	}
}

// EOF
