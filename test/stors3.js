var storage = require("canis/storage");
var context = require("canis/context");

context.service("S3");

var ioc = storage.open(context, bucket, path)
if (ioc) {
	storage.url(ioc, function(err,url) {
		console.log(url);
		storage.close(ioc);
	});
}
