var dns = require('dns'),
    express = require('express'),
    passport = require('passport'),
    FacebookStrategy = require('passport-facebook').Strategy,
    TwitterStrategy = require('passport-twitter').Strategy,
    util = require('util'),
    Player = require('./Player').Player,
    uuid = require('node-uuid');

var AWS = require('aws-sdk');

var config = require(process.env.CONFIG_FILE);

var ENABLE_LOGIN = false;

var FACEBOOK_APP_ID = "<replace with your own>";
var FACEBOOK_APP_SECRET = "<replace with your own>";

var TWITTER_CONSUMER_KEY = "<replace with your own>";
var TWITTER_CONSUMER_SECRET = "<replace with your own>";

var serverBroadcast;

var sqs,
    queueUrl;

var serverId,
    app,
    server,
    io,
    port,
    socket,
    players,
    gameWidth,
    gameHeight;

function ensureAuthenticated(req, res, next) {
    if (!ENABLE_LOGIN || req.isAuthenticated()) { return next(); }
    res.redirect('/login');
}

function init() {

    serverId = uuid.v4();
    util.log('Unique serverId = '+ serverId);

    players = [];
  
    gameWidth = 600;
    gameHeight = 600;

    AWS.config.update({region:config.Region});
    sqs = new AWS.SQS();
    elasticache = new AWS.ElastiCache();
    queueUrl = config.QueueURL;

    port = process.env.PORT || 3000;

    passport.serializeUser(function(user, done) {
	    done(null, user);
	});

    passport.deserializeUser(function(obj, done) {
	    done(null, obj);
	});

    if (ENABLE_LOGIN) {

	passport.use(new FacebookStrategy({
		    clientID:FACEBOOK_APP_ID,
			clientSecret:FACEBOOK_APP_SECRET,
			callbackURL:"/auth/facebook/callback"
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
		    consumerKey:TWITTER_CONSUMER_KEY,
			consumerSecret:TWITTER_CONSUMER_SECRET,
			callbackURL:"/auth/twitter/callback"
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
	    app.use(express.session({ secret:'websockets html5' }));
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
		res.render('index', { user:req.user });
	    } else {
		res.redirect('/game');
	    }
	});

    app.get('/game', ensureAuthenticated, function(req, res){
	    if (ENABLE_LOGIN) {
		res.render('game', { user:req.user.username });
	    } else {
		res.render('game', { user:'' });
	    }
	});

    if (ENABLE_LOGIN) {

	app.get('/login', function(req, res){
		res.render('login', { user:req.user });
	    });

	app.get('/auth/facebook',
		passport.authenticate('facebook'),
		function(req, res){
		    // The request will be redirected to Facebook for authentication, so this
		    // function will not be called.
		});

	app.get('/auth/facebook/callback', 
		passport.authenticate('facebook', { failureRedirect:'/login' }),
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
		passport.authenticate('twitter', { failureRedirect:'/login' }),
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
	    io.set('log level', 1); // warn
	    function getRedisEndpoint() {
		elasticache.describeCacheClusters({CacheClusterId:config.ElastiCache, ShowCacheNodeInfo:true},
						  function(err, data) {
						      if (!err) {
							  util.log('Describe Cache Cluster Id:'+config.ElastiCache);
							  if (data.CacheClusters[0].CacheClusterStatus == 'available') {
							      redisEndpoint = data.CacheClusters[0].CacheNodes[0].Endpoint;
							      function configureRedisStore() {
								  dns.lookup(redisEndpoint.Address, function (err, address) {
									  // Sometimes the DNS propagation can be slow, try again after 1 second
									  if (err) { 
									      setTimeout(configureRedisStore, 1000);
									  } else {
									      var RedisStore = require('socket.io/lib/stores/redis'),
										  redis  = require('socket.io/node_modules/redis'),
										  pub    = redis.createClient(redisEndpoint.Port, address),
										  sub    = redis.createClient(redisEndpoint.Port, address),
										  client = redis.createClient(redisEndpoint.Port, address);
									      io.set('store', new RedisStore({redisPub:pub, redisSub:sub, redisClient:client}));
									      serverBroadcast = redis.createClient(redisEndpoint.Port, address);
									      var redisUpdates = redis.createClient(redisEndpoint.Port, address);
									      redisUpdates.on('message', function (channel, message) {
										      data = JSON.parse(message);
										      if (data.serverId != serverId) { // Don't listen to your own messages
											  util.log('channel:'+channel+' message:'+message);
											  switch (channel)
											      {
											      case 'disconnect':
												  onRemoteClientDisconnect(data); break;
											      case 'new player':
												  onRemoteNewPlayer(data); break;
											      case 'move player':
												  onRemoteMovePlayer(data); break;
											      case 'score player':
												  onRemoteScorePlayer(data); break;
											      case 'all players':
												  sendAllPlayers(false); break;
											      default:
												  util.log('Unknown channel:'+channel+' message:'+message);
											      }
										      }
										  });
									      redisUpdates.subscribe('disconnect');
									      redisUpdates.subscribe('new player');
									      redisUpdates.subscribe('move player');
									      redisUpdates.subscribe('score player');
									      redisUpdates.subscribe('all players');
									      serverBroadcast.publish('all players', JSON.stringify({serverId:serverId})); // To get all players from all servers
									      setEventHandlers();
									  }
								      });
							      }
							      configureRedisStore();
							  } else {
							      process.nextTick(getRedisEndpoint); // Try again until available
							  }
						      } else {
							  util.log('Error describing Cache Cluster:'+err);
						      }
						  });
	    }
	    getRedisEndpoint();
	});

}

var setEventHandlers = function() {
    io.on('connection', onSocketConnection);
}

function onSocketConnection(client) {
    util.log('New player has connected:'+client.id);
    client.on('disconnect', onLocalClientDisconnect);
    client.on('new player', onLocalNewPlayer);
    client.on('move player', onLocalMovePlayer);
    client.on('log', onLog);
}

function onLog(data) {
    util.log('Log:'+data);
}

function onLocalClientDisconnect() {
    onClientDisconnect.call(this, this.id, true);
}

function onRemoteClientDisconnect(data) {
    onClientDisconnect(data.id, false);
}

function onClientDisconnect(id, local) {
    util.log('Player has disconnected:'+id+' local:'+local);

    var removePlayer = playerById(id);

    if (!removePlayer) {
	util.log('Player not found:'+id);
	return;
    }

    if (local) {
	var data = {id:id};
	this.broadcast.emit('remove player', data);
	data.serverId = serverId;
	serverBroadcast.publish('disconnect', JSON.stringify(data));

	var message = 'onClientDiconnect:'+JSON.stringify(removePlayer);
	sqs.client.sendMessage({QueueUrl:queueUrl, MessageBody:message},
			       function(err, data) {
				   if (!err) {
				       util.log('Message sent, id:'+data.MessageId);
				   } else {
				       util.log('Error sending message:'+err);
				   }
			       });
    }

    players.splice(players.indexOf(removePlayer), 1);
}

function get_random_color() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
	color += letters[Math.round(Math.random() * 15)];
    }
    return color;
}

function onLocalNewPlayer(data) {
    onNewPlayer.call(this, data, true);
}

function onRemoteNewPlayer(data) {
    onNewPlayer(data, false);
}

function onNewPlayer(data, local) {
    util.log('onNewPlayer local:'+local);

    var newPlayer = new Player(data.x, data.y, gameWidth, gameHeight);
    if (local) {
	data.id = this.id;
    }
    newPlayer.id = data.id;

    var checkPlayer = playerById(newPlayer.id);
    if (checkPlayer) {
        util.log('Player already known:'+newPlayer.id);
        return;
    }
    util.log('New player ID: '+newPlayer.id+' local:'+local);

    newPlayer.name = data.name;

    if (local) {
	newPlayer.color = get_random_color();
	newPlayer.score = 0;
    } else {
	newPlayer.color = data.color;
	newPlayer.score = data.score;
    }

    var forOthersData = {
	id:newPlayer.id,
	name:newPlayer.name,
	x:newPlayer.getX(),
	y:newPlayer.getY(),
	color:newPlayer.color,
	score:newPlayer.score
    };

    if (local) {

	data.serverId = serverId;
	serverBroadcast.publish('new player', JSON.stringify(data));

	var message = 'onNewPlayer:' + JSON.stringify(newPlayer);
	sqs.client.sendMessage({QueueUrl:queueUrl, MessageBody:message},
			       function(err, data) {
				   if (!err) {
				       util.log('Message sent, id:'+data.MessageId);
				   } else {
				       util.log('Error sending message:'+err);
				   }
			       });

	this.broadcast.emit('new player', forOthersData);

	this.emit('init player', {
		color:newPlayer.color,
		    id:newPlayer.id,
		    score:newPlayer.score
		    });
   

	var i, existingPlayer;
	sendAllPlayers.call(this, true);
    }

    players.push(newPlayer);

}

function sendAllPlayers(local) {
    for (i = 0; i < players.length; i++) {
	existingPlayer = players[i];
	var data = {
	    id:existingPlayer.id,
	    name:existingPlayer.name,
	    x:existingPlayer.getX(),
	    y:existingPlayer.getY(),
	    color:existingPlayer.color,
	    score:existingPlayer.getScore()
	};
	if (local) {
	    this.emit('new player', data);
	} else {
	    data.serverId = serverId;
	    serverBroadcast.publish('new player', JSON.stringify(data));
	}
    }
}

function onLocalMovePlayer(data) {
    onMovePlayer.call(this, data, true);
}

function onRemoteMovePlayer(data) {
    onMovePlayer(data, false);
}

function onMovePlayer(data, local) {
    util.log('onMovePlayer local:'+local);

    if (local) {
	data.id = this.id;
	data.serverId = serverId;
	serverBroadcast.publish('move player', JSON.stringify(data));
    }
    var id = data.id;

    var movePlayer = playerById(id);
    if (!movePlayer) {
	util.log('Player not found:'+id);
	return;
    }
	
    movePlayer.setX(data.x);
    movePlayer.setY(data.y);

    var forOthersData = {id:id, x:data.x, y:data.y};
    if (local) {

	this.broadcast.emit('move player', forOthersData);

	var collision_id = checkCollision(id, data.x, data.y);

	if (collision_id !== undefined) {
	    util.log('Collision!');
	    var collisionPlayer = playerById(collision_id);
	    collisionPlayer.shake();
	    collisionPlayer.decScore(1);
	    movePlayer.incScore(1);

	    // TODO optimize messages -> too many!!!
	    var data;

	    data = {id:collision_id, x:collisionPlayer.getX(), y:collisionPlayer.getY()};
	    io.sockets.emit('move player', data);
	    data.serverId = serverId;
	    serverBroadcast.publish('move player', JSON.stringify(data));
	    
	    data = {id:id, score:movePlayer.getScore()};
	    io.sockets.emit('score player', data);
	    data.serverId = serverId;
	    serverBroadcast.publish('score player', JSON.stringify(data));
	    
	    data = {id:collision_id, score:collisionPlayer.getScore()};
	    io.sockets.emit('score player', data);
	    data.serverId = serverId;
	    serverBroadcast.publish('score player', JSON.stringify(data));
	}

    }
    
}

function onRemoteScorePlayer(data) {
    util.log('onRemoteScorePlayer');

    var id = data.id;

    var scorePlayer = playerById(id);
    if (!scorePlayer) {
	util.log('Player not found:'+id);
	return;
    }
	
    scorePlayer.setScore(data.score);
}

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
