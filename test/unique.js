var server = require( "canis/server" );

var prev;

function
unique(n)
{
	server.uniqueTime( function ( id ) {
		console.log( id );
		if ( n-- > 0 ) unique( n );
	} );
}

unique(5);
unique(5);
unique(5);
unique(5);
