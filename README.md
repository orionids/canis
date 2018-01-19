# Canis, Node.js based RESTful web service for Orion project.

## Introduction
Orion ( http://orionids.org ) project is aimed to be a general purpose
application framework which supports various forms of application
including web app.

So Canis is a part of Orion project and will support :
- RESTful web service framework, compatible to AWS API gateway. ( initial implementation is done )
- API definition using JSON and automatic API hirarchy generation for AWS. ( initial implementation is done )
- Supports popular web app frameworks like Express. ( Partial implementation for express is done )

## New features in 0.1.0 to 0.2.1
- AWS related
	- Functions needed to generate AWS APIs and methods automatically according to api.json
	- Delay and retry to call APIs in AWS SDK ( https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html )
- REST API server related
	- Stage support in api.json
	- API key support
- Utilities related
	- delimiters to define a symbol is changed from {} to [] because {} is used to define path parameters
	- custom delimiters can be specified to resolve symbols
	- Command line option processor
	- Some examples are added
	- request.js is added to call APIs various way ( basically test purpose )

## Known todo list
- Static files
- https support
- An implementation like AWS lambda proxy integration ( AWS API auto generation supports this option )
- User account support using popular frameworks
- Interoperability with Orion project

## Examples are added
- test/itertest.js : how to use canis iterator including aynchronous execution case
- test/match.js : find the matching API ( to run this, cwd must be canis/test )
- test/server.js : run an REST API server according to test/testapi.js
	- to run this, cwd must be canis/test
	- after executing this, access http://127.0.0.1:3000/test1/hello in a web browser
	- API key can be enabled in test/testapi.js ( API cannot be called in a web browser )

## Usage
You should create a file api.json or api.js in current working direcrory and run
`node canis_path/server.js`
( Current implementation temporarily listens port 3000 for test )

An example of api.js which necessarily exports body is below.
If there is stage property in global configuration, API URL will be
`base_url/stage_name/path` and the current stage will be automatically passed to
the context of lambda handler - for AWS API auto-generation feature in Canis,
header mapping contains similar code to do that :
```
exports.body = {
	"configuration" : {
		"stage" : {
			"test1" : {
				"comment" : "A test stage",
				"apiKey" : "abcd"
			}
		},
		"apiKeyRequired" : true,
		"lambdaPrefix" : "",
		// optional aws specific parameters
		"aws-gatewayRegion" : "ca-central-1",
		"aws-lambdaRegion" : ""
	},
	"/hello" : {
		"/{param1}" : {
			"GET" : {
				"lambda" : "lambda/param1",
			},
			"/world" : {
				"/{param2}" : {
					"POST" : {
						"lambda" : "lambda/param2"
					}
				}
			}
		},
		"GET" : {
			"lambda" : "lambda/hello",
			"lambdaName" : "sayHello"
		},
		"/world" : {
			"GET" : {
				"lambda" : "lambda/world"
			}
		}
	}
};
```


## An example to generate AWS API automatically
```
const server = require( "canis/server" );
const awsapi = require( "canis/awsapi" );

// myapi.js ( with exported body )  or myapi.json must be present in cwd
server.main( "myapi", function( api, cwd ) {
	if ( api ) {
		var iter = new awsapi.iterator(
			function( iter, code, data ) { // progress callback
				switch ( code ) {
					case undefined:
					console.log( "Done." );
					break;
					case -1: // an error
					console.log( data );
					break;
					case awsapi.PATH:
					console.log( iter.path + data );
					break;
					case awsapi.METHOD:
					console.log( data );
					break;
					case awsapi.EXISTING_METHOD:
					data = iter.path + "/" + data;
					case awsapi.EXISTING_PATH:
					console.log( data + " : present" );
					break;
				}
			}
		);
		awsapi.createAPI( iter, api,
			"my-api-set-[stage]", // rest api name with symbol 'stage'
			[process.env], // array of key-value pairs to resolve symbol defined by {symbol}
			null, // subset path : if path is not null but subset json is null,
			      // try to match path using given parameter 'api' ( first param )
			null, // subset json );
	} else {
		console.log( "No API definition." );
	}
} );
```
