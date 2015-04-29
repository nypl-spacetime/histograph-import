var fs = require('fs');
var config = require(process.env.HISTOGRAPH_CONFIG);
var path = require('path');
var _ = require('underscore');
var request = require('request');
var async = require('async');

var clear = process.argv[2] === '--clear';
var args = process.argv.slice(clear ? 3 : 2);

require('colors');

async.mapSeries(config.data.dirs, function(dataDir, callback) {
  fs.readdir(dataDir, function(err, directories) {
    var directories = directories.filter(function(dir) {
      if (dir === '.') {
        return false;
      } else {
        return (args.length === 0 || args.indexOf(dir) > -1)
      }
    }).map(function(dir) {
      return {
        id: dir,
        dir: path.join(dataDir, dir)
      };
    }).filter(function(source) {
      var stat = fs.statSync(source.dir)
      return stat.isDirectory();
    });
    callback(null, directories);
  });
}, function(err, sources) {
  async.eachSeries(_.flatten(sources), function(source, callback) {
    importSourceFromDir(source, function() {
      callback();
    });
  });
});

function importSourceFromDir(source, callback) {
  if (clear) {
    deleteSource(source.id, function(err) {
      if (err) {
        console.error('Deleting source failed: '.red + err);
      } else {
        console.error('Deleted source: '.green + source.id);
      }
      callback();
    });
  } else {
    createSource(source, function(err) {
      if (err) {
        console.error(('Creating source ' + source.id + ' failed: ').red + JSON.stringify(err));
        callback();
      } else {
        console.error('Created or found source: '.green + source.id);
        uploadData(source, function() {
          callback();
        });
      }
    });
  }
}

function createSource(source, callback) {
  var filename = path.join(source.dir, source.id + '.source.json');
  // TODO: check if file exists!

  if (fs.existsSync(filename)) {
    request(apiUrl('sources'), {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: fs.readFileSync(filename, 'utf8')
    }, function(err, res, body) {
      if (err) {
        callback(err.message);
      } else if (res.statusCode === 200 || res.statusCode === 409) {
        callback();
      } else {
        callback(JSON.parse(res.body).message);
      }
    });
  } else {
    callback('source meta data not found');
  }
}


function deleteSource(sourceId, callback) {
  request(apiUrl('sources/' + sourceId), {
    method: 'DELETE'
  }, function(err, res, body) {
    if (err) {
      callback(err.message);
    } else if (res.statusCode === 200) {
      callback();
    } else {
      callback(JSON.parse(res.body).message);
    }
  });
}

function apiUrl(url) {
  return 'http://' +
    config.api.admin.name + ':' + config.api.admin.password + '@' +
    config.api.host + ':' + config.api.internalPort + '/' + url;
}

function uploadData(source, callback) {
  var files = [
    'pits',
    'relations'
  ];

  async.eachSeries(files, function(file, callback) {
    var filename = path.join(source.dir, source.id + '.' + file + '.ndjson');
    var base = path.basename(filename);

    fs.exists(filename, function(exists) {
      if (exists) {
        var formData = {file: fs.createReadStream(filename)};

        request.put(apiUrl('sources/' + source.id + '/' + file), {
          formData: formData,
          headers: {'content-type': 'application/x-ndjson'}
        }, function(err, res, body) {
          if (err) {
            console.error('Upload failed: '.red + base);
            console.error('\t' + err.code);
          } else if (res.statusCode == 200) {
            console.log('Upload successful: '.green + base);
          } else {
            var message;
            try {
              message = JSON.parse(body);
            } catch (parseError) {
              message = {message: body};
            }
            console.log('Upload failed: '.red + base);

            if (message.details) {
              console.log(JSON.stringify(message, null, 2).split('\n').map(function(line) {
                return '\t' + line;
              }).join('\n'));
            }
          }
          callback();
        });
      } else {
        console.log('File not found: '.yellow + base);
        callback();
      }
    });

  }, function(err) {
    callback();
  });
}
