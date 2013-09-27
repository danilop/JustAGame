var Player = function(startX, startY, gameWidth, gameHeight) {
    var x = startX,
    y = startY,
	width = gameWidth,
	height = gameHeight,
    id,
    color,
	name = '',
	score = 0;
    
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
	
	var getScore = function() {
		return score;
	}
	
	var setScore = function(newScore) {
		score = newScore;
	}
	
	var incScore = function(i) {
		score += i;
		if (score < 0) {
			score = 0;
		}
	}

	var decScore = function(i) {
		score -= i;
		if (score < 0) {
			score = 0;
		}
	}

	var shake = function() {
		x += Math.floor((Math.random()*21)-10);
		y += Math.floor((Math.random()*21)-10);
		checkInside();
	}
	
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

    return {
        getX: getX,
	getY: getY,
	setX: setX,
	setY: setY,
	getScore: getScore,
	setScore: setScore,
	incScore: incScore,
	decScore: decScore,
	shake: shake,
	name: name,
	id: id,
	color: color
    }
};

exports.Player = Player;
