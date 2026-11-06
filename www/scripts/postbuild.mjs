// After Parcel: copy public/ (files served at fixed URLs) into dist/, and write sitemap.xml from the data files.
import { cp, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const site = await json('src/data/site.json');
const games = await json('src/data/games.json');

await cp(new URL('public/', root), new URL('dist/', root), { recursive: true, filter: (src) => !src.endsWith('.DS_Store') });

const [home, ...rest] = site.pages;
const urls = [home, ...games.map((g) => ({ path: `/games/${g.slug}`, lastmod: g.lastmod })), ...rest].map(
  (p) => `  <url><loc>${site.url}${p.path}</loc><lastmod>${p.lastmod}</lastmod></url>`,
);
await writeFile(
  new URL('dist/sitemap.xml', root),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);
console.log(`sitemap.xml: ${urls.length} pages`);
