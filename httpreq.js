// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

'use strict'
module.exports = function( mod, o, f ) {
	try {
		let req = mod.request( o, function(res) {
			let str = '';
			res.on('data', function(d) { str += d; } );
			res.on('end', function() {
				f( null, str );
			});
		});
		if ( o.data !== undefined )
			req.write( o.data );
		else if ( o.body !== undefined ) {
			req.write( JSON.stringify(o.body) );
		}

		req.on('error', function(e) {
			f( e );
		} );
		req.end();
	} catch ( e ) {
		f( e );
	}
}
