var icecast = require('./lib/icecast.js');
var shoutcast = require('./lib/shoutcast.js');
var icystream = require('./lib/icystream.js');

var StreamSource = {
	SHOUTCAST_V1: 'SHOUTCAST_V1',
	SHOUTCAST_V2: 'SHOUTCAST_V2',
	STREAM: 'STREAM',
	ICECAST: 'ICECAST'
};

function getStationInfo(url, callback, method) {
	var methodHandler = undefined;

	switch (method) {
		case StreamSource.SHOUTCAST_V1:
			methodHandler = shoutcast.getShoutcastV1Station;
			break;
		case StreamSource.SHOUTCAST_V2:
			methodHandler = shoutcast.getShoutcastV2Station;
			break;
		case StreamSource.ICECAST:
			methodHandler = icecast.getIcecastStation;
			break;
		case StreamSource.STREAM:
			methodHandler = icystream.getStreamStation;
			break;
		default:
	}

	// If we have a specific method to fetch from then
	// attempt only that.
	if (methodHandler) return methodHandler(url, callback);

	// Resolve the promise from the async function and return the station with the callback
	// We shouldnt mix callbacks and promises but for backwards compatability I am breaking
	// the law here......
	return findStation().then(function(station) {
		callback(null, station);
	}).catch(function(error) {
		callback(error);
	});

	/*
	@params -> string: url of given stream
	@returns -> mixed (object if successful, string if error)
	*/
	function findStation() {
		// Try to get the station info from the various sources
		this.results = undefined;

		// Try to get the station info from the various sources
		if (!this.results) try{shoutcast.getShoutcastV1Station(url, function(err, station) {this.results = station;});}catch(e){}
		if (!this.results) try{shoutcast.getShoutcastV2Station(url, function(err, station) {this.results = station;});}catch(e){}
		if (!this.results) try{icecast.getIcecastStation(url, function(err, station) {this.results = station;});}catch(e){}
		if (!this.results) try{icystream.getStreamStation(url, function(err, station) {this.results = station;});}catch(e){}

		// If we have a result, return it
		if (this.results) return this.results;
		// Else return an error
		else return new Error('Unable to determine current station information.');
	}
}

module.exports.StreamSource = StreamSource;
module.exports.getStationInfo = getStationInfo;