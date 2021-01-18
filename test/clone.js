var object = require( "canis/object" );

var o = object.clone( {
	a: 1, b: 2
}, {
	recursive : false
});

console.log( o );
