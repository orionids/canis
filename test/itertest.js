// vim: ts=4 sw=4 :

var iterator = require( "../../canis/iterator" );
var iter = new iterator( function() {
	console.log( "done" );
} );
var o = { a:"aa", b: "bb", c:"cc"};
var a = Object.keys( o );

iter.add( a.length, { o:o, a:a },
	function( iter, c, i ) {
		console.log( c.o[c.a[i]] + ", i=" + i );
		iter.add( 2, null, function( iter, c, j ) {
		console.log( "\tstktop=" + iter.index + ", j=" + j ); // stack_top + cur_index
		iter.add( 3, null, function ( iter, c, k ) {
			console.log ( "\t\tk=" + k );

			if ( i == 1 && j == 1 && k == 2 ) {
				setTimeout( function() {
					iter.run(); // restart iteration
				} );
				console.log( "----- async -----" );
				return iterator.PENDING;
			}
		} );
	} );
} ).run();
