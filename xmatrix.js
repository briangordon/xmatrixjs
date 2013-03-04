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

function resizeCanvas () {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	width = Math.floor((canvas.width / options.fontSize) / 0.75);
	height = (canvas.height / options.fontSize);
	
	columnDelayers = makeDelayers(width);
	columnDelays = [];
	columns = [];
	gaps = [];
	halfSteps = [];
	drops = [];

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

function writeGap (i) {
	gaps[i]--;
	// Add numRowsToFall spaces
	for(var j = 0; j < options.numRowsToFall; j++) {
		columns[i].splice(0, 0, "");
	}
}

function updateColumn (i) {
	if(gaps[i] > 0) {
		writeGap(i);
	} else {
		if(Math.random() < options.gapProbability) {
			// Create a gap of 1 to 4 times numRowsToFall
			gaps[i] = randInt(options.minGap, options.maxGap);

			writeGap(i);
		} else {
			// Add numRowsToFall new characters
			for(var j = 0; j < options.numRowsToFall; j++) {
				columns[i].splice(0, 0, randChar());
			}
		}
	}

	// Cut the array off after height elements
	columns[i] = columns[i].slice(0, height+1);

	// Reset the amount of time this column will have to wait
	columnDelays[i] = columnDelayers[i]();
}

function drawFrame () {
	// Enforce frame limiter
	if(Date.now() - lastFrameTime < 1000 / options.fpsLimit) {
		console.log("Frame limiter: skipping a frame.");
		return;
	}
	lastFrameTime = Date.now();

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
			var x = Math.floor(options.fontSize * col * 0.75);
			var y;

			if(halfSteps[col]) {
				y = options.fontSize * (row - (options.numRowsToFall / 2));
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
		obj.dropsRemaining--;

		obj.y++;
		if(obj.dropsRemaining === 0 || obj.y >= height) {
			drops.splice(i, 1);
		}

		var c = randChar();
		columns[obj.x][obj.y] = c;
		context.fillText(c, Math.floor(options.fontSize * obj.x * 0.75), options.fontSize * obj.y);
		context.fillText(c, Math.floor(options.fontSize * obj.x * 0.75), (options.fontSize * obj.y)+1);
		context.fillText(c, Math.floor(options.fontSize * obj.x * 0.75)+1, options.fontSize * obj.y);
		context.fillText(c, Math.floor(options.fontSize * obj.x * 0.75)+1, (options.fontSize * obj.y)+1);
	}
}