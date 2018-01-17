// Copyright (c) 2017, 2018 adaptiveflow
// Distributed under ISC

exports.https = function ( server, api, basepath, request, response, extra ) {
	var httpreq, https, symbol;
	if ( extra ) {
		httpreq = extra.httpreq;
		https = extra.https;
		symbol = extra.symbol;
	}
	if ( httpreq === undefined ) httpreq = require( "./httpreq" );
	if ( https === undefined ) https = require( "https" );
	request.path = server.resolve
		( basepath ? basepath + request.url : request.url,
		 symbol? symbol : [ process.env ] );
	httpreq( https, request, function( err, data ) {
		if ( err ) console.log( err );else
		response.write( data );
	} );
}

exports.local = function( server, api, basepath, request, response, extra ) {
	var symbol = extra ? extra.symbol : null;
	request.url = server.resolve( request.url, symbol ? symbol : [ process.env ] );
	request.on = function(n,f) {
		switch ( n ) {
			case "data" :
			f( request.body === undefined? "" :
			JSON.stringify(request.body,0,2) );
			break;
			case "end": f(); break;
		}
	}
	server.invoke( api, basepath, request, response );
}
