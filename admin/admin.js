/* wGB◇ admin: edits site.json (and the page <head>) in the GitHub repo through the GitHub REST API.
   The fine-grained token lives only in this browser's localStorage and is only ever sent to api.github.com. */
(function () {
  'use strict';
  var WGB = window.WGB;

  // ---- which repo ----
  var host = location.hostname.match(/^(.+)\.github\.io$/);
  var parts = location.pathname.split('/').filter(Boolean);
  var OWNER = host ? host[1] : 'yesirfa-sudo';
  var REPO = host && parts.length ? parts[0] : 'wgb-site';
  var LIVE = 'https://' + OWNER + '.github.io/' + REPO + '/';
  var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
  var TOKEN_KEY = 'wgb-admin-token', DRAFT_KEY = 'wgb-admin-draft-v1';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function h(tag, attrs) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, ''); else if (v !== false && v != null) n.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null) continue; n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return n;
  }
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split('.'); var last = ks.pop(); var t = ks.reduce(function (a, k) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; return a[k]; }, o); t[last] = v; }
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };

  // ---- token + GitHub API ----
  function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function gh(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || 'GET', cache: 'no-store',
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token(), 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  }
  function ghErr(res, what) {
    var m = { 401: 'GitHub did not accept the token (wrong, expired or revoked). Sign out and paste a new one.',
      403: 'The token is not allowed to ' + what + '. Make sure Contents is set to "Read and write" for the ' + REPO + ' repository.',
      404: 'GitHub cannot see ' + OWNER + '/' + REPO + ' with this token. Make sure the token\'s repository access includes ' + REPO + '.',
      409: 'The file changed on GitHub while you were editing. Reload and try again.', 422: 'The file changed on GitHub while you were editing. Reload and try again.' };
    return new Error(m[res.status] || ('GitHub said ' + res.status + ' while trying to ' + what + '.'));
  }
  function b64decode(b) { var bin = atob(String(b).replace(/\s/g, '')); var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
  function b64encode(s) { var bytes = new TextEncoder().encode(s), bin = ''; for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
  function getFile(path, allowMissing) {
    return gh('/contents/' + path).then(function (r) {
      if (r.status === 404 && allowMissing) return { text: null, sha: null };
      if (!r.ok) throw ghErr(r, 'read ' + path);
      return r.json().then(function (j) {
        if (j.content) return { text: b64decode(j.content), sha: j.sha };
        // files over 1 MB come back without inline content
        return gh('/contents/' + path, {}).then(function () { throw new Error(path + ' is too large to edit here.'); });
      });
    });
  }
  function putFile(path, text, sha, msg) {
    var body = { message: msg, content: b64encode(text) }; if (sha) body.sha = sha;
    return gh('/contents/' + path, { method: 'PUT', body: body }).then(function (r) { if (!r.ok) throw ghErr(r, 'save ' + path); return r.json(); });
  }

  // ---- state ----
  var site = null, baseText = null, products = [], dirty = false, publishing = false;

  function status(kind, text) { $('#statusDot').className = 'dot ' + kind; $('#status').textContent = text; }
  function refreshStatus() {
    if (publishing) return;
    if (dirty) status('warn', 'Unpublished changes. Press Publish to put them on the site.');
    else status('ok', 'Everything here is live.');
  }

  function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), site: site })); } catch (e) { /* ignore */ } }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }

  var pvTimer = null, pvReady = false;
  function sendPreview() {
    var f = $('#pvFrame'); if (!f || !f.contentWindow || !pvReady) return;
    f.contentWindow.postMessage({ type: 'wgb-site', site: site }, location.origin);
  }
  window.addEventListener('message', function (ev) {
    if (ev.origin !== location.origin || !ev.data) return;
    if (ev.data.type === 'wgb-ready') { pvReady = true; sendPreview(); }
  });
  function changed() {
    dirty = true; saveDraft(); refreshStatus();
    clearTimeout(pvTimer); pvTimer = setTimeout(sendPreview, 120);
  }

  // ---- form builders ----
  var ICONS = Object.keys(WGB.ICONS);
  var F = {
    text: function (p, l, o) { return Object.assign({ k: 'text', p: p, l: l }, o); },
    area: function (p, l, o) { return Object.assign({ k: 'area', p: p, l: l }, o); },
    url: function (p, l, o) { return Object.assign({ k: 'url', p: p, l: l }, o); },
    num: function (p, l, o) { return Object.assign({ k: 'num', p: p, l: l }, o); },
    check: function (p, l, o) { return Object.assign({ k: 'check', p: p, l: l }, o); },
    icon: function (p, l, o) { return Object.assign({ k: 'icon', p: p, l: l }, o); },
    list: function (p, l, o) { return Object.assign({ k: 'list', p: p, l: l }, o); }
  };

  function fieldEl(f, base) {
    if (f.k === 'row') { var r = h('div', { class: 'row2' }); f.fields.forEach(function (sf) { r.appendChild(fieldEl(sf, base)); }); return r; }
    var path = base ? base + '.' + f.p : f.p;
    var val = getPath(site, path);
    if (f.k === 'list') return listEl(f, path);
    if (f.k === 'check') {
      var cb = h('input', { type: 'checkbox' }); cb.checked = !!val;
      cb.addEventListener('change', function () { setPath(site, path, cb.checked); changed(); });
      return h('label', { class: 'check' }, cb, h('span', { text: f.l }));
    }
    var input;
    if (f.k === 'area') input = h('textarea', { rows: f.rows || 3 });
    else if (f.k === 'icon') { input = h('select'); ICONS.forEach(function (i) { input.appendChild(h('option', { value: i, text: i })); }); }
    else if (f.k === 'num') input = h('input', { type: 'number', step: 'any', inputmode: 'decimal', placeholder: f.ph || '' });
    else input = h('input', { type: f.k === 'url' ? 'url' : 'text', autocapitalize: 'off', spellcheck: 'false' });
    input.value = val == null ? '' : val;
    input.addEventListener('input', function () {
      var v = input.value;
      if (f.k === 'num') v = v === '' ? null : parseFloat(v);
      setPath(site, path, v); changed();
    });
    return h('label', { class: 'field' }, h('span', { text: f.l }), input, f.help ? h('span', { class: 'help', text: f.help }) : null);
  }

  function listEl(f, path) {
    var wrap = h('div');
    var box = h('div', { class: 'list' });
    function build() {
      box.textContent = '';
      var arr = getPath(site, path); if (!Array.isArray(arr)) { arr = []; setPath(site, path, arr); }
      arr.forEach(function (it, i) {
        var ctl = h('div', { class: 'item-ctl' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move up', text: '\u25B2', disabled: i === 0, onclick: function () { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); build(); changed(); } }),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move down', text: '\u25BC', disabled: i === arr.length - 1, onclick: function () { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); build(); changed(); } }),
          h('button', { type: 'button', class: 'icon-btn btn-danger', 'aria-label': 'Delete', text: '\u2715', onclick: function () { arr.splice(i, 1); build(); changed(); } }));
        var item = h('div', { class: 'item' }, h('div', { class: 'item-head' }, h('span', { text: f.item + ' ' + (i + 1) }), ctl));
        f.fields.forEach(function (sf) { item.appendChild(fieldEl(sf, path + '.' + i)); });
        box.appendChild(item);
      });
    }
    build();
    wrap.appendChild(h('p', { class: 'sub', text: f.l }));
    wrap.appendChild(box);
    wrap.appendChild(h('button', { type: 'button', class: 'btn btn-sm', text: '+ Add ' + f.item.toLowerCase(), onclick: function () { getPath(site, path).push(clone(f.blank)); build(); changed(); } }));
    return wrap;
  }

  var COLOR_LABELS = [['bg', 'Page background'], ['bg2', 'Background (secondary)'], ['panel', 'Card background'], ['panel2', 'Card background (lighter)'], ['text', 'Main text'], ['muted', 'Soft text'], ['soft', 'Labels'],
    ['silverTop', 'Accent: top shine'], ['silverMid', 'Accent: middle'], ['silverBottom', 'Accent: bottom'], ['btnTop', 'Button: top'], ['btnBottom', 'Button: bottom']];
  var PRESETS = [
    ['Silver (default)', { silverTop: '#ffffff', silverMid: '#e9ecf2', silverBottom: '#8d95a6', btnTop: '#6b7280', btnBottom: '#3b4049' }],
    ['Ice blue', { silverTop: '#ffffff', silverMid: '#cfe6ff', silverBottom: '#6b8fb8', btnTop: '#3f6fa8', btnBottom: '#24456f' }],
    ['Violet', { silverTop: '#ffffff', silverMid: '#e4d8ff', silverBottom: '#8d79c9', btnTop: '#6d54b8', btnBottom: '#3f2e7a' }],
    ['Emerald', { silverTop: '#ffffff', silverMid: '#d5f5e3', silverBottom: '#5fae88', btnTop: '#2f8a61', btnBottom: '#1b5640' }],
    ['Gold', { silverTop: '#fff6dc', silverMid: '#f0d27a', silverBottom: '#a2802c', btnTop: '#a2802c', btnBottom: '#6b531a' }]
  ];
  function colorsEl() {
    var wrap = h('div');
    var grid = h('div', { class: 'colorgrid' });
    var inputs = {};
    COLOR_LABELS.forEach(function (c) {
      var key = c[0];
      var pick = h('input', { type: 'color', 'aria-label': c[1] }), hex = h('input', { type: 'text', maxlength: 9, autocapitalize: 'off', spellcheck: 'false', 'aria-label': c[1] + ' hex code' });
      var set = function (v, from) { setPath(site, 'colors.' + key, v); if (from !== pick && /^#[0-9a-f]{6}$/i.test(v)) pick.value = v; if (from !== hex) hex.value = v; changed(); };
      pick.value = site.colors[key]; hex.value = site.colors[key];
      pick.addEventListener('input', function () { set(pick.value, pick); });
      hex.addEventListener('input', function () { if (/^#[0-9a-f]{3,8}$/i.test(hex.value.trim())) set(hex.value.trim(), hex); });
      inputs[key] = [pick, hex];
      grid.appendChild(h('div', { class: 'colorfield' }, h('label', { text: c[1] }), pick, hex));
    });
    var presets = h('div', { class: 'presets' });
    PRESETS.forEach(function (p) {
      presets.appendChild(h('button', { type: 'button', class: 'btn btn-sm', onclick: function () {
        Object.keys(p[1]).forEach(function (k) { setPath(site, 'colors.' + k, p[1][k]); inputs[k][0].value = p[1][k]; inputs[k][1].value = p[1][k]; });
        changed();
      } }, h('span', { class: 'swatch' }, h('i', { style: 'background:' + p[1].silverMid }), p[0])));
    });
    wrap.appendChild(h('p', { class: 'help', text: 'Accent presets (change the shine and buttons only):' }));
    wrap.appendChild(presets);
    wrap.appendChild(grid);
    wrap.appendChild(h('div', { style: 'margin-top:14px' }, h('button', { type: 'button', class: 'btn btn-sm', text: 'Reset all colors to default', onclick: function () {
      Object.keys(WGB.DEFAULTS.colors).forEach(function (k) { var v = WGB.DEFAULTS.colors[k]; setPath(site, 'colors.' + k, v); inputs[k][0].value = v; inputs[k][1].value = v; });
      changed();
    } })));
    return wrap;
  }

  function productsEl() {
    var wrap = h('div');
    wrap.appendChild(h('p', { class: 'callout' }, h('b', { text: 'Edit products in the Telegram bot.' }), ' Names, prices, descriptions and photos come from the bot and show up on the site about a minute after you change them there. Here you can only hide a product, mark it Featured (shown first, with a badge) or change the order.'));
    var box = h('div', { class: 'list' });
    function ensure(id) { var ov = getPath(site, 'products.overrides'); if (!ov[id]) ov[id] = {}; return ov[id]; }
    function build() {
      box.textContent = '';
      if (!products.length) { box.appendChild(h('p', { class: 'muted', text: 'No products found yet.' })); return; }
      var list = WGB.arrange(products, site, true);
      list.forEach(function (p, i) {
        var hide = h('input', { type: 'checkbox' }), feat = h('input', { type: 'checkbox' });
        hide.checked = !!p.hidden; feat.checked = !!p.featured;
        hide.addEventListener('change', function () { var o = ensure(p.id); if (hide.checked) o.hidden = true; else delete o.hidden; if (!o.hidden && !o.featured) delete getPath(site, 'products.overrides')[p.id]; changed(); build(); });
        feat.addEventListener('change', function () { var o = ensure(p.id); if (feat.checked) o.featured = true; else delete o.featured; if (!o.hidden && !o.featured) delete getPath(site, 'products.overrides')[p.id]; changed(); build(); });
        var move = function (d) { var ids = list.map(function (x) { return x.id; }); ids.splice(i + d, 0, ids.splice(i, 1)[0]); setPath(site, 'products.order', ids); changed(); build(); };
        box.appendChild(h('div', { class: 'prod' + (p.hidden ? ' is-hidden' : '') },
          h('img', { src: '../' + ((p.images || [])[0] || ''), alt: '', loading: 'lazy' }),
          h('div', {}, h('b', { text: p.name }), h('span', { class: 'meta', text: '$' + Number(p.price).toFixed(2) + (p.sample ? ' · sample' : '') }),
            h('div', { class: 'opts' }, h('label', { class: 'check' }, hide, h('span', { text: 'Hide' })), h('label', { class: 'check' }, feat, h('span', { text: 'Featured' })))),
          h('div', { class: 'item-ctl' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move up', text: '\u25B2', disabled: i === 0, onclick: function () { move(-1); } }),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move down', text: '\u25BC', disabled: i === list.length - 1, onclick: function () { move(1); } }))));
      });
    }
    build(); wrap.appendChild(box);
    return wrap;
  }

  var SECTIONS = [
    { title: 'Brand & site info', open: true, fields: [
      F.text('brand.name', 'Brand name'), F.text('brand.mark', 'Logo symbol', { help: 'The small symbol next to the name. Leave empty to hide it.' }), F.text('brand.sub', 'Tagline under the brand name'),
      F.text('seo.title', 'Browser tab and link preview title'), F.area('seo.description', 'Link preview description'),
      F.url('telegram', 'Telegram link', { help: 'Every "Order via Telegram" button and the floating button open this. Footer links written as {telegram} follow it too.' })] },
    { title: 'Colors', custom: colorsEl },
    { title: 'Sections on / off', fields: [
      F.check('sections.strip', 'Scrolling product strip under the headline'), F.check('sections.perks', 'Perks row under the headline'), F.check('sections.why', '"How it works" steps'),
      F.check('sections.faq', 'FAQ questions'), F.check('sections.support', 'Support panel near the bottom'), F.check('sections.telegramFloat', 'Floating Telegram button')] },
    { title: 'Headline (top of the page)', fields: [
      F.text('hero.line1', 'Headline, first line'), F.text('hero.line2', 'Headline, second line (silver)'), F.area('hero.text', 'Text under the headline'),
      F.text('hero.primaryButton', 'Main button'), F.text('hero.secondaryButton', 'Second button')] },
    { title: 'Perks row', fields: [F.list('perks', 'Perks', { item: 'Perk', blank: { icon: 'star', text: 'New perk' }, fields: [F.icon('icon', 'Icon'), F.text('text', 'Text')] })] },
    { title: 'Products section & price filters', fields: [
      F.text('catalog.eyebrow', 'Small label'), F.text('catalog.heading', 'Heading'), F.area('catalog.text', 'Text'),
      F.check('catalog.filters.enabled', 'Show price filter buttons'), F.text('catalog.filters.allLabel', 'Label of the "show everything" button'),
      F.list('catalog.filters.items', 'Price filters', { item: 'Filter', blank: { label: 'New filter', min: null, max: null }, fields: [
        F.text('label', 'Button label'), { k: 'row', fields: [F.num('min', 'From price (included)', { ph: 'no minimum' }), F.num('max', 'Up to price (not included)', { ph: 'no maximum' })] }] })] },
    { title: '"How it works" steps', fields: [
      F.text('why.eyebrow', 'Small label'), F.text('why.heading', 'Heading'), F.area('why.text', 'Text'),
      F.list('why.steps', 'Steps', { item: 'Step', blank: { icon: 'check', title: 'New step', text: 'Describe this step.' }, fields: [F.icon('icon', 'Icon'), F.text('title', 'Title'), F.area('text', 'Text')] })] },
    { title: 'FAQ', fields: [
      F.text('faq.eyebrow', 'Small label'), F.text('faq.heading', 'Heading'),
      F.list('faq.items', 'Questions', { item: 'Question', blank: { q: 'New question?', a: 'Answer.' }, fields: [F.text('q', 'Question'), F.area('a', 'Answer')] }),
      { k: 'note', text: 'Turn the FAQ on under "Sections on / off".' }] },
    { title: 'Support panel', fields: [F.text('support.eyebrow', 'Small label'), F.text('support.heading', 'Heading'), F.area('support.text', 'Text'), F.text('support.button', 'Button')] },
    { title: 'Footer', fields: [
      F.area('footer.about', 'About text'),
      F.list('footer.columns', 'Link columns', { item: 'Column', blank: { title: 'New column', links: [] }, fields: [
        F.text('title', 'Column title'),
        F.list('links', 'Links', { item: 'Link', blank: { label: 'New link', href: 'https://' }, fields: [F.text('label', 'Label'), F.text('href', 'Link', { help: 'https://..., #catalog, mailto:..., or {telegram}' })] })] }),
      F.text('footer.legal', 'Bottom line')] },
    { title: 'Menu & button labels', fields: [
      F.text('nav.products', 'Menu: products'), F.text('nav.why', 'Menu: how it works'), F.text('nav.support', 'Menu: support'), F.text('nav.faq', 'Menu: FAQ'),
      F.text('labels.order', 'Order button'), F.text('labels.purchase', 'Product tile button'), F.text('labels.addToCart', 'Add to cart button'), F.text('labels.viewCart', 'View cart button'),
      F.text('labels.continueShopping', 'Continue shopping button'), F.text('labels.cartTitle', 'Cart title'), F.area('labels.cartNote', 'Note in the cart'), F.text('labels.emptyCart', 'Empty cart message'),
      F.text('labels.noResults', 'No search results message'), F.text('labels.searchPlaceholder', 'Search box hint')] },
    { title: 'Products (list only)', custom: productsEl }
  ];

  function renderEditor() {
    var ed = $('#editor'); ed.textContent = '';
    SECTIONS.forEach(function (s) {
      var body = h('div', { class: 'sec-body' });
      if (s.custom) body.appendChild(s.custom());
      else s.fields.forEach(function (f) {
        if (f.k === 'note') { body.appendChild(h('p', { class: 'help', text: f.text })); return; }
        body.appendChild(fieldEl(f));
      });
      ed.appendChild(h('details', Object.assign({ class: 'sec' }, s.open ? { open: true } : {}), h('summary', { text: s.title }), body));
    });
  }
  // ---- load / publish ----
  function load() {
    status('busy', 'Loading your site...');
    return gh('').then(function (r) {
      if (!r.ok) throw ghErr(r, 'open the repository');
      return r.json();
    }).then(function (repo) {
      if (repo.permissions && repo.permissions.push === false) throw new Error('This token can only read ' + REPO + '. Create a new one with Contents set to "Read and write".');
      return Promise.all([getFile('site.json', true), fetch('../products.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })]);
    }).then(function (res) {
      products = res[1] || [];
      if (res[0].text === null) return fetch('../site.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; }).then(function (t) { res[0].text = t; return res; });
      return res;
    }).then(function (res) {
      baseText = res[0].text;
      var remote = {}; try { remote = baseText ? JSON.parse(baseText) : {}; } catch (e) { throw new Error('site.json on GitHub is not valid JSON. Ask your assistant to repair it.'); }
      site = WGB.normalize(remote);
      var restored = false;
      try {
        var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (d && d.site && JSON.stringify(d.site) !== JSON.stringify(site) && confirm('You have unpublished edits from ' + new Date(d.at).toLocaleString() + ' on this device. Restore them?\n\nOK = restore, Cancel = discard.')) { site = WGB.normalize(d.site); restored = true; }
        else if (d) clearDraft();
      } catch (e) { /* ignore */ }
      dirty = restored; renderEditor(); refreshStatus(); sendPreview();
    });
  }

  function pollLive(stamp, tries) {
    return fetch(LIVE + 'site.json?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) {
      if (j.updated === stamp) return true;
      if (tries <= 0) return false;
      return new Promise(function (res) { setTimeout(res, 5000); }).then(function () { return pollLive(stamp, tries - 1); });
    });
  }
  function headSwap(html, block) {
    var a = html.indexOf('<!--wgb:head-->'), b = html.indexOf('<!--/wgb:head-->');
    if (a < 0 || b < 0) return null;
    return html.slice(0, a) + block + html.slice(b + '<!--/wgb:head-->'.length);
  }

  function publish() {
    if (publishing) return;
    publishing = true; $('#publishBtn').disabled = true; status('busy', 'Publishing...');
    var stamp = new Date().toISOString(), out, t0 = Date.now();
    getFile('site.json', true).then(function (remote) {
      if (baseText !== null && remote.text !== null && remote.text !== baseText && !confirm('The site content was changed somewhere else (another device or your assistant) after you opened this page.\n\nPublish anyway and overwrite those changes?')) { throw new Error('Cancelled. Press Revert to load the latest version.'); }
      site.updated = stamp;
      out = JSON.stringify(site, null, 2) + '\n';
      status('busy', 'Saving site content...');
      return putFile('site.json', out, remote.sha, 'Admin: update site content');
    }).then(function () {
      status('busy', 'Updating page title and colors...');
      return getFile('index.html').then(function (idx) {
        var next = headSwap(idx.text, WGB.headBlock(site));
        if (next === null || next === idx.text) return null;
        return putFile('index.html', next, idx.sha, 'Admin: update page head');
      });
    }).then(function () {
      baseText = out; dirty = false; clearDraft();
      status('ok', 'Published. Live in about a minute...');
      var tick = setInterval(function () { if (publishing) status('ok', 'Published. Waiting for GitHub Pages... ' + Math.round((Date.now() - t0) / 1000) + 's'); }, 1000);
      return pollLive(stamp, 48).then(function (live) {
        clearInterval(tick);
        status(live ? 'ok' : 'warn', live ? 'Live now \u2713 (took ' + Math.round((Date.now() - t0) / 1000) + 's). Refresh your site to see it.' : 'Published, but not visible yet. GitHub Pages can take a few minutes; refresh the site shortly.');
      });
    }).catch(function (e) {
      status('bad', e.message || String(e));
    }).then(function () { publishing = false; $('#publishBtn').disabled = false; });
  }

  function revert() {
    if (dirty && !confirm('Throw away your unpublished edits and reload the live content?')) return;
    clearDraft(); dirty = false;
    load().catch(function (e) { status('bad', e.message); });
  }

  // ---- sign in / out ----
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; document.title = 'wGB◇ Admin: sign in'; }
  function showApp() { $('#login').hidden = true; $('#app').hidden = false; document.title = 'wGB◇ Admin'; }
  function signOut() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } if (dirty && !confirm('You have unpublished edits (they stay saved on this device). Sign out anyway?')) return; showLogin(); }

  function init() {
    document.querySelectorAll('[data-owner]').forEach(function (n) { n.textContent = OWNER; }); $('#ownerName').textContent = OWNER;
    document.querySelectorAll('[data-repo]').forEach(function (n) { n.textContent = REPO; });
    $('#tokenLink').href = 'https://github.com/settings/personal-access-tokens/new?name=' + encodeURIComponent('wGB admin') + '&description=' + encodeURIComponent('Edits the wGB storefront content (site.json) from /admin') + '&target_name=' + encodeURIComponent(OWNER) + '&expires_in=90&contents=write';
    $('#loginForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = $('#tokenInput').value.trim(), err = $('#loginError'); err.hidden = true;
      if (!/^(github_pat_|ghp_|gho_|ghu_|ghs_)/.test(v)) { err.textContent = 'That does not look like a GitHub token. It should start with github_pat_.'; err.hidden = false; return; }
      $('#connectBtn').disabled = true; $('#connectBtn').textContent = 'Checking...';
      try { localStorage.setItem(TOKEN_KEY, v); } catch (e) { err.textContent = 'This browser blocks saving the token (private mode?).'; err.hidden = false; $('#connectBtn').disabled = false; $('#connectBtn').textContent = 'Connect'; return; }
      showApp();
      load().then(function () { $('#tokenInput').value = ''; }).catch(function (e) {
        try { localStorage.removeItem(TOKEN_KEY); } catch (x) { /* ignore */ }
        showLogin(); err.textContent = e.message; err.hidden = false;
      }).then(function () { $('#connectBtn').disabled = false; $('#connectBtn').textContent = 'Connect'; });
    });
    $('#publishBtn').addEventListener('click', publish);
    $('#revertBtn').addEventListener('click', revert);
    $('#signOutBtn').addEventListener('click', signOut); $('#signOutBtn2').addEventListener('click', signOut);
    document.querySelectorAll('.viewtabs [data-view]').forEach(function (b) { b.addEventListener('click', function () {
      document.body.classList.toggle('view-preview', b.dataset.view === 'preview');
      document.querySelectorAll('.viewtabs [data-view]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      if (b.dataset.view === 'preview') setTimeout(sendPreview, 50);
    }); });
    document.querySelectorAll('.pv-toggle [data-dev]').forEach(function (b) { b.addEventListener('click', function () {
      $('.pv-stage').classList.toggle('phone', b.dataset.dev === 'phone');
      document.querySelectorAll('.pv-toggle [data-dev]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    }); });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    if (token()) { showApp(); load().catch(function (e) { status('bad', e.message); if (/token|GitHub cannot see|only read/.test(e.message)) { var b = h('button', { class: 'btn btn-sm', type: 'button', text: 'Sign in again', onclick: function () { try { localStorage.removeItem(TOKEN_KEY); } catch (x) { /* ignore */ } showLogin(); } }); $('#status').appendChild(document.createTextNode(' ')); $('#status').appendChild(b); } }); }
    else showLogin();
  }
  init();
})();
