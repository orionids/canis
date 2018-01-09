// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

'use strict'

module.exports = class {
	constructor( progress ) {
		this.stack = [];
		this.index = -1;
		// iterator only sends two cases for progress,
		// one is multi-level iteration was fully completed ( state == undefined )
		// another is multi-level loop is terminated by TERMINATE ( state == TERMINATE )
		this.progress = progress;
	}

	add( n, c, cb, pop ) {
		var t = ++this.index;
		if ( t >= this.stack.length ) this.stack.push( {} );
		var e = this.stack[t];
		e.context = c;
		e.index = 0;
		e.total = n;
		e.callback = cb;
		e.pop = pop;
	}

	// end can be called instead of run after pending
	end() {
		this.progress( this, module.exports.TERMINATE );
		this.index = -1;
	}

	run( brk ) {
		while ( this.index >= 0 ) {
			var e = this.stack[this.index];
			switch ( e.state ) {
				case module.exports.PENDING_BREAK: brk = true; break;
				case module.exports.PENDING_END: this.end(); return;
			}
			if ( brk != true ) {
				for (;;) {
					var i = e.index;
					if ( i >= e.total ) break;
					e.index = i + 1;
					var result = e.callback( this, e.context, i );
					if ( result == module.exports.BREAK ) {
						break;
					} else {
						switch ( result ) {
							case module.exports.PENDING:
							return;
							case module.exports.PENDING_BREAK:
							e.state = module.exports.PENDING_BREAK;
							return;
							case module.exports.PENDING_END:
							e.state = module.exports.PENDING_END;
							return;
							case module.exports.END:
							this.end();
							return;
						}
					}
				}
			}
			e.context = undefined;
			this.index --;
			if( e.pop !== undefined ) e.pop( this, e.context );
		}
		this.progress( this );
	}
};


module.exports.CONTINUE = 0;
module.exports.PENDING = 1;
module.exports.PENDING_BREAK = 2;
module.exports.PENDING_END = 3;
module.exports.BREAK = -1;
module.exports.END = -2;
