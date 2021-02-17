var object = require( "canis/object" );

var o = object.clone( {
	"[W]": "Hello [W]", b: 2
}, {
	symbol: {
		"W" : "World"
	},
	recursive : true
});

console.log( o );
