'use strict'

exports.iterate = function(api) {
	for ( var p in api ) {
		console.log( p );
	}
}

function invokeAPI(api,basepath,request,response) {
	// match API
	var url = request.url;
	var i = 0;
	var a;
	var ev = {}
	for (;;) {
		var start = i;
		i = url.indexOf( "/", start + 1 );
		var part = i > 0 ? url.substring( start, i ) : url.substring( start );
		a = api[part];
		if ( a === undefined ) { // path parameter
			for ( var prop in api ) {
				if ( prop.charAt(1) == '{' ) {
					a = api[prop];
					// automatically transfer path parameter without mapping
					ev[prop.substring( 2, prop.length - 1  )] =
						part.substring( 1 );
					break;
				}
			}
			if ( a === undefined ) break;
		}
		if ( i < 0 ) break;
		api = a;
	};
	if ( a !== undefined ) {
		var m = a[request.method];
		if ( m != undefined ) {
			try {
				var l = require( basepath ? basepath + "/" + m.lambda : m.lambda  );
				var str = '';
				request.on('data', function(d) { str += d; } );
				request.on('end', function() {
					try {
						ev.body = JSON.parse(str);
					} catch ( e ) {
					}
					ev.headers = request.headers;
					l.handler ( ev, null, function(xxx,result) {
						var type;
						if ( typeof result === 'object' ) {
							result = JSON.stringify( result, undefined, 2 );
							type = 'application/json';
						} else if ( m.header === undefined ||
							(type = m.header["Content-Type"]) === undefined ) {
							type = "text/plain";
						}
						response.writeHead(200, {'Content-Type' : type });
						response.write( result );
						response.end();
					} );
				} );
				request.on('error', function(e) {
					console.log( e ); // XXX do response here
				});
			} catch ( e ) {
				console.log( e );
			}
		} else {
			console.log( "Unknown method " + request.method );
		}
		return 0;
	} else {
		console.log( "Unknown API " + request.url );
	}
}

exports.invoke = invokeAPI;
exports.run = function(api,basepath,module) {
	function dispatch( request, response ) {
//		response.writeHead(200, {'Content-Type' : 'text/plain'} );
//		response.write('Undefined API');
//		response.end();
		invokeAPI( api, basepath, request, response );
	}

	const http = require( "http" );


var express = require( 'express' );
const app = express();
app.all('*', dispatch );
	// XXX testing now
	http.createServer( app ).listen( 3000 );
}
