var getConnection = require('./connection');

/* 
  Receives a token object and stores it for the first time. 
  This includes the refresh token
*/
storeToken = function(token) {
    getConnection(function(err, db) {
      // Store our credentials in the database
      var collection = db.collection("tokens");
      var settings = {};
      settings._id = 'token';
      settings.access_token = token.access_token;
      settings.expires_at = new Date(token.expiry_date);
      settings.refresh_token = token.refresh_token;

      collection.save(settings, {
        w: 0
      });
    });
  }
/* 
  Updates an existing token taking care of only updating necessary 
  information. We want to preserve our refresh_token
 */
updateToken = function(token, db) {
  getConnection(function(err, db) {
    var collection = db.collection("tokens");
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
  });
}

/* 
  When authenticating for the first time this will generate 
  a token including the refresh token using the code returned by
  Google's authentication page
*/
authenticateWithCode = function(code, callback, oAuthClient) {
  oAuthClient.getToken(code, function(err, tokens) {
    if (err) {
      console.log('Error authenticating');
      console.log(err);
      return callback(err);
    } else {
      console.log('Successfully authenticated!');
      // Save that token
      storeToken(tokens);

      setCredentials(tokens.access_token, tokens.refresh_token, oAuthClient);
      return callback(null, tokens);
    }
  });
}

/* 
  When authenticating at any other time this will try to 
  authenticate the user with the tokens stored on the DB.
  Failing that (i.e. the token has expired), it will
  refresh that token and store a new one.
*/
authenticateWithDB = function(oAuthClient) {
  getConnection(function(err, db) {
    var collection = db.collection("tokens");
    collection.findOne({}, function(err, tokens) {
      // if current time < what's saved
      if (Date.compare(Date.today().setTimeToNow(), Date.parse(tokens.expires_at)) == -1) {
        console.log('using existing tokens');
        setCredentials(tokens.access_token, tokens.refresh_token, oAuthClient);
      } else {
        // Token is expired, so needs a refresh
        console.log('getting new tokens');
        setCredentials(tokens.access_token, tokens.refresh_token, oAuthClient);
        refreshToken(tokens.refresh_token, oAuthClient);
      }
    });
  });
}

// Refreshes the tokens and gives a new access token
refreshToken = function(refresh_token, oAuthClient) {
  oAuthClient.refreshAccessToken(function(err, tokens) {
    updateToken(tokens);

    setCredentials(tokens.access_token, refresh_token, oAuthClient);
  });
  console.log('access token refreshed');
}

setCredentials = function(access_token, refresh_token, oAuthClient) {
  oAuthClient.setCredentials({
    access_token: access_token,
    refresh_token: refresh_token
  });
}

requestToken = function(res, oAuthClient) {
  // Generate an OAuth URL and redirect there
  var url = oAuthClient.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/calendar.readonly'
  });
  res.redirect(url);
}

module.exports = function(oAuthClient) {
  var module = {};

  module.refreshToken = function(refresh_token) {
    refreshToken(refresh_token, oAuthClient);
  };

  module.requestToken = function(res) {
    requestToken(res, oAuthClient);
  };

  module.authenticateWithCode = function(code, callback) {
    authenticateWithCode(code, function(err, data) {
      if (err) {
        return callback(err)
      }
      callback(null, data);
    }, oAuthClient);
  };

  module.authenticateWithDB = function(callback) {
    authenticateWithDB(oAuthClient, function(err, data) {
      if (err) {
        return callback(err)
      }
      callback(null, data);
    });
  };

  return module;
};