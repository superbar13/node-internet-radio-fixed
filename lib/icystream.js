var urlParser = require('url');
const tls = require('tls');
const net = require('net');
var utils = require('./utils.js');

var packageJson = require('../package.json');
var versionNumber = packageJson.version;
var clientName = 'node-internet-radio v' + versionNumber;

// Here we get the stream data from the stream url
function getStreamStation(url, callback, teardownWhenDone) {
	if (teardownWhenDone === undefined) teardownWhenDone = true;

	var urlString = url;
	var completed = false;
	var buffer = '';
	var maxBufferSize = 100000;

	// Failure timer (to prevent waiting forever, forever is very long, like infinity)
	if (teardownWhenDone) {
		var timeout = setTimeout(function() {
			tearDown();
			return callback(new Error('Attempting to fetch station data via stream timed out.'));
		}, 5000);
	}

	// parse the url and create the headers for the request
	var url = urlParser.parse(url);
	var headers = 'Icy-Metadata: 1\r\nUser-Agent: ' + clientName + '\r\nhost: ' + url.hostname + '\r\n';

	// Support HTTP Basic auth via Username:Password@host url syntax
	if (url.auth) {
		var encodedAuth = Buffer.from(url.auth).toString('base64');
		headers += 'Authorization: Basic ' + encodedAuth + '\r\n';
	}

	// string to get stream data
	var getString = 'GET ' + url.path + ' HTTP/1.0\r\n' + headers + '\r\n\r\n';

	// support for http and https
	// we create the client here and connect to the server
	if (url.protocol === 'http:') {
		var port = url.port || 80;
		
		var client = new net.Socket();
		client.setTimeout(5);
		client.setEncoding('utf8');
		client.connect(port, url.hostname, function() {
			client.write(getString);
		});
	} else if (url.protocol === 'https:') {
		var port = url.port || 443;
		var client = tls.connect(
			port, // port
			url.hostname, // host
			{
				servername: url.hostname
			}, // options
			function() { client.write(getString); } // callback
		);
	} else {
		const error = new Error('Unknown protocol: ' + url.protocol + '. Unable to fetch stream.');
		return errorCallback(error);
	}

	// function to handle the buffer
	// when there are data
	let interval = null;
	if(teardownWhenDone) client.on('data', dataCallback);
	else {
		let dataCallBacked = null;
		client.on('data', function(response) {
			dataCallBacked = response;
		});
		// each 100ms check if we have data
		interval = setInterval(function() {
			if(dataCallBacked) dataCallback(dataCallBacked);
		}, 100);
	}
	// when there are errors
	client.on('error', errorCallback);
	// when the connection is closed
	client.on('close', closeCallback);

	// function to handle the buffer
	function dataCallback(response) {
		const responseString = response.toString();

		// Append to the buffer and check if our title is fully included yet
		// We're looking for a string with the format of
		// StreamTitle=Artist Name - Song Name;
		buffer += responseString;

		var titlecheck = getDetailsFromBuffer(buffer); // check if we have the title in the buffer
		if (titlecheck != null) {
			// oh look, we found the title, let's handle it
			handleBuffer(buffer, callback); // handle the buffer
			if(teardownWhenDone) tearDown(); // tear down the connection
			return;
		}

		if (buffer.length > maxBufferSize) return returnError();
	}

	// function to handle errors in the buffer
	// this function will return the error and tear down the connection
	function errorCallback(error) {
		if (completed) return;
		tearDown();
		console.trace(error);
		return callback(error);
	}

	// function to close the callback (tear down the connection and if there are errors, return them)
	function closeCallback() {
		var redirectUrl = handleRedirect(buffer);

		if (redirectUrl) {
			if(teardownWhenDone) tearDown();
			return getStreamStation(redirectUrl, callback);
		}

		if (areThereErrors(buffer)) return returnError();

		if (completed) return;
	}

	// function to tear down the connection (close it)
	function tearDown() {
		clearTimeout(timeout);

		if(interval) clearInterval(interval);

		completed = true;
		buffer = null;

		if (client != null) {
			client.destroy();
			client = null;
		}
	}

	// function to get details from buffer
	function getDetailsFromBuffer(buffer) {
		var startSubstring = 'StreamTitle=';
		var startPosition = buffer.indexOf(startSubstring);
		var endPosition = buffer.toString().indexOf(';', startPosition);
		if (startPosition > -1 && endPosition > startPosition) {
			var titleString = buffer.substring(startPosition, endPosition);
			var title = titleString.substring(13, titleString.length - 1);
			return title;
		}
		return null;
	}

	// function to get headers from buffer
	function getHeadersFromBuffer(buffer) {
		var headersArray = buffer.split('\n');
		var headersObject = {};

		headersArray
			.filter(function(line) {
				return (
					(line.indexOf('icy') !== -1 && line.indexOf(':') !== -1)
					||
					line.toLowerCase().indexOf('content-type') !== -1
				);
			})
			.forEach(function(line) {
				var keyValueArray = line.trim().split(":");
				if (keyValueArray.length === 2) headersObject[keyValueArray[0].toLowerCase()] = keyValueArray[1].trim();
			});

		return headersObject;
	}

	// function to handle buffer
	function handleBuffer(buffer, callback) {
		// so we get the title from the buffer
		var title = getDetailsFromBuffer(buffer);
		title = utils.fixTrackTitle(title);

		// and we get the headers from the buffer
		var headers = getHeadersFromBuffer(buffer);

		// we create a station object	and return it, yay!
		var station = {};
		station.title = title;
		station.fetchsource = 'STREAM';
		station.headers = headers;

		return callback(null, station);
	}

	// function to handle redirect
	function handleRedirect(buffer) {
		var redirectTest = /Location: (.*)/mi.exec(buffer); // check if there is a redirect
		if (redirectTest) {
			// Redirect!
			var newUrl = redirectTest[1]; // get the new url
			// if the new url is the same as the old one, we have a redirect loop
			if (newUrl === urlString) { // 
				const error = new Error('Redirect loop detected. ' + urlString + ' -> ' + newUrl);
				// so we return the error and tear down the connection
				return errorCallback(error);
			}
			return newUrl; // yay, we have a new url
		}
		return false; // no redirect
	}

	// function to check if there are errors
	function areThereErrors(buffer) {
		// If we get back HTML there's a problem
		var contentTypeTest = /Content-Type: text\/html(.*)/m.exec(buffer); // check if the content type is html
		if (contentTypeTest) return true; // we have an error
		return false; // no errors
	}

	// function to return error
	function returnError() {
		if(teardownWhenDone) tearDown();
		return callback(new Error('Error fetching stream'));
	}
}

module.exports.getStreamStation = getStreamStation;