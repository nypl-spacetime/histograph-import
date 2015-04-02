var fs = require('fs');
var config = require(process.env.HISTOGRAPH_CONFIG);
var path = require('path');
var request = require('request');
var async = require('async');
var files = [
  'pits',
  'relations'
];
var clear = process.argv[2] === '--clear';
var args = process.argv.slice(clear ? 3 : 2);

require('colors');

fs.readdir(config.data.dir, function(err, directories) {
  async.eachSeries(files, function(file, callback) {
    async.eachSeries(directories, function(dir, callback) {
      if (dir != '.') {
        fs.stat(config.data.dir + '/' + dir, function(err, stat) {
          if (stat.isDirectory()) {
            var source = dir;
            if (args.length === 0 || args.indexOf(source) > -1) {
              var filePath = config.data.dir + '/' + dir + '/' + dir + '.' + file + '.ndjson';
              var base = path.basename(filePath);
              var response = function(err, res, body) {
                    if (err) {
                      console.error('Upload failed: '.red + base);
                      console.error('\t' + err.code);
                      callback();
                    }

                    if (body === 'OK') {
                      console.log('Upload successful: '.green + base);
                    } else {
                      var message;
                      try {
                        message = JSON.parse(body);
                      } catch (parseError) {
                        message = {error: body};
                      }

                      console.log('Upload failed: '.red + base);
                      console.log('\t' + message.error);
                      if (message.details) {
                        console.log(JSON.stringify(message.details, null, 2).split('\n').map(function(line) {
                          return '\t' + line;
                        }).join('\n'));
                      }
                    }

                    callback();
                  };

              fs.exists(filePath, function(exists) {
                if (exists) {
                  var url = 'sources/' + source + '/' + base.replace(source + '.', '');

                  if (clear) {
                    // Send empty file

                    request('http://' + config.io.host + ':' + config.io.port + '/' + url, {
                      method: 'POST',
                      headers: {'content-type': 'text/plain'},
                      body: ''
                    }, response);
                  } else {
                    var formData = {file: fs.createReadStream(filePath)};

                    request.post('http://' + config.io.host + ':' + config.io.port + '/' + url, {
                      formData: formData
                    }, response);
                  }
                } else {
                  console.log('File not found: '.yellow + base);
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
    },

    function() {
      callback();
    });
  });
});
