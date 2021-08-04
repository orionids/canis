var memutil = require("canis/memutil");

//var base32_dest_table = [
//	'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K',
//	'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V',
//	'W', 'X', 'Y', 'Z', '2', '3', '4', '5', '6', '7'
//];
var base32Table = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

(function() {
    var b32 = "JBSWY3DPFQQHO33SNRSA====";
    var p = Buffer.alloc(memutil.memDestBufferSize(8, 5, b32.length));
    var r = memutil.memConvert(p, b32, b32.length, null,
        base32Table, 8, 5, memutil.MEM_DESTINATION);

    if (Buffer.compare(p.slice(0, r.length), Buffer.from([
            0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77,
            0x6f, 0x72, 0x6c, 0x64
    ])) == 0)
        console.log("pass");
    else
        console.log("fail", p);

    var b = Buffer.alloc(
        memutil.memDestBufferSize(5, 8, r.length));
    memutil.memConvert(b, p, r.length,
        base32Table, null, 5, 8, memutil.MEM_FLAG_ALIGN | 61);
    console.log(b);
})();
