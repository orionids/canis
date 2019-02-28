// vim:ts=4 sw=4:
"use strict";
// https://medium.com/@tarkus/how-to-call-c-c-code-from-node-js-86a773033892return 

function
query()
{
}

module.exports ={
	canis : {
		DynamoDB: {
			DocumentClient: {
				query : query,
			}
		}
	},
	config: {
		update: function(){}
	},
	DynamoDB: {
		DocumentClient: class {
			query( param ) {
				//module.exports.canis.DynamoDB.DocumentClient.query
				//	( param, callback );
				console.log( "query called" );
				console.log( param );
			}
			update( param, callback ) {
				module.exports.canis.DynamoDB.DocumentClient.update
					( this, param, callback );
			}
		},
	},
	Lambda: class {
		invoke( param, callback ) {
			callback( { code: "ResourceNotFoundException" } );
		}
	},
	CloudWatchEvents: class {
	}
};
