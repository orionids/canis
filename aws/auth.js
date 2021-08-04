// vim: ts=4 sw=4 noet :
var context = require("canis/context");

var child_process = require("child_process");

exports.session = function(account, user, code, duration) {
	var sts = context.service("STS");
	var param = {
		DurationSeconds: 900, 
		SerialNumber: "arn:aws:iam::" + account + ":mfa/" + user, 
		TokenCode: code
    };
	var ignore = false;

//	for (var i=0; i < 3; i++) {
		sts.getSessionToken(param, function(err, data) {
			if (!ignore) {
				ignore = true;
				console.log(err);
				console.log(data);
				var key = data.Credentials.SecretAccessKey;
				process.env["AWS_ACCESS_KEY_ID"] = data.Credentials.AccessKeyId;
				process.env["AWS_SECRET_ACCESS_KEY"] = key;
				process.env["AWS_SESSION_TOKEN"] = data.Credentials.SessionToken;
//	console.log(key);
	child_process.exec("aws s3 ls", function(err,stdout,stderr) {
		console.log(err);
		console.log(stdout);
		console.log(stderr);
	});
			} else {
				console.log("ignored");
			}
		});
//	}
};
