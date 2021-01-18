// vim: ts=4 sw=4:
var context = require( "canis/context" )

var sqs = context.service( "SQS" );

var params = {
  QueueName: 'SQS_QUEUE_NAME02',
  Attributes: {
    'DelaySeconds': '60',
    'MessageRetentionPeriod': '86400'
  }
};


if ( true ) {
	sqs.createQueue( params, function(err,data) {
		console.log( "createQueue", err );
		var url = data.QueueUrl;
		sqs.sendMessage( {
			QueueUrl: url,
			MessageBody: "Hello",
			DelaySeconds: 3
		}, function(err,data) {
			sqs.sendMessage( {
				QueueUrl: url,
				MessageBody: "World",
				DelaySeconds: 1
			}, function(err,data) {
				console.log( "sendMessage", err );
				setTimeout( function() {
					sqs.receiveMessage( {
						QueueUrl: url,
						MaxNumberOfMessages: 1
					}, function(err,data) {
						console.log( "receiveMessage", err );
						console.log( data );
						console.log( "===" );
						
//						sqs.deleteMessageBatch( {
//							QueueUrl: url,
//							Entries: data.Messages
//						}, function(err,data) {
//							console.log( "deleteMessage", err );
							sqs.deleteQueue( {
								QueueUrl: url
							}, function(err,data) {
								console.log( "deleteQueue", err );
							} );
//						} );
					} );
				}, 5000 );
			} )
		} );
	} );
} else {
	sqs.listQueues( {}, function(err,q) {
		console.log( q.QueueUrls );
		console.log( q.QueueUrls[0] );
		sqs.deleteQueue( {
			QueueUrl: q.QueueUrls[0]
		} );
	});
}
