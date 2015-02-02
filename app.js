var config = require('./config');

// Dependency setup
var express = require('express'),
    google = require('googleapis'),
    date = require('datejs'),
    twilio = require('twilio');

// Initialization
var app = express(),
    calendar = google.calendar('v3'),
    oAuthClient = new google.auth.OAuth2(config.googleConfig.clientID, config.googleConfig.clientSecret, config.googleConfig.redirectURL),
    authed = false;


// Schedule setup
var jobSchedule = require('./job-schedule.js'),
    smsJob = require('./jobs/send-sms.js');
    callJob = require('./jobs/start-call.js');

// Event object
var calendarEvent = function(id, description, location, startTime) {
  this._id = id;
  this._eventName = description;
  this._number = location;
  this._eventTime = Date.parse(startTime);
  this._smsTime = Date.parse(startTime).addMinutes(-5)
};

app.post('/conference', function(req, res){

  var resp = new twilio.TwimlResponse();
  resp.say('Your conference call is starting.',
    {
        voice:'alice',
        language:'en-gb'
    }).dial(function(node) {
      node.conference('waitingRoom', {
      beep:'true',
      endConferenceOnExit: 'true'
    });
  });

  res.writeHead(200, {
      'Content-Type':'text/xml'
  });
  res.end(resp.toString());
});

app.get('/', function(req, res) {
  // If we're not authenticated, fire off the OAuth flow
  if (!authed) {
    // Generate an OAuth URL and redirect there
    var url = oAuthClient.generateAuthUrl({
      access_type: 'offline',
      scope: 'https://www.googleapis.com/auth/calendar.readonly'
    });
    res.redirect(url);
  } else {
    // Set obj variables
    var id, eventName, number, start;
    // Format today's date
    var today = Date.today().toString('yyyy-MM-dd') + 'T';

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
          // populate calendarEvent object with the event info
          event = new calendarEvent(events.items[i].id, events.items[i].summary, events.items[i].location, events.items[i].start.dateTime);

          // Filter results by ones with telephone numbers in them
          if (event._number.match(/\+[0-9 ]+/)) {

            // SMS Job
            smsJob.send(jobSchedule.agenda, event, 'sms#1', event._number);
            smsJob.send(jobSchedule.agenda, event, 'sms#2', config.ownNumber);

            // Call Job
            callJob.call(jobSchedule.agenda, event, "call#1", event._number);
            callJob.call(jobSchedule.agenda, event, "call#2", config.ownNumber);


            // Start the tasks
            jobSchedule.agenda.start();
          }
        }
        res.send(events);
      }
    });
  }
});

// Return point for oAuth flow
app.get('/auth', function(req, res) {

  var code = req.param('code');

  if (code) {
    // Get an access token based on our OAuth code
    oAuthClient.getToken(code, function(err, tokens) {

      if (err) {
        console.log('Error authenticating')
        console.log(err);
      } else {
        console.log('Successfully authenticated');
        console.log(tokens);

        // Store our credentials and redirect back to our main page
        oAuthClient.setCredentials(tokens);
        authed = true;
        res.redirect('/');
      }
    });
  }
});

var server = app.listen(config.port, function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Listening at http://%s:%s', host, port);
});