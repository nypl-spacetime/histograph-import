#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var url = require('url');
var request = require('request');
var async = require('async');
var _ = require('underscore');
var minimist = require('minimist');
var config = require('histograph-config');

var argv = minimist(process.argv.slice(2), {
  boolean: [
    'force',
    'clear'
  ]
});

var datasets = _.uniq(argv._);

var ignoredDirs = [
  'node_modules',
  '.git'
];

require('colors');

console.log('Using ' + config.api.baseUrl);

async.mapSeries(config.import.dirs, function(dataDir, callback) {
  fs.readdir(dataDir, function(err, directories) {
    directories = directories.filter(function(dir) {
      if (dir === '.' || ignoredDirs.indexOf(dir) > -1) {
        return false;
      } else {
        return (datasets.length === 0 || datasets.indexOf(dir) > -1);
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
}, function(err, dirs) {
  var notFound = datasets;
  var dirs = _.flatten(dirs);
  async.eachSeries(dirs, function(dir, callback) {
    if (datasets.length > 0) {
      notFound.splice(notFound.indexOf(dir.id), 1);
    }
    importDatasetFromDir(dir, function() {
      callback();
    });
  }, function() {
    if (notFound.length > 0) {
      console.error('Dataset(s) not found in dirs `config.import.dirs`: '.red + notFound.join(', '));
    }
  });
});

function importDatasetFromDir(dataset, callback) {
  if (argv.clear) {
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
          headers: {
            'content-type': 'application/x-ndjson',
            'x-histograph-force': argv.force
          }
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
