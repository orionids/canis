// vim:ts=4 sw=4:
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

var context = require( "canis/context" );

var cwe = context.service("CloudWatchEvents");
var lambda = context.service("Lambda" );


if ( false ) {
	lambda.removePermission( {
	  StatementId: "executor",
	  FunctionName: "executor", 
	}, function(err,data) {
		console.log( err );
		console.log( data );
	} );
	return;
}

if ( false ) {
	cwe.putTargets(

	  { Rule: 'executor',
	  Targets: [
	    {
	     	Arn: 'arn:aws:lambda:ap-northeast-2:ACCOUNT:function:executor',
			Id: 'ReqExe',
			Input: JSON.stringify({ "type" : "test" })
	    }
	  ]
	}, function(err,data) {
		console.log( err );
		console.log( data );
	} );
	return;
}

if ( true ) {
	cwe.putRule( {
		Name: 'executor',
		ScheduleExpression: 'cron(* */2 * * ? *)',
		State: 'ENABLED'
	}, function(err,data) {
		console.log( err );
		console.log( data, "---" );
	});
	return;
}


cwe.putRule( {
	Name: 'executor',
	ScheduleExpression: 'cron(0/5 * * * ? *)',
	State: 'ENABLED'
}, function(err,data) {
	console.log( err );
	console.log( data, "---" );

var params = {
  Action: "lambda:InvokeFunction", 
  FunctionName: "executor", 
  Principal: "events.amazonaws.com", 
  SourceArn: data.RuleArn, 
  StatementId: "executor-Event"
 };
 lambda.addPermission(params, function(err, data) {
//   if (err)
console.log(err);//, err.stack); // an error occurred
//   else  
   console.log(data);           // successful response

	cwe.putTargets(

	  { Rule: 'executor',
	  Targets: [
	    {
	     	Arn: 'arn:aws:lambda:ap-northeast-2:ACCOUNT:function:executor',
			Id: 'ReqExe',
			InputPath: '$.detail'
	    }
	  ]
	}


, function(err, data) {
	  if (err) {
	    console.log("Error", err);
	  } else {
	    console.log("Success", data);
	  }
	});

   /*
   data = {
    Statement: "{\"Sid\":\"s3\",\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"s3.amazonaws.com\"},\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"arn:aws:lambda:us-east-2:123456789012:function:my-function\",\"Condition\":{\"StringEquals\":{\"AWS:SourceAccount\":\"123456789012\"},\"ArnLike\":{\"AWS:SourceArn\":\"arn:aws:s3:::my-bucket-1xpuxmplzrlbh\"}}}"
   }
   */
 });

} )


