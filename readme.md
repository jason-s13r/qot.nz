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

In a site's folder:

```sh
pnpm dev        # dev server with reload
pnpm build      # production build into dist/
pnpm preview    # serve dist/ with wrangler, the same way Cloudflare does
```

## How each site is laid out

### `www/` (qot.nz)

- `src/pages/` has one Pug file per page. The output path follows the file: `src/pages/games/fuse.pug` becomes `/games/fuse`.
- `src/layout/page.pug` is the shared shell, and `src/layout/mixins.pug` holds the game cards, hero, "All games" list and screenshots.
- `src/data/games.json` lists every game in display order. The home page shelf, the "All games" list on each game page, the fonts and the sitemap all come from it. `src/data/site.json` has the site-wide links and the sitemap dates for the other pages.
- `public/` is copied into `dist/` unchanged, for files that need fixed URLs (`ads.txt`, `robots.txt`, `/favicon.ico`, the Tessera share image).
- `scripts/postbuild.mjs` copies `public/` and writes `sitemap.xml`.

To add a game: add it to `games.json`, add `src/pages/games/<slug>.pug` (copy an existing one), and put its screenshot in `src/images/`.

### `juice-factory/` and `fuse/`

- `src/game/` is the game logic: plain TypeScript with no DOM, covered by the `*.test.ts` files beside it.
- `src/ui/` holds the DOM code, and `src/main.ts` wires the two together.
- `public/` is copied as-is (robots, sitemap, and for Fuse its fonts, icons and `_headers`).

Save data lives in `localStorage` (`juice-factory-v2` and `fuse0xac.v1`). Changing what's stored needs a migration; see `juice-factory/src/game/state.ts`.

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
