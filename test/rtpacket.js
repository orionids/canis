// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

// runtime packet response test implemented in
// invokeHandler, server.js

var child = {
	stdout : {
		on: function(ev,f) {
			child.stdout[ev] = f;
		}
	}
};

function
test()
{
				var chunk = [];
				var size, current = 0;
				child.stdout.on("data", function(d) {
//					chunk.push( data );
//console.log( data.slice(0,4),
// );
					if ( size === undefined ) {
						current += d.length;
						if ( current < 4 ) {
							chunk.push(d);
							return;
						}
						if ( chunk.length > 0 ) {
							d = Buffer.concat(chunk);
							chunk = [];
						}
						if ( current == 4 ) {
							size = parseInt
								(d.toString("hex"),16);
console.log( ">>>>> only size field received :", size );
							return;
						}
						size = parseInt( d.slice(0,4).
							toString("hex"),16);
						d = d.slice(4);
						current = 4;
console.log( ">>>>> size with payload : ", d.length );
					}
					current += d.length;
					if ( current >= size ) {
						var r;
						if ( current > size ) {
							var end = d.length +
								size - current;
							chunk.push(d.slice(0,end));
							r = Buffer.concat(chunk);
							chunk = [d.slice(end)];
						} else {
console.log( ">>>>> Exact payload received" );
							chunk.push(d);
							r = Buffer.concat(chunk);
							chunk = [];
						}

						var cmd = JSON.parse(r.slice( 2, 2 + parseInt( r.slice(0,2).
							toString("hex"),16) ));
//console.log( "[" + r.toString() + "]", "------" );
console.log( cmd );
						size = undefined;
						current = 0;
					} else {
						chunk.push(d);
					}
				});
				child.stdout.on("end",function() {
					var r = Buffer.concat(chunk);
console.log( r.toString(), "------" );
				});
}


test();
var f = child.stdout["data"];

var json = JSON.stringify({
	action: "result",
	err: null,
	data: "hello"
});

var buf = Buffer(6);
buf.writeUInt32BE(8 + json.length,0);
buf.writeUInt16BE(json.length,4)

f( buf );

f( Buffer.concat([Buffer.from(json),Buffer.from([123,123])]) );

