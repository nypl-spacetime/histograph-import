var path = require('path')
var AWS = require('aws-sdk')
var _ = require('highland')
var config = require('spacetime-config')

AWS.config.update({
  region: config.import.s3.region,
  accessKeyId: config.import.s3.accessKeyId,
  secretAccessKey: config.import.s3.secretAccessKey
})

var buckets = config.import.s3.buckets || []

var s3 = new AWS.S3()

var listObjects = _.wrapCallback(function (bucket, callback) {
  s3.listObjects({
    Bucket: bucket,
    Delimiter: '/'
  }, callback)
})

var dataset = function (s3Objects) {
  return s3Objects.CommonPrefixes.map(function (prefix) {
    return {
      type: 's3',
      bucket: s3Objects.Name,
      id: prefix.Prefix.replace('/', '')
    }
  })
}

// ==================================== API ====================================

module.exports.title = 'Amazon S3'

module.exports.format = function (d) {
  return d.bucket
}

module.exports.path = function (d) {
  return [d.bucket, d.id].join('/')
}

// Returns a Highland stream of datasets per bucket
module.exports.list = function () {
  return _(buckets)
    .map(listObjects)
    .series()
    .map(dataset)
}

module.exports.size = function (d, file, callback) {
  s3.listObjects({
    Bucket: d.bucket,
    Prefix: path.join(d.id, file)
  }, function (err, data) {
    if (err) {
      callback(err)
    } else {
      if (data.Contents && data.Contents.length) {
        callback(null, data.Contents[0].Size)
      } else {
        callback()
      }
    }
  })
}

module.exports.readFile = function (d, file, callback) {
  return s3.getObject({
    Bucket: d.bucket,
    Key: path.join(d.id, file)
  }, function (err, data) {
    if (err) {
      callback(err)
    } else {
      callback(err, data.Body ? data.Body.toString('utf8') : '')
    }
  })
}

module.exports.createReadStream = function (d, file) {
  return s3.getObject({
    Bucket: d.bucket,
    Key: path.join(d.id, file)
  }).createReadStream()
}
