var fs = require('fs'),
    config = require(process.env.HISTOGRAPH_CONFIG),
    path = require('path'),
    request = require('request'),
    async = require('async'),
    colors = require('colors'),
    files = [
      'pits',
      'relations'
    ],
    args = process.argv.slice(2);

fs.readdir(config.data.dir, function(err, directories){
  async.eachSeries(files, function(file, callback) {
    async.eachSeries(directories, function(dir, callback) {
      if (dir != '.') {
        fs.stat(config.data.dir + "/" + dir, function (err, stat) {
          if (stat.isDirectory()) {
            var source = dir;
            if (args.length == 0 || args.indexOf(source) > -1) {
              var filePath = config.data.dir + "/" + dir + '/' + dir + '.' + file + '.ndjson',
                  base = path.basename(filePath);

              fs.exists(filePath, function (exists) {
                if (exists) {
                  var url = 'sources/' + source + "/" + base.replace(source + ".", "");
                      formData = {file: fs.createReadStream(filePath)};

                  request.post("http://" + config.io.host + ":" + config.io.port + "/" + url, {formData: formData}, function optionalCallback(err, res, body) {
                    if (err) {
                      console.error('Upload failed: '.red + base);
                      console.error("\t" + err.code);
                      callback();
                    }

                    if (body === "OK") {
                      console.log("Upload successful: ".green + base);
                    } else {
                      var message = JSON.parse(body);
                      console.log("Upload failed: ".red + base);
                      console.log("\t" + message.error);
                      if (message.details) {
                        console.log(JSON.stringify(message.details, undefined, 2).split("\n").map(function(line) {
                          return "\t" + line;
                        }).join("\n"));
                      }
                    }
                    callback();
                  });
                } else {
                  console.log("File not found: ".yellow + base);
                  callback();
                }
              });
            } else {
              callback();
            }
          } else {
            callback();
          }
        });
      } else {
        callback();
      }
    }, function(err) {
      callback();
    });
  });
});
