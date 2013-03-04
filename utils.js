// Swap two entries in an array
Array.prototype.swap = function (one, two) {
	var tmp = this[one];
	this[one] = this[two];
	this[two] = tmp;
}

// Generate a random integer in [low, high]
function randInt (low, high) {
	return Math.floor(Math.random() * (high - low + 1)) + low;
}

// Returns a random character in [A-Za-z0-9]
function randChar () {
	var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	return letters.substr(randInt(0, letters.length-1), 1);
}