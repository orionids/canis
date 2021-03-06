// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

exports.body = {
	"configuration" : {
		"apiKeyRequired" : true,
		"lambdaPrefix" : "",
		"lambdaProxyIntegration": undefined,
		"lambdaProxyIntegrationInput": undefined,
		"stage" : {
			"test1" : {
				"comment" : "A test stage",
				// to test on browser, don't use apiKey in http header
				//"apiKey" : "abcd"
			}
		},
		// if stage doesn't define apiKey, this apiKey is used
		//"apiKey" : "1234",
		// optional aws specific parameters
		"aws-gatewayRegion" : "ap-northeast-2",
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
				"lambda" : "lambda/world",
				"lambdaProxyIntegration" : true
			}
		},
	},
	"/python" : {
		"GET": {
			"lambda" : "lambda/hello.py",
			"lambdaProxyIntegration" : true,
			"runtime" : "python"
		}
	},
	"" : {
		"GET": {
			"path" : "html",
			"base" : "STATIC_PATH"
		}
	}
};
