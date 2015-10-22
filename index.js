#!/usr/bin/env node

var util = require('util');
var chalk = require('chalk');
var H = require('highland');
var minimist = require('minimist');
var config = require('histograph-config');

var api = require('./api');

var storage = {
  fs: require('./lib/fs.js'),
  s3: require('./lib/s3.js')
};

var colors = {
  fs: 'blue',
  s3: 'yellow'
};

var getFilename = function(dataset, type) {
  var ext;
  if (type === 'dataset') {
    ext = 'json';
  } else {
    // pits, relations
    ext = 'ndjson';
  }

  return util.format('%s.%s.%s', dataset, type, ext);
};

var formatDataset = function(d) {
  return util.format('%s %s', d.id, chalk[colors[d.type]](storage[d.type].path(d)));
};

var formatError = function(err, body) {
  var message;
  var details;
  var indent = '    ';

  if (err) {
    message = {message: err.message};
  } else {
    try {
      message = JSON.parse(body);
    } catch (parseError) {
      message = {message: body};
    }
  }

  if (message.details) {
    details = JSON.stringify(message, null, 2).split('\n').map(function(line) {
      return indent + line;
    }).join('\n');
  }

  return chalk.gray(details || indent + message.message);
};

var readDatasetFile = H.wrapCallback(function(d, callback) {
  // Read dataset.json file from storage
  return storage[d.type].readFile(d, getFilename(d.id, 'dataset'), function(err, data) {
    if (!err) {
      // Return input object (d), and add contents from dataset file
      d.dataset = JSON.parse(data);
      callback(null, d);
    } else {
      console.log(chalk.red('Directory contains no dataset files:') + ' ' + formatDataset(d));
      callback();
    }
  });
});

var createDataset = function(d, callback) {
  api.createDataset(d.dataset, function(err, res, body) {
    if (res && (res.statusCode === 201 || res.statusCode === 409)) {
      var message;
      if (res.statusCode === 201) {
        message = 'Created dataset:';
      } else {
        message = 'Found dataset:';
      }

      console.log(util.format('%s %s', chalk.green(message), formatDataset(d)));
      callback(null, d);
    } else {
      console.log(chalk.red('Creating dataset failed: ') + formatDataset(d));
      console.log(formatError(err, body));
      callback();
    }
  });
};

var deleteDataset = function(d, callback) {
  api.deleteDataset(d.dataset.id, function(err, res, body) {
    if (res && res.statusCode === 200) {
      console.log(chalk.green('Deleted dataset: ') + formatDataset(d));
      callback(null, d);
    } else if (res && res.statusCode === 404) {
      console.log(chalk.red('Dataset does not exist: ') + formatDataset(d));
      callback();
    } else {
      console.log(chalk.red('Error deleting dataset: ') + formatDataset(d));
      console.log(formatError(err, body));
      callback();
    }
  });
};

var uploadData = function(d, type, callback) {
  var filename = getFilename(d.id, type);
  storage[d.type].size(d, filename, function(err, size) {
    if (size) {
      var force = argv.force;
      var readStream = storage[d.type].createReadStream(d, filename);
      api.uploadData(d.id, type, readStream, size, force, function(err, res, body) {
        if (res && res.statusCode == 200) {
          console.log(chalk.green('  Upload successful: ') + filename);
          callback(null, d);
        } else {
          console.error(chalk.red('  Upload failed: ') + filename);
          console.log(formatError(err, body));
          callback();
        }
      });
    } else {
      console.log('  File not found: ' + filename);
      callback();
    }
  });
};

var argv = minimist(process.argv.slice(2), {
  boolean: [
    'all',
    'force',
    'delete'
  ]
});

require('colors');

var datasets = H([
  storage.fs.list(),
  storage.s3.list()
]).flatten();

var count = 0;
if (argv._.length === 0 && !argv.all) {
  datasets
    .group('type')
    .map(H.pairs)
    .flatten()
    .each(function(d) {
      count += 1;
      if (d.id) {
        console.log(util.format(' - %s', formatDataset(d)));
      } else {
        console.log(chalk.underline(util.format('%s:', storage[d].title)));
      }
    })
    .done(function() {
      if (!count) {
        console.log(chalk.red('No directories or S3 buckets found in Histograph configuration file...'));
      }

      console.log('\nUsage: histograph-import [--config /path/to/config.yml] [--delete] [--all] [--force] [[path/]dataset ...]');
    });
} else {
  var legend = Object.keys(colors).map(function(type) {
    var color = colors[type];
    return chalk[color](storage[type].title);
  }).join(', ');

  console.log(util.format('Using %s - colors: %s\n', chalk.underline(config.api.baseUrl), legend));

  // Keep list of dataset IDs
  var matchedDatasetIds = [];

  // Keep list of matched dataset arguments
  var matchedArgs = [];
  var duuuble = [];

  datasets
    .filter(function(d) {
      if (argv.all) {
        return true;
      } else {
        if (argv._.indexOf(d.id) > -1) {
          matchedArgs.push(d.id);
          return true;
        } else if (argv._.indexOf(storage[d.type].path(d)) > -1) {
          matchedArgs.push(storage[d.type].path(d));
          return true;
        } else {
          return false;
        }
      }
    })
    .filter(function(d) {
      // If dataset is encountered more than once (e.g. once on fs, once on S3)
      //   only import this dataset once
      if (matchedDatasetIds.indexOf(d.id) > -1) {
        duuuble.push(d);
        return false;
      }

      matchedDatasetIds.push(d.id);
      return true;
    })
    .map(readDatasetFile)
    .series()
    .compact()
    .map(H.curry(argv.delete ? deleteDataset : createDataset))
    .flatten()
    .nfcall([])
    .series()
    .compact()
    .map(function(d) {
      if (!argv.delete) {
        return H([
          H.curry(uploadData, d, 'pits'),
          H.curry(uploadData, d, 'relations')
        ]);
      } else {
        return H([]);
      }
    })
    .flatten()
    .nfcall([])
    .series()
    .compact()
    .each(function() {
      count += 1;
    })
    .done(function() {
      if (count) {
        console.log('');

        var uniqArgs = [];
        matchedArgs.forEach(function(arg) {
          if (uniqArgs.indexOf(arg) === -1) {
            uniqArgs.push(arg);
          }
        });

        var doubleDatasetIds = duuuble.map(function(d) {
          return storage[d.type].path(d);
        });

        var unmatchedArgs = argv._.filter(function(arg) {
          return uniqArgs.indexOf(arg) === -1;
        }).filter(function(arg) {
          return doubleDatasetIds.indexOf(arg) === -1;
        });

        if (duuuble.length) {
          console.log(chalk.red('The following arguments matched a dataset more then once, and were not imported: '));
          duuuble.forEach(function(d) {
            console.log(chalk.red(' - ') + formatDataset(d));
          });
        }

        if (unmatchedArgs.length) {
          console.log(chalk.red('The following arguments did not match any dataset: ') + unmatchedArgs.join(', '));
        } else {
          console.log('Done...');
        }
      }
    });
}
