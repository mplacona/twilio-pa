var config = require('./config');
var tokenUtils = require('./token-utils');
var getConnection = require('./connection');

// Dependency setup
var express = require('express'),
  google = require('googleapis'),
  date = require('datejs'),
  twilio = require('twilio');

// Initialization
var app = express(),
  calendar = google.calendar('v3');

  oAuthClient = new google.auth.OAuth2(config.googleConfig.clientID, config.googleConfig.clientSecret, config.googleConfig.redirectURL);

// Schedule setup
var jobSchedule = require('./job-schedule.js'),
  smsJob = require('./jobs/send-sms.js'),
  callJob = require('./jobs/start-call.js');

// Event object
var CalendarEvent = function(id, description, location, startTime) {
  this.id = id;
  this.eventName = description;
  this.number = location;
  this.eventTime = Date.parse(startTime);
  this.smsTime = Date.parse(startTime).addMinutes(-5);
};

function fetchAndSchedule() {
  // Set obj variables
  var id, eventName, number, start;

  // Call google to fetch events for today on our calendar
  calendar.events.list({
    calendarId: config.googleConfig.calendarId,
    maxResults: 20,
    timeMax: Date.parse('tomorrow').addSeconds(-1).toISOString(), // any entries until the end of today
    updatedMin: new Date().clearTime().toISOString(), // that have been created today
    auth: oAuthClient
  }, function(err, events) {
    if (err) {
      console.log('Error fetching events');
      console.log(err);
    } else {
      // Send our JSON response back to the browser
      console.log('Successfully fetched events');

      for (var i = 0; i < events.items.length; i++) {
        // populate CalendarEvent object with the event info
        event = new CalendarEvent(events.items[i].id, events.items[i].summary, events.items[i].location, events.items[i].start.dateTime);

        // Filter results 
        // ones with telephone numbers in them 
        // that are happening in the future (current time < event time)
        if (event.number.match(/\+[0-9 ]+/) && (Date.compare(Date.today().setTimeToNow(), Date.parse(event.eventTime)) == -1)) {

          // SMS Job
          smsJob.send(jobSchedule.agenda, event, 'sms#1', config.ownNumber);

          // Call Job
          callJob.call(jobSchedule.agenda, event, "call#1", config.ownNumber);
        }
      }

    }
  });
}

app.post('/call', function(req, res) {

  var number = req.query.number;
  var eventName = req.query.eventName;
  var resp = new twilio.TwimlResponse();
  resp.say('Your meeting ' + eventName + ' is starting.', {
    voice: 'alice',
    language: 'en-gb'
  }).dial(number);

  res.writeHead(200, {
    'Content-Type': 'text/xml'
  });
  res.end(resp.toString());
});

app.get('/', function(req, res) {
  getConnection(function(err, db) {
    var collection = db.collection("tokens");
    collection.findOne({}, function(err, tokens) {
      // Check for results
      if (tokens) {
        // If going through here always refresh
        tokenUtils.refreshToken(tokens.refresh_token);
        res.send('authenticated');
      } else {
        tokenUtils.requestToken(res);
      }
    });
  });
});

// Return point for oAuth flow
app.get('/auth', function(req, res) {

  var code = req.query.code;

  if (code) {
    tokenUtils.authenticateWithCode(code)

    res.redirect('/');
  }
});

var server = app.listen(config.port, function() {
  var host = server.address().address;
  var port = server.address().port;

  // make sure user is authenticated
  getConnection(function(err, db) {
    var collection = db.collection("tokens");
    collection.findOne({}, function(err, tokens) {
      if (tokens) {
        tokenUtils.authenticateWithDB(db);
      }
    });
  });

  jobSchedule.agenda.define('fetch events', function(job, done) {
    fetchAndSchedule();
    done();
  });

  jobSchedule.agenda.every('10 minutes', 'fetch events');

  // Initialize the task scheduler
  jobSchedule.agenda.start()

  console.log('Listening at http://%s:%s', host, port);
});