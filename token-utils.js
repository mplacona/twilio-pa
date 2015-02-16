var getConnection = require('./connection');

/* 
  Receives a token object and stores it for the first time. 
  This includes the refresh token
*/
storeToken = function(token) {
    getConnection(function(err, db) {
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
    });
  }
  /* 
    Updates an existing token taking care of only updating necessary 
    information. We want to preserve our refresh_token
   */
updateToken = function(token, db) {
  getConnection(function(err, db) {
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
  });
}

/* 
  When authenticating for the first time this will generate 
  a token including the refresh token using the code returned by
  Google's authentication page
*/
authenticateWithCode = function(code) {
  oAuthClient.getToken(code, function(err, tokens) {
    if (err) {
      console.log('Error authenticating');
      console.log(err);
    } else {
      console.log('Successfully authenticated!');

      // Save that token
      storeToken(tokens);

      setCredentials(tokens.access_token, tokens.refresh_token);
    }
  });
}

/* 
  When authenticating at any other time this will try to 
  authenticate the user with the tokens stored on the DB.
  Failing that (i.e. the token has expired), it will
  refresh that token and store a new one.
*/
authenticateWithDB = function(tokens) {
  getConnection(function(err, db) {
    var collection = db.collection("tokens");
    collection.findOne({}, function(err, tokens) {
      // if current time < what's saved
      if (Date.compare(Date.today().setTimeToNow(), Date.parse(tokens.expires_at)) == -1) {
        console.log('using existing tokens');
        setCredentials(tokens.access_token, tokens.refresh_token);
      } else {
        // Token is expired, so needs a refresh
        console.log('getting new tokens');
        setCredentials(tokens.access_token, tokens.refresh_token);
        refreshToken(tokens.refresh_token);
      }
    });
  });
}

// Refreshes the tokens and gives a new access token
refreshToken = function(refresh_token) {
  oAuthClient.refreshAccessToken(function(err, tokens) {
    console.log(tokens)
    updateToken(tokens);

    setCredentials(tokens.access_token, refresh_token);
  });
  console.log('access token refreshed');
}

setCredentials = function(access_token, refresh_token) {
  oAuthClient.setCredentials({
    access_token: access_token,
    refresh_token: refresh_token
  });
}

requestToken = function(res) {
  // Generate an OAuth URL and redirect there
  var url = oAuthClient.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/calendar.readonly'
  });
  res.redirect(url);
}



module.exports = {
  refreshToken: refreshToken,

  setCredentials: setCredentials,

  requestToken: requestToken,

  authenticateWithCode: authenticateWithCode,

  authenticateWithDB: authenticateWithDB
}