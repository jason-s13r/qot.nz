// Data and helpers available in every Pug template.
const site = require('./src/data/site.json');
const games = require('./src/data/games.json');

/** Google Fonts URL for the site's base fonts plus `extra` families. */
function fontsHref(extra = []) {
  const families = [...new Set([...site.baseFonts, ...extra])];
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`;
}

module.exports = {
  locals: {
    site,
    games,
    fontsHref,
    gameBySlug: (slug) => games.find((g) => g.slug === slug),
    allGameFonts: games.flatMap((g) => g.fonts),
  },
};
