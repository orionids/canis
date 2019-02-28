// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

module.exports ={
	canis : {
		DynamoDB: {
			DocumentClient: {
				query : function() {
				},
				update : function() {
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
};
