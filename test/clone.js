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

var base = {
	"World": {
		b: 1,
		c: 3,
		x: "a"
	},
	"Hello" : [
		{
			a:1,
			b:2
		}
	]
};
var ref = object.clone(base);
var o = object.clone( {
	"[W]": {
		a: "Hello [W]", b: 2, x: "b"
	},
	"Hello": [
		{
			a: 11,
			c:3
		},
		{
			x: 123
		}
	]
}, {
	symbol: {
		"W" : "World"
	},
	recursive : true
}, base);

console.log(o);
///Object.assign(ref, o);
//console.log(ref);
