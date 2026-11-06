// Screenshots linked from game pages (<a href="….jpg">) need stable names. Parcel would put them
// at up_/images/…; this keeps them at /games/img/<name>, where they've always been.
const { Namer } = require('@parcel/plugin');
const path = require('node:path');

module.exports = new Namer({
  name({ bundle }) {
    const entry = bundle.getMainEntry();
    if (!bundle.needsStableName || !entry) return null;
    if (!entry.filePath.includes(`${path.sep}src${path.sep}images${path.sep}`)) return null;
    return `games/img/${path.basename(entry.filePath)}`;
  },
});
