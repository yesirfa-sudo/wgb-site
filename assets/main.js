/* wGB◇ store theme */
(() => {
  'use strict';
  const root = document.documentElement;
  // Short messages stay centered; overflowing text loops as a news ticker.
  const announcement = document.querySelector('[data-announcement]');
  if (announcement) {
    const viewport = announcement.querySelector('[data-announcement-viewport]');
    const track = announcement.querySelector('[data-announcement-track]');
    const message = announcement.querySelector('[data-announcement-text]');
    const pause = announcement.querySelector('[data-announcement-toggle]');
    if (viewport && track && message && pause) {
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const duplicate = message.cloneNode(true);
      duplicate.removeAttribute('data-announcement-text');
      duplicate.setAttribute('aria-hidden', 'true');
      duplicate.classList.add('announcement-duplicate');
      duplicate.hidden = true;
      track.appendChild(duplicate);
      let paused = false;
      const refresh = () => {
        announcement.classList.add('ticker-ready');
        const textWidth = message.scrollWidth;
        const scrolling = !motion.matches && announcement.clientWidth > 0 && textWidth > announcement.clientWidth + 1;
        announcement.classList.toggle('is-scrolling', scrolling);
        duplicate.hidden = !scrolling;
        pause.hidden = !scrolling;
        if (scrolling) {
          const distance = textWidth + 48;
          track.style.setProperty('--ticker-distance', '-' + distance + 'px');
          track.style.setProperty('--ticker-duration', Math.max(12, distance / 40) + 's');
        }
      };
      pause.addEventListener('click', () => {
        paused = !paused;
        announcement.classList.toggle('ticker-paused', paused);
        pause.setAttribute('aria-pressed', String(paused));
        pause.setAttribute('aria-label', paused ? 'Resume announcement' : 'Pause announcement');
        pause.textContent = paused ? 'Play' : 'Pause';
      });
      if (typeof window.ResizeObserver === 'function') {
        const observer = new window.ResizeObserver(refresh);
        observer.observe(announcement);
        observer.observe(message);
      } else {
        window.addEventListener('resize', refresh);
      }
      if (typeof motion.addEventListener === 'function') motion.addEventListener('change', refresh);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
      refresh();
    }
  }

  const toggles = Array.from(document.querySelectorAll('[data-nav-toggle]'));
  if (toggles.length) {
    const drawer = document.getElementById('store-navigation');
    const phone = window.matchMedia ? window.matchMedia('(max-width: 760px)') : { matches: false };
    let lastToggle = toggles[0];
    const setOpen = (open, returnFocus) => {
      root.classList.toggle('nav-open', open);
      toggles.forEach((t) => t.setAttribute('aria-expanded', String(open)));
      if (drawer && phone.matches) {
        if (open) {
          const first = drawer.querySelector('a, summary, button');
          if (first) first.focus({ preventScroll: true });
        } else if (returnFocus) {
          lastToggle.focus({ preventScroll: true });
        }
      }
    };
    toggles.forEach((t) => t.addEventListener('click', () => {
      lastToggle = t;
      setOpen(!root.classList.contains('nav-open'));
    }));
    document.querySelectorAll('[data-nav-close]').forEach((el) => el.addEventListener('click', () => setOpen(false, true)));
    if (drawer) drawer.addEventListener('click', (event) => {
      if (event.target.closest && event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && root.classList.contains('nav-open')) setOpen(false, true);
    });
    const leavePhone = () => { if (!phone.matches && root.classList.contains('nav-open')) setOpen(false); };
    if (phone.addEventListener) phone.addEventListener('change', leavePhone);
    else if (phone.addListener) phone.addListener(leavePhone);
    root.classList.add('js');
  }

  const featured = document.querySelector('[data-home-featured]');
  const grid = document.querySelector('[data-featured-grid]');
  if (featured && grid) {
    document.querySelectorAll('[data-module-source] [data-featured-module]').forEach((module) => grid.appendChild(module));
    featured.hidden = grid.children.length === 0;
  }

  // Use Tebex's actual configured modules; never fabricate customer activity.
  const customerLayout = document.querySelector('[data-customer-layout]');
  const leftCustomers = document.querySelector('[data-customer-left]');
  const rightCustomers = document.querySelector('[data-customer-right]');
  if (customerLayout && leftCustomers && rightCustomers) {
    const placeModules = (kind, target, className) => {
      document.querySelectorAll('[data-module-source] [data-customer-module="' + kind + '"]').forEach((module) => target.appendChild(module));
      const populated = target.children.length > 0;
      target.hidden = !populated;
      customerLayout.classList.toggle(className, populated);
    };
    placeModules('top-customer', leftCustomers, 'has-left-customers');
    placeModules('recent-customers', rightCustomers, 'has-right-customers');
    const moduleSource = document.querySelector('[data-module-source]');
    if (moduleSource && !moduleSource.querySelector('.widget, .store-product')) {
      const remainder = moduleSource.closest('.store-sidebar');
      if (remainder) remainder.hidden = true;
    }
  }

  // The grid is populated before search binds, including homepage featured modules.
  const search = document.querySelector('[data-package-search]');
  const cards = Array.from(document.querySelectorAll('.store-main .store-products .store-product'));
  if (search && cards.length) {
    const input = search.querySelector('[data-search-input]');
    const clear = search.querySelector('[data-search-clear]');
    const message = search.querySelector('[data-search-status]');
    const empty = search.querySelector('[data-search-empty]');
    const normalize = (text) => text.normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g, ' ');
    const entries = cards.map((card) => ({
      title: normalize(card.querySelector('.product-title').textContent),
      element: card.closest('[data-featured-module]') || card
    }));
    const filter = () => {
      const query = normalize(input.value);
      const words = query.split(' ').filter(Boolean);
      let visible = 0;
      entries.forEach((entry) => {
        const matches = words.every((word) => entry.title.includes(word));
        entry.element.hidden = !matches;
        if (matches) visible++;
      });
      clear.hidden = !input.value;
      empty.hidden = visible !== 0;
      message.textContent = query ? visible + ' / ' + entries.length : '';
    };
    input.addEventListener('input', filter);
    clear.addEventListener('click', () => { input.value = ''; filter(); input.focus(); });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { input.value = ''; filter(); }
    });
    search.hidden = false;
    filter();
  }

  document.querySelectorAll('[data-copy-ip]').forEach((button) => {
    const label = button.querySelector('[data-copy-label]');
    const status = button.parentElement.querySelector('[data-copy-status]');
    const manual = button.parentElement.querySelector('[data-copy-manual]');
    let copying = false;
    button.addEventListener('click', async () => {
      if (copying) return;
      copying = true;
      const address = button.dataset.copyIp.trim();
      let copied = false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(address);
          copied = true;
        }
      } catch (_) { /* Try the selection fallback when clipboard permission is denied. */ }
      if (!copied && manual) {
        manual.hidden = false;
        manual.value = address;
        manual.focus();
        manual.select();
        manual.setSelectionRange(0, address.length);
        try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
      }
      if (copied) {
        if (manual) manual.hidden = true;
        button.focus();
        if (label) label.textContent = 'Copied!';
        if (status) status.textContent = 'Server address copied.';
      } else {
        if (label) label.textContent = 'Copy address';
        if (status) status.textContent = 'Select the address below and copy it manually.';
      }
      copying = false;
    });
  });

  document.querySelectorAll('[data-currency]').forEach((select) => {
    select.addEventListener('change', () => {
      if (select.form && typeof select.form.requestSubmit === 'function') select.form.requestSubmit();
    });
    const submit = select.form && select.form.querySelector('.currency-submit');
    if (submit && typeof select.form.requestSubmit === 'function') submit.hidden = true;
  });

  document.querySelectorAll('[data-gallery]').forEach((gallery) => {
    const track = gallery.querySelector('[data-media-track]');
    const previous = gallery.querySelector('[data-gallery-prev]');
    const next = gallery.querySelector('[data-gallery-next]');
    if (!track || !previous || !next) return;
    const update = () => {
      previous.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };
    const advance = (direction) => track.scrollBy({left: direction * track.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    previous.addEventListener('click', () => advance(-1));
    next.addEventListener('click', () => advance(1));
    track.addEventListener('scroll', update, {passive:true});
    window.addEventListener('resize', update);
    update();
  });

  document.querySelectorAll('[data-countdown]').forEach((element) => {
    const seconds = Number(element.dataset.countdown);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const end = Date.now() + seconds * 1000;
    let timer;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      const days = Math.floor(remaining / 86400);
      const hours = Math.floor(remaining % 86400 / 3600);
      const minutes = Math.floor(remaining % 3600 / 60);
      element.textContent = (days ? days + 'd ' : '') + hours + 'h ' + minutes + 'm ' + remaining % 60 + 's';
      if (!remaining && timer) clearInterval(timer);
    };
    update();
    timer = setInterval(update, 1000);
  });

})();

/* Product popup + cart popup. Original code; talks to the same Tebex basket URLs the theme already uses. */
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
    document.querySelectorAll('.basket-link .count, .mobile-dock .count').forEach((c) => { c.textContent = String(stored.reduce((t, i) => t + i.qty, 0)); });
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
    if (img && img.getAttribute('src')) product.body.appendChild(el('div', { class: 'wgb-modal__image' }, [el('img', { src: img.getAttribute('src'), alt: '' })]));
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
      const thumb = el('div', { class: 'wgb-cart__thumb' }, item.image ? [el('img', { src: item.image, alt: '' })] : []);
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
