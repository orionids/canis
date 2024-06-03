"use strict";
var net = require("net");
var List = require("canis/list");
var monitor = require("canis/monitor");
var reporter = require("canis/reporter");


class Client extends List {
	constructor(prev, socket) {
		super();
		this.socket = socket;
		this.linkCircular(prev);
	}
}

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
	parse: function(context, input, control) {
		try {
			switch (input) {
				case null:
					class instance extends monitor.Instance {
						result(r) {
							console.log(r);
							control(false);
						}
					};
					return {
						instance: new instance(
							null, null, 10002),
						client: new List(true)
					}
				case "quit":
					control();
					break;
				case "connect":
					new Client(context.client, net.connect(10001, "127.0.0.1", function() {}))
					break;
				case "disconnect":
					var next = context.client.next;
					if (context.client == next) {
						console.log("empty");
					} else {
						next.unlinkCircular();
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
}, function(context) {
	context.instance.close();

	for (var c = context.client.next; c != context.client; c = c.next)
		c.socket.destroy();

	reporter.close();
	server.close();

	console.log("Bye~");
});
