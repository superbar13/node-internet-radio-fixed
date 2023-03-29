// fixing the title of the track
function fixTrackTitle(trackString) {
  try {
    // if the trackString has a comma and "The" in it, we need to fix it
    if (trackString.split(",").length > 1 && trackString.indexOf(", The -") !== -1) {
      // get the artist and song with the split
      var titleArtist = trackString.split(",")[0];
      var titleSong = trackString.split(",")[1];

      // Fix the "The" issue
      titleSong = trackString.split(",")[1].split(" - ")[1];
      titleArtist = "The " + titleArtist;

      // return the fixed title
      return titleArtist + " - " + titleSong;
    } else {
      // else just return the trackString
      return trackString;
    }
  } catch (error) {return trackString;}
}

module.exports.fixTrackTitle = fixTrackTitle;
