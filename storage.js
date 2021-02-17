// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2018, adaptiveflow
// adaptiveflow@gmail.com
// Distributed under ISC

'use strict';

var fs = require("fs");
var object = require( "canis/object" );

function
getStorageContext( context, tblpref, name, callback ) {
	if ( typeof tblpref === "string" )
		return tblpref + name;
	if ( tblpref === null ) return name;
	var s;
	var storage = context._entity._storage;
	var mname = tblpref.name;
	if ( storage === undefined ) {
		storage = context._entity._storage = {};
	} else {
		s = storage[mname];
		if ( s !== undefined ) {
			callback( null, s, name);
			return;
		}
	}
	var i = mname.indexOf(".");
	s = {
		m : require( "canis/" +
			( i > 0 ? mname.substring( 0, i ) : mname ) )
	};
	s.m.initialize( tblpref, function ( err, c ) {
		s.c = c;
		storage[mname] = s;
		if ( err ) {
			callback(err);
		} else {
			callback( null, s, mname );
		}
	} );
}

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

exports.getIndexName = function(key)
{
	var index = key.index;
	return index? typeof index === "string" ? index :
			key.p + "-index" : undefined;
};


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
throw new Error( "Unexpected operator " + key.cond );
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
		name = getStorageContext( context, tblpref, name,
		function (err,s, name) {
			if ( err ) callback(err);
			else s.m.query( s.c, context, tblpref, name,
				key, callback );
		} );
		if ( name ) {
			if ( key.s === undefined ||
				key.sval === undefined ) {
				require( "canis/awsddb" ).partitionKeyQuery
				( this, context, name, key, callback );
			} else {
				require( "canis/awsddb" ).primaryKeyQuery
				( context.ddbcli(), name,
				key.p, key.pval, key.s, key.sval,
				key.extra, key.cond, callback );
			}
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
							di = object.clone(di);
							if ( item ) item.push( di );
							else item = [ di ];
							cnt++;
						}
					}
				} else if ( checkSortKey(data) ) {
					cnt = 1;
					item = [ object.clone(data) ];
				} else {
					cnt = 0;
					item = [];
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

var ddbParam = {
	put: function( name, key, body ) {
		var item = {};
		item[key.p] = key.pval;
		if ( key.s ) item[key.s] = key.sval;
		Object.assign( item, body );
		var param = {
			TableName: name,
			Item: item
		};
		if ( key.sync && !unlock ) {
			require("canis/awsddb").conditionExpression
				( param, key.sync, "putExpression" );
		}
		return param;
	},
	update: function( name,key,expr) {
		var awsddb = require( "canis/awsddb" );
		var Key = {};
		Key[key.p] = key.pval;
		if ( key.s ) Key[key.s] = key.sval;
		var param = {
			TableName: name,
			Key: Key
		};
		var state;
		if ( key.sync )
			state = awsddb.conditionExpression
				( param, key.sync, "updateExpression", unlock );

		if ( Array.isArray(expr) ) {
			var action = 0;
			while ( i < expr.length ) {
				var e = expr[i++];
				// prevent null, so null can be used to
				// specify removal
				if ( e !== null && typeof e === "object" ) {
					state = awsddb.updateExpression
					( param, action, state, e.name, e.value );
				} else {
					action = e;
				}
			}
			// don't do this, key only item can be saved
			//if ( state === undefined ) break;
		} else if ( typeof expr === "object" ) {
			awsddb.updateExpression
			( param, 0, state, expr.name, expr.value );
		}
		return param;
	}
}


exports.transact = function
	( context, tblpref, param, callback ) {
	var i;
	var pi;
	if ( tblpref !== undefined ) {
		var name = getStorageContext
			( context, tblpref, "@" );
		if ( name ) {
			var ddbparam = [];
			for ( i = 0; i < param.length; i++ ) {
				pi = param[i];
				var op = pi.op;
				var ddbop;
				switch ( op ) {
					default:
					ddbop = op.charAt(0).toUpperCase() +
						op.substring(1);
				}
				var ddbpi = {};
				var name = pi.arg[0];
				if ( tblpref ) pi.arg[0] = tblpref + name;
				ddbpi[ddbop] =
					ddbParam[op].apply(null,pi.arg);
				pi.arg[0] = name;
				ddbparam.push( ddbpi );
			}
			context.ddbcli().transactWrite
				( { TransactItems: ddbparam }, callback );
		}
	} else {
		i = 0;
		(function transactMemoryDB(err) {
			if ( !err && i < param.length ) {
				pi = param[i++];
				exports[pi.op]( context, tblpref,
					pi.arg[0], pi.arg[1], pi.arg[2],
				transactMemoryDB );
			} else {
				callback(err);
			}
		})();
	}
}

// body and expr are exclusive, if body is empty
// expr contains update instructions, vice versa
function
put( context, name, key, body, unlock, callback, expr )
{
	var mutex;
	function synchronize( sync, prev ) {
		if ( !sync ) return true;

		var result;
		var or = true;
		function append( si ) {
			// TODO: parenthesis is not implemented yet
			if ( si === "|" ) {
				or = true;
			} else {
				if ( or ) {
					if ( result ) return true;
					or = false;
				} else {
					if ( !result ) return true;
				}

				var value = prev ? prev[si.name] : undefined;
				switch ( si.cond ) {
					case "absent":
					result = value === undefined ?
						true : false;
					break;
					case "present":
					result = value === undefined ?
						false : true;
					break;
					case "lock":
					if ( unlock ) {
						mutex = si.name;
						result = true;
					} else if ( result === undefined ) {
						var m;
						if ( value === undefined ) {
							result = true;
							// si.timeout > 0 includes
							// si.timeout !== undefined
							m = si.timeout > 0 ?
								Date.now() : true;
						} else {
							for (;;) {
								if ( si.timeout > 0 ) {
									m = Date.now();
									if ( value <
										m - si.timeout ) {
										result = true;
										break;
									}
								}
								result = false;
								return true;
							}
						}
						if ( expr )
							mutex = {
								name: si.name, value: m
							};
						else
							body[si.name] = m;
					}
					break;
					case "<":
					result = value < si.value;
				}
			}
		}

		if ( Array.isArray(sync) ) {
			for ( var i = 0; i < sync.length; i++ )
				if ( append( sync[i] ) ) break;
		} else {
			append( sync );
		}

		if ( !result ) {
			callback( {
				code: "ConditionalCheckFailedException"
			} );
		}
		return result;
	}

	function merge( prev ) {
		if ( typeof mutex === "object" ) prev[mutex.name] = mutex.value;

// XXX only set and remove operation is defined now
		if ( Array.isArray(expr) ) {
			var action = 0;
			for ( var i = 0; i < expr.length; i ++ ) {
				var e = expr[i];
				// prevent null, so null can be used to
				// specify removal
				if ( e !== null && typeof e === "object" ) {
					switch ( action ) {
						case undefined: break;
						case 0:
						prev[e.name] = e.value;
						break;
						case 1: break;
						case -1: break;
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
		if ( unlock ) delete prev[mutex];
		return true;
	}

	var invoke = require("canis/invoke");
	invoke( context, name, null, invoke.DISABLE_REMOTE,
	function( err, data ) {
		function store( table, body, key, sync ) {
			var prev = table[key.pval];
			if ( key.s ) {
				body[key.s] = key.sval;
				if ( prev !== undefined ) {
					if ( !Array.isArray(prev) ) {
						prev = [ prev ];
						table[key.pval] = prev;
					}

					var i = searchSortKey
						( prev, key.s, key.sval );
					if ( !synchronize( sync, prev[i] ) )
						return;

					if ( i < 0 ) {
						i = -i - 1;
						prev.splice( i, 0, null );
					}
					if ( expr ) {
						var pi = prev[i];
						if ( pi ) {
							merge( pi );
							return true;
						}
						merge( body );
					}
					prev[i] = body;
					return true;
				}
				/* if here, there is no previous item,
				  so share below routine though if ( prev )
				  is evaluated twice */
			}

			if ( !synchronize( sync, prev ) ) return;
			if ( expr ) {
				if ( prev ) {
					merge( prev );
					return true;
				}
				merge( body );
			}
			table[key.pval] = body;
			return true;
		}

		if ( err ) {
			callback(err);
		} else {
			body = object.clone( body );
			body[key.p] = key.pval;

			if ( store( data, body, key, key.sync ) ) {
				// global secondary index
				var index = data["~index"];
				for ( var prop in index ) {
					if ( index.hasOwnProperty(prop) ) {
						var i = index[prop];
						if ( !i.table ) i.table = {};
						var p = i.key.p;
						var s = i.key.s;
						store( i.table, body, {
							p: p, pval: body[p],
							s: s, sval: body[s],
						} );
					}
				}
///// XXX unlock here if mutex between process is needed
				callback();
			}
		}
	} );
}

exports.put = function( context, tblpref, name,
	key, body, callback )
{
	var unlock;
	if ( typeof body === "function" ) {
		callback = body;
		body = undefined;
	} else if ( Array.isArray(body) ) {
		unlock = true;
		body = body[0] === undefined ? body[1] : body[0];
	}

	var t = key.t;
	if ( tblpref !== undefined ) {
		name = getStorageContext( context, tblpref, name,
		function (err,s,name) {
			if ( err ) callback(err);
			else s.m.put( s.c, context, tblpref, name,
				key, body, unlock, callback );
		} );
		if ( name )
			context.ddbcli().put( ddbParam.put
				( name, key, body ), callback );
	} else {
		var t = key.t;
		if ( t ) {
			key.t = undefined;
			t.param.push({
				op: "put",
				p1: name,
				p2: object.clone(key),
				p3: object.clone(body),
			});
			key.t = t;
			setTimeout( callback );
		} else {
			put( context, name, key, body, false, callback );
		}
	}
};

exports.update = function( context, tblpref, name,
	key, expr, callback )
{
	var i, unlock;
	if ( typeof expr === "function" ) {
		callback = expr;
		expr = undefined;
	} else {
		if ( Array.isArray(expr) ) {
			if ( expr[0] === undefined ) {
				unlock = true;
				i = 1;
			} else {
				i = 0;
			}
		}
	}

	if ( tblpref !== undefined ) {
		name = getStorageContext( context, tblpref, name,
		function (err,s,name) {
			if ( err ) callback(err);
			else s.m.put( s.c, context, tblpref, name,
				key, undefined, unlock, callback, expr );
		} );
		if ( name )
			context.ddbcli().update( ddbParam.update
				(name,key,expr), callback );
	} else {
		// expr can be undefined if mutex is supplied,
		// because mutex automatically appends required
		// expressions for mutex, so explicit empty expr is used
		// to distinguish put and update
		put( context, name, key, {}, unlock, callback,
			expr ? expr : [] );
	}
};

// common: p, s
// to delete queried result: queried, cond
// to delete an item : pval, sval

exports.delete = function
	( context, tblpref, name, key, callback )
{
	function del( delItem, loop ) {
		var queried = key.queried;
		if ( queried ) {
			var item = queried.Items;
			var cnt = queried.Count;
			var cond = key.cond;
			var i = 0;
			return (function delQueried(e,d) {
				for (;;) {
					if ( i < cnt ) {
						var di = item[i++];
						if ( cond && !cond(di) ) continue;
						if ( delItem( di[key.p], di[key.s],
							delQueried ) ) return true;
						if ( loop ) continue;
						return;
					}
					callback( e, d);
					return true;
				}
			})();
		}
		return delItem( key.pval, key.sval, callback );
	}

	// impl
	if ( tblpref !== undefined ) {
		name = getStorageContext( context, tblpref, name,
		function (err,s, name) {
			if ( err ) {
				callback(err);
			} else {
				del( function (pval,sval,done) {
					s.m.delete( s.c, context, tblpref, name,
					{ p: key.p, pval: pval,
						s: key.s, sval: sval }, done );
				} );
			}
		} );
		if ( name === undefined ) return;
		var param = {
			TableName: name,
			Key: {}
		};
		del( function( pval, sval, done ) {
			param.Key[key.p] = pval;
			if ( key.s ) param.Key[key.s] = sval;
			context.ddbcli().delete( param, done );
		} );
	} else {
		var invoke = require("canis/invoke");
		invoke( context, name, null, invoke.DISABLE_REMOTE,
		function( err, data ) {
			if ( err ) {
				callback(err);
			} else {
				if ( !del(
				function(pval,sval) {
					do {
						var p = data[pval];
						if ( p ) {
							if ( key.s === undefined )
								break;
							if ( sval === undefined ) {
								callback( new Error
									( "SortKeyNeeded" ) );
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
								if ( p[key.s] === sval )
									break;
							}
						}
						callback( new Error
							( "NoSuchItem" ) );
						return true;
					} while ( 0 );
					// current memorydb implementation
					// cannot determine this case
					// requires sort key
					delete data[pval];
				}, true ) )
					callback();
			}
		} );
	}
};

exports.retry = function( err, retry, timeout ) {
	if ( err.code == "ConditionalCheckFailedException" ) {
		setTimeout( retry, timeout );
		return true;
	}
};

exports.finalize = function( context )
{
	var storage = context._entity._storage;
	for ( var name in storage ) {
		if ( storage.hasOwnProperty(name) ) {
			var s = storage[name];
			s.m.finalize( s.c );
		}
	}
};

exports.scan = function( context, tblpref, name, callback )
{
	if ( tblpref === undefined ) {
		var invoke = require("canis/invoke");
		invoke( context, name, null, invoke.DISABLE_REMOTE,
		function(err,data) {
			var scan = {
				Items: []
			};

			var cnt = 0;
			for ( var p in data ) {
				var d = data[p];
				if ( Array.isArray(d) ) {
					for ( var i = 0; i < d.length; i++ ) {
						scan.Items.push( d[i] );
						cnt ++;
					}
				} else {
					scan.Items.push( d );
					cnt ++;
				}
			}
			scan.Count = cnt;

			callback( null, scan );
		} );
	} else {
		var param = {
			TableName: tblpref + name,
			//Limit : 50
		};

		(function scan() {
			context.ddbcli().scan( param,
			function(err,data) {
				if ( err ) {
					callback(err );
				} else {
					var next;
					if ( data.LastEvaluatedKey ) {
						param.ExclusiveStartKey =
							data.LastEvaluatedKey;
						next = scan;
					}
					callback(err,data, next );
				}
			} );
		})();
	}
}

// lock can be done by both put and update
// but unlock is not, so separate function is defined
/*exports.unlock = function
	( context, tblpref, name, key, callback )
{
	// delete key.lock column or call storage.delete
	// to remove mutex
	var sync = key.sync;
	if ( sync ) {
		exports.update( context, tblpref, name, key,
			[ undefined, null, { name: sync.name } ], callback );
	} else {
		exports.delete
			( context, tblpref, name, key, callback );
	}
};*/

exports.snapshot = function
	( context, tblpref, name, path, callback )
{
	if ( tblpref !== undefined ) {
		name = name; /* XXX */
	} else {
		var invoke = require("canis/invoke");
		invoke( context, name,
		null, invoke.DISABLE_REMOTE,
		function( err, data ) {
			if ( err ) {
				callback(err);
			} else {
				var s = JSON.stringify(data,null,4);
				if ( path ) {
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
};


exports.createDirectory = function(path,file) {
	var p;
	var from = 0, to = -1;
	var l = path.length;
	var i = file? l = path.lastIndexOf("/",l) : l;
	var p = path;
	while ( !fs.existsSync( p ) ) {
		i = p.lastIndexOf( "/", i );
		if ( i < 0 ) break;
		p = path.substring(0,i);
	}
	while ( ++i < l ) {
		i = path.indexOf( "/", i );
		fs.mkdirSync( i < 0 ? (i = l, path) :
			path.substring(0,i) );
	}
}

exports.open = function ( context, id, path, local ) {
	function fileName(a,b,c) {
		return a + "/" + b + "/" + c;
	}
	if ( typeof id === "object" ) {
		var fn = id ? fileName( path,
			id.param.Bucket, id.param.Key ) : path;
		var p = fn;
		var i = p.lastIndexOf("/");
		if ( i > 0 ) {
			exports.createDirectory( p.substring(0,i) );
		}
		var mode = "r+";
		for ( i = 0 ; i < 2; i++ ) {
			try {
				var fd = fs.openSync( fn,
					local !== undefined ? local : mode );
				if ( fd >= 0 ) {
					return {
						fd: fd,
						offset: 0
					}
//		console.log( p );
//		fs.mkdirSync( p );
				}
			} catch ( e ) {
			}
			mode = "w+";
		}
	} else {
/*		if ( local ) {
			var ioc = exports.open( context, null,
				fileName( local, id, path ),
					"wx+" );
			if ( ioc ) return ioc;
		}*/
		return {
			s3 : context.service("S3"),
			param : {
				Bucket : id,
				Key: path
			}
		}
	}
}

exports.close = function ( ioc ) {
	var fd = ioc.fd;
	if ( fd === undefined ) {
	} else {
		fs.closeSync( ioc.fd );
	}
}

exports.read = function( ioc, callback, filter )
{
	var fd = ioc.fd;
	if ( fd === undefined ) {
		var param = ioc.param;
		if ( filter ) {
			var expr = "SELECT ";
			var col = filter.column;
			if ( col ) {
// TODO: column is array
				expr += col;
			} else {
				expr += "*";
			}
			expr += " from S3Object where " + filter.s;
			switch ( filter.cond ) {
				case "contain" : expr += " like '%" + filter.sval + "%'";
			}
			param = {
				Bucket: param.Bucket,
				Key: param.Key,
				ExpressionType: "SQL",
				Expression: expr,
				InputSerialization: {
					CSV: {
						FileHeaderInfo: "USE",
						RecordDelimiter: "\n",
						FieldDelimiter: ","
					}
				},
				OutputSerialization: {
					JSON: {RecordDelimiter:","}
				}
			}
			
			ioc.s3.selectObjectContent( param, function (err,data) {
				if ( !err ) {
					var s = "";
					data.Payload.on( 'data',
						function(event) {
							if ( event.Records )
								s += event.Records.Payload.toString();
							else if ( event.End ) {
								callback( null,
									JSON.parse( "[" +
										s.substring(0,s.length-1) + "]" ) );
							}
						}
					);
				} else {
					callback(err);
				}
			} );
		} else {
			ioc.s3.getObject( param, function(err,data) {
				if ( !err ) {
					data.buf = data.Body;
				}
				callback( err, data );
			} );
		}
	} else {
		fs.fstat( fd, function(err,st) {
			if ( err ) {
				callback(err);
			} else {
				var data = {
					buf : Buffer.alloc( st.size )
				}
				fs.read( fd, data.buf, 0,st.size, 0,
				function(err) {
					if ( err ) callback(err);
					else callback( null, data );
				});
			}
		} );
	}
}

exports.write = function( ioc, buf, callback ) {
	var fd = ioc.fd;
	if (fd === undefined) {
		var param = { 
//"ACL" : "public-read",
			"Body" : buf,
			"ContentType":"application/octet-stream" };
		Object.assign(param, ioc.param);
		var s3 = ioc.s3;
		(function put(err) {
			if (err) {
				callback(err);
			} else {
				s3.putObject(param, function ( err ) {
					if (err && err.code == "NoSuchBucket") {
						s3.createBucket({
							Bucket: param.Bucket
		//					CreateBucketConfiguration : {
		//					LocationConstraint:
		//process.env.AWS_DEFAULT_REGION
		//					}
						}, put);
					} else {
						callback(err);
					}
				});
			}
		})();
	} else {
		if (typeof buf === "string")
			buf = Buffer.from(buf);
		fs.write(fd, buf, 0, buf.length,
			ioc.offset, callback);
		ioc.offset += buf.length;
	}
}

exports.url = function( ioc, callback, expire ) {
	var fd = ioc.fd;
	if ( fd === undefined ) {
		var s3 = ioc.s3;
		var param = { Expires: expire };
		Object.assign( param, ioc.param );
		s3.getSignedUrl('getObject', param, callback );
	}
}

// EOF

