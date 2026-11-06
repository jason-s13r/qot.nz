// Site-wide data and helpers for the Pug layouts. Page content comes from content/ (see lib/content.js).
const site = require('./src/data/site.json');

/** Google Fonts URL for the site's base fonts plus `extra` families. */
function fontsHref(extra = []) {
  const families = [...new Set([...site.baseFonts, ...extra])];
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`;
}

module.exports = { locals: { site, fontsHref } };
