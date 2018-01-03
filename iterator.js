// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

'use strict'

module.exports = class {
	constructor( complete ) {
		this.stack = [];
		this.index = -1;
		this.CONTINUE = 0;
		this.PENDING = 1;
		this.BREAK = -1;
		this.RETURN = -2;
		this.complete = complete;
	}

	add( n, c, cb ) {
		var l = this.stack.length;
		var t = ++this.index;
		if ( t >= l ) this.stack.push( {} );
		this.stack[t] = {
			"context" : c,
			"index" : 0,
			"total" : n,
			"callback" : cb
		};
	}

	run() {
		while ( this.index >= 0 ) {
			for (;;) {
				var e = this.stack[this.index];
				var i = e.index;
				if ( i >= e.total ) break;
				e.index = i + 1;
				var result = e.callback( this, e.context, i );
				if ( result == this.PENDING ) return;
				if ( result == this.BREAK ) break;
				if ( result == this.RETURN ) {
					this.complete( this, this.RETURN );
					return;
				}
			}
			this.index --;
		}
		this.complete( this, 0 );
	}
};
