// vim: ts=4 sw=4 noet :

var fs = require("fs");
var syntax = require("canis/context").module(
	"ge/glue/syntax", "@orionids/Orion");

// XXX In Windows!
module.exports.off = fs.statSync("/dev/stderr").isFile();

module.exports = syntax;

module.exports.console = {
	tag: "\x1b[",
	classTag: null,
	done: "m",
	end: "\x1b[0m",
	color: function (name) {
		return {
		"key": 93,
		"number": 95,
		"string": 92,
		"boolean": 94,
		"null": 91,
		"array": 96,
		"default": 0,
		"lightcyan": 96,
		"lightgreen": 92,
		"magenta": 95
		}[name];
	},
	stack : class {
		constructor() {
			this.stack = [null];
		}
		push(c) {
			if (this.stack[0]) {
				this.stack.push(c);
			} else {
				this.stack[0] = c;
			}
			return c;
		}
		pop(end) {
			var l = this.stack.length;
			if (l > 1) {
				this.stack.pop();
				return this.stack[l - 2];
			}
			this.stack[0] = null;
			return end;
		}
	}
};

module.exports.target = module.exports.console;
