// Copyright (c) 2018, adaptiveflow
// Distributed under ISC

'use strict';

exports.partitionKeyQuery = function ( context, target, name, key, val, callback )
{
	var prefix = context.tablePrefix;
	if ( prefix ) {
		context.partitionKeyQuery( target, prefix + name, key, val, callback );
	} else {
		// call function to get read-only storage
		// parameter 'key' is meaningless for this case
		context( context, target, name, { key: val }, callback );
	}
}
