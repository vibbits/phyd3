var http = require("http");
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');

var serve = serveStatic("./dist/");

var server = http.createServer(function(req, res) {
  var done = finalhandler(req, res);
  serve(req, res, done);
});

server.listen(8080);
console.log("Listening on 127.0.0.1:8080...");