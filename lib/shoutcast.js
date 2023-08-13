var fetch = require('node-fetch');
var parseXmlString = require('xml2js').parseString;
var urlParser = require('url');
var utils = require('./utils.js');

// Shoutcast v1
function getShoutcastV1Station(url, callback) {
	url = url + '/7.html';
	
	// fetch the url
	fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.13) Gecko/20080311 Firefox/2.0.0.13' } })
		.then(res => {
			if (res.status !== 200) return callback(new Error('HTTP error.'));
			if (res.headers.get('content-type') != 'text/html') {
				res.abort();
				return callback(new Error('Not valid metadata'));
			}
			return res.text();
		})
		.then(body => {
			parseV1Response(body, callback);
		})
		.catch(error => {
			return callback(error);
		});
}

// Shoutcast v2
function getShoutcastV2Station(url, callback) {
	var urlObject = urlParser.parse(url);
	var v2StatsUrl = urlObject.protocol + '//' + urlObject.hostname + ':' + urlObject.port ? urlObject.port : 80 + '/stats?sid=1';

	// fetch the url
	fetch(v2StatsUrl, { timeout: 1500 })
		.then(res => {
			if (res.status !== 200) return callback(new Error('HTTP error.'));
			return res.text();
		})
		.then(body => {
			parseV2Response(url, body, callback);
		})
		.catch(error => {
			return callback(error);
		});
}

// Parse the response from a Shoutcast v1 server
function parseV1Response(body, callback) {
	// The response is a CSV array, so we need to parse it
	var csvArrayParsing = /<body>(.*)<\/body>/im.exec(body);

	// If the response is not a CSV array, return an error
	if (!csvArrayParsing || typeof csvArrayParsing.length !== 'number') return callback(null, null);

	// Split the CSV array into an array
	var csvArray = csvArrayParsing[1].split(',');
	var title = undefined;

	// If the array is 7 elements long, the title is the 6th element
	if (csvArray && csvArray.length == 7) title = csvArray[6];
	// if it is not, we get all the elements after the 6th and join them with a comma
	else title = utils.fixTrackTitle(csvArray.slice(6).join(','));

	if (title) {
		// look, we found the station!
		var station = {};
		station.listeners = csvArray[0];
		station.bitrate = csvArray[5];
		station.title = title;
		station.fetchsource = 'SHOUTCAST_V1';

		return callback(null, station);
	} else {
		return callback(new Error('Unable to determine current station information.'));
	}
}

function parseV2Response(url, body, callback) {
	parseXmlString(body, function(error, result) {
		if (error) return callback(error);

		var numberOfStreamsAvailable = result.SHOUTCASTSERVER.STREAMSTATS[0].STREAM.length;
		var stationStats = null;

		if (numberOfStreamsAvailable === 1) stationStats = result.SHOUTCASTSERVER.STREAMSTATS[0].STREAM[0];
		else {
			// Find the stream that matches the url
			var streams = result.SHOUTCASTSERVER.STREAMSTATS[0].STREAM;
			for (var i = 0, mountCount = streams.length; i < mountCount; i++) {
				var stream = streams[i];
				var streamUrl = stream.SERVERURL[0];
				// look, we found the stream ! :)
				if (streamUrl == url) stationStats = stream;
			}
		}

		// If we have a station, return it
		if (!error && stationStats != null && stationStats.SONGTITLE) {
			// create a station object
			var station = {};
			station.listeners = stationStats.CURRENTLISTENERS[0];
			station.bitrate = stationStats.BITRATE[0];
			station.title = utils.fixTrackTitle(stationStats.SONGTITLE[0]);
			station.fetchsource = 'SHOUTCAST_V2';

			return callback(null, station);

			// else return an error
		} else return callback(error);
	});
}

module.exports.parseV1Response = parseV1Response;
module.exports.parseV2Response = parseV2Response;
module.exports.getShoutcastV1Station = getShoutcastV1Station;
module.exports.getShoutcastV2Station = getShoutcastV2Station;
