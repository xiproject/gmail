var xal = require('../../xal-javascript');
var _s = require('underscore.string');
var _ = require('underscore');
var atob = require('atob');
var gmail = require('./gmail');
var messageHash = {};
var unseenMessages = [];
var inputManager;
function getHeader(msg, header) {
    var headers = msg.payload.headers;
    for (var i = 0; i < headers.length; i++) {
        if (headers[i].name === header) {

            return headers[i].value;
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
                    xal.log.error(err);
                    return;
                }
                xal.log.info(message);
                if(_.contains(message.labelIds, "CATEGORY_FORUMS")){
                    return;
                }
                xal.log.info('You have new messages');
                xal.createEvent('xi.event.output.text', function(state, done) {
                    xal.log.info({
                        state: state
                    }, 'created event');

                    state.put('xi.event.output.text', 'You have new mail from ' + message.name );
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
            xal.log.error(err);
            return;
        }
        xal.log.info(message);
        var getName = function(msg) {
            var name = getHeader(msg, "From").split(" ");
            name = name.splice(0, name.length - 1).join(" "); 
            return name;
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

//TODO: assuming stuff
xal.on('xi.event.input.destination', function(state, next){
    var dest = _.reduce(state.get('xi.event.input.destination'), function(memo, dest) {
        if (dest.source === inputManager.id) {
            memo = dest;
        }
        return memo;
    }, null);
    if (dest && dest.value == xal.getId()) {
        xal.log.info({dest: dest}, 'Acting on InputManager\'s command');
        var text = state.get('xi.event.input.text')[0].value;
        if(unseenMessages[unseenMessages.length - 1].subject){
            state.put('xi.event.input.destination', xal.getId());
            state.put('xi.event.output.text', 'The subject is ' + unseenMessages[unseenMessages.length - 1].subject);
        }
    }
    next(state);

});

xal.start({
    name: "Gmail"
}, function() {
    gmail.start(function(){
        setInterval(checkMail, 10000);
    });
    xal.getAgent({name: 'InputManager'}, function(err, agent) {
        if (err) {
            xal.log.fatal(err);
        } else if (agent === null) {
            xal.log.fatal('InputManager is required');
        } else {
            inputManager = agent;
        }
    });
});
