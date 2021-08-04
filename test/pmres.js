// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2017, 2018 adaptiveflow
// Distributed under ISC

var responseBody = JSON.stringify({
	a : 'a', b: 'b'
});
var response = JSON.parse(responseBody);

__PM_MESSAGE__ = 'success';
/*__PM_RESULT__ = [ {
		"key" : "a",
		 "value" : response.a
	},
	{
		"key" : "b",
		 "value" : response.b
	}
	]*/
__PM_RESULT__ = function(response) {
	pm.envionment.set("a",response.a);
	pm.envionment.set("b",response.b);
}
__PM_RESULT_KEY__ = "a";
__PM_RESULT_VALUE__ = response.a;

function pmMultipleResult() {
	pm.test(__PM_MESSAGE__, function () {
		pm.expect(pm.response.code).to.be.oneOf([200]);
	});

	var response = JSON.parse(responseBody);
//	var env = __PM_RESULT__;
//	for (var i = 0; i < env.length; i++ ) {
//		pm.environment.set(env[i].key, env[i].value);
//	}
	__PM_RESULT__(response);
}

function pmSingleResult() {
	pm.test(__PM_MESSAGE__, function () {
		pm.expect(pm.response.code).to.be.oneOf([200]);
	});

	pm.environment.set(__PM_RESULT_KEY__,JSON.parse(responseBody).__PM_RESULT_VALUE__)
}

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

pmMultipleResult();
/*
function generate(f,token)
{
	var c = "";
	function code(r,v) {
		r = c + "\"" + r.replace(/\t/g,"\\t" ).
			replace(/\n/g, "\\n\" + \n\"" )
		return v? r + "\" + " + v + " + " : r;
	}
	var s = f.toString()
	s = s.substring( s.indexOf("{") + 1, s.lastIndexOf("}") );
	var l = token.length;
	for( var t = 0; t < l; t++ ) {
		var ti = token[t];
		var i = s.indexOf(ti.key);
		c = code( s.substring(0,i), ti.value );
		s = s.substring(i + ti.key.length);
	}
	return code(s);
}


var code = generate( pmMultipleResult, [
	{
		key: "__PM_MESSAGE__",
		value: "msg"
	},
	{
		key: "__PM_RESULT__",
		value: "result"
	}
] )

var msg = __PM_MESSAGE__;
var result = JSON.stringify(__PM_RESULT__);

eval("var x = " + code + "\"");
console.log( x );*/
