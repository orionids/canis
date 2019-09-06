// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2017, 2018 adaptiveflow
// Distributed under ISC

"use strict";

var object = require( "canis/object" );

exports.override = function( target, source ) {
	for ( var s in source ) {
		if ( source.hasOwnProperty(s) ) {
			var sv = source[s];
			if ( typeof sv === 'object' ) {
				exports.override( target[s], sv );
			} else {
				target[s + "_orig"] = target[s];
				target[s] = sv;
			}
		}
	}
};


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
	var r = object.clone( request, {
		symbol : symbol === undefined ?
			[ process.env ] : symbol,
		ctx : { loose: true }
	} );
	if( r ) {
		r.path = basepath ? basepath + r.url : r.url;
console.log(r);
		httpreq( https, r, function( err, data, res ) {
			if ( err ) {
				console.log( err );
			} else {
				response.writeHead( res.statusCode );
				response.write( data );
				response.end( data );
			}
		} );
	}
//XXX exception
};

exports.http = function
( server, api, basepath, request, response, param ) {
	var p = {
		https: require("http")
	};
	Object.assign( p, param );
	exports.https( server, api, basepath,
		request, response, p );
}

exports.local = function
( server, api, basepath, request, response, param ) {
	var symbol;
	if ( param ) symbol = param.symbol;
	var r = object.clone( request, {
		symbol : symbol === undefined ?
			[ process.env ] : symbol,
		ctx : { loose: true }
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
		};
		return server.invoke( api, basepath, r, response, param );
	}
// XXX exception
};

var callee = {
	"local" : exports.local,
	"https" : exports.https,
	"http" : exports.http
};

exports.callee = function (name ) {
	var i;
	return callee
		[ name === undefined? 0 :
			(i = name.indexOf(".")) > 0 ?
				name.substring(0,i) : name];
};

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
			callee[target]( server, api, basepath,
				request, r, e );
		}
	}
	var e = {};
	for ( var p in param ) {
		if ( param.hasOwnProperty(p) ) e[p] = param[p];
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
};


// EOF
