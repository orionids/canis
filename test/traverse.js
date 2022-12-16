var o = {
	"[[INCLUDE]]": [
		"[MK_DEVEL]/test/js/in1", 
		"[MK_DEVEL]/test/js/in2"
		, {"my2": "LLL"}
	],
	"/1" : {
		"/1-1": {
			"/1-1-1": "contents",
			"/1-1-2": "contents"
		}
	},
	"/2" : [
		{"/2-1": "contents"},
		"/2-2",
		"/2-3"
	],
	"/3" : "contents"
};

var path = [];
require("canis/object").clone(o, {
	include: true,
	push: function(k, v) {
		path.push(k);
		if (typeof v !== "object")
			console.log(path.join(""));
	},
	pop: function(k) {
		path.pop();
	},
	list: function(v, s) {
		switch (s) {
			case true:
			console.log("[ begin list");
			break;
			case false:
			console.log("[ base list");
			break;
			case undefined:
			console.log("] end list");
			break;
			default:
			if (typeof v !== "object") {
				path.push(v);
				console.log(path.join(""));
				path.pop();
			}
		}
	}
});
