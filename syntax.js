// vim: ts=4 sw=4 noet :

var fs = require("fs");
var syntax = require("canis/context").module(
	"ge/glue/syntax", "@orionids/Orion");

// XXX In Windows!
var off = fs.statSync("/dev/stderr").isFile();

exports.html = syntax.html;

exports.console = {
	"color": "\x1b[",
	"done": "m",
	"end": "\x1b[0m"
};

exports.consoleColor = {
	"key": 93,
	"number": 95,
	"string": 92,
	"boolean": 94,
	"null": 91,
	"array": 96
};

exports.highlight = function(s, r, c)
{
	return off? s : syntax.highlight(
		s, r? r : this.console, c? c: this.consoleColor);
}
