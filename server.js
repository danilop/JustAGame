var express = require('express'),
    passport = require('passport'),
    FacebookStrategy = require('passport-facebook').Strategy,
    TwitterStrategy = require('passport-twitter').Strategy,
    util = require('util'),
    Player = require('./Player').Player;

var AWS = require('aws-sdk');

var config = require(process.env.CONFIG_FILE);

var ENABLE_LOGIN = false;

var FACEBOOK_APP_ID = "<replace with your own>";
var FACEBOOK_APP_SECRET = "<replace with your own>";

var TWITTER_CONSUMER_KEY = "<replace with your own>";
var TWITTER_CONSUMER_SECRET = "<replace with your own>";

var app,
    server,
    io,
    port,
    socket,
    players,
    sqs,
    queueUrl,
    gameWidth,
    gameHeight;

function ensureAuthenticated(req, res, next) {
    if (!ENABLE_LOGIN || req.isAuthenticated()) { return next(); }
    res.redirect('/login')
	}

function init() {

    players = [];
  
    gameWidth = 600;
    gameHeight = 600;

    AWS.config.update({region: config.Region});
    sqs = new AWS.SQS();
    sqs.client.getQueueUrl({QueueName: 'JustAGame-Queue'}, function(err, data) {
	    if (!err) {
		console.log('Get Queue URL: '+data.QueueUrl);
		queueUrl = data.QueueUrl;
	    } else {
		console.log('Error getting Queue URL: '+err);
	    }
	});
    var elasticache = new AWS.ElastiCache();

    port = process.env.PORT || 3000;

    passport.serializeUser(function(user, done) {
	    done(null, user);
	});

    passport.deserializeUser(function(obj, done) {
	    done(null, obj);
	});

    if (ENABLE_LOGIN) {

	passport.use(new FacebookStrategy({
		    clientID: FACEBOOK_APP_ID,
			clientSecret: FACEBOOK_APP_SECRET,
			callbackURL: "/auth/facebook/callback"
			},
		function(accessToken, refreshToken, profile, done) {
		    // asynchronous verification, for effect...
		    process.nextTick(function () {
      
			    // To keep the example simple, the user's Facebook profile is returned to
			    // represent the logged-in user.  In a typical application, you would want
			    // to associate the Facebook account with a user record in your database,
			    // and return that user instead.
			    return done(null, profile);
			});
		}
		));

	passport.use(new TwitterStrategy({
		    consumerKey: TWITTER_CONSUMER_KEY,
			consumerSecret: TWITTER_CONSUMER_SECRET,
			callbackURL: "/auth/twitter/callback"
			},
		function(token, tokenSecret, profile, done) {
		    // asynchronous verification, for effect...
		    process.nextTick(function () {
      
			    // To keep the example simple, the user's Twitter profile is returned to
			    // represent the logged-in user.  In a typical application, you would want
			    // to associate the Twitter account with a user record in your database,
			    // and return that user instead.
			    return done(null, profile);
			});
		}
		));

    }

    app = express();
    app.configure(function() {
	    app.use(express.favicon());
	    app.set('views', __dirname + '/views');
	    app.set('view engine', 'ejs');
	    app.use(express.logger());
	    app.use(express.cookieParser());
	    app.use(express.bodyParser());
	    app.use(express.methodOverride());
	    app.use(express.session({ secret: 'websockets html5' }));
	    // Initialize Passport!  Also use passport.session() middleware, to support
	    // persistent login sessions (recommended).
	    if (ENABLE_LOGIN) {
		app.use(passport.initialize());
		app.use(passport.session());
	    }
	    app.use(app.router);
	    app.use(express.static(__dirname + '/public'));
	});

    app.get('/', function(req, res){
	    if (ENABLE_LOGIN) {
		res.render('index', { user: req.user });
	    } else {
		res.redirect('/game');
	    }
	});

    app.get('/game', ensureAuthenticated, function(req, res){
	    if (ENABLE_LOGIN) {
		res.render('game', { user: req.user.username });
	    } else {
		res.render('game', { user: '' });
	    }
	});

    if (ENABLE_LOGIN) {

	app.get('/login', function(req, res){
		res.render('login', { user: req.user });
	    });

	app.get('/auth/facebook',
		passport.authenticate('facebook'),
		function(req, res){
		    // The request will be redirected to Facebook for authentication, so this
		    // function will not be called.
		});

	app.get('/auth/facebook/callback', 
		passport.authenticate('facebook', { failureRedirect: '/login' }),
		function(req, res) {
		    res.redirect('/game');
		});

	app.get('/auth/twitter',
		passport.authenticate('twitter'),
		function(req, res){
		    // The request will be redirected to Twitter for authentication, so this
		    // function will not be called.
		});

	app.get('/auth/twitter/callback', 
		passport.authenticate('twitter', { failureRedirect: '/login' }),
		function(req, res) {
		    res.redirect('/game');
		});
	  
    }

    app.get('/logout', function(req, res){
	    if (ENABLE_LOGIN) {	req.logout(); }
	    res.redirect('/');
	});


		
    server = app.listen(port);

    io = require('socket.io').listen(server);
    
    io.configure(function() {
	    // io.set('transports', ['websocket']);
	    io.set('log level', 3);
            elasticache.describeCacheClusters({CacheClusterId: config.ElastiCache, ShowCacheNodeInfo: true}, function(err, data) {
                    if (!err) {
                        console.log('Describe Cache Cluder Id: '+config.ElastiCache+' data: '+data);
                        redisEndpoint = data.CacheClusters[0].CacheNodes[0].Endpoint;
                        var RedisStore = require('socket.io/lib/stores/redis'),
                            redis  = require('socket.io/node_modules/redis'),
                            pub    = redis.createClient(redisEndpoint.Port, redisEndpoint.Address),
                            sub    = redis.createClient(redisEndpoint.Port, redisEndpoint.Address),
                            client = redis.createClient(redisEndpoint.Port, redisEndpoint.Address);
                        io.set('store', new RedisStore({
                                    redisPub : pub
                                        , redisSub : sub
                                        , redisClient : client
                                        }));
                    } else {
                        console.log('Error describing Cache Cluster: '+err);
                    }
                });

	});
	
    setEventHandlers();

};

var setEventHandlers = function() {
    io.on('connection', onSocketConnection);
};

function onSocketConnection(client) {
    util.log('New player has connected: '+client.id);
    client.on('disconnect', onClientDisconnect);
    client.on('new player', onNewPlayer);
    client.on('move player', onMovePlayer);
    client.on('log', onLog);
};

function onLog(data) {
    util.log('Log: '+data);
}

function onClientDisconnect() {
    util.log('Player has disconnected: '+this.id);

    var removePlayer = playerById(this.id);

    if (!removePlayer) {
	util.log('Player not found: '+this.id);
	return;
    };

    var message = 'onClientDiconnect: '+JSON.stringify(removePlayer);

    sqs.client.sendMessage({QueueUrl: queueUrl, MessageBody: message},
			   function(err, data) {
			       if (!err) {
				   console.log('Message sent, id: '+data.MessageId);
			       } else {
				   console.log('Error sending message: '+err);
			       }
			   });

    players.splice(players.indexOf(removePlayer), 1);
    this.broadcast.emit('remove player', {id: this.id});
};

function get_random_color() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
	color += letters[Math.round(Math.random() * 15)];
    }
    return color;
}

function onNewPlayer(data) {
    util.log('onNewPlayer');

    var newPlayer = new Player(data.x, data.y, gameWidth, gameHeight);
    newPlayer.id = this.id;
    newPlayer.name = data.name;
    newPlayer.color = get_random_color();
    newPlayer.score = 0;

    var message = 'onNewPlayer: ' + JSON.stringify(newPlayer);

    sqs.client.sendMessage({QueueUrl: queueUrl, MessageBody: message},
			   function(err, data) {
			       if (!err) {
				   console.log('Message sent, id: '+data.MessageId);
			       } else {
				   console.log('Error sending message: '+err);
			       }
			   });

    this.emit('init player', {
	    color: newPlayer.color,
		id: newPlayer.id,
		score: newPlayer.score
		});

    this.broadcast.emit('new player', {
	    id: newPlayer.id,
		name: newPlayer.name,
		x: newPlayer.getX(),
		y: newPlayer.getY(),
		color: newPlayer.color,
		score: newPlayer.score
		});

    var i, existingPlayer;
    for (i = 0; i < players.length; i++) {
	existingPlayer = players[i];
	this.emit('new player', {
		id: existingPlayer.id,
		    name: existingPlayer.name,
		    x: existingPlayer.getX(),
		    y: existingPlayer.getY(),
		    color: existingPlayer.color,
		    score: existingPlayer.getScore()
		    });
    };

    players.push(newPlayer);

};

function onMovePlayer(data) {
    util.log('onMovePlayer');
    var movePlayer = playerById(this.id);

    if (!movePlayer) {
	util.log('Player not found: '+this.id);
	return;
    };

    movePlayer.setX(data.x);
    movePlayer.setY(data.y);

    this.broadcast.emit('move player', {id: movePlayer.id, x: data.x, y: data.y});

    var collision_id = checkCollision(this.id,data.x,data.y);

    if (collision_id !== undefined) {
	util.log('Collision!');
	var collisionPlayer = playerById(collision_id);
	collisionPlayer.shake();
	collisionPlayer.decScore(1);
	movePlayer.incScore(1);
	// TODO optimize messages -> too many!!!
	this.emit('move player', {id: collision_id, x: collisionPlayer.getX(), y: collisionPlayer.getY()});
	this.broadcast.emit('move player', {id: collision_id, x: collisionPlayer.getX(), y: collisionPlayer.getY()});
	this.emit('score player', {id: this.id, score: movePlayer.getScore()});
	this.broadcast.emit('score player', {id: this.id, score: movePlayer.getScore()});
	this.emit('score player', {id: collision_id, score: collisionPlayer.getScore()});
	this.broadcast.emit('score player', {id: collision_id, score: collisionPlayer.getScore()});
    }
};

function checkCollision(id,x,y) {
    var i;
    for (i = 0; i < players.length; i++) {
	if (players[i].id != id) {
	    if (Math.abs(players[i].getX() - x) < 10 && Math.abs(players[i].getY() - y) < 10) {
		return players[i].id;
	    }
	}
    };
    return undefined;
}

function playerById(id) {
    var i;
    for (i = 0; i < players.length; i++) {
	if (players[i].id == id)
	    return players[i];
    };
    return false;
};

init();
