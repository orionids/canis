var htmlutil = require("canis/htmlutil");

console.log(htmlutil.json(
    JSON.stringify({ABC: "b&X<><>", DEF: 123, d: true, e: {f: null }}, null, 3)))
