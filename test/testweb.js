exports.body = {
	"configuration" : {
		"apiKeyRequired" : true,
		"lambdaPrefix" : "",
		"lambdaProxyIntegraton": undefined,
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
	"" : {
		"GET": {
			"path" : "html",
			"base" : "STATIC_PATH"
		}
	}
};
