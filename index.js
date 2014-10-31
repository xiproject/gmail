var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var config = require('./auth.json');
var fs = require('fs');

var CLIENT_ID = config.installed.client_id;
var CLIENT_SECRET = config.installed.client_secret;
var REDIRECT_URL = "http://localhost";
var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
google.options({ auth: oauth2Client });


var gmail = google.gmail('v1');

var messageHash = {};
var unseenMessages = [];
var scopes = [
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.readonly"
];

if(!config.auth_code){
    var url = oauth2Client.generateAuthUrl({
        //access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
        scope: scopes // If you only need one scope you can pass it as string
    });

    console.log("Generate access token from this url ", url);
    console.log("Put it in config.json with key auth_code");
    process.exit();
}


var tokens;
if (fs.existsSync('./tokens.json')) {
    tokens = require('./tokens.json');
}
else{
    console.log("Using authcode", config.auth_code);
    oauth2Client.getToken(config.auth_code, function(err, tks) {
        // Now tokens contains an access_token and an optional refresh_token. Save them.
        if(err) {
            console.log(err);
            return;
        }
        tokens =tks;
        console.log(tokens);
        fs.writeFile('./tokens.json', tokens);
        oauth2Client.setCredentials(tokens);
        setInterval(checkMail, 10000);
    });
}


function checkMail(){
    gmail.users.messages.list({userId: "me", labelIds: ["UNREAD","INBOX"]}, function(err, response){
        console.log("Retrieved list");
        if(err){
            console.log(err);
            return;
        }
        console.log(response);
        var messages = response.messages;
        var unseen = false;
        for(var i = 0; i< messages.length; i++){
            if(!messageHash.hasOwnProperty(messages[i].id)){
                unseen = true;
                unseenMessages.push(messages[i]);
                messageHash[messages[i].id]= messages[i];
            }
        }
        if(unseen){
            console.log("You have new messages");
        }
    });
}
