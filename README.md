# wGB◇ storefront (static, GitHub Pages)

Everything is static: no server to keep running.

| What | Where | Edited by |
| --- | --- | --- |
| Products (name, price, photos, description) | `products.json` + `images/` | the Telegram bot (`export_products.py` + `git push`, automatic) |
| All page content (headline, text, colors, footer, labels, section toggles, price filters, per-product hide/feature/order) | `site.json` | the web admin at `/admin/` (or by hand) |
| Page template | `assets/render.js` (renders the page in the browser from `site.json` + `products.json`) | developers |
| Cart + product popup | `assets/app.js`, `assets/style.css` | developers |
| `index.html` | tiny shell. Only the `<head>` block between `<!--wgb:head-->` markers is generated | `export_products.py` / admin Publish |

## Admin panel
`https://yesirfa-sudo.github.io/wgb-site/admin/` signs in with a fine-grained GitHub token (repo `wgb-site` only, Contents read/write). The page explains how to create it. The token is kept only in that browser's localStorage and is never committed. Publish writes `site.json` (and refreshes the `<head>` block in `index.html`) through the GitHub contents API; GitHub Pages redeploys in about a minute.

## Bot sync
`python3 export_products.py` reads the bot's SQLite catalog, writes `products.json` + `images/`, and regenerates the `index.html` shell from `site.json`. It never writes `site.json`, so catalog syncs cannot overwrite admin edits. The bot's sync runs `git pull --rebase` before exporting so it also never overwrites admin commits.

Orders go to the Telegram link in `site.json` (`telegram`).
