#!/usr/bin/env node

var util = require('util')
var path = require('path')
var H = require('highland')
var chalk = require('chalk')
var minimist = require('minimist')
var config = require('spacetime-config')

var apiClient = require('./api-client')

var storage = {
  fs: require('./storage/fs.js'),
  s3: require('./storage/s3.js')
}

var colors = {
  fs: 'blue',
  s3: 'yellow'
}

var argv = minimist(process.argv.slice(2), {
  boolean: [
    'all',
    'force',
    'delete'
  ]
})

// Utility & wrapper functions

var getFilename = function (dataset, type) {
  var ext
  if (type === 'dataset') {
    ext = 'json'
  } else {
    // pits, relations
    ext = 'ndjson'
  }

  return util.format('%s.%s.%s', dataset, type, ext)
}

var formatDataset = function (d, filename) {
  return util.format('%s %s', filename || d.id, chalk[colors[d.type]](path.join(storage[d.type].path(d), filename || '')))
}

var formatError = function (err, body) {
  var message
  var details
  var indent = '    '

  if (err) {
    message = {message: err.message}
  } else {
    try {
      message = JSON.parse(body)
    } catch (parseError) {
      message = {message: body}
    }
  }

  if (message.details) {
    details = JSON.stringify(message, null, 2).split('\n').map(function (line) {
      return indent + line
    }).join('\n')
  }

  return chalk.gray(details || indent + JSON.stringify(message.message))
}

var readDatasetFile = H.wrapCallback(function (d, callback) {
  // Read dataset.json file from storage
  return storage[d.type].readFile(d, getFilename(d.id, 'dataset'), function (err, data) {
    if (!err) {
      // Return input object (d), and add contents from dataset file
      d.dataset = JSON.parse(data)
      callback(null, d)
    } else {
      console.log(chalk.red('Directory contains no dataset files:') + ' ' + formatDataset(d))
      callback()
    }
  })
})

var createDataset = function (d, callback) {
  apiClient.createDataset(d.dataset, function (err, res, body) {
    if (res && (res.statusCode === 201 || res.statusCode === 409)) {
      var message
      if (res.statusCode === 201) {
        message = 'Created dataset:'
      } else {
        message = 'Found dataset:'
      }

      console.log(util.format('%s %s', chalk.green(message), formatDataset(d)))
      callback(null, d)
    } else {
      console.error(chalk.red('Creating dataset failed: ') + formatDataset(d))
      console.error(formatError(err, body))
      callback(err)
    }
  })
}

var deleteDataset = function (d, callback) {
  apiClient.deleteDataset(d.dataset.id, function (err, res, body) {
    if (res && res.statusCode === 200) {
      console.log(chalk.green('Deleted dataset: ') + formatDataset(d))
      callback(null, d)
    } else if (res && res.statusCode === 404) {
      console.log(chalk.red('Dataset does not exist: ') + formatDataset(d))
      callback()
    } else {
      console.log(chalk.red('Error deleting dataset: ') + formatDataset(d))
      console.log(formatError(err, body))
      callback()
    }
  })
}

var uploadData = function (d, type, callback) {
  var filename = getFilename(d.id, type)
  storage[d.type].size(d, filename, function (err, size) {
    if (err) {
      console.error(err)
      return
    }

    if (size) {
      var force = argv.force
      var readStream = storage[d.type].createReadStream(d, filename)
      apiClient.uploadData(d.id, type, readStream, size, force, function (err, res, body) {
        if (res && res.statusCode === 200) {
          console.log(chalk.green('  Upload successful: ') + formatDataset(d, filename))
          callback(null, d)
        } else {
          console.error(chalk.red('  Upload failed: ') + formatDataset(d, filename))
          console.log(formatError(err, body))
          callback()
        }
      })
    } else {
      console.log(chalk.gray('  File not found: ' + chalk.stripColor(formatDataset(d, filename))))
      callback()
    }
  })
}

// Import logic:
//   - Fetch available datasets
//   - filter, using command line arguments
//   - create/delete datasets in API
//   - (read NDJSON files, PUT to API)

var legend = Object.keys(colors).map(function (type) {
  var color = colors[type]
  return chalk[color](storage[type].title)
}).join(', ')

console.log(util.format('Using %s - colors: %s\n', chalk.underline(config.api.baseUrl), legend))

// Fetch available datasets from file system and S3
var datasets = H([
  storage.fs.list(),
  storage.s3.list()
]).flatten()
  .errors(function (err) {
    console.log(chalk.red('Error reading directory:'))
    console.log('  ' + err.message)
  })

var count = 0
if (argv._.length === 0 && !argv.all) {
  // List datasets - don't import anything
  datasets
    .group('type')
    .map(H.pairs)
    .flatten()
    .each((d) => {
      count += 1
      if (d.id) {
        console.log(util.format(' - %s', formatDataset(d)))
      } else {
        console.log(chalk.underline(util.format('%s:', storage[d].title)))
      }
    })
    .done(function () {
      if (!count) {
        console.log(chalk.red('No directories or S3 buckets found in Space/Time configuration file...'))
      }

      console.log('\nUsage: spacetime-import [--config /path/to/config.yml] [--delete] [--all] [--force] [[path/]dataset ...]')
    })
} else {
  // Import datasets!

  // Keep list of dataset IDs
  var matchedDatasetIds = []

  // Keep list of matched dataset arguments
  var matchedArgs = []
  var matchedMultiple = []

  datasets
    .filter((d) => {
      if (argv.all) {
        return true
      } else {
        if (argv._.indexOf(d.id) > -1) {
          matchedArgs.push(d.id)
          return true
        } else if (argv._.indexOf(storage[d.type].path(d)) > -1) {
          matchedArgs.push(storage[d.type].path(d))
          return true
        } else {
          return false
        }
      }
    })
    .filter((d) => {
      // If dataset is encountered more than once (e.g. once on fs, once on S3)
      //   only import this dataset once
      if (matchedDatasetIds.indexOf(d.id) > -1) {
        matchedMultiple.push(d)
        return false
      }

      matchedDatasetIds.push(d.id)
      return true
    })
    .map(readDatasetFile)
    .series()
    .compact()
    .map(H.curry(argv.delete ? deleteDataset : createDataset))
    .flatten()
    .nfcall([])
    .series()
    .stopOnError((err) => {
      console.error(err.message)
      process.exit(1)
    })
    .compact()
    .map((d) => {
      if (!argv.delete) {
        return H([
          H.curry(uploadData, d, 'pits'),
          H.curry(uploadData, d, 'relations')
        ])
      } else {
        return H([])
      }
    })
    .flatten()
    .nfcall([])
    .series()
    .stopOnError((err) => {
      console.error(err.message)
      process.exit(1)
    })
    .compact()
    .each(() => {
      count += 1
    })
    .done(() => {
      if (count) {
        console.log('')

        var uniqArgs = []
        matchedArgs.forEach((arg) => {
          if (uniqArgs.indexOf(arg) === -1) {
            uniqArgs.push(arg)
          }
        })

        var doubleDatasetIds = matchedMultiple.map((d) => {
          return storage[d.type].path(d)
        })

        var unmatchedArgs = argv._.filter((arg) => {
          return uniqArgs.indexOf(arg) === -1
        }).filter(function (arg) {
          return doubleDatasetIds.indexOf(arg) === -1
        })

        if (matchedMultiple.length) {
          console.log(chalk.red(util.format('The following %s matched a dataset more than once; the first match was imported, the following %s not imported:', matchedMultiple.length === 1 ? 'argument' : 'arguments', matchedMultiple.length === 1 ? 'match was' : 'matches were')))
          console.log(matchedMultiple.map(function (d) {
            return ' - ' + formatDataset(d)
          }).join('\n'))
        }

        if (unmatchedArgs.length) {
          console.log(chalk.red(util.format('The following %s did not match any dataset: ', unmatchedArgs.length === 1 ? 'argument' : 'arguments')))
          console.log(unmatchedArgs.map(function (arg) {
            return ' - ' + arg
          }).join('\n'))
        }
      }
    })
}
