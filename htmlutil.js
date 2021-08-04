// vim: ts=4 sw=4 noet :
// jshint curly:false
// Copyright (C) 2017, 2021 adaptiveflow
// Distributed under ISC License

exports.json = function (json) {
	return json.replace(/[&<>]/g, function(m) {
		return {"&": "&amp;", "<": "&lt;", ">": "&gt;"}[m];
	}).replace(
		/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
		function (m) {
			return '<span class="' + (
				/^"/.test(m)?
				/:$/.test(m)? 'json_attr' : 'json_str' :
				/true|false/.test(m)? 'json_bool':
				/null/.test(m)? 'json_null': 'json_num'
			)+ '">' + m + '</span>';
		});
}
