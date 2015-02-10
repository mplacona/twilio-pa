var config = require('../config');
var twilio = require('twilio');
// Create a new REST API client to make authenticated requests against the
// twilio back end
var client = new twilio.RestClient(config.twilioConfig.accountSid, config.twilioConfig.authToken);

exports.send = function(agenda, event, task, number) {
	agenda.define(task, function(job, done) {
		client.sendSms({
			to: number,
			from: config.twilioConfig.number,
			body: 'Your call is about to start in 5 minutes. Make sure you\'re in a quiet place'
		}, function(error, message) {
			if (!error) {
				console.log('Success! The SID for this SMS message is:');
				console.log(message.sid);
				console.log('Message sent on:');
				console.log(message.dateCreated);
				console.log(message.to);
			} else {
				console.log(error);
				console.log('Oops! There was an error.');
			}
		});
		done();
	});
	agenda.create(task).schedule(event.smsTime).unique({'id': event.id}).save();
}