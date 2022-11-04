// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (c) 2017 ~ 2022 adaptiveflow
// Distributed under ISC

require("canis/httpreq")(require(process.argv[2]), {
	"method": "GET",
	"host": process.argv[3],
	"path": process.argv[4]
}, function(err, data) {
	if (err) process.exit(1);
	console.log(data);
});
