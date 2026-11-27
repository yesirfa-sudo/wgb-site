#!/usr/bin/env python3
"""Export the Telegram bot's catalog to products.json and rebuild the index.html shell (pure static site).

Page content (headline, text, colours, footer ...) lives in site.json and is edited in /admin/; the export only reads it
(for the <head> block) and never overwrites it, so catalog syncs and admin edits do not clash.

Usage:  python3 export_products.py [--db PATH] [--no-samples]
Then:   git add -A && git commit -m "update products" && git push   (GitHub Pages redeploys)

If the catalog has fewer than MIN_PRODUCTS active products, sample products are appended so the
storefront never looks empty (use --no-samples to disable). No secrets are read or written.
"""
import argparse, html, json, os, re, sqlite3, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.environ.get("WGB_DB", "/workspace/wgb-telegram-bot/data/catalog.sqlite3")
MIN_PRODUCTS = 9
SAMPLE_PRICES = [4.99, 9.99, 14.99, 19.99, 24.99, 29.99, 39.99, 49.99, 59.99]
e = html.escape
money = lambda v: "$%.2f" % v

MAX_W = 800          # display size is <= ~760 css px wide at 1x; keeps files ~150-250KB
MAX_RATIO = 1.25     # very tall images are centre-cropped (the site shows a centred "cover" crop anyway)

def optimize(src, dest):
    """Resize + recompress a product image to a web-friendly JPEG at dest."""
    im = Image.open(src).convert("RGB")
    w, h = im.size
    if w > MAX_W:
        im = im.resize((MAX_W, round(h * MAX_W / w)), Image.LANCZOS); w, h = im.size
    if h > w * MAX_RATIO:
        top = (h - round(w * MAX_RATIO)) // 2
        im = im.crop((0, top, w, top + round(w * MAX_RATIO)))
    im.save(dest, "JPEG", quality=80, optimize=True, progressive=True)

def placeholder(i):
    return "placeholders/placeholder-%d.jpg" % ((int(i) - 1) % 7 + 1)

def read_catalog(db):
    if not os.path.exists(db):
        return []
    c = sqlite3.connect(db); c.row_factory = sqlite3.Row
    out = []
    os.makedirs(os.path.join(HERE, "images"), exist_ok=True)
    for r in c.execute("SELECT p.*, c.name AS category FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=1 ORDER BY p.id"):
        imgs = []
        for im in c.execute("SELECT local_path FROM product_images WHERE product_id=? ORDER BY position, id", (r["id"],)):
            lp = im["local_path"]
            if lp and os.path.exists(lp):
                dest = "images/" + os.path.splitext(os.path.basename(lp))[0] + ".jpg"
                optimize(lp, os.path.join(HERE, dest)); imgs.append(dest)
        out.append({"id": "p%d" % r["id"], "name": r["name"], "price": round((r["price_cents"] or 0) / 100, 2),
                    "description": r["description"] or "", "category": r["category"] or "", "images": imgs, "sample": False})
    return out

def samples(start):
    return [{"id": "s%d" % (i + 1), "name": "Sample product %d" % (i + 1), "price": p,
             "description": "Placeholder product. Message us on Telegram to order.", "category": "", "images": [placeholder(start + i)], "sample": True}
            for i, p in enumerate(SAMPLE_PRICES)]

def build_products(db, use_samples):
    prods = read_catalog(db)
    if use_samples and len(prods) < MIN_PRODUCTS:
        prods += samples(len(prods) + 1)[: MIN_PRODUCTS - len(prods)]
    for n, p in enumerate(prods):
        if not p["images"]:
            p["images"] = [placeholder(n + 1)]
    return prods

# ---- page shell -------------------------------------------------------------------------------------
# index.html is a small shell. The page itself (hero, perks, product tiles, footer ...) is rendered in the browser by
# assets/render.js from site.json (content, edited in /admin/) + products.json (catalog, from the bot). Only the <head>
# block between the wgb:head markers is baked here so link previews / first paint use the current title and colours.
# The admin's Publish rewrites the same block with the same code (see tests/ in the admin README), so both stay in sync.

def load_defaults():
    src = open(os.path.join(HERE, "assets", "render.js"), encoding="utf-8").read()
    m = re.search(r"DEFAULTS = (\{.*?\});\n", src, re.S)
    return json.loads(m.group(1))

def merge(base, over):
    if not isinstance(base, dict) or not isinstance(over, dict):
        return base if over is None else over
    out = dict(base)
    for k, v in over.items():
        out[k] = merge(base[k], v) if k in base else v
    return out

def load_site():
    d = load_defaults()
    path = os.path.join(HERE, "site.json")
    if not os.path.exists(path):
        return d
    try:
        with open(path, encoding="utf-8") as f:
            return merge(d, json.load(f))
    except ValueError as ex:  # a broken site.json must never take the store down or block product syncs
        print("WARNING: site.json is not valid JSON (%s); using built-in defaults for the page head" % ex, file=sys.stderr)
        return d

HEX = re.compile(r"^#[0-9a-fA-F]{3,8}$")
def color(site, defaults, key):
    v = str(site["colors"].get(key, "")).strip()
    return v if HEX.match(v) else defaults["colors"][key]

def theme_css(site):
    d = load_defaults(); g = lambda k: color(site, d, k)
    return (":root{--bg:%s;--bg2:%s;--panel:%s;--panel2:%s;--text:%s;--muted:%s;--soft:%s;"
            "--silver:linear-gradient(180deg,%s 0%%,%s 45%%,%s 100%%);--btn:linear-gradient(180deg,%s 0%%,%s 100%%)}"
            % (g("bg"), g("bg2"), g("panel"), g("panel2"), g("text"), g("muted"), g("soft"),
               g("silverTop"), g("silverMid"), g("silverBottom"), g("btnTop"), g("btnBottom")))

def head_block(site):
    d = load_defaults()
    t, de = e(site["seo"]["title"]), e(site["seo"]["description"])
    return ('<!--wgb:head--><title>%s</title><meta name="description" content="%s">'
            '<meta property="og:title" content="%s"><meta property="og:description" content="%s"><meta property="og:type" content="website">'
            '<meta name="theme-color" content="%s"><style id="wgb-theme">%s</style><!--/wgb:head-->'
            % (t, de, t, de, e(color(site, d, "bg")), theme_css(site)))

def page(site):
    return """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="icon" href="favicon.ico" sizes="any">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap">
<link rel="stylesheet" href="assets/style.css">
%s
<script defer data-boot src="assets/render.js"></script></head>
<body>
<noscript><p style="padding:48px 24px;text-align:center;color:#b7bcc8;font-family:sans-serif">This store needs JavaScript. Message us on Telegram to order.</p></noscript>
</body></html>
""" % head_block(site)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DEFAULT_DB); ap.add_argument("--no-samples", action="store_true")
    a = ap.parse_args()
    prods = build_products(a.db, not a.no_samples)
    used = {os.path.basename(i) for p in prods for i in p["images"] if i.startswith("images/")}
    for f in os.listdir(os.path.join(HERE, "images")) if os.path.isdir(os.path.join(HERE, "images")) else []:
        if f not in used:
            os.remove(os.path.join(HERE, "images", f))
    with open(os.path.join(HERE, "products.json"), "w", encoding="utf-8") as f:
        json.dump(prods, f, ensure_ascii=False, indent=2)
    with open(os.path.join(HERE, "index.html"), "w", encoding="utf-8") as f:
        f.write(page(load_site()))
    print("exported %d products (%d from catalog)" % (len(prods), sum(not p["sample"] for p in prods)))

if __name__ == "__main__":
    main()
