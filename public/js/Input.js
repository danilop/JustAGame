var Input = function(up, left, right, down, lr, td) {
    var up = up || false,
    left = left || false,
    right = right || false,
    down = down || false,
    lr = lr || 0,
    td = td || 0;
		
	var onKeyDown = function(e) {
		var that = this,
			c = e.keyCode;
		switch (c) {
			// Controls
			case 37: // Left
				that.left = true;
				break;
			case 38: // Up
				that.up = true;
				break;
			case 39: // Right
				that.right = true; // Will take priority over the left key
				break;
			case 40: // Down
				that.down = true;
				break;
		};
	};
	
	var onKeyUp = function(e) {
		var that = this,
			c = e.keyCode;
		switch (c) {
			case 37: // Left
				that.left = false;
				break;
			case 38: // Up
				that.up = false;
				break;
			case 39: // Right
				that.right = false;
				break;
			case 40: // Down
				that.down = false;
				break;
		};
	};

    var updateOrientation = function(lr,td) {
	var that = this;
	this.lr = lr;
	this.td = td;
    };

	return {
		up: up,
		left: left,
		right: right,
		down: down,
		lr: lr,
		td: td,
		onKeyDown: onKeyDown,
		onKeyUp: onKeyUp,
		updateOrientation: updateOrientation
	};
};