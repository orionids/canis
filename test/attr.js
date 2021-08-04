var object = require( "canis/object" );


var o = {
	"A" : {
		"B" : {
			"C" : "D"
		}
	}
};


console.log( object.attribute( o, "A.B.C" ) );
