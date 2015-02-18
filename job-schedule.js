var Agenda = require("Agenda");
var config = require('./config');
agenda = new Agenda({
  db: {
    address: config.mongoConfig.ip + ':' + config.mongoConfig.port + '/' + config.mongoConfig.name
  }
});
exports.agenda = agenda;