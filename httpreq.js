// vim: ts=4 sw=4 :
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

'use strict'
module.exports = function( mod, o, f ) {
	try {
		let req = mod.request( o, function(res) {
			let r = '';
			res.on('data', function(d) {
				r += d;
			} );
			res.on('end', function() {
				f( null, r, req );
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
