/**************************************************
 ** GAME VARIABLES
 **************************************************/
var canvas,			// Canvas DOM element
    ctx,			// Canvas rendering context
    input,			// Input
    localPlayer,	// Local player
    remotePlayers,
    socket,
    username,
    gameWidth,
    gameHeight;


/**************************************************
 ** GAME INITIALISATION
 **************************************************/
function init(u) {
	
    username = u;

    while (!username) {
        username = window.prompt('Please enter your name:');
    }

    gameWidth = 600;
    gameHeight = 600;
	
    // Declare the canvas and rendering context
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Maximise the canvas
    //canvas.width = window.innerWidth;
    //canvas.height = window.innerHeight;
    // Set canvas size	
    canvas.width = gameWidth;
    canvas.height = gameHeight;

    // Initialise input controls
    input = new Input();

    // Calculate a random start position for the local player
    // The minus 5 (half a player size) stops the player being
    // placed right on the egde of the screen
    var startX = Math.round(Math.random()*(canvas.width-5)),
	startY = Math.round(Math.random()*(canvas.height-5));

    // Initialise the local player
    localPlayer = new Player(startX, startY, gameWidth, gameHeight);

    socket = io.connect();

    // Start listening for events
    setEventHandlers();

    remotePlayers = [];
};


/**************************************************
 ** GAME EVENT HANDLERS
 **************************************************/
var setEventHandlers = function() {
    // Keyboard
    window.addEventListener('keydown', onKeydown, false);
    window.addEventListener('keyup', onKeyup, false);

    // Accelerometer
    if (window.DeviceOrientationEvent) {
	console.log('DeviceOrientation is supported');
	window.addEventListener('deviceorientation', onDeviceOrientation, false);
    } else if (window.OrientationEvent) {
	console.log('MozOrientation is supported');
	window.addEventListener('MozOrientation', onMozOrientation, false);
    }

    // Window resize
    window.addEventListener('resize', onResize, false);

    socket.on('connect', onSocketConnected);
    socket.on('disconnect', onSocketDisconnect);
    socket.on('new player', onNewPlayer);
    socket.on('move player', onMovePlayer);
    socket.on('remove player', onRemovePlayer);
    socket.on('init player', onInitPlayer);
    socket.on('score player', onScorePlayer);
};

// Keyboard key down
function onKeydown(e) {
    if (localPlayer) {
	input.onKeyDown(e);
    };
};

// Keyboard key up
function onKeyup(e) {
    if (localPlayer) {
	input.onKeyUp(e);
    };
};

function onDeviceOrientation(e) {
    if (localPlayer) {
	input.updateOrientation(e.gamma, e.beta);
	//	socket.emit('log', 'orientation: ' + input.lr + ',' + input.td);
    };
};

function onMozOrientation(e) {
    if (localPlayer) {
	input.updateOrientation(e.x * 90, e.y * 90);
    };
};


// Browser window resize
function onResize(e) {
    // Maximise the canvas
    //canvas.width = window.innerWidth;
    //canvas.height = window.innerHeight;
};

function onSocketConnected() {
    console.log('Connected to socket server');

    console.log("connect with username: "+username);
    if (username) {
	localPlayer.setName(username);
    } else {
	var name = window.prompt('Please enter your name:');
	localPlayer.setName(name);
    }

    socket.emit('new player', {
	    name: localPlayer.getName(),
		x: localPlayer.getX(),
		y: localPlayer.getY()
		});
};

function onSocketDisconnect() {
    console.log('Disconnected from socket server');
};

function onNewPlayer(data) {
    console.log('New player connected: '+data.id+' color: '+data.color+' score: '+data.score);

    var checkPlayer = playerById(data.id);
    if (checkPlayer) {
        console.log('Player already known:'+data.id);
        return;
    }

    var newPlayer = new Player(data.x, data.y);
    newPlayer.id = data.id;
    newPlayer.setName(data.name);
    newPlayer.setColor(data.color);
    newPlayer.setScore(data.score);
    remotePlayers.push(newPlayer);
};

function onMovePlayer(data) {
	
    if (localPlayer.getId() == data.id) {
	localPlayer.setX(data.x);
	localPlayer.setY(data.y);
	return;
    }
	
    var movePlayer = playerById(data.id);

    if (!movePlayer) {
	console.log('Player not found: '+data.id);
	return;
    };

    movePlayer.setX(data.x);
    movePlayer.setY(data.y);
};

function onRemovePlayer(data) {
    console.log('Remove Player: ' + data.id);
    var removePlayer = playerById(data.id);

    if (!removePlayer) {
	console.log('Player not found: '+data.id);
	return;
    };

    remotePlayers.splice(remotePlayers.indexOf(removePlayer), 1);
};

function onInitPlayer(data) {
    console.log('Your Color: ' + data.color);
    console.log('Your ID: ' + data.id);
    localPlayer.setColor(data.color);
    localPlayer.setId(data.id);
    localPlayer.setScore(data.score);
};

function onScorePlayer(data) {
    console.log('Score Player: ' + data.id + ' -> ' + data.score);
    if (localPlayer.getId() == data.id) {
	localPlayer.setScore(data.score);
	return;
    }
	
    var movePlayer = playerById(data.id);

    if (!movePlayer) {
	console.log('Player not found: '+data.id);
	return;
    };

    movePlayer.setScore(data.score);
};

/**************************************************
 ** GAME ANIMATION LOOP
 **************************************************/
function animate() {
    update();
    draw();
    scores();

    // Request a new animation frame using Paul Irish's shim
    window.requestAnimFrame(animate);
};


/**************************************************
 ** GAME UPDATE
 **************************************************/
function update() {
    if (localPlayer.update(input)) {
	socket.emit('move player', {x: localPlayer.getX(), y: localPlayer.getY()});
    };
};


/**************************************************
 ** GAME DRAW
 **************************************************/
function draw() {
	
    // Wipe the canvas clean
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    x = localPlayer.getX();
    y = localPlayer.getY();

    // Draw the local player
    localPlayer.draw(ctx, x-5, y-5);

    var i;
    for (i = 0; i < remotePlayers.length; i++) {
	remotePlayers[i].draw(ctx);
    };
};

function scores() {
    var color;

    var scoreItem = {
	name: localPlayer.getName(),
	color: localPlayer.getColor(),
	score: localPlayer.getScore(),
	local: true
    };
    var scoreList = [ scoreItem ];
    var i;
    for (i = 0; i < remotePlayers.length; i++) {
	scoreItem = {
	    name: remotePlayers[i].getName(),
	    color: remotePlayers[i].getColor(),
	    score: remotePlayers[i].getScore(),
	    local: false
	};
	scoreList.push(scoreItem);
    }
    scoreList.sort(
		   function(x,y) {
		       if (y.score != x.score)
			   return y.score - x.score;
		       else if (x.local)
			   return -1;
		       else if (y.local)
			   return +1;
		       else
			   return 0;
		   });
    var py = 5;
    var localIsDone = false;
    for (i = 0; i < scoreList.length; i++) {
	if (i > 10) {
	    if (localIsDone) {
		break;
	    } else if (!scoreList[i].local) {
		continue;
	    }
	}
	color = scoreList[i].color;
	if(typeof color === 'undefined'){
	    ctx.fillStyle='#000000'; // black
	} else {
	    ctx.fillStyle=color;
	}
	var printScore;
	printScore = '#'+(i+1)+': '+scoreList[i].score+' '+scoreList[i].name;
	if (scoreList[i].local) {
	    ctx.font = '24px Arial';
	    py += 30
		localIsDone = true;
	    printScore += ' << That\'s you!'
		} else {
	    ctx.font = '16px Arial';
	    py += 20
		}
	ctx.fillText(printScore, 5, py);
    };
}

function playerById(id) {
    var i;
    for (i = 0; i < remotePlayers.length; i++) {
	if (remotePlayers[i].id == id)
	    return remotePlayers[i];
    };

    return false;
};
