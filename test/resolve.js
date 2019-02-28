var string = require("canis/string")


var sym = {
	"?" : function( ctx, s ) {
		console.log( "On demand resolve" );
		if ( s == "world" ) return sym.world = ctx.result;
	},
	"??" : {
		result : ", world"
	},
	"hello": "Hello",
}

var ctx = {
	i : 0,
	delim : { open:"{", close:"}", escape:"\\"}
};

console.log( string.resolve( "{hello}{world}", [ sym ] , ctx ) );
console.log( sym.world );
console.log( string.resolve( "{hello}{world}", [ sym ] , ctx ) );
