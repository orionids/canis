// vim:ts=4 sw=4:
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

var net = require("net");
var list = require("canis/list");

module.exports = function(port, handler, manageClient) {
	var server = net.createServer(function(reporter) {
		function checkArguments(cmd, n) {
			if (cmd.length < n) {
				reporter.write("Insufficient number of arguments\n");
				return false;
			}
			return true;
		}

		function unknownArgument(arg) {
			reporter.write("Unknown argument: " + arg + "\n");
		}

		if (manageClient) {
			var l = {
				next: null,
				prev: null,
				reporter: reporter
			}
			list.linkCircularNode(context.client, l);
		}

		var rl = require("readline").createInterface({
			input: reporter,
		});

		handler([0]);

		rl.on("line", function(l) {
			var cmd = l.split(/\s+/);
			var result = handler(cmd);
			reporter.write(
				(result ? result : "Unknown command: " + cmd[0]) + "\n");
		});

		reporter.on("error", function() {});

		reporter.on("end", function() {
			rl.close();
			if (manageClient)
				list.unlinkCircularNode(l);
		});
	}).listen(port, function() {
		handler([1]);
	});

	if (!manageClient) return server;

	var context = {
		client: list.circularHead(),
		server: server,
		close: function() {
			for (var l = context.client.next; l != context.client; l = l.next)
				l.reporter.destroy();
			context.server.close();
		}
	};
	return context;
};
