
// https://medium.com/@tarkus/how-to-call-c-c-code-from-node-js-86a773033892return 

module.exports ={
	canis : {
		DynamoDB: {
			DocumentClient: {
				query : function( ddbcli, param, callback ) {
				},
				update : function( ddbcli, param, callback ) {
				}
			}
		}
	},
	config: {
		update: function(){}
	},
	DynamoDB: {
		DocumentClient: class {
			query( param, callback ) {
				module.exports.canis.DynamoDB.DocumentClient.query
					( this, param, callback );
			}
			update( param, callback ) {
				module.exports.canis.DynamoDB.DocumentClient.update
					( this, param, callback );
			}
		},
	}
}
