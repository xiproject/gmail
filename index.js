var xal = require('../../xal-javascript');
var _s = require('underscore.string');
var atob = require('atob');
var gmail = require('./gmail');
var messageHash = {};
var unseenMessages = [];

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
    gmail.getUnreadMessages( function(err, response) {
        xal.log.debug("Retrieving list");
        if (err) {
            xal.log.info(err);
            return;
        }
        if(response.resultSizeEstimate === 0){
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
    gmail.getMessage(messageId, function(err, message) {
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
    gmail.start(function(){
        setInterval(checkMail, 10000);
    });
});
