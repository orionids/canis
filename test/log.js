var log = require("canis/log" )


function f() {
	var pos = log.position();
	console.log( pos.getLineNumber() );
	console.log( pos.getLineNumber() );
//	console.log(log.position());
//	console.log(log.position());
//	console.log(log.position());
}

f();
