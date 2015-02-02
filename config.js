var cfg = {};

// HTTP Port to run our web application
cfg.port = process.env.PORT || 2002;

// My own telephone number for notifications
cfg.ownNumber = '+447590566866'

// Your Twilio account SID and auth token, both found at:
// https://www.twilio.com/user/account
// 
// A good practice is to store these string values as system environment
// variables, and load them from there as we are doing below. Alternately,
// you could hard code these values here as strings.
cfg.twilioConfig = {
	accountSid: process.env.TWILIO_ACCOUNT_SID,
	authToken: process.env.TWILIO_AUTH_TOKEN,
	// A Twilio number you control - choose one from:
	// https://www.twilio.com/user/account/phone-numbers/incoming
	number: process.env.TWILIO_NUMBER
}

// Google OAuth Configuration
cfg.googleConfig = {
	clientID: '818396815844-ug45hf9p004thp69ra4dkveo3fm39b1p.apps.googleusercontent.com',
	clientSecret: 'v0CLCnyw5IA8EPsOPWoI1kL5',
	calendarId: 'hn8me17ad3eg0e8a1qc6bq8s28@group.calendar.google.com',
	redirectURL: 'http://localhost:2002/auth'
};

// MongoDB Settings
cfg.mongoConfig = {
	ip: '127.0.0.1',
	port: 27017,
	name: 'twilio-pa'
}

// Export configuration object
module.exports = cfg;