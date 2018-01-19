// Copyright (c) 2017, 2018 adaptiveflow
// Distributed under ISC

function
resolveObject( server, o, symbol ) {
	var newo = {};
	for ( p in o ) {
		var v = o[p];
		if ( typeof v === 'string' ) {
			if ( (newo[p] = server.resolve( v, symbol )) === undefined )
				return undefined;
		} else if ( typeof v === 'object' ) {
			if ( (newo[p] = resolveObject( server, v, symbol )) === undefined )
				return undefined;
		} else {
			newo[p] = v;
		}
	}
	return newo;
}

exports.https = function ( server, api, basepath, request, response, extra ) {
	var httpreq, https, symbol;
	if ( extra ) {
		httpreq = extra.httpreq;
		https = extra.https;
		symbol = extra.symbol;
	}
	if ( httpreq === undefined ) httpreq = require( "./httpreq" );
	if ( https === undefined ) https = require( "https" );
	if ( symbol == undefined ) symbol = [ process.env ];
	request.path = server.resolve
		( basepath ? basepath + request.url : request.url, symbol );
	if ( resolveObject( server, request.headers, symbol ) &&
	     resolveObject( server, request.body, symbol ) ) {
		httpreq( https, request, function( err, data ) {
			if ( err ) console.log( err );else
			response.write( data );
		} );
	}
//XXX exception
}

exports.local = function( server, api, basepath, request, response, extra ) {
	var symbol;
	if ( extra ) symbol = extra.symbol;

	if ( symbol == undefined ) symbol = [ process.env ];
	var r = resolveObject( server, request, symbol );
		r.on = function(n,f) {
			switch ( n ) {
				case "data" :
				f( r.body === undefined? "" :
				JSON.stringify(r.body,0,2) );
				break;
				case "end": f(); break;
			}
		}
		server.invoke( api, basepath, r, response );
// XXX exception
}

exports.iterate = function( target, symbol, callback, server, api, basepath, request, response, extra ) {
	function perform() {
		callback( i, symbol.length );
		if ( i < symbol.length ) {
			e.symbol[0] = symbol[i++];
			exports[target]( server, api, basepath,
				request, r, e );
		}
	}
	var r = {
		writeHead: response.writeHead,
		write : response.write,
		end : function () {
			response.end();
			perform();
		}
	};

	var e = {};
	for ( var p in extra ) {
		e[p] = extra[p];
	}

	var i;
	var s = e.symbol;
	if ( s === undefined ) {
		e.symbol = [ null, process.env ];
	} else if ( typeof e.symbol === 'object' ) {
		e.symbol = [ null, s ];
	} else { // assume array
		e.symbol = [ null ];
		for ( i = 0; i < s.length; i ++ ) {
			e.symbol.push( s[i] );
		}
	}

	i = 0;
	if ( !symbol || symbol.length <= 0 ) symbol = [ null ];
	perform();
}
