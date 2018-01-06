// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

'use strict'

module.exports = class {
	constructor( progress ) {
		this.stack = [];
		this.index = -1;
		// iterator only sends two cases for progress,
		// one is multi-level iteration was fully completed ( state == undefined )
		// another is multi-level loop is terminated by RETURN ( state == RETURN )
		this.progress = progress;
	}

	add( n, c, cb, pop ) {
		var l = this.stack.length;
		var t = ++this.index;
		if ( t >= l ) this.stack.push( {} );
		this.stack[t] = {
			"context" : c,
			"index" : 0,
			"total" : n,
			"callback" : cb,
			"pop" : pop
		};
	}

	run() {
		while ( this.index >= 0 ) {
			var e = this.stack[this.index];
			for (;;) {
				var i = e.index;
				if ( i >= e.total ) break;
				e.index = i + 1;
				var result = e.callback( this, e.context, i );
				if ( result == module.exports.PENDING ) return;
				if ( result == module.exports.BREAK ) break;
				if ( result == module.exports.RETURN ) {
					this.progress( this, module.exports.RETURN );
					return;
				}
			}
			this.index --;
			if( e.pop !== undefined ) e.pop( this, e.context );
		}
		this.progress( this );
	}
};


module.exports.CONTINUE = 0;
module.exports.PENDING = 1;
module.exports.BREAK = -1;
module.exports.RETURN = -2;
