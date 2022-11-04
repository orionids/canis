var object = require( "canis/object" );


var o = {
	"A" : {
		"B" : {
			"C" : "D"
		},
		"C.D.X.Y.Z": {
			"C": 123
		}
	},
};


console.log(object.attribute(o, "A.B.C") == "D");
console.log(object.attribute(o, "A.C.D.X.Y.Z.C") == 123);
