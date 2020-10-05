var c = require( "canis/context" );
//c.ddbcli();

//context.ddbcli();
//console.log( new context() );
c.set( "storage_unlockDelay", 2000 );
c.delay( "storage_unlockDelay", function(a,b,c) { console.log( a,b,c); }, [ 1, 2, 3 ] ); 
var context = new (require( "canis/context" ));
console.log( c.storage_unlockDelay );
console.log( c );
console.log( context );
console.log( "done" );
