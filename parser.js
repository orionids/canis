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
		stkIndex: 0,
		lastIndex: -1
	};
	return pc;
};

exports.token = function( pc )
{
	var src = pc.src;
	var from = pc.lastIndex + 1;
	if ( from >= src.length ) return undefined;
	var r;
	var re = pc.re;

	if ( blank(src,from) ) {
		r = re.exec( src );
		from = r.index + 1;
	}

	r = re.exec( src );
	
	var to = r ? r.index : src.length;
	pc.lastIndex = to;

	return src.substring(from,to);
//		pc.expr[pc.exprIndex++] = src.substring(from,to);
};

exports.last = function(pc)
{
	return pc.src.charAt(pc.lastIndex);
}
