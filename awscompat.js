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
