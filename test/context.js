var c = require("canis/context");
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

context.module("validator", "canis", "val");
console.log("AFTER MODULE");
console.log(context.bind("val"));
context.module("iterator", "@orionids/canis", true);

context.module("compat.sh", "@orionids/Orion/mate/src", true);
