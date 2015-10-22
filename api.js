var util = require('util');
var url = require('url');
var request = require('request');
var config = require('histograph-config');

function apiUrl(path) {
  var urlObj = url.parse(config.api.baseUrl);
  urlObj.auth = config.api.admin.name + ':' + config.api.admin.password;
  urlObj.pathname = path;
  return url.format(urlObj);
}

function createDataset(dataset, callback) {
  request(apiUrl('datasets'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(dataset)
  }, callback);
}

function deleteDataset(datasetId, callback) {
  request(apiUrl('datasets/' + datasetId), {
    method: 'DELETE'
  }, callback);
}

function uploadData(datasetId, type, readStream, size, force, callback) {
  request.put(apiUrl('datasets/' + datasetId + '/' + type), {
    formData: {
      file: {
        value: readStream,
        options: {
          filename: util.format('%s.%s.ndjson', datasetId, type),
          contentType: 'application/x-ndjson',
          knownLength: size
        }
      }
    },
    headers: {
      'content-type': 'application/x-ndjson',
      'x-histograph-force': force
    }
  }, callback);
}

module.exports.createDataset = createDataset;
module.exports.deleteDataset = deleteDataset;
module.exports.uploadData = uploadData;
