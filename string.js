// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

"use strict";

exports.symbol = function ( s, symbol ) {
	function onDemandSymbol( sl, s ) {
		var r = sl[s];
		if ( r ) return r;
		r = sl['?'];
		if ( r instanceof Function ) {
			var ctx = sl['??'];
			return r( ctx? ctx : sl, s );
		}
		return undefined;
	}

	var resolved;
	if ( Array.isArray(symbol) ) {
		for ( var l = 0; l < symbol.length; l++ ) {
			var sl = symbol[l];
			if ( sl ) {
				resolved = onDemandSymbol( sl, s );
				// exclude both null and undefined
				if ( resolved != null ) return resolved;
			}
		}
		return undefined;
	}
	if ( symbol ) return onDemandSymbol( symbol, s );
	return undefined;
};

exports.resolve = function( s, symbol, ctx ) {
	var i;
	var delim;
	function replace( resolved, end ) {
		s = s.substring( 0, i ) + resolved +
			s.substring( end + delim.close.length );
	}
	for (;;) {
		if ( ctx ) {
			i = ctx.i;
			delim = ctx.delim;
			if ( delim ) break;
		} else {
			ctx = {};
			i = 0;
		}
		ctx.delim = delim = {
			open: "[", close: "]", escape: "\\",
		};
		break;
	}

	if ( ctx.preproc )
		s = ctx.preproc( s, ctx );

	if ( ctx.resolved !== undefined ) {
		replace( ctx.resolved, ctx.end );
	}

	if ( s === undefined ) return "";
	if ( s === null ) return null;
	while ( ( i = s.indexOf( delim.open, i ) ) >= 0 ) {
		var prev = i - 1;
		var next = i + delim.open.length;
		if ( s.charAt(prev) === delim.escape ) {
			s = s.substring( 0, prev ) + s.substring( i );
		} else {
			var end = s.indexOf( delim.close, next );
			if ( end < 0 ) return null;
			var sym = s.substring( next, end );
			var resolved = exports.symbol( sym, symbol );
			if ( resolved === undefined ) {
				if ( ctx.loose ) {
					replace( delim.open + sym + delim.close,
						end );
					i = end + 1;
				} else {
					ctx.i = i;
					ctx.end = end;
					ctx.s = s;
					ctx.symbol = sym;
					ctx.resolved = undefined;
					return undefined;
				}
			} else {
				replace( resolved, end );
			}
		}
	}
	return s;
};

var prevTime;
exports.unique = function( callback ) {
	(function wait(t) {
		setTimeout( function() {
			var now = Date.now();
			if ( now === prevTime ) {
				wait( 1 );
			} else {
				prevTime = now;
				callback( now );
			}
		}, t );
	})();
};
