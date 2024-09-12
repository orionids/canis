// vim: ts=4 sw=4 :
// jshint curly:false
// Copyright (C) 2017, adaptiveflow
// Distributed under ISC License
"use strict";

module.exports = class {
	constructor(circular) {
		this.next = this.prev = circular? this : undefined;
	}

	linkCircular(prev) {
		var next = prev.next;
		this.next = next;
		next.prev = this;
		prev.next = this;
		this.prev = prev;
	}

	unlinkCircular() {
		var prev = this.prev;
		if (prev !== undefined) {
			this.prev = undefined;
			var next = this.next;
			prev.next = next;
			next.prev = prev;
		}
	}

	countCircular() {
		var n = 0;
		for (var node = this.next; node != this; node = node.next) n++;
		return n;
	}

	empty() {
		var head = this.next;
		return !head || head.next === head;
	}
};
