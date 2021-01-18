// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

exports.linkCircularNode = function(prev,node)
{
	var next = prev.next;
	node.next = next;
	next.prev = node;
	prev.next = node;
	node.prev = prev;
}

exports.unlinkCircularNode = function(node)
{
	var next = node.next;
	var prev = node.prev;
	prev.next = next;
	next.prev = prev;
}
