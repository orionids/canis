// vim: ts=4 sw=4 noet :
// jshint curly:false
// Copyright (C) 2021, adaptiveflow
// Distributed under ISC License
// memConvert in coral to canis

exports.MEM_FLAG_REJECT_RESIDUE = 0x0100;
exports.MEM_FLAG_ALIGN = 0x0200;
exports.MEM_FLAG_SPECIAL_CHAR_INDEX = 0x0400;
exports.MEM_FLAG_LOW_TO_HIGH = 0x0800;
exports.MEM_REDUCED_SOURCE = 0x1000;
exports.MEM_DESTINATION = 0x2000;
exports.MEM_MASK_SOURCE = 0x3000;
exports.FLAG_SPECIAL = 0x8000;
exports.MEM_SPECIAL_CHAR = 0xff;

exports.OP_BYTE = function(val, b)
{
	return ((val) + ((b) - 1)) / (b);
}

exports.OP_ALIGN = function(val, b)
{
	return exports.OP_BYTE(val, b) * b;
}


var mask = [0x00, 0x01, 0x03, 0x07, 0x0f, 0x1f, 0x3f, 0x7f];
var mem_src_align = [0, 8, 4, 8, 2, 8, 4, 8, 1];

exports.memConvert = function(
	dest, src, len, dest_table, src_table,
	dest_nbit, src_nbit, flag)
{
	var src_len = len;
	if (src_len > 0) {
		var dest_bit, src_bit, dest_full, dest_empty,
			src_full, src_empty;
		var dest_index = 0, src_index = 0;
		var  l = 0;
		var dest_char = 0, src_char = 0; // actually src_char need not to be initialized
		if (flag & exports.MEM_FLAG_LOW_TO_HIGH) {
			dest_full = dest_nbit;
			dest_empty = 0;
			src_full = 0;
			src_empty = src_nbit;
		} else {
			dest_full = 0;
			dest_empty = dest_nbit;
			src_full = src_nbit;
			src_empty = 0;
		}

		dest_bit = dest_empty;
		src_bit = src_empty;

		for (;;) {
			var needed, dest_shift, src_shift;

			if (src_bit == src_empty) { /* no remained bits in the source */
				for (;;) {
					if (src_len <= 0) {
						if (dest_bit != dest_empty) {
							if (!(flag & exports.MEM_FLAG_REJECT_RESIDUE)) {
								dest_bit = dest_full;
								break;
							}
						}
						if (flag & exports.MEM_FLAG_ALIGN) {
							var align;
							dest_char = flag & 0xff;
							align = mem_src_align[dest_nbit];
							src_len = l % align;
							if (src_len > 0) {
								src_len = align - src_len;
								l += src_len;
								while (src_len-- > 0)
									dest[dest_index++] = dest_char;
							}
						}
						return {
							length: l,
							code: 0
						};
					}

					src_char = src[src_index];
					if (src_table) {
						switch (flag & exports.MEM_MASK_SOURCE) {
							case 0: /* direct table */
							src_char = src_table[src_char];
							break;
							case exports.MEM_REDUCED_SOURCE:
							var lb = src_table[0];
							src_char = src_char < lb ||
								src_char >= src_table[1]?
								exports.MEM_SPECIAL_CHAR :
								src_table[src_char - lb + 2];
							break;
							default: /* MEM_DESTINATION */
							var found = src_table.indexOf(
							 src_char );
							src_char = found < 0? exports.MEM_SPECIAL_CHAR :
								found;
						}
						if (src_char == exports.MEM_SPECIAL_CHAR) {
							result = {
								length: l,
								code: exports.FLAG_SPECIAL | src[src_index]
							};

							if (flag & exports.MEM_FLAG_SPECIAL_CHAR_INDEX)
								result.index = len - src_len;
							return result;
						}
					}
					src_index++;
					src_len--;
					src_bit = src_full;
					break;
				}
			}

			if (flag & exports.MEM_FLAG_LOW_TO_HIGH) {
				var dest_remained = dest_full - dest_bit;
				var src_remained = src_empty - src_bit;
				needed = Math.min(dest_remained,src_remained);
				dest_shift = dest_bit;
				dest_bit += needed;
				src_shift = src_bit;
				src_bit += needed;
			} else {
				needed = Math.min(dest_bit,src_bit);
				dest_shift = dest_bit -= needed;
				src_shift = src_bit -= needed;
			}

			dest_char |= ((src_char>>src_shift)&mask[needed]) << dest_shift;
			if (dest_bit == dest_full) {
				dest[dest_index++] =
					(dest_table? dest_table[dest_char] : dest_char);
				dest_char = 0;
				dest_bit = dest_empty;
				l++;
			}

		}
	}
	return {
		length: 0,
		code: 0
	}
}

exports.memDestBufferSize = function(dest_nbit, src_nbit, len)
{
	return exports.OP_ALIGN(exports.OP_BYTE(
		len * src_nbit,dest_nbit), mem_src_align[dest_nbit]);
}

exports.memSetClipboard = function(data, callback)
{
	var cmd;
	switch (process.platform) {
		case "darwin":  cmd = "pbcopy"; break;
		case "win32": cmd = "orion -[wclip] -q"; break;
		default: cmd = "xclip";
	}
	require("child_process").exec(
		"echo -n " + data + "|" + cmd, {
		shell: process.env.SHELL
	}, function(err, stdout, stderr) {
		callback();
	})
}
