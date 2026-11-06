// After Parcel: copy public/ (files served at fixed URLs) into dist/, and write sitemap.xml from content/.
import { cp, readFile, writeFile } from 'node:fs/promises';
import content from '../lib/content.js';

const root = new URL('../', import.meta.url);
const site = JSON.parse(await readFile(new URL('src/data/site.json', root), 'utf8'));

await cp(new URL('public/', root), new URL('dist/', root), { recursive: true, filter: (src) => !src.endsWith('.DS_Store') });

const urls = content
  .readAllPages()
  .filter((p) => p.sitemap !== false)
  .map((p) => `  <url><loc>${site.url}${p.path}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`);
await writeFile(
  new URL('dist/sitemap.xml', root),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);
console.log(`sitemap.xml: ${urls.length} pages`);
