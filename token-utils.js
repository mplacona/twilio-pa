function _storeToken(token) {
	console.log(token)
		// Store our credentials and redirect back to our main page
	var collection = db.collection("tokens");
	var settings = {};
	settings._id = 'token';
	settings.access_token = token.access_token;
	settings.expires_at = new Date(token.expiry_date);
	settings.refresh_token = token.refresh_token;

	collection.save(settings, {
		w: 0
	});
}

module.exports = {

	_updateToken: function(token) {
		var collection = db.collection("tokens");
		// attention to $set here
		collection.update({
			_id: 'token'
		}, {
			$set: {
				access_token: token.access_token,
				expires_at: new Date(token.expiry_date)
			}
		}, {
			w: 0
		});
	},

	_refreshToken: function(code, refresh_token) {
		oAuthClient.getToken(code, function(err, tokens) {
			if (err) {
				console.log('Error authenticating');
				console.log(err);
			} else {
				console.log('Successfully authenticated');

				// Save that new token but keep refresh_token
				_updateToken(tokens);

				oAuthClient.setCredentials({
					access_token: tokens.access_token,
					refresh_token: refresh_token
				});
			}
		});
	},

	_requestToken: function(res) {
		// Generate an OAuth URL and redirect there
		var url = oAuthClient.generateAuthUrl({
			access_type: 'offline',
			scope: 'https://www.googleapis.com/auth/calendar.readonly'
		});
		res.redirect(url);
	},

	_authenticate: function(code) {
		var collection = db.collection("tokens");
		var today = Date.today().toString('yyyy-MM-dd');
		collection.findOne({}, function(err, item) {

			// Check for results
			if (item) {
				console.log('found')
					// if current time < what's saved
				console.log(Date.today().setTimeToNow())
				console.log(item.expires_at)
				if (Date.compare(Date.today().setTimeToNow(), Date.parse(item.expires_at)) == -1) {
					console.log('using existing tokens');
					oAuthClient.setCredentials({
						access_token: item.access_token,
						refresh_token: item.refresh_token
					});
				} else {
					console.log('getting new tokens');
					// Get an access token based on our OAuth code
					_refreshToken(code, item.refresh_token);
				}
			} else {
				console.log('not-found')
				oAuthClient.getToken(code, function(err, tokens) {
					if (err) {
						console.log('Error authenticating');
						console.log(err);
					} else {
						console.log('Successfully authenticated!');

						// Save that token
						_storeToken(tokens);

						oAuthClient.setCredentials({
							access_token: tokens.access_token,
							refresh_token: tokens.refresh_token
						});
					}
				});
			}
		});
	}
}