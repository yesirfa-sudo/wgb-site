#!/usr/bin/env python3
"""Export the Telegram bot's catalog to products.json and rebuild index.html (pure static site).

Usage:  python3 export_products.py [--db PATH] [--no-samples]
Then:   git add -A && git commit -m "update products" && git push   (GitHub Pages redeploys)

If the catalog has fewer than MIN_PRODUCTS active products, sample products are appended so the
storefront never looks empty (use --no-samples to disable). No secrets are read or written.
"""
import argparse, html, json, os, sqlite3, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.environ.get("WGB_DB", "/workspace/wgb-telegram-bot/data/catalog.sqlite3")
TITLE = "wGB◇"
TG = "https://t.me/AlphaTest3"
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

def ico(path):
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % path
BAG = ico('<path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>')
MENU = ico('<path d="M4 7h16M4 12h16M4 17h16"/>')
SEARCH = ico('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>')
I_GRID = ico('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>')
I_BOLT = ico('<path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z"/>')
I_CHAT = ico('<path d="M5 5h14v10H10l-5 4V5Z"/>')
I_SHIELD = ico('<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>')
I_CART = ico('<path d="M3 4h2l2 11h11l2-8H7"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>')
I_PEN = ico('<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>')
TGSVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.4 3.6 2.8 10.8c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.5c.2.6.4.8.8.8s.6-.2.9-.5l2.2-2.1 4.5 3.4c.8.5 1.4.2 1.6-.8l3.1-14.5c.3-1.2-.4-1.8-1.5-1.4ZM9.2 14.1l9.5-6c.4-.3.8-.1.5.2l-7.9 7-.3 3.2-1.8-4.4Z"/></svg>'

def card(p):
    desc = "".join("<p>%s</p>" % e(x) for x in p["description"].split("\n") if x.strip()) or "<p>Message us on Telegram to order.</p>"
    return f"""<article class="store-product reveal" data-product data-simple="1" data-id="{e(p['id'])}" data-identifier="{e(p['id'])}" data-name="{e(p['name'])}" data-price="{p['price']}" data-price-text="{money(p['price'])}" data-fixed-qty="0" data-images="{e('|'.join(p['images']))}">
<a class="card-link" href="#" aria-label="{e(p['name'])}, {money(p['price'])}" data-product-open>
<div class="product-image"><img src="{e(p['images'][0])}" alt="{e(p['name'])}" loading="lazy" decoding="async" width="640" height="360"></div>
<div class="product-body"><h3 class="product-title">{e(p['name'])}</h3>
<div class="product-meta"><span class="product-buy">Purchase</span><span class="price-pill">{money(p['price'])} <span class="arrow" aria-hidden="true">&#8599;</span></span></div></div></a>
<template data-product-desc>{desc}</template></article>"""

def chip(p):
    return f'<div class="chip"><img src="{e(p["images"][0])}" alt="{e(p["name"])}" loading="lazy" decoding="async"><b>{e(p["name"])}</b></div>'

def page(prods):
    cards = "".join(card(p) for p in prods)
    strip = "".join(chip(p) for p in prods)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{TITLE} | Digital products</title><meta name="description" content="Browse the {TITLE} catalog and order through Telegram."><meta name="theme-color" content="#060709">
<link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="icon" href="favicon.ico" sizes="any">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap">
<link rel="stylesheet" href="assets/style.css"><script defer src="assets/app.js"></script></head>
<body>
<header class="topbar"><div class="wrap">
<a class="brand" href="./" aria-label="{TITLE} home"><span class="brand-mark" aria-hidden="true">&#9671;</span><span class="brand-text"><span class="brand-name">{TITLE}</span><span class="brand-sub">Digital products</span></span></a>
<nav class="nav" aria-label="Main"><a href="#catalog">Products</a><a href="#why">How it works</a><a href="#support">Support</a></nav>
<div class="actions"><a class="btn btn-primary btn-small" href="{TG}" target="_blank" rel="noopener noreferrer">Order via Telegram</a>
<button type="button" class="icon-btn" data-open-cart aria-label="Open cart">{BAG}<span class="count" data-zero="1">0</span></button>
<button type="button" class="icon-btn menu-btn" data-menu-toggle aria-expanded="false" aria-controls="mobile-menu" aria-label="Menu">{MENU}</button></div></div></header>
<div class="mobile-menu" id="mobile-menu" data-menu><a href="#catalog">Products</a><a href="#why">How it works</a><a href="#support">Support</a><a href="{TG}" target="_blank" rel="noopener noreferrer">Order via Telegram</a></div>
<main>
<section class="hero"><div class="wrap">
<h1>Level up<span>your loadout</span></h1>
<p>Browse the {TITLE} catalog, pick what you need, and finish your order with us in Telegram.</p>
<div class="hero-cta"><a class="btn btn-primary" href="#catalog">Browse products &rarr;</a><a class="btn" href="{TG}" target="_blank" rel="noopener noreferrer">Message on Telegram</a></div>
<div class="perks"><div class="perk">{I_GRID}Curated catalog</div><div class="perk">{I_BOLT}Quick replies</div><div class="perk">{I_SHIELD}Simple ordering</div><div class="perk">{I_CHAT}Telegram support</div></div>
</div></section>
<div class="strip" aria-hidden="true"><div class="strip-track"><div class="strip-set">{strip}</div><div class="strip-set">{strip}</div></div></div>
<section class="section" id="catalog"><div class="wrap">
<p class="eyebrow">All products</p><h2>Explore the catalog</h2><p class="lede">Search the collection or filter by price, open any item for details, and add it to your cart.</p>
<div class="toolbar"><label class="search">{SEARCH}<span class="sr-only">Search products</span><input type="search" placeholder="Search products" data-search autocomplete="off"></label>
<div class="filters" role="group" aria-label="Filter by price"><button class="filter" type="button" data-range="all" aria-pressed="true">All</button><button class="filter" type="button" data-range="low" aria-pressed="false">Under $10</button><button class="filter" type="button" data-range="mid" aria-pressed="false">$10 - $30</button><button class="filter" type="button" data-range="high" aria-pressed="false">$30+</button></div>
<p class="results" data-results aria-live="polite"></p></div>
<div class="grid">{cards}<p class="empty-note" data-empty hidden>Nothing matches your search.</p></div>
</div></section>
<section class="section" id="why"><div class="wrap center">
<p class="eyebrow">How it works</p><h2>Ordering made simple</h2><p class="lede">Four quick steps from browsing to delivery.</p>
<div class="features">
<div class="feature reveal"><div class="ico">{I_GRID}</div><h3>1. Browse</h3><p>Look through the catalog and open any product to see what is included.</p></div>
<div class="feature reveal"><div class="ico">{I_CART}</div><h3>2. Add to cart</h3><p>Pick quantities and review your total before you commit to anything.</p></div>
<div class="feature reveal"><div class="ico">{I_CHAT}</div><h3>3. Message us</h3><p>Tap Order via Telegram and paste your cart into the chat.</p></div>
<div class="feature reveal"><div class="ico">{I_PEN}</div><h3>4. Confirm</h3><p>We confirm the details with you directly and take it from there.</p></div>
</div></div></section>
<section id="support"><div class="wrap"><div class="cta reveal"><p class="eyebrow">Support</p><h2>Questions? Just ask.</h2><p>Our Telegram channel is the fastest way to reach us for orders and help.</p><a class="btn btn-primary" href="{TG}" target="_blank" rel="noopener noreferrer">Open Telegram &rarr;</a></div></div></section>
</main>
<footer class="footer"><div class="wrap"><div class="foot-about"><a class="brand" href="./"><span class="brand-mark" aria-hidden="true">&#9671;</span><span class="brand-text"><span class="brand-name">{TITLE}</span><span class="brand-sub">Digital products</span></span></a><p>Browse, add to cart and order through Telegram.</p></div>
<div><h4>Store</h4><ul><li><a href="#catalog">Products</a></li><li><a href="#why">How it works</a></li></ul></div>
<div><h4>Contact</h4><ul><li><a href="{TG}" target="_blank" rel="noopener noreferrer">Telegram</a></li><li><a href="#support">Support</a></li></ul></div>
<p class="legal">&copy; {TITLE}. All rights reserved.</p></div></footer>
<div id="wgb-shop" hidden data-modal="1" data-currency="USD" data-telegram="{TG}"></div>
<a class="tg-float" href="{TG}" target="_blank" rel="noopener noreferrer" aria-label="Order via Telegram" title="Order via Telegram">{TGSVG}</a>
</body></html>"""

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
        f.write(page(prods))
    print("exported %d products (%d from catalog)" % (len(prods), sum(not p["sample"] for p in prods)))

if __name__ == "__main__":
    main()
