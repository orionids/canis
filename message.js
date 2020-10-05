// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2019, adaptiveflow
// Distributed under ISC License

exports.mail = function(context,region,sender,receiver,
subject,contents,attach,callback) {
	function encstr(s) {
		return "=?UTF8?B?" +
		Buffer.from(s).toString('base64') + "?=";
	}

	function addr(s,name) {
		if ( name === undefined ) return s;
		return encstr(name) + " <" + s +">";
	}

	var ses = context.service("SES");

	var senderName;
	if ( typeof sender === "object" ) {
		senderName = sender.name;
		sender = sender.addr;
	} else {
		senderName = sender;
	}

	var arn = "arn:aws:ses:" + region +
		":279701849881:identity/" + sender;

	var msg = "From: " + addr(sender,senderName) + "\nTo: ";

	if ( !Array.isArray(receiver) )
		receiver = [receiver];

	var dest = [];

	for ( var i = 0; i < receiver.length; i++ ) {
		if ( i > 0 ) msg += ",";
		var r = receiver[i];
		var rname;
		if ( typeof r === "object" ) {
			rname = r.name;
			dest.push( r = r.addr );
		} else {
			rname = undefined;
			dest.push( r );
		}
		msg += addr(r,rname);
	}

	msg += "\nSubject: " + encstr(subject) +
	"\nContent-Type: multipart/mixed;\n" + 
"    boundary=\"a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\"\n" + 
"\n" + 
"--a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\n" + 
"Content-Type: multipart/alternative;\n" + 
"    boundary=\"sub_a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\"\n" + 
"\n" + 
"--sub_a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\n" + 
"Content-Type: text/plain; charset=iso-8859-1\n" + 
"Content-Transfer-Encoding: quoted-printable\n" + 
"\n" + 
"Please see the attached file for a list of customers to contact.\n" + 
"\n";


	var html = contents.html;
	if ( html ) {
		msg +=
		"--sub_a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\n" + 
		"Content-Type: text/html; charset=utf-8\n" +
		"Content-Transfer-Encoding: base64\n" +
		"\n" + (typeof html === "string" ? Buffer.from(html) : html ).toString('base64') + "\n\n" +
		"--sub_a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a--\n\n";
	}
/*"--sub_a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\n" + 
"Content-Type: text/html; charset=iso-8859-1\n" + 
"Content-Transfer-Encoding: quoted-printable\n" + 
"\n" + 
"<html>\n" + 
"<head></head>\n" + 
"<body>\n" + 
"<h1>Hello!</h1>\n" + 
"<p>Please see the attached file for a list of customers to contact.</p>\n" + 
"</body>\n" + 
"</html>\n" + 
"\n" + 
"--sub_a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a--\n" + 
"\n" + */

if ( attach ) {
var a = attach;
var aname = encstr(attach.name);
var atype = attach.type == "text" ?
	"text/plain" : "application/octet-stream";

msg += "--a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\n" + 
"Content-Type: " + atype + "; name=\"" + aname + "\"\n" + 
"Content-Description: " + aname + "\n" + 
"Content-Disposition: attachment;filename=\"" + aname + "\";\n" + 
"    creation-date=\"" + encstr(attach.date) + "\";\n" + 
"Content-Transfer-Encoding: base64\n" + 
"\n" + 
//"SUQsRmlyc3ROYW1lLExhc3ROYW1lLENvdW50cnkKMzQ4LEpvaG4sU3RpbGVzLENhbmFkYQo5MjM4\n" + 
//"OSxKaWUsTGl1LENoaW5hCjczNCxTaGlybGV5LFJvZHJpZ3VleixVbml0ZWQgU3RhdGVzCjI4OTMs\n" + 
//"QW5heWEsSXllbmdhcixJbmRpYQ==\n" + 
attach.buf.toString('base64')
"\n\n" + 
"--a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a--\n";
}

	var param = {
		Destinations: dest,
		FromArn: arn,
		RawMessage: {
			Data: msg
		},
		ReturnPathArn: arn,
		Source: sender,
		SourceArn: arn
	};
	ses.sendRawEmail( param, callback );
}
if (false ) {
exports.mail = function(context,region,sender,receiver,
subject,contents,attach,callback) {
	function encstr(s) {
		return "=?UTF8?B?" +
		Buffer.from(s).toString('base64') + "?=";
	}

	function addr(s,name) {
		if ( name === undefined ) return s;
		return encstr(name) + " <" + s +">";
	}

	var ses = context.service("SES");

	var senderName;
	if ( typeof sender === "object" ) {
		senderName = sender.name;
		sender = sender.addr;
	} else {
		senderName = sender;
	}

	var arn = "arn:aws:ses:" + region +
		":279701849881:identity/" + sender;

	var msg = "From: " + addr(sender,senderName) + "\nTo: ";

	if ( !Array.isArray(receiver) )
		receiver = [receiver];

	var dest = [];

	for ( var i = 0; i < receiver.length; i++ ) {
		if ( i > 0 ) msg += ",";
		var r = receiver[i];
		var rname;
		if ( typeof r === "object" ) {
			rname = r.name;
			dest.push( r = r.addr );
		} else {
			rname = undefined;
			dest.push( r );
		}
		msg += addr(r,rname);
	}


	msg += "\nSubject: " + encstr(subject) +
	"\nContent-Type: multipart/mixed;\n" +
"    boundary=\"a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\"\n" +
"\n" +
"--a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\n" +
"Content-Type: multipart/alternative;\n" +
"    boundary=\"sub_a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\"\n" +
"\n" +
"--sub_a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\n" +
"Content-Type: text/plain; charset=iso-8859-1\n" +
"Content-Transfer-Encoding: quoted-printable\n" +
"\n" +
"Please see the attached file for a list of customers to contact.\n" +
"\n" +
"--sub_a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\n";

var html = contents.html;
if ( html ) {
msg += "Content-Type: text/html; charset=utf-8\n" +
"Content-Transfer-Encoding: base64\n" +
"\n" +

/* XXX consider the case when html is not buffer, but plain string */
	(typeof html === "string" ?
		Buffer.from(html) : html ).toString('base64')

"\n\n" +
"--sub_a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a--\n\n";
}

if ( attach ) {
	var a = attach;
	var aname = encstr(a.name);
	var atype = a.type == "text" ?
		"text/plain" : "application/octet-stream";

	msg +=
	"--a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a\n" +
	"Content-Type: " + atype + "; name=\"" + aname +
	"\"\nContent-Description: " + aname +
	"\nContent-Disposition: attachment;filename=\"" + aname +
	"\";\n    creation-date=\"" + encstr(a.date) + "\";\n" +
	"Content-Transfer-Encoding: base64\n" +
	"\n" +
	//"SUQsRmlyc3ROYW1lLExhc3ROYW1lLENvdW50cnkKMzQ4LEpvaG4sU3RpbGVzLENhbmFkYQo5MjM4\n" +
	//"OSxKaWUsTGl1LENoaW5hCjczNCxTaGlybGV5LFJvZHJpZ3VleixVbml0ZWQgU3RhdGVzCjI4OTMs\n" +
	//"QW5heWEsSXllbmdhcixJbmRpYQ=="

	a.buf.toString('base64')
	 +
	"\n\n" +
	"--a3f166a86b56ff6c37755292d690675717ea3cd9de81228ec2b76ed4a15d6d1a--\n";
console.log( attach.buf.length );
}


	var param = {
		Destinations: dest,
		FromArn: arn,
		RawMessage: {
			Data: msg
		},
		ReturnPathArn: arn,
		Source: sender,
		SourceArn: arn
	};
	ses.sendRawEmail( param, callback );
}
}


