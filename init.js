var config = require(process.env.HISTOGRAPH_CONFIG);
var neo4j = require('neo4j');
var graphDb = new neo4j.GraphDatabase('http://' + config.core.neo4j.host + ':' + config.core.neo4j.port);
var fs = require('fs');
var path = require('path');
var bcrypt = require('bcrypt');
var async = require('async');
var admin = config.api.admin;

// Query to delete owners:
//  MATCH (owner:Owner) DELETE owner
//
// Query to delete sources:
//  MATCH (source:Source) DELETE source

if (admin.password = null) {
  console.error('No admin password set in Histograph configuration');
  process.exit(1);
  // TODO: throw error!
  // please set admin username and password in Histograph configuration
}

var sources = [
  {
    id: 'tgn',
    name: 'Getty Thesaurus of Geographic Names',
    website: 'http://www.getty.edu/research/tools/vocabularies/tgn/'
  }
];

var queries = [
  {
    query: 'CREATE CONSTRAINT ON (owner:Owner) ASSERT owner.name IS UNIQUE'
  },
  {
    query: 'CREATE CONSTRAINT ON (source:Source) ASSERT source.id IS UNIQUE'
  },
  {
    query: 'MERGE (admin:Owner { name:{name} }) ON CREATE SET admin.password = {password} RETURN admin',
    params: {
      name: admin.name,
      password: bcrypt.hashSync(admin.password, 8),
    }
  }
];


fs.readdir(config.data.dir, function(err, directories) {
  async.eachSeries(directories, function(dir, callback) {
    if (dir != '.') {
      fs.stat(config.data.dir + '/' + dir, function(err, stat) {
        if (stat.isDirectory()) {
          var id = dir;

          queries.push({
            query: 'MERGE (source:Source { id:{id} }) ON CREATE SET source.name = {name}',
            params: {
              id: id,
              name: id
            }
          });

          queries.push({
            query: 'MATCH (s:Source {id: {id}}), (o:Owner {name: {name}}) MERGE (o)-[r:OWNS]->(s)',
            params: {
              id: id,
              name: admin.name
            }
          });

        }
        callback();
      });
    } else {
      callback();
    }
  },
  function() {
    async.eachSeries(queries, function(query, callback) {
      graphDb.cypher(query, function (err, results) {
        if (err) throw err;
        console.log(JSON.stringify(results, null, 4));
        callback();
      });
    });
  })
});
