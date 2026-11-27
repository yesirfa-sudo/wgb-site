/* wGB◇ storefront: product popup + cart popup (local cart, orders via Telegram) */
(() => {
  const shopEl = document.getElementById('wgb-shop');
  if (!shopEl || shopEl.dataset.modal !== '1') return;
  const root = document.documentElement;
  const L = (key, fallback) => shopEl.dataset['l' + key] || fallback;
  const label = {
    close: L('Close', 'Close'), add: L('Add', 'Add to cart'), viewCart: L('ViewCart', 'View cart'), quantity: L('Quantity', 'Quantity'),
    totalAmount: L('TotalAmount', 'Total amount'), cartTitle: L('CartTitle', 'Shopping cart'), update: L('Update', 'Update quantity'),
    save: L('Save', 'Save'), remove: L('Remove', 'Remove'), total: L('Total', 'Total'), cont: L('Continue', 'Continue shopping'),
    checkout: L('Checkout', 'Go to checkout'), login: L('Login', 'Log in to checkout'), empty: L('Empty', 'Your cart is empty.'),
    qty: L('Qty', 'Qty'), inStock: L('InStock', 'in stock'), added: L('Added', 'Added to your cart.'),
    error: L('Error', 'Something went wrong. Please try again.'), working: L('Working', 'Working…')
  };

  // ---- cart state: kept in this browser (localStorage). No checkout backend; orders go through Telegram. ----
  const TG = shopEl.dataset.telegram || 'https://t.me/AlphaTest3';
  const KEY = 'wgb-cart-v1';
  const money = (n) => '$' + n.toFixed(2);
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  let stored = load();
  const save_ = () => { try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch (e) { /* private mode */ } };
  const view_ = () => ({
    items: stored.map((i) => ({ id: i.id, identifier: i.id, name: i.name, qty: i.qty, price: money(i.unit * i.qty), image: i.image, fixed: false })),
    total: money(stored.reduce((t, i) => t + i.unit * i.qty, 0)), currency: 'USD', ident: '', canCheckout: true
  });
  let cart = view_();
  const applyCart = () => {
    cart = view_();
    const n = stored.reduce((t, i) => t + i.qty, 0); document.querySelectorAll('.count').forEach((c) => { c.textContent = String(n); c.dataset.zero = n ? '0' : '1'; });
  };
  const addItem = (d, img, qty) => {
    const found = stored.find((i) => i.id === d.id);
    if (found) found.qty = Math.min(99, found.qty + qty);
    else stored.push({ id: d.id, name: d.name, unit: parseFloat(d.price) || 0, qty: Math.min(99, qty), image: img || '' });
    save_(); applyCart();
  };
  const removeItem = (id) => { stored = stored.filter((i) => i.id !== id); save_(); applyCart(); };
  const setQty = (id, q) => { const f = stored.find((i) => i.id === id); if (f) f.qty = q; save_(); applyCart(); };
  const orderText = () => 'Hi! I would like to order:\n' + stored.map((i) => '- ' + i.qty + ' x ' + i.name + ' (' + money(i.unit * i.qty) + ')').join('\n') + '\nTotal: ' + cart.total;
  applyCart();

  // ---- tiny DOM helper ----
  const el = (tag, attrs, children) => {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (attrs[k] !== false && attrs[k] != null) node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (children || []).forEach((c) => { if (c) node.appendChild(c); });
    return node;
  };
  const formatMoney = (template, amount) => {
    const grouped = /\d,\d{3}/.test(template);
    const number = grouped ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount.toFixed(2);
    return template.replace(/\d[\d.,]*/, number);
  };

  // ---- modal shell with focus trap ----
  let uid = 0;
  const makeModal = (extraClass) => {
    const id = 'wgb-modal-' + (++uid);
    const title = el('h2', { class: 'wgb-modal__title', id: id + '-title' });
    const close = el('button', { type: 'button', class: 'wgb-modal__close', text: label.close });
    const body = el('div', { class: 'wgb-modal__body' });
    const foot = el('div', { class: 'wgb-modal__foot' });
    const status = el('p', { class: 'wgb-modal__status', role: 'status', 'aria-live': 'polite' });
    const panel = el('div', { class: 'wgb-modal__panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-title', tabindex: '-1' }, [
      el('div', { class: 'wgb-modal__head' }, [title, close]), body, status, foot
    ]);
    const overlay = el('div', { class: 'wgb-modal ' + extraClass, hidden: true }, [panel]);
    document.body.appendChild(overlay);
    const api = { overlay, panel, title, body, foot, status, close, opener: null, onClose: null };
    api.open = (opener) => {
      api.opener = opener || document.activeElement;
      overlay.hidden = false;
      root.classList.add('modal-open');
      panel.focus({ preventScroll: true });
    };
    api.hide = (restoreFocus) => {
      if (overlay.hidden) return;
      overlay.hidden = true;
      if (!document.querySelector('.wgb-modal:not([hidden])')) root.classList.remove('modal-open');
      if (api.onClose) api.onClose();
      if (restoreFocus !== false && api.opener && document.contains(api.opener)) api.opener.focus({ preventScroll: true });
    };
    api.setBusy = (busy) => {
      if (busy) api._focus = document.activeElement;
      panel.setAttribute('aria-busy', String(busy));
      panel.querySelectorAll('button, input').forEach((c) => {
        if (busy) { c._wasDisabled = c.disabled; c.disabled = true; } else if (c._wasDisabled !== undefined) { c.disabled = c._wasDisabled; delete c._wasDisabled; }
      });
      status.textContent = busy ? label.working : '';
      if (!busy && api._focus && panel.contains(api._focus) && !api._focus.disabled) api._focus.focus({ preventScroll: true });
      else if (!busy && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    };
    close.addEventListener('click', () => api.hide());
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) api.hide(); });
    api.onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); api.hide(); return; }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea')).filter((n) => n.offsetParent !== null);
      if (!focusable.length) { e.preventDefault(); panel.focus(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active) || active === panel) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    return api;
  };

  // ---- product popup ----
  const product = makeModal('wgb-modal--product');
  const openProduct = (card, opener) => {
    const d = card.dataset;
    const unit = parseFloat(d.price) || 0;
    const stock = d.stock !== undefined && d.stock !== '' ? parseInt(d.stock, 10) : null;
    const img = card.querySelector('.product-image img');
    const tpl = card.querySelector('template[data-product-desc]');
    product.title.textContent = d.name;
    product.body.textContent = '';
    const pics = (d.images || '').split('|').filter(Boolean);
    if (!pics.length && img && img.getAttribute('src')) pics.push(img.getAttribute('src'));
    if (pics.length) {
      const big = el('img', { src: pics[0], alt: d.name, decoding: 'async' });
      const gallery = el('div', { class: 'wgb-modal__gallery' }, [el('div', { class: 'wgb-modal__image' }, [big])]);
      if (pics.length > 1) {
        const bar = el('div', { class: 'wgb-thumbs', role: 'group', 'aria-label': 'Product images' });
        pics.forEach((src, i) => {
          const t = el('button', { type: 'button', class: 'wgb-thumb', 'aria-label': 'Image ' + (i + 1) + ' of ' + pics.length, 'aria-current': i === 0 ? 'true' : 'false' }, [el('img', { src: src, alt: '', loading: 'lazy', decoding: 'async' })]);
          t.addEventListener('click', () => { big.src = src; bar.querySelectorAll('.wgb-thumb').forEach((x) => x.setAttribute('aria-current', String(x === t))); });
          bar.appendChild(t);
        });
        gallery.appendChild(bar);
      }
      product.body.appendChild(gallery);
    }
    const desc = el('div', { class: 'wgb-modal__desc text-content' });
    if (tpl) desc.appendChild(tpl.content.cloneNode(true));
    product.body.appendChild(desc);
    // The option/stock line only appears when Tebex exposes a stock figure for the package.
    if (stock != null) product.body.appendChild(el('p', { class: 'wgb-modal__variant', text: d.name + ' - ' + d.priceText + ' | ' + stock + ' ' + label.inStock }));
    const qtyId = 'wgb-qty-' + d.id;
    const qty = el('input', { id: qtyId, type: 'number', min: '1', max: stock != null ? String(Math.max(stock, 1)) : '99', step: '1', value: '1', inputmode: 'numeric', disabled: d.fixedQty === '1' });
    const total = el('output', { class: 'wgb-modal__total', for: qtyId, text: d.priceText });
    const row = el('div', { class: 'wgb-modal__qty' }, [
      el('label', { for: qtyId, text: label.quantity }), qty,
      el('p', { class: 'wgb-modal__sum' }, [document.createTextNode(label.totalAmount + ': '), total])
    ]);
    product.body.appendChild(row);
    const current = () => Math.max(1, Math.min(parseInt(qty.value, 10) || 1, parseInt(qty.max, 10) || 99));
    qty.addEventListener('input', () => { total.textContent = formatMoney(d.priceText, unit * current()); });
    const order = el('a', { class: 'btn btn-primary', href: TG, target: '_blank', rel: 'noopener noreferrer', text: 'Order via Telegram' });
    const add = el('button', { type: 'button', class: 'btn btn-outline', text: label.add });
    const view = el('button', { type: 'button', class: 'btn btn-outline', text: label.viewCart });
    product.foot.textContent = '';
    product.foot.append(order, add, view);
    product.status.textContent = '';
    view.addEventListener('click', () => { product.hide(false); openCart(view); });
    add.addEventListener('click', () => {
      addItem(d, img && img.getAttribute('src'), current());
      product.status.textContent = label.added;
    });
    product.open(opener);
    qty.focus({ preventScroll: true });
  };

  // ---- cart popup ----
  const cartModal = makeModal('wgb-modal--cart');
  cartModal.title.textContent = label.cartTitle;
  const renderCart = () => {
    cartModal.body.textContent = '';
    cartModal.foot.textContent = '';
    cartModal.status.textContent = '';
    if (!cart.items.length) {
      cartModal.body.appendChild(el('p', { class: 'wgb-cart__empty', text: label.empty }));
      cartModal.foot.appendChild(contBtn());
      return;
    }
    const list = el('ul', { class: 'wgb-cart__list' });
    cart.items.forEach((item) => {
      const thumb = el('div', { class: 'wgb-cart__thumb' }, item.image ? [el('img', { src: item.image, alt: item.name, loading: 'lazy' })] : []);
      const meta = el('p', { class: 'wgb-cart__meta', text: label.qty + ' ' + item.qty + ' | ' + item.price });
      const info = el('div', { class: 'wgb-cart__info' }, [el('p', { class: 'wgb-cart__name', text: item.name }), meta]);
      const update = el('button', { type: 'button', class: 'btn btn-secondary btn-small', text: label.update, disabled: item.fixed });
      const remove = el('button', { type: 'button', class: 'btn btn-danger btn-small', text: label.remove });
      let editing = null;
      const save = () => {
        const value = Math.max(1, Math.min(parseInt(editing.value, 10) || 1, 99));
        setQty(item.id, value); renderCart();
      };
      update.addEventListener('click', () => {
        if (editing) { save(); return; }
        editing = el('input', { type: 'number', min: '1', max: '99', step: '1', value: String(item.qty), 'aria-label': label.quantity, class: 'wgb-cart__qty', inputmode: 'numeric' });
        meta.textContent = '';
        meta.append(document.createTextNode(label.qty + ' '), editing, document.createTextNode(' | ' + item.price));
        update.textContent = label.save;
        editing.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
        editing.focus(); editing.select();
      });
      remove.addEventListener('click', () => { removeItem(item.id); renderCart(); });
      list.appendChild(el('li', { class: 'wgb-cart__row' }, [thumb, info, el('div', { class: 'wgb-cart__actions' }, [update, remove])]));
    });
    cartModal.body.appendChild(list);
    cartModal.body.appendChild(el('hr', { class: 'wgb-cart__rule' }));
    cartModal.body.appendChild(el('p', { class: 'wgb-cart__total' }, [el('span', { text: label.total }), el('strong', { text: cart.total + ' ' + cart.currency })]));
    cartModal.foot.appendChild(contBtn());
    const checkout = el('a', { class: 'btn btn-primary', href: TG, target: '_blank', rel: 'noopener noreferrer', text: 'Order via Telegram' });
    checkout.addEventListener('click', () => { try { navigator.clipboard && navigator.clipboard.writeText(orderText()); } catch (e) { /* optional */ } });
    cartModal.body.appendChild(el('p', { class: 'wgb-cart__note muted', text: 'Checkout is handled in Telegram. Your cart is copied so you can paste it into the chat.' }));
    cartModal.foot.appendChild(checkout);
  };
  const contBtn = () => {
    const b = el('button', { type: 'button', class: 'btn btn-outline', text: label.cont });
    b.addEventListener('click', () => cartModal.hide());
    return b;
  };
  function openCart(opener) { renderCart(); cartModal.open(opener); }

  const modals = [product, cartModal];
  document.addEventListener('keydown', (e) => {
    const open = modals.filter((m) => !m.overlay.hidden).pop();
    if (open) open.onKey(e);
  }, true);

  // ---- wiring: open from product tiles and basket links ----
  const plain = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  document.addEventListener('click', (e) => {
    const open = e.target.closest && e.target.closest('[data-product-open]');
    if (open && plain(e)) {
      const card = open.closest('[data-product]');
      if (card && card.dataset.simple === '1') { e.preventDefault(); openProduct(card, open); return; }
    }
    const basket = e.target.closest && e.target.closest('[data-open-cart]');
    if (basket && plain(e) && !basket.closest('.wgb-modal')) { e.preventDefault(); openCart(basket); }
  });
})();

/* page behaviour: menu, search + price filters, reveal-on-scroll */
(() => {
  const menu = document.querySelector('[data-menu]');
  const btn = document.querySelector('[data-menu-toggle]');
  if (menu && btn) {
    const set = (o) => { menu.classList.toggle('open', o); btn.setAttribute('aria-expanded', String(o)); };
    btn.addEventListener('click', () => set(!menu.classList.contains('open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) { set(false); btn.focus(); } });
    document.addEventListener('click', (e) => { if (menu.classList.contains('open') && !menu.contains(e.target) && !btn.contains(e.target)) set(false); });
  }
  const cards = Array.from(document.querySelectorAll('.store-product'));
  const input = document.querySelector('[data-search]');
  const out = document.querySelector('[data-results]');
  const empty = document.querySelector('[data-empty]');
  let range = 'all';
  const ranges = { all: () => true, low: (p) => p < 10, mid: (p) => p >= 10 && p < 30, high: (p) => p >= 30 };
  const apply = () => {
    const q = input ? input.value.trim().toLowerCase() : '';
    let n = 0;
    cards.forEach((c) => {
      const ok = ranges[range](parseFloat(c.dataset.price) || 0) && (!q || c.dataset.name.toLowerCase().includes(q));
      c.hidden = !ok; if (ok) n++;
    });
    if (out) out.innerHTML = '<b>' + n + '</b> result' + (n === 1 ? '' : 's');
    if (empty) empty.hidden = n > 0;
  };
  if (input) input.addEventListener('input', apply);
  document.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => {
    range = b.dataset.range;
    document.querySelectorAll('[data-range]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    apply();
  }));
  apply();
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
    items.forEach((i) => io.observe(i));
  } else items.forEach((i) => i.classList.add('in'));
})();
