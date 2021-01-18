var storage = require( "canis/storage" );
var context = require( "canis/context" );



var ioc = storage.open( context, "resource", "model/name.csv" );
if ( ioc ) {

if (0) {
	storage.write( ioc,
		"modelName\nabc\nabcba\nzazaza",
	function(err) {
		console.log( err );
		storage.close( ioc );
	} );
}
/*	storage.read( ioc, function(err,data) {
		console.log( err );
		console.log( data );
		console.log( data.buf.toString() );
	} );*/
if (1) {
	ioc.s3.selectObjectContent( {
		Bucket: "resource",
		Key: "model/name.csv",
		ExpressionType: "SQL",
		Expression: "SELECT modelName from S3Object where Name like '%ab%'",
		InputSerialization: {
			CSV: {
				FileHeaderInfo: "USE",
				RecordDelimiter: "\n",
				FieldDelimiter: ","
			}
		},
		OutputSerialization: {
			CSV: {}
		}
	}, function(err,data) {
		console.log( err );
//		console.log( data );

		if ( !err ) {
			data.Payload.on( 'data',
			function(event) {
				if ( event.Records )
				console.log
			( event.Records.Payload.toString() );
			});
		}

	} );
	return;
}
	

if (false ) {
	storage.read( ioc, function(err,data) {
console.log(err);
console.log( data );
	}, { s: "modelName", sval: "ab", cond: "contain", column: "modelName" } );
//	ioc.s3.listBuckets({},function(err,data) {
//		console.log( err );
//		console.log( JSON.stringify(data,null,3) );
//	} );
}
storage.url( ioc, function(err,url) {
	console.log( err );
	console.log( url );
}, 10 );
if ( 0 ) {
	ioc.s3.listObjects({ Bucket: "bucket" },function(err,data) {
		console.log( err );
		console.log( JSON.stringify(data,null,3) );
	} );
}
if ( 0 ) {
	ioc.s3.putBucketAcl(
	{	Bucket: "bucket",
		GrantFullControl: "id="
, GrantWrite: "uri=http://acs.amazonaws.com/groups/s3/LogDelivery"
	}, function(err,data) {
		console.log( err );
		console.log( data );
	} );
}
}
