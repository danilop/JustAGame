/**************************************************
 ** GAME PLAYER CLASS
 **************************************************/
var Player = function(startX, startY, gameWidth, gameHeight) {
    var x = startX,
    y = startY,
    width = gameWidth,
    height = gameHeight,
    id,
    color,
    score = 0,
    name = '',
    moveAmount = 2;
    
    var getX = function() {
	return x;
    };

    var getY = function() {
	return y;
    };

    var setX = function(newX) {
	x = newX;
    };

    var setY = function(newY) {
	y = newY;
    };

    var setColor = function(newColor) {
	color = newColor;
    }

    var getColor = function() {
	return color;
    }

    var getId = function() {
	return id;
    }

    var setId = function(newId) {
	id = newId;
    }

    var getScore = function() {
	return score;
    }
	
    var setScore = function(s) {
	score = s;
    }
	
    var getName = function() {
	return name;
    }
	
    var setName = function(n) {
	name = n;
    }

    var update = function(input) {
	var prevX = x,
	prevY = y;
	// Up key takes priority over down
	if (input.up) {
	    y -= moveAmount;
	} else if (input.down) {
	    y += moveAmount;
	};
	    
	// Left key takes priority over right
	if (input.left) {
	    x -= moveAmount;
	} else if (input.right) {
	    x += moveAmount;
	};

	if (input.td < -20) {
	    y -= moveAmount;
	} else if (input.td > 20) {
	    y += moveAmount;
	};

	if (input.lr < -20) {
	    x -= moveAmount;
	} else if (input.lr > 20) {
	    x += moveAmount;
	};

	checkInside();

	return (prevX != x || prevY != y) ? true : false;
    };

    var checkInside = function() {
	while (x < 0) {
	    x += width;
	}
	while (x >= width) {
	    x -= width;
	}
	while (y < 0) {
	    y += height;
	}
	while (y >= height) {
	    y -= height;
	}
    }
    
    var draw = function(ctx) {
	if(typeof color === 'undefined'){
	    ctx.fillStyle='#000000'; // black
	} else {
	    ctx.fillStyle=color;
	}
	ctx.fillRect(x-5, y-5, 10, 10);
    };
    
    return {
	getX: getX,
	    getY: getY,
	    setX: setX,
	    setY: setY,
	    setColor: setColor,
	    getColor: getColor,
	    getId: getId,
	    setId: setId,
	    getScore: getScore,
	    setScore: setScore,
	    getName: getName,
	    setName: setName,
	    update: update,
	    draw: draw
	    }
};
