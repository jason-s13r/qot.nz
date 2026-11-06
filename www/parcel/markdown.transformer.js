// Turns a content/*.md page into Pug that includes its layout from src/layout/, with the page
// (`doc`), every game (`games`) and every update (`updates`, newest first) available to the template. Parcel's Pug transformer takes it
// from there, so the output keeps the markdown file's path: content/games/fuse.md → games/fuse.html.

const path = require('node:path');
const { Transformer } = require('@parcel/plugin');
const content = require('../lib/content');

module.exports = new Transformer({
  async transform({ asset }) {
    const doc = content.readDoc(asset.filePath);
    const games = content.readGames();
    const updates = content.readUpdates();

    // A page can list games and updates, so any of those files changing (or being added) rebuilds it.
    for (const f of [...content.gameFiles(), ...content.updateFiles()]) asset.invalidateOnFileChange(f);
    asset.invalidateOnFileCreate({ glob: path.join(content.gamesDir, '*.md') });
    asset.invalidateOnFileCreate({ glob: path.join(content.updatesDir, '*.md') });
    asset.invalidateOnFileChange(path.join(__dirname, '../lib/content.js'));

    const layout = path.join(content.root, 'src/layout', `${doc.layout}.pug`);
    const include = path.relative(path.dirname(asset.filePath), layout).split(path.sep).join('/');
    asset.type = 'pug';
    asset.setCode(`- var doc = ${JSON.stringify(doc)}\n- var games = ${JSON.stringify(games)}\n- var updates = ${JSON.stringify(updates)}\ninclude ${include}\n`);
    return [asset];
  },
});
