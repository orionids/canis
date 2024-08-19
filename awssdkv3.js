module.exports = function()
{
	return new Proxy({
		Credentials: class {
			needsRefresh() {
				return this.expireTime - this.expiryWindow <= Date.now();
			}
		},
		config: {
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
			},
			update: function() {
			}
		},
		Lambda: ["invoke"],
		S3: ["listBuckets"],
		STS: ["getSessionToken"],
	}, {
		get: function(aws, name) {
			var attr = aws[name];
			if (attr && !Array.isArray(attr)) return attr;
			return class {
				constructor() {
					var client = require(
						"@aws-sdk/client-" + name.toLowerCase());
					this.context = new client[name + "Client"]({
						credentials: name == "STS"? undefined :
						async function () {
							return new Promise(function (resolve) {
								var c = aws.config.credentials;
								if (c.needsRefresh())
									aws.config.credentials.refresh(
									function() {
										resolve(aws.config.credentials);
									});
								else
									resolve(c);
							});
						}
					});
					for (var i = 0; i < attr.length; i++)
						this[attr[i]] = null;

					return new Proxy(this, {
						get: function(t, fn) {
							var f = t[fn];
							switch (f) {
								case undefined:
								console.log("\x1b[91m" + name + ":" +
									fn + ": Undefined symbol\x1b[0m");
								process.exit(1);
								case null:
								break;
								default:
								return f;
							}
							var cmd = client[fn.charAt(0).toUpperCase() +
								fn.substring(1) + "Command"];
							return t[fn] = function(param, callback) {
								t.context.send(
									new cmd(param), callback);
							};
						}
					});
				}
			};
		}
	});
};
