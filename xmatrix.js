// HTML5 drawing context
var canvas, context;

// The number of rows and columns of text
var width, height;

// A list of functions that determine how long to delay each column between events
var columnDelayers;

// The amount of time remaining in each column before the next event
var columnDelays;

// The characters in each column
var columns;

// The number of lines that each column has left before it starts writing characters again
var gaps;

// Whether each column has only just been drawn-to
var halfSteps;

// A list of falling "code raindrops"
var drops;

// The time in milliseconds-since-the-epoch that the last frame was drawn. This is useful for the frame limiter.
var lastFrameTime = 0;

// The time in milliseconds-since-the-epoch that we last checked for messages from the message server
var lastMessageCheck = 0;

// The figlet result
var grid;

// Are we displaying a message?
var messageMode;

// The first column of a message's text
var startColumn;

// The Y coordinate of the bottom of the text, measured from the top of the screen.
var gridProgress;

// The number of frames remaining in a pause
var pause;

// The number of frames remaining in a fast screen-filling drop
var runDry;

function resizeCanvas () {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	width = Math.floor((canvas.width / options.fontSize) / options.aspect);
	height = (canvas.height / options.fontSize);
	
	columnDelayers = makeDelayers(width);
	columnDelays = [];
	columns = [];
	gaps = [];
	halfSteps = [];
	drops = [];

	messageMode = false;
	pause = 0;
	runDry = 0;

	for(var i = 0; i < width; i++) {
		columnDelays[i] = 0;
		gaps[i] = 0;
		halfSteps[i] = false;
		columns[i] = [];
		for(var j = 0; j < height; j++) {
			columns[i].push(" ");
		}
	}

	// The context resets every time you change the canvas width/height so we need to set these here
	context.textBaseline = "top";
	context.font = "bold " + options.fontSize + "px MatrixCode";

	// Preload the columns with data
	for(var ticks = 0; ticks < options.numTicksToPrecompute; ticks++) {
		for(var col = 0; col < width; col++) {
			updateColumn(col);
		}
	}
}

// Returns a list of functions which return the number of ticks to wait between events for each column
function makeDelayers (numOfColumns) {
	var ret = [];

	// Add the correct number of slow columns to ret
	for(var i = 0; i < numOfColumns * options.propSlowColumns; i++) {
		ret.push(function () {
			return Math.floor(Math.random() * (options.maxSlowTime - options.minSlowTime + 1)) + options.minSlowTime;
		})
	}

	// Add the correct number of medium columns to ret
	for(var i = 0; i < numOfColumns * options.propMediumColumns; i++) {
		ret.push(function () {
			return Math.floor(Math.random() * (options.maxMediumTime - options.minMediumTime + 1)) + options.minMediumTime;
		})
	}

	// Add the remaining number of fast columns to ret
	var remaining = numOfColumns - ret.length;
	for(var i = 0; i < remaining; i++) {
		ret.push(function () {
			return Math.floor(Math.random() * (options.maxFastTime - options.minFastTime + 1)) + options.minFastTime;
		})
	}

	// Randomly shuffle the order of the columns using the Knuth shuffle
    for (var i = 0; i < numOfColumns; i++) {
        ret.swap(i, randInt(i, numOfColumns - i - 1));
    }

    return ret;
}

function xmatrixStart () {
	canvas = document.getElementById('canvas');
	context = canvas.getContext("2d");

	window.addEventListener('resize', resizeCanvas, false);
	resizeCanvas();

	var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame || window.oRequestAnimationFrame;

	if(requestAnimationFrame === undefined) {
		context.fillText("Sorry, your browser doesn't support requestAnimationFrame. Try the latest versions of Firefox, Chrome, or IE10", 20, 20)
	} else {
		// Start the animation
		var callback = function () { drawFrame(); requestAnimationFrame(callback); }
		callback();
	}
}

function doMessage (text) {
	if(!Figlet) {
		throw new "vector-figlet library required to display messages"
	}
	var fig = new Figlet(1);
	grid = fig.render(text);

	// Which columns are going to be affected by the message?
	var messageWidth = 0;
	for(var i=0; i<grid.length; i++) {
		if(grid[i].length > messageWidth) {
			messageWidth = grid[i].length;
		}
	}

	var size = Math.min(7, Math.floor(width/messageWidth))

	// Now that we know how much space the message will take up, create the real grid with the correct font size
	fig = new Figlet(size);
	grid = fig.render(text);

	// Which columns are going to be affected by the message?
	messageWidth = 0;
	for(var i=0; i<grid.length; i++) {
		if(grid[i].length > messageWidth) {
			messageWidth = grid[i].length;
		}
	}
	startColumn = Math.floor((width - messageWidth) / 2);

	// Reset the column delays for all columns
	for(var i=0; i<width; i++) {
		columnDelays[i] = options.messageSpeed;
	}
	gridProgress = 0;
	messageMode = true;

	// Synchronize half steps
	for(var i=0; i<width; i++) {
		halfSteps[i] = false;
	}

	runDry = Math.floor(height);
}

function writeGap (i) {
	gaps[i]--;
	columns[i].splice(0, 0, "");
}

function updateColumn (i) {
	// Before display a message we first fill the screen with letters
	if(runDry > 0) {
		columns[i].splice(0, 0, randChar());

		columnDelays[i] = options.messageSpeed;
	} else if(!messageMode) {
		if(gaps[i] > 0) {
			writeGap(i);
		} else {
			if(Math.random() < options.gapProbability) {
				gaps[i] = randInt(options.minGap, options.maxGap);

				writeGap(i);
			} else {
				columns[i].splice(0, 0, randChar());
			}
		}

		// Reset the amount of time this column will have to wait
		columnDelays[i] = columnDelayers[i]();
	} else {
		if(gridProgress < grid.length) {
			if(grid[grid.length-gridProgress-1][i-startColumn]) {
				columns[i].splice(0, 0, "");
			} else {
				columns[i].splice(0, 0, randChar());
			}
		} else {
			columns[i].splice(0, 0, randChar());
		}

		columnDelays[i] = options.messageSpeed;
	}

	// Cut the array off after height elements
	columns[i] = columns[i].slice(0, height+1);
}

function drawFrame () {
	// Enforce frame limiter
	if(Date.now() - lastFrameTime < 1000 / options.fpsLimit) {
		console.log("Frame limiter: skipping a frame.");
		return;
	}
	lastFrameTime = Date.now();

	if(messageMode && gridProgress === Math.floor((height/2) + (grid.length/2))) {
		// We're done with the message. Freeze here for awhile and then resume the normal effect
		messageMode = false;
		pause = options.messagePause;
	}

	if(pause-- > 0) return;

	if(runDry <= 0 && messageMode && columnDelays[0] <= 0) {
		gridProgress++;
	}

	if(runDry > 0) {
		runDry--;
	}

	// Add some new text to any column which is due for an event
	for(var i = 0; i < width; i++) {
		// If we just drew the half step then switch to the regular offset
		if(halfSteps[i]) {
			halfSteps[i] = false;
		}

		if(columnDelays[i] <= 0) {
			updateColumn(i);

			// We just moved the column down one space, so for the next frame show it halfway to its new position
			halfSteps[i] = true;
		} else {
			columnDelays[i]--;
		}
	}

	// Clear the canvas
	context.fillStyle = "#000000";
	context.fillRect(0, 0, canvas.width, canvas.height); 

	// Draw the matrix effect
	context.fillStyle = options.fontColor;
	context.shadowBlur = 15;
	context.shadowColor = options.fontColor;
	for(var col = 0; col < width; col++) {
		for(var row = 0; row < height; row++) {
			var text = columns[col][row];
			var x = Math.floor(options.fontSize * col * options.aspect);
			var y;

			if(halfSteps[col]) {
				y = options.fontSize * (row - 0.5);
			} else {
				y = options.fontSize * row;
			}

			context.fillText(text, x, y);
		}
	}

	// Possibly add a new bright character
	if(Math.random() < options.dropProbability) {
		var obj = {
			"dropsRemaining": randInt(options.dropMinDistance, options.dropMaxDistance),
			"x": randInt(0, width-1),
			"y": randInt(0, height-1)
		};
		drops.push(obj);
	}

	// Process each bright character
	context.fillStyle = options.fontColor;
	context.shadowBlur = 15;
	context.shadowColor = options.fontColor;
	for(var i = 0; i < drops.length; i++) {
		var obj = drops[i];

		// Don't rain on top of a message
		if(messageMode) {
			drops.splice(i, 1);
			continue;
		}

		obj.dropsRemaining--;

		obj.y++;
		if(obj.dropsRemaining === 0 || obj.y >= height) {
			drops.splice(i, 1);
		}

		var c = randChar();
		columns[obj.x][obj.y] = c;
		context.fillStyle = options.highlightColor;
		context.fillText(c, Math.floor(options.fontSize * obj.x * options.aspect), options.fontSize * obj.y);
		context.fillText(c, Math.floor(options.fontSize * obj.x * options.aspect)+1, (options.fontSize * obj.y)+1);
	}

	if(options.messageServer && !messageMode && (Date.now() - lastMessageCheck > 1000)) {
		$.ajax({
			url: options.messageServer,
			type: "GET",
			dataType: "text",
			timeout: 500,
			success: function (data, status, jqXHR) {
				if(jqXHR.status !== 204) {
					doMessage(data);
				}
			}
		});

		lastMessageCheck = Date.now();
	}
}