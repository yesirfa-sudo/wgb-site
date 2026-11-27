#!/usr/bin/env python3
"""Export the Telegram bot's catalog to products.json and rebuild index.html (pure static site).

Usage:  python3 export_products.py [--db PATH] [--no-samples]
Then:   git add -A && git commit -m "update products" && git push   (GitHub Pages redeploys)

If the catalog has fewer than MIN_PRODUCTS active products, sample products are appended so the
storefront never looks empty (use --no-samples to disable). No secrets are read or written.
"""
import argparse, html, json, os, shutil, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.environ.get("WGB_DB", "/workspace/wgb-telegram-bot/data/catalog.sqlite3")
TITLE = "wGB◇"
TG = "https://t.me/AlphaTest3"
MIN_PRODUCTS = 9
SAMPLE_PRICES = [4.99, 9.99, 14.99, 19.99, 24.99, 29.99, 39.99, 49.99, 59.99]
e = html.escape
money = lambda v: "$%.2f" % v

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
                dest = "images/" + os.path.basename(lp)
                shutil.copyfile(lp, os.path.join(HERE, dest)); imgs.append(dest)
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

BASKET = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m8 8 4-5 4 5M3 8h18l-2 12H5L3 8Zm6 4v4m6-4v4"/></svg>'
TGSVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.4 3.6 2.8 10.8c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.5c.2.6.4.8.8.8s.6-.2.9-.5l2.2-2.1 4.5 3.4c.8.5 1.4.2 1.6-.8l3.1-14.5c.3-1.2-.4-1.8-1.5-1.4ZM9.2 14.1l9.5-6c.4-.3.8-.1.5.2l-7.9 7-.3 3.2-1.8-4.4Z"/></svg>'

def card(p):
    desc = "".join("<p>%s</p>" % e(x) for x in p["description"].split("\n") if x.strip()) or "<p>Message us on Telegram to order.</p>"
    return f'''<article class="store-product" data-product data-simple="1" data-id="{e(p['id'])}" data-identifier="{e(p['id'])}" data-name="{e(p['name'])}" data-price="{p['price']}" data-price-text="{money(p['price'])}" data-fixed-qty="0">
<a class="product-image-link" href="#" aria-label="{e(p['name'])}" data-product-open><div class="product-image"><img src="{e(p['images'][0])}" alt="{e(p['name'])}" loading="lazy" width="1600" height="900"></div></a>
<div class="product-body"><h2 class="product-title"><a href="#" data-product-open>{e(p['name'])}</a></h2>
<a class="btn btn-outline product-buy" href="#" data-product-open>Purchase<span class="buy-sep" aria-hidden="true">|</span><span class="buy-price">{money(p['price'])}</span></a>
<template data-product-desc>{desc}</template></div></article>'''

def page(prods):
    cards = "".join(card(p) for p in prods)
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{TITLE}</title><meta name="description" content="{TITLE} storefront. Order via Telegram."><meta name="theme-color" content="#0d0b0e">
<link rel="stylesheet" href="assets/generic.css"><link rel="stylesheet" href="assets/shared.css">
<style>:root{{--background:#0d0b0e;--surface:#191316;--surface-raised:#261a20;--accent:#ff4059;--text:#fff5f6;--muted:#c2aeb4;--border:#48212b;--columns:4;--columns-tablet:4;--columns-compact:3;--image-fit:cover;--logo-width:220px}}
.login-button{{display:none}}</style>
<script defer src="assets/main.js"></script></head>
<body class="wgb-theme"><a class="skip-link" href="#main-content">Skip to content</a>
<div class="announcement-bar"><div class="announcement-inner"><div class="announcement-social-left"></div>
<div class="store-toolbar topbar-controls"><div><a class="btn btn-primary" href="{TG}" target="_blank" rel="noopener noreferrer">Order via Telegram</a></div><div class="toolbar-actions"><span class="muted">USD</span><a href="#" data-open-cart class="basket-link">{BASKET} Cart <span class="count">0</span></a></div></div></div></div>
<header class="site-header compact-header"><a href="./" class="store-brand"><span class="store-wordmark">{TITLE}</span></a></header>
<nav class="mobile-dock" aria-label="Quick actions"><a class="dock-item" href="./"><span>Home</span></a>
<a class="dock-item" href="#" data-open-cart>{BASKET}<span>Cart <b class="count">0</b></span></a><a class="dock-item" href="{TG}" target="_blank" rel="noopener noreferrer"><span>Order</span></a></nav>
<div class="site-content customer-layout"><main id="main-content" class="store-main"><section class="home-featured"><h2 class="section-title">Hot products</h2><div class="store-products">{cards}</div></section></main></div>
<footer class="site-footer"><div><a class="footer-brand" href="./">{TITLE}</a></div><div class="footer-links"><a href="{TG}" target="_blank" rel="noopener noreferrer">Telegram</a></div></footer>
<div id="wgb-shop" hidden data-modal="1" data-currency="USD" data-telegram="{TG}"></div>
<a class="tg-float" href="{TG}" target="_blank" rel="noopener noreferrer" aria-label="Order via Telegram" title="Order via Telegram">{TGSVG}</a>
</body></html>'''

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DEFAULT_DB); ap.add_argument("--no-samples", action="store_true")
    a = ap.parse_args()
    prods = build_products(a.db, not a.no_samples)
    with open(os.path.join(HERE, "products.json"), "w", encoding="utf-8") as f:
        json.dump(prods, f, ensure_ascii=False, indent=2)
    with open(os.path.join(HERE, "index.html"), "w", encoding="utf-8") as f:
        f.write(page(prods))
    print("exported %d products (%d from catalog)" % (len(prods), sum(not p["sample"] for p in prods)))

if __name__ == "__main__":
    main()
