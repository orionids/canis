require( "../../../out/aws/awskey" );

var context = require( "canis/context" );
var message = require( "canis/message" );

var awssdk = require( "canis/awssdk" );
var AWS = awssdk.initialize();

AWS.config.update({region: 'us-east-1'});
message.mail( context, "us-east-1",
	{
		addr: "adaptiveflow@gmail.com",
		name: "AdaptiveFlow"
	},
	"adaptiveflow@gmail.com",
	"HTML mail test",
	{ html: "<h1>Hello!</h1>" },
	null, function(err) {
		if ( err ) console.log( err );
		awssdk.recover();
		console.log( "\t\tmail sent!" );
	} );
