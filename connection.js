var config = require('./config');
var MongoClient = require('mongodb').MongoClient;

var dbSingleton = null;

var getConnection = function getConnection(callback) {
  if (dbSingleton) {
    callback(null, dbSingleton);
  } else {
    var connURL = 'mongodb://' + config.mongoConfig.ip + ':' + config.mongoConfig.port + '/' + config.mongoConfig.name;
    MongoClient.connect(connURL, function(err, db) {

      if (err)
        console.log("Error creating new connection " + err);
      else {
        dbSingleton = db;
        console.log("created new connection");

      }
      callback(err, dbSingleton);
      return;
    });
  }
}

module.exports = getConnection;