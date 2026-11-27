/* wGB◇ storefront renderer. Builds the page from site.json (content) + products.json (catalog from the bot).
   Shared by the live page, the admin live preview and the admin's index.html head updater. No secrets here. */
(function (root) {
  'use strict';

  var DEFAULTS = null; // filled by WGB.defaults(): minimal built-in copy, used when site.json is missing keys
  var ICONS = {
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z"/>',
    chat: '<path d="M5 5h14v10H10l-5 4V5Z"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    cart: '<path d="M3 4h2l2 11h11l2-8H7"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8L12 3.5Z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M12 9v11M3 9h18"/><path d="M12 9c-2.5 0-4-1-4-2.5S9 4 10.5 5 12 9 12 9Zm0 0c2.5 0 4-1 4-2.5S15 4 13.5 5 12 9 12 9Z"/>',
    check: '<circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    tag: '<path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5-8.5-8.5Z"/><circle cx="8" cy="8.5" r="1.2"/>'
  };
  var TGSVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.4 3.6 2.8 10.8c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.5c.2.6.4.8.8.8s.6-.2.9-.5l2.2-2.1 4.5 3.4c.8.5 1.4.2 1.6-.8l3.1-14.5c.3-1.2-.4-1.8-1.5-1.4ZM9.2 14.1l9.5-6c.4-.3.8-.1.5.2l-7.9 7-.3 3.2-1.8-4.4Z"/></svg>';
  function ico(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.grid) + '</svg>';
  }
  var BAG = ico('cart').replace(ICONS.cart, '<path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>');
  var MENU = ico('grid').replace(ICONS.grid, '<path d="M4 7h16M4 12h16M4 17h16"/>');
  var SEARCH = ico('grid').replace(ICONS.grid, '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c];
    });
  }
  function money(v) { return '$' + Number(v).toFixed(2); }
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  /* Deep-merge: objects merge key by key, arrays and scalars from `over` replace the base. */
  function merge(base, over) {
    if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(over).forEach(function (k) { out[k] = k in base ? merge(base[k], over[k]) : over[k]; });
    return out;
  }
  /* Only allow safe link targets (https, http, mailto, tel, #anchors, relative paths). */
  function safeHref(h, tg) {
    h = String(h == null ? '' : h).trim().replace(/\{telegram\}/g, tg || '');
    if (!h) return '#';
    if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(h)) return h;
    if (/^[a-z][a-z0-9+.-]*:/i.test(h)) return '#';
    return h;
  }
  function ext(h) { return /^https?:/i.test(h) ? ' target="_blank" rel="noopener noreferrer"' : ''; }
  function colorOk(c, fb) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '').trim()) ? String(c).trim() : fb; }

  /* ---- head pieces (mirrored byte-for-byte by export_products.py; tests compare them) ---- */
  function themeCss(site) {
    var c = site.colors, d = DEFAULTS.colors, g = function (k) { return colorOk(c[k], d[k]); };
    return ':root{--bg:' + g('bg') + ';--bg2:' + g('bg2') + ';--panel:' + g('panel') + ';--panel2:' + g('panel2') +
      ';--text:' + g('text') + ';--muted:' + g('muted') + ';--soft:' + g('soft') +
      ';--silver:linear-gradient(180deg,' + g('silverTop') + ' 0%,' + g('silverMid') + ' 45%,' + g('silverBottom') + ' 100%)' +
      ';--btn:linear-gradient(180deg,' + g('btnTop') + ' 0%,' + g('btnBottom') + ' 100%)}';
  }
  function headBlock(site) {
    var t = esc(site.seo.title), d = esc(site.seo.description);
    return '<!--wgb:head--><title>' + t + '</title><meta name="description" content="' + d + '">' +
      '<meta property="og:title" content="' + t + '"><meta property="og:description" content="' + d + '"><meta property="og:type" content="website">' +
      '<meta name="theme-color" content="' + esc(colorOk(site.colors.bg, DEFAULTS.colors.bg)) + '">' +
      '<style id="wgb-theme">' + themeCss(site) + '</style><!--/wgb:head-->';
  }

  /* ---- products: apply the admin's per-product overrides (hide / feature / order) ---- */
  function arrange(products, site, keepHidden) {
    var ov = (site.products && site.products.overrides) || {};
    var order = (site.products && site.products.order) || [];
    var list = products.filter(function (p) { return keepHidden || !(ov[p.id] && ov[p.id].hidden); }).map(function (p, i) {
      var o = order.indexOf(p.id);
      return { p: p, feat: !!(ov[p.id] && ov[p.id].featured), ord: o < 0 ? 1e6 + i : o };
    });
    list.sort(function (a, b) { return (b.feat - a.feat) || (a.ord - b.ord); });
    return list.map(function (x) { return Object.assign({}, x.p, { featured: x.feat, hidden: !!(ov[x.p.id] && ov[x.p.id].hidden) }); });
  }

  /* ---- body renderers ---- */
  function card(p, site) {
    var desc = String(p.description || '').split('\n').filter(function (x) { return x.trim(); }).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') || '<p>Message us on Telegram to order.</p>';
    var imgs = (p.images && p.images.length) ? p.images : [];
    return '<article class="store-product reveal" data-product data-simple="1" data-id="' + esc(p.id) + '" data-identifier="' + esc(p.id) + '" data-name="' + esc(p.name) + '" data-price="' + p.price + '" data-price-text="' + money(p.price) + '" data-fixed-qty="0" data-images="' + esc(imgs.join('|')) + '">' +
      '<a class="card-link" href="#" aria-label="' + esc(p.name) + ', ' + money(p.price) + '" data-product-open>' +
      '<div class="product-image"><img src="' + esc(imgs[0] || '') + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async" width="640" height="360">' + (p.featured ? '<span class="badge">Featured</span>' : '') + '</div>' +
      '<div class="product-body"><h3 class="product-title">' + esc(p.name) + '</h3>' +
      '<div class="product-meta"><span class="product-buy">' + esc(site.labels.purchase) + '</span><span class="price-pill">' + money(p.price) + ' <span class="arrow" aria-hidden="true">&#8599;</span></span></div></div></a>' +
      '<template data-product-desc>' + desc + '</template></article>';
  }
  function chip(p) {
    return '<div class="chip"><img src="' + esc((p.images || [])[0] || '') + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async"><b>' + esc(p.name) + '</b></div>';
  }
  function brandHtml(site, label) {
    var b = site.brand;
    return '<a class="brand" href="./"' + (label ? ' aria-label="' + esc(b.name) + ' home"' : '') + '>' +
      (b.mark ? '<span class="brand-mark" aria-hidden="true">' + esc(b.mark) + '</span>' : '') +
      '<span class="brand-text"><span class="brand-name">' + esc(b.name) + '</span>' + (b.sub ? '<span class="brand-sub">' + esc(b.sub) + '</span>' : '') + '</span></a>';
  }

  function renderBody(site, products) {
    var tg = safeHref(site.telegram, '');
    var S = site.sections, N = site.nav, L = site.labels;
    var prods = arrange(products, site);
    var navItems = [['#catalog', N.products, true], ['#why', N.why, S.why], ['#support', N.support, S.support], ['#faq', N.faq, S.faq]].filter(function (x) { return x[2]; });
    var navLinks = navItems.map(function (x) { return '<a href="' + x[0] + '">' + esc(x[1]) + '</a>'; }).join('');
    var orderBtn = function (cls) { return '<a class="btn btn-primary' + cls + '" href="' + esc(tg) + '" target="_blank" rel="noopener noreferrer">'; };
    var h = '';
    h += '<header class="topbar"><div class="wrap">\n' + brandHtml(site, true) + '\n';
    h += '<nav class="nav" aria-label="Main">' + navLinks + '</nav>\n';
    h += '<div class="actions">' + orderBtn(' btn-small') + esc(L.order) + '</a>\n';
    h += '<button type="button" class="icon-btn" data-open-cart aria-label="Open cart">' + BAG + '<span class="count" data-zero="1">0</span></button>\n';
    h += '<button type="button" class="icon-btn menu-btn" data-menu-toggle aria-expanded="false" aria-controls="mobile-menu" aria-label="Menu">' + MENU + '</button></div></div></header>\n';
    h += '<div class="mobile-menu" id="mobile-menu" data-menu>' + navLinks + '<a href="' + esc(tg) + '" target="_blank" rel="noopener noreferrer">' + esc(L.order) + '</a></div>\n';
    h += '<main>\n<section class="hero"><div class="wrap">\n';
    h += '<h1>' + esc(site.hero.line1) + (site.hero.line2 ? '<span>' + esc(site.hero.line2) + '</span>' : '') + '</h1>\n';
    h += '<p>' + esc(site.hero.text) + '</p>\n';
    h += '<div class="hero-cta"><a class="btn btn-primary" href="#catalog">' + esc(site.hero.primaryButton) + '</a><a class="btn" href="' + esc(tg) + '" target="_blank" rel="noopener noreferrer">' + esc(site.hero.secondaryButton) + '</a></div>\n';
    if (S.perks && site.perks.length) h += '<div class="perks">' + site.perks.map(function (p) { return '<div class="perk">' + ico(p.icon) + esc(p.text) + '</div>'; }).join('') + '</div>\n';
    h += '</div></section>\n';
    if (S.strip && prods.length) { var strip = prods.map(chip).join(''); h += '<div class="strip" aria-hidden="true"><div class="strip-track"><div class="strip-set">' + strip + '</div><div class="strip-set">' + strip + '</div></div></div>\n'; }
    var C = site.catalog, F = C.filters;
    h += '<section class="section" id="catalog"><div class="wrap">\n';
    h += '<p class="eyebrow">' + esc(C.eyebrow) + '</p><h2>' + esc(C.heading) + '</h2><p class="lede">' + esc(C.text) + '</p>\n';
    h += '<div class="toolbar"><label class="search">' + SEARCH + '<span class="sr-only">' + esc(L.searchPlaceholder) + '</span><input type="search" placeholder="' + esc(L.searchPlaceholder) + '" data-search autocomplete="off"></label>\n';
    if (F.enabled) {
      h += '<div class="filters" role="group" aria-label="Filter by price"><button class="filter" type="button" data-range="all" aria-pressed="true">' + esc(F.allLabel) + '</button>';
      F.items.forEach(function (f, i) {
        h += '<button class="filter" type="button" data-range="r' + i + '"' + (f.min != null && f.min !== '' ? ' data-min="' + esc(f.min) + '"' : '') + (f.max != null && f.max !== '' ? ' data-max="' + esc(f.max) + '"' : '') + ' aria-pressed="false">' + esc(f.label) + '</button>';
      });
      h += '</div>\n';
    }
    h += '<p class="results" data-results aria-live="polite"></p></div>\n';
    h += '<div class="grid">' + prods.map(function (p) { return card(p, site); }).join('') + '<p class="empty-note" data-empty hidden>' + esc(L.noResults) + '</p></div>\n';
    h += '</div></section>\n';
    if (S.why) {
      var W = site.why;
      h += '<section class="section" id="why"><div class="wrap center">\n<p class="eyebrow">' + esc(W.eyebrow) + '</p><h2>' + esc(W.heading) + '</h2><p class="lede">' + esc(W.text) + '</p>\n<div class="features">\n';
      W.steps.forEach(function (s) { h += '<div class="feature reveal"><div class="ico">' + ico(s.icon) + '</div><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></div>\n'; });
      h += '</div></div></section>\n';
    }
    if (S.faq && site.faq.items.length) {
      var Q = site.faq;
      h += '<section class="section" id="faq"><div class="wrap center">\n<p class="eyebrow">' + esc(Q.eyebrow) + '</p><h2>' + esc(Q.heading) + '</h2>\n<div class="faq">';
      Q.items.forEach(function (it) { h += '<details class="faq-item reveal"><summary>' + esc(it.q) + '</summary><p>' + esc(it.a) + '</p></details>'; });
      h += '</div></div></section>\n';
    }
    if (S.support) {
      var P = site.support;
      h += '<section id="support"><div class="wrap"><div class="cta reveal"><p class="eyebrow">' + esc(P.eyebrow) + '</p><h2>' + esc(P.heading) + '</h2><p>' + esc(P.text) + '</p><a class="btn btn-primary" href="' + esc(tg) + '" target="_blank" rel="noopener noreferrer">' + esc(P.button) + '</a></div></div></section>\n';
    }
    h += '</main>\n';
    var Ft = site.footer;
    h += '<footer class="footer"><div class="wrap"><div class="foot-about">' + brandHtml(site, false) + '<p>' + esc(Ft.about) + '</p></div>\n';
    Ft.columns.forEach(function (col) {
      h += '<div><h4>' + esc(col.title) + '</h4><ul>' + col.links.map(function (l) { var href = safeHref(l.href, tg); return '<li><a href="' + esc(href) + '"' + ext(href) + '>' + esc(l.label) + '</a></li>'; }).join('') + '</ul></div>\n';
    });
    h += '<p class="legal">' + esc(Ft.legal) + '</p></div></footer>\n';
    h += '<div id="wgb-shop" hidden data-modal="1" data-currency="USD" data-telegram="' + esc(tg) + '" data-l-add="' + esc(L.addToCart) + '" data-l-view-cart="' + esc(L.viewCart) + '" data-l-continue="' + esc(L.continueShopping) + '" data-l-cart-title="' + esc(L.cartTitle) + '" data-l-empty="' + esc(L.emptyCart) + '" data-l-order="' + esc(L.order) + '" data-l-cart-note="' + esc(L.cartNote) + '"></div>\n';
    if (S.telegramFloat) h += '<a class="tg-float" href="' + esc(tg) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(L.order) + '" title="' + esc(L.order) + '">' + TGSVG + '</a>\n';
    return h;
  }

  /* ---- boot ---- */
  function normalize(raw) { return merge(DEFAULTS, isObj(raw) ? raw : {}); }
  function applyHead(site) {
    document.title = site.seo.title;
    var set = function (sel, attr, v) { var n = document.querySelector(sel); if (n) n.setAttribute(attr, v); };
    set('meta[name="description"]', 'content', site.seo.description);
    set('meta[property="og:title"]', 'content', site.seo.title);
    set('meta[property="og:description"]', 'content', site.seo.description);
    set('meta[name="theme-color"]', 'content', colorOk(site.colors.bg, DEFAULTS.colors.bg));
    var st = document.getElementById('wgb-theme'); if (st) st.textContent = themeCss(site);
  }
  var state = { site: null, products: [], booted: false };
  function paint() {
    var modals = Array.prototype.slice.call(document.querySelectorAll('.wgb-modal'));
    document.body.innerHTML = renderBody(state.site, state.products);
    modals.forEach(function (m) { document.body.appendChild(m); });
    applyHead(state.site);
    if (root.WGBPage) root.WGBPage.init(); else loadApp();
  }
  function loadApp() {
    if (state.appLoading) return; state.appLoading = true;
    var s = document.createElement('script'); s.src = 'assets/app.js?v=' + (root.WGB_APP_V || '1'); document.body.appendChild(s);
  }
  function getJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }
  function boot() {
    var q = new URLSearchParams(location.search);
    var preview = q.has('wgb-preview');
    var pr = getJson('products.json').catch(function () { return []; });
    if (preview) {
      // Admin live preview: wait for the draft site.json from the parent window (same origin only).
      pr.then(function (products) {
        state.products = products;
        state.site = normalize({});
        window.addEventListener('message', function (ev) {
          if (ev.origin !== location.origin || !ev.data || ev.data.type !== 'wgb-site') return;
          state.site = normalize(ev.data.site); paint();
        });
        if (window.parent !== window) window.parent.postMessage({ type: 'wgb-ready' }, location.origin);
      });
      return;
    }
    Promise.all([getJson('site.json').catch(function () { return {}; }), pr]).then(function (r) {
      state.site = normalize(r[0]); state.products = r[1]; paint();
    });
  }

  DEFAULTS = {"brand":{"name":"wGB◇","mark":"◇","sub":"Digital products"},"seo":{"title":"wGB◇ | Digital products","description":"Browse the wGB◇ catalog and order through Telegram."},"telegram":"https://t.me/AlphaTest3","colors":{"bg":"#060709","bg2":"#0b0d11","panel":"#0f1217","panel2":"#151921","text":"#f4f5f7","muted":"#8c93a1","soft":"#b7bcc8","silverTop":"#ffffff","silverMid":"#e9ecf2","silverBottom":"#8d95a6","btnTop":"#6b7280","btnBottom":"#3b4049"},"sections":{"strip":true,"perks":true,"why":true,"support":true,"faq":false,"telegramFloat":true},"nav":{"products":"Products","why":"How it works","support":"Support","faq":"FAQ"},"labels":{"order":"Order via Telegram","purchase":"Purchase","addToCart":"Add to cart","viewCart":"View cart","continueShopping":"Continue shopping","cartTitle":"Shopping cart","cartNote":"Checkout is handled in Telegram. Your cart is copied so you can paste it into the chat.","emptyCart":"Your cart is empty.","noResults":"Nothing matches your search.","searchPlaceholder":"Search products"},"hero":{"line1":"Level up","line2":"your loadout","text":"Browse the wGB◇ catalog, pick what you need, and finish your order with us in Telegram.","primaryButton":"Browse products →","secondaryButton":"Message on Telegram"},"perks":[],"catalog":{"eyebrow":"All products","heading":"Explore the catalog","text":"Search the collection or filter by price, open any item for details, and add it to your cart.","filters":{"enabled":true,"allLabel":"All","items":[]}},"why":{"eyebrow":"How it works","heading":"Ordering made simple","text":"Four quick steps from browsing to delivery.","steps":[]},"support":{"eyebrow":"Support","heading":"Questions? Just ask.","text":"Our Telegram channel is the fastest way to reach us for orders and help.","button":"Open Telegram →"},"faq":{"eyebrow":"FAQ","heading":"Frequently asked questions","items":[]},"footer":{"about":"Browse, add to cart and order through Telegram.","columns":[],"legal":"© wGB◇. All rights reserved."},"products":{"order":[],"overrides":{}}};

  root.WGB = { ICONS: ICONS, DEFAULTS: DEFAULTS, normalize: normalize, renderBody: renderBody, headBlock: headBlock, themeCss: themeCss, arrange: arrange, merge: merge, esc: esc };
  var me = document.currentScript;
  if (me && me.hasAttribute('data-boot')) boot();
})(window);
