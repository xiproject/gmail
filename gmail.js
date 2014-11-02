var xal = require('../../xal-javascript');
var restify = require('restify');
var google = require('googleapis');
var os = require('os');
var OAuth2 = google.auth.OAuth2;
var config = require('./auth.json');
var CLIENT_ID = config.installed.client_id;
var CLIENT_SECRET = config.installed.client_secret;
var port = 3645;
var REDIRECT_URL = "http://localhost:" + port + "/callback";
var fs = require('fs');
var spawn = require('child_process').spawn;
var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
google.options({
    proxy: 'http://10.3.100.207:8080',
    auth: oauth2Client
});
var gmail = google.gmail('v1');
var scopes = [
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.readonly"
];

var tokens;
//gets auth_code if auth_code not set
function start(cb) {

    var initializeTokens = function(){
        if (fs.existsSync('./tokens.json')) {
            tokens = require('./tokens.json');
        } else {
            xal.log.info("Using authcode", config.auth_code);
            oauth2Client.getToken(config.auth_code, function(err, tks) {
                // Now tokens contains an access_token and an optional refresh_token. Save them.
                if (err) {
                    xal.log.info(err);
                    return;
                }
                tokens = tks;
                xal.log.info(tokens);
                fs.writeFile('./tokens.json', JSON.stringify(tokens));
            });
        }
        oauth2Client.setCredentials(tokens);
    };
    
    if (!config.auth_code) {

        var server = restify.createServer({
            name: 'google-auth-callback'
        });
        server.use(restify.queryParser());

        server.get('/callback', function(req, res, next) {
            config.auth_code = req.query.code;
            fs.writeFile('./auth.json', JSON.stringify(config));
            cb();
            res.send("Authenticated :)");
            next();
            intializeTokens();
            server.stop();
        });
        server.listen(port);
        var url = oauth2Client.generateAuthUrl({
            //access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
            scope: scopes // If you only need one scope you can pass it as string
        });

        var command;
        if (os.platform() === 'linux') {
            command = 'xdg-open';
        } else if (os.platform() === 'darwin') {
            command = 'open';
        }

        if (command) {
            spawn(command, [url]);
        } else {
            xal.log.info("Generate access token from this url \n", url);
        }
    } else {
        initializeTokens();
        cb();

    }

    
}


function archive(messageID, cb){
    gmail.users.messages.modify({id: messageID, userId: "me", resource: {
        removeLabelIds: ["INBOX"]
    }}, function(err, response){
        if(err){
            cb(err);
            return;
        }
        else{
            if(cb){
                cb(null, response);
            }
        }
    });
}

function getMessage(messageID, cb){
    gmail.users.messages.get({
        userId: "me",
        id: messageID
    }, function(err, response){
        cb(err,response);
    } );
    
}

function getUnreadMessages(cb){
    gmail.users.messages.list({
        userId: "me",
        labelIds: ["UNREAD", "INBOX"] }, function(err, response){
            cb(err,response);
        }   );
}

exports.start = start;
exports.archive = archive;
exports.getMessage = getMessage;
exports.getUnreadMessages = getUnreadMessages;
