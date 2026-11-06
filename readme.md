each top-level dir is intended as a sub-domain of .qot.nz

## Deploying

Three folders are the source of truth for Cloudflare Workers (static assets only), each deployed by Workers Builds from `main`:

| Folder | Worker | Domain |
|---|---|---|
| `www/` | `qot-site` | qot.nz |
| `juice-factory/` | `juice-factory` | juice-factory.qot.nz |
| `fuse/` | `fuse-0xac` | fuse.qot.nz |

Each folder has its own `wrangler.jsonc` (and `.assetsignore` to keep config out of the upload). In each Worker's Settings → Build: root directory is the folder, build command is empty, deploy command is `npx wrangler deploy`, and build watch paths are `<folder>/*`.

Routes and custom domains stay in the dashboard; the configs don't set them.

Manual deploy: `cd <folder> && npx wrangler deploy`.

`puzzle/` and `vending/` aren't deployed from here yet.
