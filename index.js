var fs = require('fs'),
    config = require('./config.json'),
    path = require('path'),
    request = require('request'),
    async = require('async'),
    colors = require('colors'),
    files = [
      'pits',
      'relations'
    ];

fs.readdir(config.data, function(err, directories){
  async.eachSeries(files, function(file, callback) {
    async.eachSeries(directories, function(dir, callback) {
      if (dir != '.') {
        fs.stat(config.data + "/" + dir, function (err, stat) {
          if (stat.isDirectory()) {
            var layer = dir;

              var filePath = config.data + "/" + dir + '/' + dir + '.' + file + '.ndjson',
                  base = path.basename(filePath);

              fs.exists(filePath, function (exists) {
                if (exists) {
                  var url = 'layers/' + layer + "/" + base.replace(layer + ".", "");
                      formData = {file: fs.createReadStream(filePath)};

                  request.post(config.io + url, {formData: formData}, function optionalCallback(err, res, body) {
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
        });
      } else {
        callback();
      }
    }, function(err) {
      callback();
    });
  });
});
