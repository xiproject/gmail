var restify = require('restify');
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var config = require('./auth.json');
var fs = require('fs');
var spawn = require('child_process').spawn;
var CLIENT_ID = config.installed.client_id;
var CLIENT_SECRET = config.installed.client_secret;
var port = 3645;
var REDIRECT_URL = "http://localhost:" + port +"/callback";
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

    var server = restify.createServer({
        name: 'google-auth-callback',
    });
    server.use(restify.queryParser());

    server.get('/callback', function(req, res, next){
        config.auth_code = req.query.code;
        fs.writeFile('./auth.json', JSON.stringify(config));
        startWatching();
        res.send("Authenticated :)");
        next();
    });
    server.listen(port);
    var url = oauth2Client.generateAuthUrl({
        //access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
        scope: scopes // If you only need one scope you can pass it as string
    });

    var command;
    if(process.platform === 'linux'){
        command = 'xdg-open';
    }
    if(process.platform === 'darwin'){
        commmand = 'open';
    }

    if(command){
        spawn(command, [url]);
    }
    else{
        console.log("Generate access token from this url \n", url);
    }
}
else{
    startWatching();
}

var tokens;

function startWatching(){
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
            fs.writeFile('./tokens.json', JSON.stringify(tokens));


        });
    }
    oauth2Client.setCredentials(tokens);
    setInterval(checkMail, 10000);
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
