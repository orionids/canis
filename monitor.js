// vim:ts=4 sw=4:
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

"use strict";
var net = require("net");
var readline = require("readline");

process.on('uncaughtException', function (err,origin) {
});

module.exports = function(param) {
	function quit() {
		rl.close();
		param.terminate(context);
	}	
	var rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	rl.on("SIGINT", function() {
		if (param.interrupt) param.parse(context, null, quit);
	});

	function control(pause) {
		if (pause === false) interactive();
		else if (!pause) quit();
		state = true;
	}

	function interactive() {
		var p = param.prompt;
		rl.question(p? p : "> ", function (input) {
			state = undefined;
			try {
				if ((input = input.trim()).length > 0)
					param.parse(context, input, control);
			} catch (e) {
				console.log(e);
			}
			if (state === undefined) interactive();
		});
	}

    var context = param.initialize(control);
	var state;
	interactive();
};

module.exports.Instance = class {
	constructor(tag, addr, port) {
		this.timer = null;
		this.connection = -1;
		this.stream = null;
		this.tag = tag;
		this.rl = null;
		(function connect(instance) {
 			function reconnect() {
				instance.connection = -1;
				if (instance.timer !== undefined)
					instance.timer = setTimeout(connect, 3000, instance);
			}

			instance.stream = net.connect(port, addr, function() {
				instance.timer = null;
				instance.connection = 0;
				instance.connected();
			});
			instance.stream.on("close", function() {
				reconnect();
			});
			instance.stream.on("error", function() {
				// don't reconnect here, "close" always reached
			});
			readline.createInterface({
				input: instance.stream
			}).on("line", function (l) {
				instance.result(l);
			});
		})(this);
	}

	command(s) {
		this.stream.write(s + "\n");
	}

	close() {
		if (this.rl) this.rl.close();
		this.stream.end();
		clearTimeout(this.timer);
		this.timer = undefined;
	}

	connected() {}
	result(r) {}
};
