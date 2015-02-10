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

var MongoClient = require('mongodb').MongoClient;


// Schedule setup
var jobSchedule = require('./job-schedule.js'),
    smsJob = require('./jobs/send-sms.js');
    callJob = require('./jobs/start-call.js');

// Event object
var CalendarEvent = function(id, description, location, startTime) {
  this.id = id;
  this.eventName = description;
  this.number = location;
  this.eventTime = Date.parse(startTime);
  this.smsTime = Date.parse(startTime).addMinutes(-5);
};

app.post('/call', function(req, res){

  var number = req.query.number;
  var resp = new twilio.TwimlResponse();
  resp.say('Your call is starting.',
    {
        voice:'alice',
        language:'en-gb'
    }).dial(number);

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
          // populate CalendarEvent object with the event info
          event = new CalendarEvent(events.items[i].id, events.items[i].summary, events.items[i].location, events.items[i].start.dateTime);

          // Filter results by ones with telephone numbers in them
          if (event.number.match(/\+[0-9 ]+/)) {

            // SMS Job
            smsJob.send(jobSchedule.agenda, event, 'sms#1', event.number);
            smsJob.send(jobSchedule.agenda, event, 'sms#2', config.ownNumber);

            // Call Job
            callJob.call(jobSchedule.agenda, event, "call#1", config.ownNumber);


            // Start the tasks
            //jobSchedule.agenda.start();
          }
        }
        res.send(events);
      }
    });
  }
});

function storeToken(token){
  console.log(token)
  // Store our credentials and redirect back to our main page
  var collection = db.collection("tokens");
  var settings = {};
  settings._id = 'token';
  settings.access_token = token.access_token;
  settings.expires_at = new Date(token.expiry_date);
  settings.refresh_token = token.refresh_token;  

  collection.save(settings, { w: 0 });
}

// Return point for oAuth flow
app.get('/auth', function(req, res) {

  var code = req.query.code;

  if (code) {
    var collection = db.collection("tokens");
    var today = Date.today().toString('yyyy-MM-dd');
    collection.findOne({}, function(err, item){
      
      // Check for results
      if(item){
        console.log('found')
        // if current time < what's saved
        console.log(Date.today().setTimeToNow())
        console.log(item.expires_at)
        if(Date.compare(Date.today().setTimeToNow(), Date.parse(item.expires_at)) == -1){
          console.log('using existing keys');
          oAuthClient.setCredentials({
            access_token: item.access_token,
            refresh_token: item.refresh_token
          });
        }
        else{
          console.log('getting new keys');
          // Get an access token based on our OAuth code
          oAuthClient.getToken(code, function(err, tokens) {
            if (err) {
              console.log('Error authenticating');
              console.log(err);
            } else {
              console.log('Successfully authenticated');
              // if we already have a refresh token
              if(tokens.refresh_token == undefined)
                tokens.refresh_token = item.refresh_token;

              // Save that new token
              storeToken(tokens);

              oAuthClient.setCredentials({
                access_token: tokens.access_token,
                refresh_token: item.refresh_token
              });
            }
          });
        }
      }

      else{
        console.log('not-found')
        oAuthClient.getToken(code, function(err, tokens) {
          if (err) {
            console.log('Error authenticating');
            console.log(err);
          } else {
            console.log('Successfully authenticated!');

            // Save that token
            storeToken(tokens);

            oAuthClient.setCredentials({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token
            });
          }
        });
      } 
    });

      //oAuthClient.setCredentials(tokens);
      authed = true;
      res.redirect('/');
    }
});

var server = app.listen(config.port, function() {
  var host = server.address().address;
  var port = server.address().port;

  // initialize connection once
  MongoClient.connect('mongodb://' + config.mongoConfig.ip + ':' + config.mongoConfig.port + '/' + config.mongoConfig.name, function(err, database){
    if(err) throw err;
    db = database;
  });

  console.log('Listening at http://%s:%s', host, port);
});