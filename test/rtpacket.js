// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

// runtime packet response test implemented in
// invokeHandler, server.js
var commLog = true;

function
test()
{
	function receiveMessage(d, message) {
//var fs = require("fs");
//fs.appendFileSync('packet.txt', d.toString('base64') + "\n");
		while (true) {
			if (size === undefined) {
				current += d.length;
				if (current <= 4) {
					chunk.push(d);
					return;
				}
				if (chunk.length > 0) {
					chunk.push(d);
					d = Buffer.concat(chunk);
					chunk = [];
				}
				size = parseInt(d.slice(0,4).toString("hex"),16);
				d = d.slice(4);
				current = 4;
if ( commLog) console.log( ">>>>> size ", size,"with payload : ", d.length );
			}
			current += d.length;
			if (current >= size) {
				var dispatchPacket = function() {
					message(
						JSON.parse(Buffer.concat(chunk)));
					chunk = [];
					size = undefined;
					current = 0;
				};
				if (current > size) {
					var end = d.length +
						size - current;
					chunk.push(d.slice(0,end));
if (commLog) console.log( ">>>>> Exceeding payload received, end=", end );
					dispatchPacket();
					d = d.slice(end);
					continue;
				} else {
if ( commLog) console.log( ">>>>> Exact payload received" );
					chunk.push(d);
					dispatchPacket();
				}

/*							dispatchMessage(
					JSON.parse(r.slice( 2,
					2 + parseInt( r.slice(0,2).
					toString("hex"),16) )) );
				size = undefined;
				current = 0;*/
			} else {
				chunk.push(d);
console.log(chunk);
			}
			break;
		}
	}
    var size, current = 0;
    var chunk = [];

    var packet = [
    ];

    var i = 0;
    var append = Buffer.from('');
    (function input() {
        if (i >= packet.length) return;
        var d = Buffer.concat([append, Buffer.from(packet[i++], "base64")]);
        console.log(d);
        var size = parseInt(d.slice(0,4).toString("hex"),16)
        console.log(size, d.slice(4, size).toString());
        if (4 + size < d.length) {
            var remained = d.length - 4 - size;
            append = d.slice(4 + size);
console.log(append);
return;
        } else {
            append = Buffer.from('');
        }
        process.nextTick(input);
//        receiveMessage(d, function() {
  //          process.nextTick(input);
    //    });
    })();
}

test();
