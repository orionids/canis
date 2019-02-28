// vim: ts=4 sw=4 :
// jshint curly:false

//#include <coralsrc/cdef.h>

function blank(s,i)
{
	return " \r\n\t\f\v".indexOf
		(s.charAt(i)) >= 0 ? true : false;
}

exports.context = function(src,cdelim)
{
	var pc = {
		re: new RegExp( (cdelim? "[\\:#" : "[" ) +
			"\\.\\(\\)\\\\\\[\\];'\\\",\\?]|[\\/\\*%\\=\\+\\-\\^\\|&\\!\\<\\>~]+|[" +
			"\\s" + "]+", "gm" ),
		src: src,
		expr: [],
		exprIndex: 0,
		stk: [],
		stkIndex: 0
	};
	return pc;
};

exports.parse = function( pc )
{
	for (;;) {
		var r;
		var re = pc.re;
		var src = pc.src;
		var from = re.lastIndex, to;

//	console.log( src, from );
		if ( blank(src,from) ) {
//	console.log( "BL" );
			r = re.exec( src );
			from = re.lastIndex;
		}

		r = re.exec( src );
		to = r.index;
		var last = re.lastIndex;

		if ( from === to ) {
			console.log( src.substring(from,last) );
		} else {
			console.log( "[" + src.substring(from,to) + "]" );
			pc.expr[pc.exprIndex++] = src.substring(from,to);
		}
		if ( last >= src.length ) break;
	}
};

