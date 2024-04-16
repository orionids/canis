"use strict";
var net = require("net");
var list = require("canis/list");
var monitor = require("canis/monitor");
var reporter = require("canis/reporter");


var connection = 0;
var server = net.createServer(function (client) {
	connection ++;
	client.on("close", function() {
		connection --;
	});
}).listen(10001, function(){
});

var reporter = reporter(10002, function(cmd) {
	if (cmd[0] == "state")
		return JSON.stringify({connection: connection}) + "\n";
	return "OK\n";
}, true);

monitor({
	interrupt: true,
	initialize: function(control) {
		class instance extends monitor.Instance {
			result(r) {
				console.log(r);
				control(false);
			}
		};
		return {
			instance: new instance(null, null, 10002),
			client: list.circularHead()
		}
	},
	parse: function(context, input, control) {
		try {
			switch (input) {
				case "quit":
					control();
					break;
				case "connect":
					list.linkCircularNode(context.client, {
						next: null,
						prev: null,
						socket: net.connect(10001, "127.0.0.1", function() {})
					})
					break;
				case "disconnect":
					var next = context.client.next;
					if (context.client == next) {
						console.log("empty");
					} else {
						list.unlinkCircularNode(next)
						next.socket.destroy();
					}
					break; 
				default:
					if (context.instance.connection < 0) {
					    control(true);
					    console.log("Not connected");
					    control(false);
					} else {
					    context.instance.stream.write(input + "\n");
					    control(true);
					}
			}
		} catch (e) {
			console.log(e);
		}
	},
	terminate: function(context) {
		context.instance.close();

		for (var c = context.client.next; c != context.client; c = c.next)
			c.socket.destroy();

		reporter.close();
		server.close();

		console.log("Bye~");
	}
});
