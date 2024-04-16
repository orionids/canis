// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License

exports.circularHead = function()
{
	var head = {};
	head.prev = head.next = head;
	return head;
};

exports.linkCircularNode = function(prev,node)
{
	var next = prev.next;
	node.next = next;
	next.prev = node;
	prev.next = node;
	node.prev = prev;
};

exports.unlinkCircularNode = function(node)
{
	var prev = node.prev;
	if (prev !== undefined) {
		node.prev = undefined;
		var next = node.next;
		prev.next = next;
		next.prev = prev;
	}
};

exports.countCircular = function(head)
{
	var n = 0;
	if (head) for (var node = head.next; node != head; node = node.next) n++;
	return n;
};
