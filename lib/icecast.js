var fetch = require('node-fetch');
//var urlParser = require('url');
var utils = require('./utils.js');

function getIcecastStation(url, callback) {
	// take the url, remove the last part like "/stream" and add "/status-json.xsl"
	var icecastJsonUrl = url.replace(/\/[^\/]*$/, '/status-json.xsl');

	// fetch the url
	fetch(icecastJsonUrl, { timeout: 1500 })
		.then(res => {
			if (res.status !== 200) return callback(new Error('HTTP error.'));
			return res.text();
		})
		.then(body => {
			parseIcecastResponse(url, body, callback);
		})
		.catch(error => {
			return callback(error);
		});
}

function parseIcecastResponse(url, body, callback) {
	try {
		var stationObject = JSON.parse(body);
	} catch (error) {return callback(error);}
	if (!stationObject.icestats || !stationObject.icestats.source || stationObject.icestats.source.length === 0) return callback(new Error('Unable to determine current station information.'));

	// Find the source that matches the url
	var sources = stationObject.icestats.source;
	for (var i = 0, mountCount = sources.length; i < mountCount; i++) {
		var source = sources[i];
		// If the source url matches the url we are looking for, return the station info
		// keep only the /stream part of the url
		if (source.listenurl.slice('/')[source.listenurl.slice('/').length - 1] == url.slice('/')[url.slice('/').length - 1]) {
			// look, we found the station!
			var station = {};
			station.listeners = source.listeners;
			station.bitrate = source.bitrate;
			station.title = utils.fixTrackTitle(source.title);
			station.fetchsource = 'ICECAST';
			// return the station info
			return callback(null, station);
		}
	}

	return callback(new Error('Unable to determine current station information.'));
}

module.exports.parseIcecastResponse = parseIcecastResponse;
module.exports.getIcecastStation = getIcecastStation;
