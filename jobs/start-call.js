var config = require('../config');
var twilio = require('twilio');
// Create a new REST API client to make authenticated requests against the
// twilio back end
var client = new twilio.RestClient(config.twilioConfig.accountSid, config.twilioConfig.authToken);

exports.call = function(agenda, event, task, number) {
  agenda.define(task, function(job, done) {
    // Place a phone call, and respond with TwiML instructions from the given URL
    client.makeCall({

        to: number, // Any number Twilio can call
        from: config.twilioConfig.number, // A number you bought from Twilio and can use for outbound communication
        url: 'http://4dc24449.ngrok.com/conference/?number='+event.number // A URL that produces an XML document (TwiML) which contains instructions for the call

    }, function(err, responseData) {
        if(err){
          console.log(err);
      }else{
          // executed when the call has been initiated.
          console.log(responseData.from);
      }

    });
    done();
  });
  agenda.create(task).schedule(event.eventTime).unique({'id': event.id}).save();
}