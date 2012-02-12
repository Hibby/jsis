var Utils = require('../../classes/Utils.js');
var XDate = require('../../lib/xdate.dev.js');
var Logger = require('../../classes/Logger.js');

/**
 * Parse eggdrop log string into the LogData object
 * @param {LogData} logData
 */
var EggdropReader = function(logData) {

	/**
	 * @type {LogData}
	 */
	this.logData = logData;

	/**
	 * Read a single line
	 */
	this.readLine = function() {

		// If we no-longer have a log string, fail
		if( typeof this.logString!=='string' ) {
			return false;
		}

		/**
		 * Resulting line
		 * @type {String}
		 */
		var result;

		// Try and find a linefeed
		var nextPos = this.logString.indexOf("\n");

		// If the string has a linefeed somewhere
		if( nextPos!==-1 ) {

			// Get the contents until that feed
			result = this.logString.substr(0, nextPos);

			// And remove it from the start of the source
			this.logString = this.logString.substr(nextPos+1);

		// If not, we must be at the last line, or past it
		} else {

			result = this.logString;
			this.logString = null;
		}

		// Logger.log('DEBUG', 'Read line ' + JSON.stringify(result) );

		return result;
	};

	// Regular expression string to match (and select) the timestamp on the line
	var timeRegExpString = '\\[([0-9]{2}:[0-9]{2})\\]';

	// .. and the nickname
	var nicknameRegExpString = '\<([^>]+)\>';

	// RegExp to match a line that reports a new date and select the date
	var dateRegExpString = '([a-z]{3} +[a-z]{3} +[0-9]{1,2} +[0-9]{4})';
	var dateRegExp = new RegExp('^' + timeRegExpString + ' --- ' + dateRegExpString + '$', 'i');

	// RegExp to match a normal line and an action
	var lineRegExp = new RegExp('^' + timeRegExpString + ' ' + nicknameRegExpString + ' (.*)');
	var actionRegExp = new RegExp('^' + timeRegExpString + ' Action: ([^ ]+) (.*)$');

	// RegExp to match a mode change
	var modeRegExp = new RegExp('^' + timeRegExpString + ' [^:]+: mode change \'([^\']+)\' by ([^!]+)!(.*)$');

	// RegExp to match a join or part
	var joinPartRegExp = new RegExp('^' + timeRegExpString + ' ([^ ]+) \\(([^)]+)\\) (joined|left) ');

	// RegExp to match kicks
	var kickRegExp = new RegExp('^' + timeRegExpString + ' ([^ ]+) kicked from [^ ]+ by ([^:]+): (.*)$');

	// RegExp to match topic changes
	var topicRegExp = new RegExp('^' + timeRegExpString + ' Topic changed on [^ ]+ by ([^!]+)!([^:]+): (.*)$');

	// RegExp to extract necessary data off a line
	var date = new XDate();
	this.currentDate = date.toString('ddd MMM dd yyyy');
	this.tzData = 'GMT'+date.toString('zzz');

	/**
	 * Parse a log buffer's contents, save data into our LogData object
	 * @param logBuffer {Buffer}
	 */
	this.parse = function(logBuffer) {

		// We were given a buffer, buffers are dull, and difficult to work with, so let's just take a string representation of it
		var logString = logBuffer.toString();

		// Trim the string, extra linefeeds and such, then save it for use in readLine()
		this.logString = Utils.trim( logString );

		/**
		 * Build the timestamp for a line from the time string, e.g. "14:56"
		 */
		var lineTimeStamp = function(timestring) {
			return new XDate(this.currentDate + ' ' +timestring + ':00 ' + this.tzData);
		}.bind(this);

		// Read all lines, line by line
		var line, data;
		var lineNumber = 0;
		while( line = this.readLine() ) {

			lineNumber++;

			// Does this line tell us a new date?
			if( data = line.match(dateRegExp) ) {

//				Logger.log('DEBUG', 'Line ' + lineNumber + ' seems to contain a new date: ' + data[2]);


				// Update the current date with the first selection's result
				this.currentDate = data[2].replace(' +', ' ');

			// Is this a line?
			} else if( data = line.match( lineRegExp ) ) {

				// Logger.log('INFO', 'Line ' + lineNumber + ' seems to be someone talking: ' + JSON.stringify(data));


				// Give our data to the LogData object
				logData.addLine( lineTimeStamp(data[1]), /* user */ data[2], /* and the text */ data[3], false);

			} else if( data = line.match(actionRegExp) ) {

				logData.addLine( lineTimeStamp(data[1]), /* user */ data[2], /* and the text */ data[3], true);

			} else if( data = line.match(modeRegExp) ) {

				// This is one of those lines that reveal the users' full hostmask, let's make sure we save that data
				logData.registerUserHostmask(data[3], data[4]);

				// Logger.log('INFO', 'Line ' + lineNumber + ' seems to be a mode change: ' + JSON.stringify(data));

				logData.addMode( lineTimeStamp(data[1]), data[2], data[3] );

			} else if( data = line.match(joinPartRegExp) ) {

				// This is one of those lines that reveal the users' full hostmask, let's make sure we save that data
				logData.registerUserHostmask(data[2], data[3]);

				// Register a join or part depending on which this is
				if( data[4]==='joined' ) {
					logData.addJoin( data[2] );
				} else {
					logData.addPart( data[2] );
				}

				// Logger.log('WARNING', 'Line ' + lineNumber + ' was not recognized: "' + line + '"')
			} else if( data = line.match(kickRegExp) ) {

				logData.addKick( data[2], data[3], data[4] );

			} else if( data = line.match(topicRegExp) ) {

				// This is one of those lines that reveal the users' full hostmask, let's make sure we save that data
				logData.registerUserHostmask(data[2], data[3]);

				logData.addTopic( lineTimeStamp(data[1]), data[2], data[4]);

			} else {

				// Unrecognized line, e.g. netsplit, return from netsplit, etc.

			}
		}
	}

};

// All we want to export is our little class
module.exports = EggdropReader;
