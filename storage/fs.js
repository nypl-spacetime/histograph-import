var fs = require('fs');
var path = require('path');
var H = require('highland');
var config = require('histograph-config');

var dirs = config.import.dirs || [];

var ignoredDirs = [
  'node_modules',
  '.git'
];

// Reads all files for a single dir, and returns dataset description
var readDir = H.wrapCallback(function(dir, callback) {
  return fs.readdir(dir, function(err, files) {
    var dirs = [];
    if (!err) {
      dirs = files || [];
    }

    callback(err, dirs.map(function(file) {
      return {
        type: 'fs',
        dir: dir,
        id: file
      };
    }));
  });
});

var isDirectory = function(d) {
  if (d.id === '.' || ignoredDirs.indexOf(d.id) > -1) {
    return false;
  }

  var stat = fs.statSync(path.join(d.dir, d.id));
  return stat.isDirectory();
};

// ==================================== API ====================================

module.exports.title = 'File system';

module.exports.format = function(d) {
  return path.join(d.dir, d.id);
};

module.exports.path = function(d) {
  return path.join(d.dir, d.id);
};

// Returns a Highland stream of datasets per bucket
module.exports.list = function() {
  return H(dirs)
    .map(readDir)
    .series()
    .flatten()
    .filter(isDirectory);
};

module.exports.size = function(d, file, callback) {
  fs.stat(path.join(d.dir, d.id, file), function(err, stats) {
    if (err) {
      callback(err);
    } else {
      callback(null, stats.size);
    }
  });
};

module.exports.readFile = function(d, file, callback) {
  return fs.readFile(path.join(d.dir, d.id, file), {
    encoding: 'utf8'
  }, callback);
};

module.exports.createReadStream = function(d, file) {
  return fs.createReadStream(path.join(d.dir, d.id, file), {
    encoding: 'utf8'
  });
};
