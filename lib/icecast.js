var request = require('request');
var urlParser = require('url');
var utils = require('./utils.js');

function getIcecastStation(url, callback) {
  var urlObject = urlParser.parse(url);
  var icecastJsonUrl =
    urlObject.protocol +
    '//' +
    urlObject.hostname +
    ':' +
    urlObject.port +
    '/status-json.xsl';

  var res = request(
    { url: icecastJsonUrl }, // options
    { timeout: 1500 }, // timeout
    function(error, response, body) {
      if (error) {
        return callback(error);
      }

      if (response.statusCode !== 200) {
        return callback(new Error('HTTP error.'));
      }

      res.on('error', function(error) {
        res.abort();
        return callback(error);
      });

      parseIcecastResponse(url, body, callback);
    } // callback
  );

  res.on('response', function(response) {
    var contentType = response.headers['content-type'];
    if (contentType != 'text/xml') {
      res.abort();
      return callback(new Error('Not valid metadata'));
    }
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
    if (source.listenurl === url) {
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
