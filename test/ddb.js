var context = require( "canis/context" );
var storage = require( "canis/storage" );
var pref = process.env.TABLE_PREFIX;
console.log( pref );
/*storage.put( context, pref, "bb",
{
	p: "userId",
	pval: "1",
	s: "threadId",
	sval: "7",
}, {
	val: "g"
}, function( err ) {
	console.log( err );
} );*/


console.log( Math.ceil(Date.now() / 1000) )

/*
storage.query( context, pref, "ttl-test",
{
	"TTLKey" : "1",
	"TTL" :  "1"
},
function( err, data ) {
	console.log( err );
	console.log( data );
	
} );*/

storage.put( context, pref, "ttl-test",
{
	p: "TTLKey",
	pval : "1"
},
{
	"TTL" :  ((Date.now()/1000)|0) + 10
},
function( err )
{
	console.log( err );
} );
