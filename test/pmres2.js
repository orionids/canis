// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2017, 2018 adaptiveflow
// Distributed under ISC
function pm_evaluator(msg,env)
{
	var code =
	"pm.test(\"" + msg + "\", function() {\n" +
		"\tpm.expect(pm.response.code).to.be.oneOf([200]);\n" +
	"});\n"

	if ( env ) {
		code += "var response = JSON.parse(responseBody);\n"
		for ( var i = 0; i < env.length; i++ ) {
			code += "pm.environment.set( \"" + env[i].key +
				"\", " + env[i].value + " );\n";;
		}
	}
	return code;
}

code = pm_evaluator("success",
[ {
		"key" : "a",
		 "value" : "response.a"
	},
	{
		"key" : "b",
		 "value" : "response.b"
	}
	] );



var pm = {

	response: {
		code : 200
	},

	test: function(msg,f) {
		console.log( "pm.test: ", msg );
	},

	expect: function(code) {
		return {
			to : {
				be: {
					oneOf : function(codes) {
						console.log( "pm.expect.to.be.oneOf", codes );
					}
				}
			}
		}
	},

	environment: {
		set: function(key,value) {
			console.log( "pm.environment.set", key, "=", value );
		}
	}
};
var responseBody = JSON.stringify({
	a : 'a', b: 'b'
});
eval( code );
