var config = require(process.env.HISTOGRAPH_CONFIG);
var neo4j = require('neo4j');
var graphDb = new neo4j.GraphDatabase('http://' + config.core.neo4j.host + ':' + config.core.neo4j.port);
var fs = require('fs');
var path = require('path');
var bcrypt = require('bcrypt');
var async = require('async');
var admin = config.api.admin;

// Query to delete owners:
//  MATCH (o:Owner) OPTIONAL MATCH (o)-[r]-() DELETE o, r
//
// Query to delete sources:
//  MATCH (source:Source) DELETE source

if (admin.password == null) {
  console.error('No admin password set in Histograph configuration');
  process.exit(1);
  // TODO: throw error!
  // please set admin username and password in Histograph configuration
}

var queries = [
  {
    query: 'CREATE CONSTRAINT ON (owner:Owner) ASSERT owner.name IS UNIQUE'
  },
  {
    query: 'CREATE CONSTRAINT ON (source:Source) ASSERT source.sourceid IS UNIQUE'
  },
  {
    query: 'MERGE (admin:Owner { name:{name} }) ON CREATE SET admin.password = {password} RETURN admin',
    params: {
      name: admin.name,
      password: bcrypt.hashSync(admin.password, 8),
    }
  }
];

async.eachSeries(queries, function(query, callback) {
  graphDb.cypher(query, function (err, results) {
    if (err) throw err;
    console.log(JSON.stringify(results, null, 4));
    callback();
  });
});


