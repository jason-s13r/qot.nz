# qot.nz

Source for [Qot. games](https://qot.nz/) and two of its games. Each top-level folder is a site on its own subdomain of qot.nz, deployed as a Cloudflare Worker serving static assets.

| Folder | Site | Built with | Worker |
|---|---|---|---|
| [`www/`](www) | [qot.nz](https://qot.nz/) | Parcel + Pug | `qot-site` |
| [`juice-factory/`](juice-factory) | [juice-factory.qot.nz](https://juice-factory.qot.nz/) | Vite + TypeScript | `juice-factory` |
| [`fuse/`](fuse) | [fuse.qot.nz](https://fuse.qot.nz/) | Vite + TypeScript | `fuse-0xac` |
| [`puzzle/`](puzzle) | [puzzle.qot.nz](https://puzzle.qot.nz/) | static, no build | `picture-puzzle` |

`vending/` is an older experiment and isn't deployed from here.

## Getting started

Needs Node 22+ and pnpm (the version is pinned in `package.json`; `corepack enable` picks it up).

```sh
pnpm install
pnpm test       # unit tests for both games
pnpm build      # builds every site into its dist/
```

## Running a site locally

Two ways, from the repo root:

| | qot.nz | Juice Factory | Fuse | Picture Puzzle |
|---|---|---|---|---|
| Dev server, reloads as you edit | `pnpm dev:www` → localhost:1234 | `pnpm dev:juice` → localhost:5173 | `pnpm dev:fuse` → localhost:5173 | |
| Production build, served like Cloudflare | `pnpm preview:www` | `pnpm preview:juice` | `pnpm preview:fuse` | `pnpm preview:puzzle` |

Preview builds the site and serves `dist/` with `wrangler dev` on localhost:8787. That's how the Worker serves it: `/about` from `about.html`, Fuse's 404 page and `_headers`. Use it to check a site before releasing. In a site's folder, `pnpm dev`, `pnpm build` and `pnpm preview` do the same.

The qot.nz dev server builds pages only; `sitemap.xml` and the files in `public/` appear in the production build. Run two dev servers at once and Vite picks the next free port.

## How each site is laid out

### `www/` (qot.nz)

The words are in markdown under `content/`; the look is in Pug under `src/layout/`.

- `content/` has one markdown file per page, and the output path follows the file: `content/about.md` is `/about`, `content/games/fuse.md` is `/games/fuse`, `content/index.md` is the home page.
- Each file has YAML frontmatter (title, meta description, heading, `lastmod` for the sitemap) and a markdown body.
- A game (`content/games/<slug>.md`) is split by `<!--more-->`:
  - the body before it is the game's card on the home page;
  - the body after it is the game page's article;
  - frontmatter `lede` (and optional `tagline`) is the game page's hero, and `short` is its card in "All games" under every game page;
  - frontmatter also holds the card colours (`card`, `tone`, `fonts`), `chips`, `host`, `order` on the shelf, the `screenshot`, and optional `share` image tags.
- What's new is built from `content/updates/<slug>.md`, one file per update, each with its own page at `/updates/<slug>`. Frontmatter has the `title`, `date` (sorts the list, newest first, grouped by month) and `description`; the body's first paragraph is what the list shows. To post an update, add a file there.
- Links off qot.nz open in a new tab automatically. Definition lists (`term` then `: definition`) and `{.class}` attributes are supported.
- `src/layout/` has `base.pug` (the shell), one layout per kind of page (`home`, `game`, `update`, `updates`, `page`; picked by folder, or `layout:` in the frontmatter) and `mixins.pug`. `src/styles/site.css` and `src/images/` hold the styles and images.
- `parcel/markdown.transformer.js` turns each markdown page into Pug for its layout; `lib/content.js` reads the markdown.
- `public/` is copied into `dist/` unchanged, for files that need fixed URLs (`ads.txt`, `robots.txt`, `/favicon.ico`, the Tessera share image). `scripts/postbuild.mjs` copies it and writes `sitemap.xml`.

To add a game: copy a file in `content/games/`, change the frontmatter and text, and put its screenshot in `src/images/`. It appears on the home page, in every "All games" list and in the sitemap.

### `juice-factory/` and `fuse/`

- `src/game/` is the game logic: plain TypeScript with no DOM, covered by the `*.test.ts` files beside it.
- `src/ui/` holds the DOM code, and `src/main.ts` wires the two together.
- `public/` is copied as-is (robots, sitemap, and for Fuse its fonts, icons and `_headers`).

Save data lives in `localStorage` (`juice-factory-v2` and `fuse0xac.v1`). Changing what's stored needs a migration; see `juice-factory/src/game/state.ts`.

### `puzzle/`

A single static page, served as it is.

## Deploying

Each site deploys from its own branch, which always points at the commit on `main` that's live on that site:

| Site | Branch | Worker |
|---|---|---|
| `www/` | `cf-www` | `qot-site` |
| `juice-factory/` | `cf-juice-factory` | `juice-factory` |
| `fuse/` | `cf-fuse-0xac` | `fuse-0xac` |
| `puzzle/` | `cf-picture-puzzle` | `picture-puzzle` |

Pushing to `main` deploys nothing. To release, run the **Release** workflow (Actions → Release → Run workflow). For each site it compares the site's folder and the shared root files (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.node-version`) between `main` and the site's branch. Each site with changes is then tested and built, and if that passes its branch moves to `main`. A site that fails keeps its branch where it was, and the other sites still release. The run summary lists which sites were released and why. To release a site with no changes, name it in the **force** input (`www`, `juice-factory`, `fuse`, `puzzle`, or `all`).

Cloudflare Workers Builds then deploys each Worker from its branch. Each Worker's Settings → Build has:

| Setting | Value |
|---|---|
| Git branch (production) | `cf-www`, `cf-juice-factory`, `cf-fuse-0xac` or `cf-picture-puzzle` |
| Root directory | `www`, `juice-factory`, `fuse` or `puzzle` |
| Build command | `pnpm install --frozen-lockfile && pnpm build` (empty for `puzzle`) |
| Deploy command | `npx wrangler deploy` |
| Builds for non-production branches | off |

Routes and custom domains for the first three sites are set in the Cloudflare dashboard. `puzzle/wrangler.jsonc` sets puzzle.qot.nz itself, so its first deploy creates the custom domain.

To deploy by hand: `pnpm build && npx wrangler deploy` in the site's folder.
