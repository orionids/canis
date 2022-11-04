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

// JSON inclusion
// - object includes objects (list is not supported)
// - list includes list
var o = object.clone( {
/*	"[[INCLUDE]]": [
		"[MK_DEVEL]/test/js/in1", 
		"[MK_DEVEL]/test/js/in2"
		, {"my2": "LLL"}
	],*/
	"xxx": [
		["[[INCLUDE]]",
		"[MK_DEVEL]/test/js/in1",
		"[MK_DEVEL]/test/js/in2"],
		"@@@",
		{
			"a": "[W]"
		},
		["[[INCLUDE]]",
		"[MK_DEVEL]/test/js/in1",
		"[MK_DEVEL]/test/js/in3"],
		"#"
	],
	"[W]": {
		a: "Hello [W]", b: 2, x: "b"
	},
	"Hello": [
		{
			a: 11,
			c:333
		},
//		["[[INCLUDE]]", "[MK_DEVEL]/test/js/in1",
//"[MK_DEVEL]/test/js/in2"
//],
		{
			x: 123
		}
	]
}, {
	symbol: [
		{"W" : "World"},
		process.env
	],
	recursive : true,
	include: {
		keyword: "[[INCLUDE]]",
		load: require
	}
}, base);

console.log(o);
///Object.assign(ref, o);
console.log(ref);
