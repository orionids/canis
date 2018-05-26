// vim: ts=4 sw=4 :
// Copyright (C) 2018, adaptiveflow
// Distributed under ISC


exports.argv = function ( optionContext, action ) {
	if ( action == 'next' ) {
		var ctx = optionContext.context;
		var i = ctx.i;
		if ( i === undefined ) i = 2;
		else i = i + 1;
		ctx.i = i;
		if ( i < ctx.argv.length ) return ctx.argv[i]
	}
	return null;
} 

exports.help = function ( longOption, charOption ) {
	var option = charOption;
	for ( var i = 0; i < 2; i++ ) {
		for ( var o in option ) {
			console.log( o + " : " + option[o].comment );
		}
		option = longOption;
	}
}

// this function corresponds to stroptString in Coral library, but
// no case to get partial string of the current arg because
// that is passed to parameter of an option dispacher
exports.next = function ( optionContext ) {
	return optionContext.invoke( optionContext, 'next' );
}

// simplified implementation of stropt in Coral library
// indicator for char options is '-', and character options are combinated ( -xzvf )
// indicator for string options is '--' and delimiter is applied for string options

// typically = is used for delimiter but : is suggested because batch file doesn't
// accept = in an argument if it is enclosed by "" : moreover, if cygwin invokes
// windows command, enclosing argument doens't work

// unknown options are strictly checked

exports.parse = function
	( optionContext, delimiter, longOption, charOption ) {
	var arg;
	while ( arg = this.next( optionContext ) ) {
		var longNameIndex = 1;
		if ( arg.charAt(0) == '-' ) {
			if ( optionContext.singleIndicator ||
				arg.charAt(longNameIndex++) == '-' ) {
				if ( !longOption ) return undefined;
				var i = arg.lastIndexOf( delimiter );
				var p;
				if ( i > 0 ) {
					p = arg.substring(i + 1);
				} else {
					i = undefined;
				}
				var o = longOption
					[arg.substring(longNameIndex,i)];
				if ( o === undefined ) return undefined;
				if ( o.dispatch( p, optionContext ) ) return null;
			} else {
				if ( !charOption ) return undefined;
				for (var i = 1;; i++) {
					var o = arg.charAt(i);
					if ( o == '' ) break;
					var o = charOption[o];
					if ( o === undefined ) return undefined;
					if ( o.dispatch( undefined, optionContext ) ) return null;
				}
			}
		} else {
			return arg;
		}
	}
	return null;
}

