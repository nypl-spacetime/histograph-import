#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var url = require('url');
var request = require('request');
var async = require('async');
var _ = require('underscore');
var config = require('histograph-config');

var clear = process.argv[2] === '--clear';
var args = process.argv.slice(clear ? 3 : 2);

var ignoredDirs = [
  'node_modules',
  '.git'
];

require('colors');

async.mapSeries(config.import.dirs, function(dataDir, callback) {
  fs.readdir(dataDir, function(err, directories) {
    directories = directories.filter(function(dir) {
      if (dir === '.' || ignoredDirs.indexOf(dir) > -1) {
        return false;
      } else {
        return (args.length === 0 || args.indexOf(dir) > -1);
      }
    }).map(function(dir) {
      return {
        id: dir,
        dir: path.join(dataDir, dir)
      };
    }).filter(function(dataset) {
      var stat = fs.statSync(dataset.dir);
      return stat.isDirectory();
    });
    callback(null, directories);
  });
}, function(err, datasets) {
  async.eachSeries(_.flatten(datasets), function(dataset, callback) {
    importDatasetFromDir(dataset, function() {
      callback();
    });
  });
});

function importDatasetFromDir(dataset, callback) {
  if (clear) {
    deleteDataset(dataset.id, function(err) {
      if (err) {
        console.error('Deleting dataset failed: '.red + err);
      } else {
        console.error('Deleted dataset: '.green + dataset.id);
      }
      callback();
    });
  } else {
    createDataset(dataset, function(err) {
      if (err) {
        console.error(('Creating dataset ' + dataset.id + ' failed: ').red + JSON.stringify(err));
        callback();
      } else {
        console.error('Created or found dataset: '.green + dataset.id);
        uploadData(dataset, function() {
          callback();
        });
      }
    });
  }
}

function createDataset(dataset, callback) {
  var filename = path.join(dataset.dir, dataset.id + '.dataset.json');
  // TODO: check if file exists!

  if (fs.existsSync(filename)) {
    request(apiUrl('datasets'), {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: fs.readFileSync(filename, 'utf8')
    }, function(err, res, body) {
      if (err) {
        callback(err.message);
      } else if (res.statusCode === 201 || res.statusCode === 409) {
        callback();
      } else {
        callback(JSON.parse(res.body).message);
      }
    });
  } else {
    callback('dataset JSON file `' + dataset.id + '.dataset.json` not found');
  }
}

function deleteDataset(datasetId, callback) {
  request(apiUrl('datasets/' + datasetId), {
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

function apiUrl(path) {
  var urlObj = url.parse(config.api.baseUrl);
  urlObj.auth = config.api.admin.name + ':' + config.api.admin.password;
  urlObj.pathname = path;
  return url.format(urlObj);
}

function uploadData(dataset, callback) {
  var files = [
    'pits',
    'relations'
  ];

  async.eachSeries(files, function(file, callback) {
    var filename = path.join(dataset.dir, dataset.id + '.' + file + '.ndjson');
    var base = path.basename(filename);

    fs.exists(filename, function(exists) {
      if (exists) {
        var formData = {file: fs.createReadStream(filename)};

        request.put(apiUrl('datasets/' + dataset.id + '/' + file), {
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
            } else {
              console.log(message.message);
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
