// vim: ts=4 sw=4 :
// Copyright (c) 2017, 2018 adaptiveflow
// Distributed under ISC

/*
function
resolveObject( server, o, symbol ) {
	if ( Array.isArray( o ) ) {
		for ( var i = 0; i < o.length; i++ ) {
			if ( ( o[i] = resolveObject
				( server, o[i], symbol ) ) === undefined )
				return undefined;
		}
	} else switch ( typeof o ) {
		case "string":
		return server.resolve( o, symbol );
		case "object":
		for ( var p in o ) {
			if ( (o[p] = resolveObject
				( server, o[p], symbol )) === undefined )
				return undefined;
		}
	}
	return o;
}*/

exports.override = function( target, source ) {
	for ( s in source ) {
		var sv = source[s];
		if ( typeof sv === 'object' ) {
			exports.override( target[s], sv );
		} else {
			target[s + "_orig"] = target[s];
			target[s] = sv;
		}
	}
}


exports.https = function
( server, api, basepath, request, response, param ) {
	var httpreq, https, symbol;
	if ( param ) {
		httpreq = param.httpreq;
		https = param.https;
		symbol = param.symbol;
	}
	if ( httpreq === undefined ) httpreq = require( "canis/httpreq" );
	if ( https === undefined ) https = require( "https" );
	var r = server.object( request, {
		symbol : symbol === undefined ?
			[ process.env ] : symbol
	} );
	if( r ) {
		r.path = basepath ? basepath + r.url : r.url;
		httpreq( https, r, function( err, data ) {
			if ( err ) console.log( err );else
			response.write( data );
			response.end( data );
		} );
	}
//XXX exception
}

exports.local = function
( server, api, basepath, request, response, param ) {
	var symbol;
	if ( param ) symbol = param.symbol;
	var r = server.object( request, {
		symbol : symbol === undefined ?
			[ process.env ] : symbol
	} );
	if( r ) {
		r.on = function(n,f) {
			switch ( n ) {
				case "data" :
				f( r.body === undefined? "" :
				JSON.stringify(r.body,0,2) );
				break;
				case "end": f(); break;
			}
		}
		return server.invoke( api, basepath, r, response, param );
	}
// XXX exception
}

exports.iterate = function( target, symbol, callback,
	server, api, basepath, request, response, param ) {
	var i;
	var r = {
		writeHead: response.writeHead,
		write : response.write,
		end : function () {
			response.end();
			perform();
		}
	};

	function perform() {
		callback( i, symbol.length );
		if ( i < symbol.length ) {
			e.symbol[0] = symbol[i++];
			exports[target]( server, api, basepath,
				request, r, e );
		}
	}
	var e = {};
	for ( var p in param ) {
		e[p] = param[p];
	}

	var s = e.symbol;
	if ( s === undefined ) {
		e.symbol = [ null, process.env ];
	} else if ( Array.isArray(s) ) { // assume array
		e.symbol = [ null ];
		for ( i = 0; i < s.length; i ++ ) {
			e.symbol.push( s[i] );
		}
	} else { // assume object
		e.symbol = [ null, s ];
	}

	i = 0;
	if ( !symbol || symbol.length <= 0 ) symbol = [ null ];
	perform();
}


// EOF
