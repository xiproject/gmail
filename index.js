var xal = require('../../xal-javascript');
var _s = require('underscore.string');
var restify = require('restify');
var google = require('googleapis');
var os = require('os');
var OAuth2 = google.auth.OAuth2;
var config = require('./auth.json');
var fs = require('fs');
var atob = require('atob');
var spawn = require('child_process').spawn;
var CLIENT_ID = config.installed.client_id;
var CLIENT_SECRET = config.installed.client_secret;
var port = 3645;
var REDIRECT_URL = "http://localhost:" + port + "/callback";
var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
google.options({
    proxy: 'http://10.3.100.207:8080',
    auth: oauth2Client
});


var gmail = google.gmail('v1');

var messageHash = {};
var unseenMessages = [];
var scopes = [
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.readonly"
];


function start() {
    if (!config.auth_code) {

        var server = restify.createServer({
            name: 'google-auth-callback'
        });
        server.use(restify.queryParser());

        server.get('/callback', function(req, res, next) {
            config.auth_code = req.query.code;
            fs.writeFile('./auth.json', JSON.stringify(config));
            startWatching();
            res.send("Authenticated :)");
            next();
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
        startWatching();
    }
}
var tokens;

function startWatching() {
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
    setInterval(checkMail, 10000);
}


function getHeader(msg, header) {
    var headers = msg.payload.headers;
    for (var i = 0; i < headers.length; i++) {
        if (headers[i].name === header) {
            var name = headers[i].value.split(" ");
            name = name.splice(0, name.length - 1).join(" ");
            return name;
        }
    }
    return null;
}

function checkMail() {
    gmail.users.messages.list({
        userId: "me",
        labelIds: ["UNREAD", "INBOX"]
    }, function(err, response) {
        xal.log.debug("Retrieving list");
        if (err) {
            xal.log.info(err);
            return;
        }
        var messages = response.messages;
        var unseen = false;
        //unseenMessages are ordered from oldest to newest
        for (var i = messages.length - 1; i >= 0; i--) {
            if (!messageHash.hasOwnProperty(messages[i].id)) {
                unseen = true;
                unseenMessages.push(messages[i]);
                messageHash[messages[i].id] = messages[i];
            }
        }
        if (unseen) {
            //Retrieves only text mimeType for body
            getMessage(unseenMessages[unseenMessages.length - 1].id, function(err, message) {
                if (err) {
                    xal.error(err);
                    return;
                }
                xal.log.info('You have new messages');
                xal.createEvent('xi.event.output.text', function(state, done) {
                    xal.log.info({
                        state: state
                    }, 'created event');

                    state.put('xi.event.output.text', 'You have new mail from ' + message.name + ' with subject ' + message.subject);
                    done(state);
                });

            });
        }
    });
}

//Retrieves message
//stores it in messageHash and adds name, subject and body to it
function getMessage(messageId, cb) {
    gmail.users.messages.get({
        userId: "me",
        id: messageId
    }, function(err, message) {
        if (err) {
            xal.log.info(err);
            if (cb) {
                cb(err);
            }
            return;
        }

        if (err) {
            xal.error(err);
            return;
        }
        xal.log.info(message);
        var getName = function(msg) {
            return getHeader(msg, "From");
        };

        var getSubject = function(msg) {
            return getHeader(msg, "Subject");
        };

        var getBody = function(response) {
            if (_s.startsWith(response.payload.mimeType, 'multipart')) {
                var parts = response.payload.parts;
                xal.log.info({
                    response: response
                });
                var body = [];
                for (var i = 0; i < parts.length; i++) {
                    if (_s.startsWith(parts[i].mimeType, 'text')) {
                        xal.log.info("part ", i + 1);
                        xal.log.info(atob(parts[i].body.data));
                        body.push(atob(parts[i].body.data));
                    }
                }
                return body;
            } else if (_s.startsWith(response.payload.mimeType, 'text')) {
                return atob(response.payload.body.data);
            } else {
                return null;
            }
        };

        messageHash[message.id].name = getName(message);
        messageHash[message.id].body = getBody(message);
        messageHash[message.id].subject = getSubject(message);
        messageHash[message.id].message = message;
        if (cb) {
            cb(null, messageHash[message.id]);
        }
    });

}


xal.start({
    name: "Gmail"
}, function() {
    start();
});
