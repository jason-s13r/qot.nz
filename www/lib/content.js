// Reads the markdown in content/: frontmatter, plus a body split at <!--more-->.
// Used by the Parcel transformer (to render pages) and postbuild (for the sitemap).

const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const MarkdownIt = require('markdown-it');

const root = path.join(__dirname, '..');
const contentDir = path.join(root, 'content');
const gamesDir = path.join(contentDir, 'games');
const updatesDir = path.join(contentDir, 'updates');

const md = new MarkdownIt({ html: true }).use(require('markdown-it-deflist')).use(require('markdown-it-attrs'));

// Links off qot.nz open in a new tab.
const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, i, opts, env, self) => self.renderToken(tokens, i, opts));
md.renderer.rules.link_open = (tokens, i, opts, env, self) => {
  const href = tokens[i].attrGet('href') ?? '';
  const host = /^https?:\/\/([^/]+)/.exec(href)?.[1];
  if (host && host !== 'qot.nz' && !host.endsWith('.qot.nz')) {
    tokens[i].attrSet('target', '_blank');
    tokens[i].attrSet('rel', 'noopener');
  }
  return defaultLinkOpen(tokens, i, opts, env, self);
};

const render = (text) => (text ? md.render(text).trim() : '');
const renderInline = (text) => (text ? md.renderInline(String(text)) : '');

/** Fields that hold inline markdown, rendered to HTML alongside the raw value. */
const INLINE = ['heading', 'tagline', 'lede', 'short'];

/**
 * A page: its frontmatter, `summary` (the body before <!--more-->, used for listing cards) and
 * `html` (the body after it, or all of it when there's no <!--more-->).
 */
function readDoc(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) throw new Error(`${path.relative(root, file)}: missing frontmatter`);
  const data = YAML.parse(m[1]) ?? {};
  const body = text.slice(m[0].length);
  const [before, after] = body.includes('<!--more-->') ? body.split('<!--more-->', 2) : ['', body];

  const rel = path.relative(contentDir, file).replace(/\.md$/, '');
  const doc = {
    ...data,
    slug: path.basename(rel),
    path: rel === 'index' ? '/' : `/${rel}`,
    layout: data.layout ?? (rel === 'index' ? 'home' : rel.startsWith('games/') ? 'game' : rel.startsWith('updates/') ? 'update' : 'page'),
    summary: render(before),
    html: render(after),
  };
  for (const k of INLINE) if (doc[k] != null) doc[`${k}Html`] = renderInline(doc[k]);
  if (doc.date) {
    doc.date = String(doc.date);
    doc.month = new Date(`${doc.date}T00:00:00Z`).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    doc.lastmod ??= doc.date;
  }
  // A one-line version of the listing text, for lists where a paragraph per item is too much.
  const excerpt = (before.trim() || after.trim()).split(/\n\s*\n/)[0];
  doc.excerptHtml = renderInline(excerpt);
  if (doc.screenshot?.caption) doc.screenshot.captionHtml = renderInline(doc.screenshot.caption);
  return doc;
}

const mdFiles = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f)) : [];
const gameFiles = () => mdFiles(gamesDir);
const updateFiles = () => mdFiles(updatesDir);

/** Every game, in `order`. */
function readGames() {
  return gameFiles()
    .map(readDoc)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

/** Every update, newest first. */
function readUpdates() {
  return updateFiles()
    .map(readDoc)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Every page, for the sitemap: home, then games, then the rest by `order`, then updates. */
function readAllPages() {
  const others = fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => readDoc(path.join(contentDir, f)));
  const home = others.filter((d) => d.path === '/');
  const rest = others.filter((d) => d.path !== '/').sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  return [...home, ...readGames(), ...rest, ...readUpdates()];
}

module.exports = { root, contentDir, gamesDir, updatesDir, gameFiles, updateFiles, readDoc, readGames, readUpdates, readAllPages };
