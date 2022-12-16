// vim: ts=4 sw=4 noet :

var syntax = require("canis/context").module(
	"ge/web/syntax", "@orionids/Orion");

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
	return syntax.highlight(
		s, r? r : this.console, c? c: this.consoleColor);
}
