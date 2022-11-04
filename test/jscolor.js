var syntax = require("canis/syntax");

var obj = {
	"a" : [1, 2, 3],
	"b" : "string",
	"x": true,
	"c" : 1e-11
}

var str = JSON.stringify(obj, undefined, 3);
console.log(syntax.highlight(
	str, syntax.console, syntax.consoleColor));
