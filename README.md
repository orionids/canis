# Canis, Node.js based RESTful web service for Orion project.

## Introduction
Orion ( http://orionids.org ) project is aimed to be a general purpose
application framework which supports various forms of application
including web app.

So Canis is a part of Orion project and will support :
- RESTful web service framework, compatible to AWS API gateway.
- API definition using JSON and automatic API hirarchy generation for AWS.
- Supports popular web app frameworks like Express.

## New features in 0.1.0
- Functions needed to generate AWS APIs and methods automatically according to api.json
- Stage support in api.json


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
			"test1" : "A test stage"
		},
		"apiKey" : true,
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
