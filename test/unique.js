var string = require( "canis/string" );

var prev;

function
unique(n)
{
	string.unique( function ( id ) {
		console.log( id );
		if ( n-- > 0 ) unique( n );
	} );
}

unique(5);
unique(5);
unique(5);
unique(5);
