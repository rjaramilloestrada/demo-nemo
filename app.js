import { initWipe } from './fx/wipe.js';

const D = JSON.parse(document.getElementById('data').textContent);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const wide = matchMedia('(min-width: 1024px)');
if (reduced) html.classList.add('reduced');
const store = {
  get(k, d) { try { const v = localStorage.getItem('nemo:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('nemo:' + k, JSON.stringify(v)); } catch (e) {} },
};
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};
const icon = (id, cls) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#' + id); s.append(u); return s; };

/* ---------- Formato y precios ---------- */
const fmt = n => {
  if (n == null) return '';
  const r = Math.round(n * 100) / 100;
  const [i, d] = r.toFixed(2).split('.');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return '$' + (d === '00' ? int : int + ',' + d);
};
const sizeById = id => D.sizes.find(s => s.id === id);
const sizeLabel = id => 'Vehículo ' + sizeById(id).label.replace(' (SUV)', '');
const lc = t => t.charAt(0).toLowerCase() + t.slice(1);

/* Odómetro: cada dígito es un carrete que rueda */
function odo(el, value, f = fmt) {
  const str = value == null ? 'Consultar' : f(value);
  if (el.dataset.v === str) return;
  const prev = el.dataset.v; el.dataset.v = str;
  el.setAttribute('aria-label', str);
  const isNum = value != null;
  if (!isNum || !prev || prev.length !== str.length || el.dataset.kind !== 'n') {
    el.textContent = ''; el.dataset.kind = isNum ? 'n' : 't';
    el.classList.add('odo');
    if (!isNum) { el.append(h('span', { class: 'odo__ch', style: 'font-size:.55em;letter-spacing:0' }, str)); return; }
    for (const ch of str) {
      if (/\d/.test(ch)) {
        const reel = h('span', { class: 'odo__reel' }, ...Array.from({ length: 10 }, (_, i) => h('span', {}, String(i))));
        el.append(h('span', { class: 'odo__col', 'aria-hidden': 'true' }, reel));
      } else el.append(h('span', { class: 'odo__ch', 'aria-hidden': 'true' }, ch));
    }
    if (!prev || reduced) { setReels(el, str, true); requestAnimationFrame(() => requestAnimationFrame(() => setReels(el, str))); return; }
  }
  setReels(el, str);
}
const digitW = new WeakMap();
function widths(el) {
  if (digitW.has(el)) return digitW.get(el);
  const m = h('span', { style: 'position:absolute;visibility:hidden;white-space:nowrap' });
  el.append(m);
  const w = Array.from({ length: 10 }, (_, d) => { m.textContent = String(d).repeat(10); return (m.offsetWidth || m.getBoundingClientRect().width) / 10; });
  m.remove();
  if (w[0] > 0) digitW.set(el, w);
  return w;
}
function setReels(el, str, zero) {
  const digits = [...str].filter(c => /\d/.test(c));
  const w = widths(el);
  $$('.odo__reel', el).forEach((r, i) => {
    const d = zero ? 0 : +digits[i];
    r.style.transitionDelay = (i * 0.06) + 's';
    r.style.transform = `translateY(-${d}em)`;
    if (w[d]) { r.parentNode.style.width = w[d] + 'px'; r.parentNode.style.transitionDelay = (i * 0.06) + 's'; }
  });
}
function refreshReels() { for (const p of [...priceEls, { el: lenEl }]) { digitW.delete(p.el); if (p.el.dataset.v && p.el.dataset.kind === 'n') setReels(p.el, p.el.dataset.v); } }
document.fonts?.ready.then(refreshReels);
let reelT; new ResizeObserver(() => { clearTimeout(reelT); reelT = setTimeout(refreshReels, 160); }).observe(document.querySelector('.page'));

/* ---------- WhatsApp ---------- */
const waLink = text => `https://wa.me/${D.contact.whatsapp}?text=${encodeURIComponent(text)}`;
$$('[data-wa]').forEach(a => a.href = waLink(a.dataset.wa));
$$('[data-ig]').forEach(a => a.href = `https://instagram.com/${D.contact.instagram}`);
$$('[data-text]').forEach(el => el.textContent = el.dataset.text.split('.').reduce((o, k) => o?.[k], D) ?? '');

/* ---------- Estado ---------- */
let size = store.get('size', 'M');
if (!sizeById(size)) size = 'M';
const cart = store.get('cart', []);
const priceEls = []; // {el, get: () => number|null}
const sizeHooks = [];
const lenEl = $('[data-len]');

/* ---------- Toast y carrito ---------- */
const toastEl = $('[data-toast]');
let toastT;
function toast(msg) {
  toastEl.replaceChildren(icon('i-check'), h('span', {}, msg));
  toastEl.classList.add('is-on');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
}
function flyFrom(btn) {
  if (reduced || !btn) return;
  const z = parseFloat(getComputedStyle(html).zoom) || 1;
  const sc = r => ({ left: r.left / z, top: r.top / z, width: r.width / z, height: r.height / z });
  const a = sc(btn.getBoundingClientRect()), b = sc($('[data-cart-count]').getBoundingClientRect());
  const f = h('i', { class: 'flyer' });
  document.body.append(f);
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.width ? b.left + b.width / 2 : innerWidth / z / 2, y1 = b.height && b.top < innerHeight / z ? b.top + b.height / 2 : innerHeight / z - 40;
  f.animate([
    { transform: `translate(${x0}px,${y0}px) rotate(45deg) scale(1)` },
    { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 120}px) rotate(45deg) scale(1.4)`, offset: .45 },
    { transform: `translate(${x1}px,${y1}px) rotate(45deg) scale(.4)`, opacity: .3 },
  ], { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => f.remove();
  f.style.left = '0px'; f.style.top = '0px';
}
function addLine(line, btn) {
  const wasEmpty = !cart.length;
  const ex = cart.find(l => l.key === line.key);
  if (ex) ex.qty += line.qty || 1; else cart.push({ qty: 1, ...line });
  saveCart(); flyFrom(btn);
  if (wasEmpty && wide.matches) toggleSheet(true);
  setTimeout(() => { const c = $('[data-cart-count]'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }, reduced ? 0 : 700);
  toast('Agregado: ' + line.title);
}
function removeKey(key) { const i = cart.findIndex(l => l.key === key); if (i > -1) cart.splice(i, 1); saveCart(); }
function saveCart() { store.set('cart', cart); renderCart(); syncAddButtons(); }
function lineTotal(l) { return l.price == null ? null : l.price * l.qty; }
function lineMax(l) { return l.max == null ? null : l.max * l.qty; }
function totals() {
  let min = 0, max = 0, ranged = false, pending = 0;
  for (const l of cart) {
    const t = lineTotal(l);
    if (t == null) { pending++; continue; }
    min += t; const m = lineMax(l); if (m != null) { ranged = true; max += m; } else max += t;
  }
  return { min, max, ranged, pending };
}
function renderCart() {
  const box = $('[data-cart]'), n = cart.reduce((a, l) => a + l.qty, 0), t = totals();
  box.classList.toggle('is-on', cart.length > 0);
  document.body.classList.toggle('has-cart', cart.length > 0);
  $('[data-cart-count]').textContent = n;
  $('[data-cart-unit]').textContent = n === 1 ? 'ítem' : 'ítems';
  const totalTxt = t.ranged ? `${fmt(t.min)} a ${fmt(t.max)}` : fmt(t.min);
  $('[data-cart-total]').textContent = totalTxt;
  $('[data-cart-total2]').textContent = totalTxt + (t.pending ? ' +' : '');
  $('[data-cart-lines]').replaceChildren(...cart.map(l => h('li', {},
    h('span', {}, (l.qty > 1 ? l.qty + ' × ' : '') + l.title, l.detail ? h('small', {}, l.detail) : null),
    h('b', {}, l.price == null ? 'Por confirmar' : lineMax(l) != null ? `${fmt(lineTotal(l))} a ${fmt(lineMax(l))}` : fmt(lineTotal(l))),
    h('button', { type: 'button', 'aria-label': 'Quitar ' + l.title, onclick: () => removeKey(l.key) }, icon('i-x')))));
  const note = $('[data-cart-note]');
  const msgs = [];
  if (t.ranged) msgs.push('Algunos precios son un rango que Nemo confirma según la pieza.');
  if (t.pending) msgs.push(`${t.pending} ítem${t.pending > 1 ? 's' : ''} se cotiza${t.pending > 1 ? 'n' : ''} por WhatsApp.`);
  note.hidden = !msgs.length; note.textContent = msgs.join(' ');
  const link = waLink(cartMessage());
  $('[data-cart-send]').href = link;
  $('[data-cart-quick]').href = link;
  if (!cart.length) toggleSheet(false); else syncDock();
}
function cartMessage() {
  const t = totals();
  const lines = cart.map(l => {
    const price = l.price == null ? 'por confirmar' : lineMax(l) != null ? `${fmt(lineTotal(l))} a ${fmt(lineMax(l))}` : fmt(lineTotal(l));
    return `• ${l.qty > 1 ? l.qty + ' × ' : ''}${l.title}${l.detail ? ' (' + l.detail + ')' : ''}: ${price}`;
  });
  const total = t.ranged ? `${fmt(t.min)} a ${fmt(t.max)}` : fmt(t.min);
  return `Hola Nemo, quiero cotizar:\n${lines.join('\n')}\n\nTotal estimado: ${total}${t.pending ? ' + ítems por confirmar' : ''}\n\n(Enviado desde la página web)`;
}
function syncDock() {
  const open = $('[data-cart-toggle]').getAttribute('aria-expanded') === 'true';
  const docked = open && cart.length > 0 && wide.matches;
  $('[data-cart]').classList.toggle('is-docked', docked);
  document.body.classList.toggle('cart-docked', docked);
  document.body.classList.toggle('cart-open', open && !wide.matches);
}
function toggleSheet(open) {
  const btn = $('[data-cart-toggle]'), sheet = $('[data-cart-sheet]');
  open = open ?? btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', open); sheet.hidden = !open;
  syncDock();
  window.ScrollTrigger && setTimeout(() => window.ScrollTrigger.refresh(), 520);
}
$('[data-cart-toggle]').addEventListener('click', () => toggleSheet());
$('[data-cart-scrim]').addEventListener('click', () => toggleSheet(false));
$('[data-cart-clear]').addEventListener('click', () => { cart.splice(0); saveCart(); });
wide.addEventListener?.('change', syncDock);
const addButtons = []; // {btn, key: () => string}
function syncAddButtons() {
  for (const { btn, key, label } of addButtons) {
    const on = cart.some(l => l.key === key());
    btn.classList.toggle('is-added', on);
    btn.replaceChildren(icon(on ? 'i-check' : 'i-plus'), h('span', {}, on ? 'Agregado' : label || 'Agregar'));
  }
}

/* ---------- Hero ---------- */
$$('[data-hero-from]').forEach(el => {
  const id = el.dataset.heroFrom;
  const s = [...D.car.ladder, ...D.car.plans].find(x => x.id === id);
  el.textContent = fmt(Math.min(...Object.values(s.price).filter(v => v != null)));
});
const hero = $('.hero');
const meter = $('.hero__meter');
const stageEl = $('[data-wipe]');
let wipe;
if (!reduced) {
  wipe = initWipe(stageEl, {
    beforeSrc: D.hero.before,
    onProgress: p => { meter.style.setProperty('--p', p); meter.querySelector('b').textContent = Math.round(Math.min(1, p / .55) * 100) + '%'; },
    onClean: () => { hero.classList.add('is-clean'); },
  });
  $('.hero__skip').addEventListener('click', () => wipe.finish());
} else hero.classList.add('is-clean');

/* ---------- Selector de tamaño ---------- */
const stage = $('.sizes__stage');
const carEls = $$('.car', stage);
const fmtLen = m => m.toFixed(1).replace('.', ',') + '\u00a0m';
function drawCar(id, animate) {
  const s = sizeById(id);
  if (!animate) stage.classList.add('no-anim');
  stage.style.setProperty('--len', (s.length_m * 100 / 640).toFixed(4));
  carEls.forEach(el => {
    if (el.dataset.car === id) { el.classList.remove('is-out'); el.classList.add('is-in'); el.style.setProperty('--spin', '0deg'); }
    else if (el.classList.contains('is-in')) { el.classList.remove('is-in'); el.classList.add('is-out'); el.style.setProperty('--spin', '90deg'); }
    else { el.classList.remove('is-out'); el.style.setProperty('--spin', '-90deg'); }
  });
  odo(lenEl, s.length_m, fmtLen);
  $('[data-size-examples]').textContent = s.examples;
  if (!animate) requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('no-anim')));
}
const picker = $('[data-size-picker]');
const chips = $('[data-size-chips]');
D.sizes.forEach(s => {
  picker.append(h('button', { type: 'button', role: 'radio', class: 'size-opt', 'data-size': s.id, 'aria-checked': 'false', onclick: () => setSize(s.id, true) },
    h('b', {}, s.label), h('small', {}, s.examples)));
  chips.append(h('button', { type: 'button', 'data-size': s.id, 'aria-pressed': 'false', onclick: () => { setSize(s.id, true); sizeMenu(false); } },
    h('b', {}, s.label), h('small', {}, s.examples)));
});
picker.addEventListener('keydown', e => {
  const i = D.sizes.findIndex(s => s.id === size);
  const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!d) return; e.preventDefault();
  const n = D.sizes[(i + d + D.sizes.length) % D.sizes.length].id; setSize(n, true); $(`[data-size="${n}"]`, picker).focus();
});
function setSize(id, user) {
  size = id; store.set('size', id);
  $$('[data-size]', picker).forEach(b => { const on = b.dataset.size === id; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; });
  $$('[data-size]', chips).forEach(b => b.setAttribute('aria-pressed', b.dataset.size === id));
  drawCar(id, user);
  priceEls.forEach(p => !p.home && odo(p.el, p.get()));
  sizeHooks.forEach(f => f());
  syncAddButtons();
  if (user) toast('Precios para ' + sizeLabel(id).toLowerCase());
}
sizeHooks.push(() => {
  $$('[data-size-label]').forEach(e => e.textContent = sizeLabel(size));
  $$('[data-size-name]').forEach(e => e.textContent = sizeLabel(size).toLowerCase());
  $('[data-size-current]').textContent = sizeById(size).label;
});

/* ---------- Tamaño en la navegación ---------- */
const sizeBtn = $('[data-size-toggle]');
function sizeMenu(open) {
  open = open ?? sizeBtn.getAttribute('aria-expanded') !== 'true';
  sizeBtn.setAttribute('aria-expanded', open); chips.hidden = !open;
}
sizeBtn.addEventListener('click', () => sizeMenu());
document.addEventListener('click', e => { if (!chips.hidden && !e.target.closest('[data-navsize]')) sizeMenu(false); });

/* ---------- Servicios: lista de precios editorial ---------- */
function bulletList(items) { return h('ul', { class: 'svc__list' }, items.map(t => h('li', {}, t))); }
function picture(name, alt, sizes = '(min-width: 900px) 420px, 90vw') {
  const has960 = !['headlight'].includes(name);
  return h('img', { src: `assets/${name}-480.webp`, srcset: has960 ? `assets/${name}-480.webp 480w, assets/${name}-960.webp 960w` : null, sizes, alt, loading: 'lazy', decoding: 'async' });
}
function beforeAfter([b, a], caption, ar) {
  const el = h('div', { class: 'ba', style: `--ar:${ar || '4/3'}` },
    h('img', { src: `assets/${a}.webp`, alt: (caption ? caption + ': ' : '') + 'después', loading: 'lazy' }),
    h('img', { class: 'ba__before', src: `assets/${b}.webp`, alt: (caption ? caption + ': ' : '') + 'antes', loading: 'lazy' }),
    h('span', { class: 'ba__handle' }), h('span', { class: 'tag tag--before' }, 'Antes'), h('span', { class: 'tag tag--after' }, 'Después'),
    caption ? h('span', { class: 'ba__cap' }, caption) : null);
  const input = h('input', { type: 'range', min: 0, max: 100, value: 50, 'aria-label': 'Comparar antes y después' + (caption ? ' de ' + caption.toLowerCase() : '') });
  input.addEventListener('input', () => el.style.setProperty('--x', input.value + '%'));
  el.append(input);
  return el;
}
const summary = s => {
  const b = s.bullets;
  if (s.bulletsTitle) return `${s.bulletsTitle}: ${lc(b[0])} y ${b.length - 1} más.`;
  if (b.length <= 3) return b.slice(0, -1).map((t, i) => i ? lc(t) : t).join(', ') + ' y ' + lc(b[b.length - 1]) + '.';
  return `${b[0]}, ${lc(b[1])} y ${b.length - 2} más.`;
};
const svcBox = $('[data-services]');
D.car.ladder.forEach(s => {
  const priceEl = h('span', { class: 'price' });
  priceEls.push({ el: priceEl, get: () => s.price[size] });
  const key = () => `car:${s.id}:${size}`;
  const add = h('button', { type: 'button', class: 'add', onclick: e => {
    if (cart.some(l => l.key === key())) { removeKey(key()); return; }
    addLine({ key: key(), title: s.name, detail: sizeLabel(size), price: s.price[size] }, e.currentTarget);
  } });
  addButtons.push({ btn: add, key });
  const did = `svc-${s.id}-d`, nid = `svc-${s.id}-n`;
  const toggle = h('button', { type: 'button', class: 'svc__toggle', 'aria-expanded': 'false', 'aria-controls': did }, h('span', {}, 'Ver detalle'), icon('i-chev'));
  let addon = null;
  if (s.addon) {
    const k = () => `car:${s.id}-addon:${size}`;
    const b = h('button', { type: 'button', class: 'add', onclick: e => cart.some(l => l.key === k()) ? removeKey(k()) : addLine({ key: k(), title: s.addon.name + ' (adicional a ' + s.name + ')', price: s.addon.price }, e.currentTarget) });
    addButtons.push({ btn: b, key: k });
    addon = h('div', { class: 'svc__addon' }, h('span', {}, 'Adicional: ', h('b', {}, s.addon.name + ' ' + fmt(s.addon.price))), b);
  }
  const media = s.ba ? beforeAfter(s.ba, null, '4/5') : s.img ? picture(s.img, s.name) : null;
  const detail = h('div', { class: 'svc__detail', id: did, role: 'region', 'aria-labelledby': nid },
    h('div', { class: 'svc__detail-in' }, h('div', { class: 'svc__body' },
      h('div', { class: 'svc__text' },
        s.lead ? h('p', { class: 'svc__lead' }, s.lead) : null,
        s.bulletsTitle ? h('p', { class: 'svc__bt' }, s.bulletsTitle) : null,
        bulletList(s.bullets),
        s.note ? h('p', { class: 'svc__lead' }, s.note) : null,
        addon),
      media ? h('div', { class: 'svc__media' }, media) : null)));
  const row = h('div', { class: 'svc__row' },
    h('span', { class: 'svc__n', 'aria-hidden': 'true' }, String(s.n).padStart(2, '0')),
    h('div', { class: 'svc__title' }, s.family || s.kicker ? h('p', { class: 'svc__fam' }, s.family || s.kicker) : null, h('h3', { class: 'svc__name', id: nid }, s.name)),
    h('div', { class: 'svc__sum' }, h('p', {}, summary(s)), toggle),
    h('span', { class: 'svc__dur' }, s.duration ? 'Aprox. ' + s.duration : ''),
    h('div', { class: 'svc__price' }, h('small', { 'data-size-label': '' }), priceEl),
    h('div', { class: 'svc__foot' }, add));
  const art = h('article', { class: 'svc', role: 'listitem', style: `--lvl:${s.level}`, 'data-reveal': '' }, row, detail);
  const flip = () => {
    const open = art.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
    toggle.firstChild.textContent = open ? 'Ver menos' : 'Ver detalle';
    setTimeout(() => window.ScrollTrigger?.refresh(), 520);
  };
  toggle.addEventListener('click', flip);
  row.addEventListener('click', e => { if (!e.target.closest('button,a,input')) flip(); });
  svcBox.append(art);
});

/* ---------- Adicionales ---------- */
const extrasBox = $('[data-extras]');
const figX = D.car.extras.find(x => x.img);
if (figX) $('[data-extras-fig]').append(picture(figX.img, figX.name + ': antes y después', '(min-width: 900px) 760px, 92vw'), h('figcaption', {}, h('b', {}, figX.name + '.'), ' Antes y después.'));
D.car.extras.forEach(x => {
  let opt = x.options ? 0 : null;
  const priceNow = () => x.price ? x.price[size] : x.options ? x.options[opt].price : x.fixed;
  const key = () => `car:${x.id}:${x.price ? size : ''}:${opt ?? ''}`;
  const priceEl = h('span', { class: 'price price--sm' });
  priceEls.push({ el: priceEl, get: priceNow });
  const add = h('button', { type: 'button', class: 'add', onclick: e => {
    if (cart.some(l => l.key === key())) { removeKey(key()); return; }
    const p = priceNow();
    addLine({ key: key(), title: x.name + (x.options ? ': ' + x.options[opt].label : ''), detail: x.price ? sizeLabel(size) + (x.detail ? ', ' + x.detail.toLowerCase() : '') : null, price: p }, e.currentTarget);
  } });
  addButtons.push({ btn: add, key });
  const chipsEl = x.options ? h('div', { class: 'chips', role: 'group', 'aria-label': 'Opciones de ' + x.name }, x.options.map((o, i) => h('button', { type: 'button', class: 'chip', 'aria-pressed': i === 0, onclick: e => {
    opt = i; $$('.chip', e.currentTarget.parentNode).forEach((c, j) => c.setAttribute('aria-pressed', j === i)); odo(priceEl, priceNow()); syncAddButtons();
  } }, o.label))) : null;
  extrasBox.append(h('div', { class: 'extra', 'data-reveal': '' },
    h('div', { class: 'extra__main' }, h('p', { class: 'extra__name' }, x.name), x.detail ? h('p', { class: 'extra__detail' }, x.detail) : null),
    h('div', { class: 'extra__side' }, priceEl),
    chipsEl,
    h('small', { class: 'extra__meta', 'data-extra-size': x.price ? '' : null }, x.price ? '' : 'Precio único'),
    h('div', { class: 'extra__cta' }, add)));
});
sizeHooks.push(() => $$('[data-extra-size]').forEach(e => e.textContent = sizeLabel(size) + (size === 'XL' && D.car.extras.some(x => x.price && x.price.XL == null) ? ': consultar' : '')));

/* ---------- Planes ---------- */
const plansBox = $('[data-plans]');
D.car.plans.forEach((p, idx) => {
  const base = D.car.ladder.find(s => s.id === p.baseService);
  const priceEl = h('span', { class: 'price' });
  priceEls.push({ el: priceEl, get: () => p.price[size] });
  const vs = h('p', { class: 'plan__vs' }), save = h('p', { class: 'plan__save' });
  const upd = () => {
    const loose = base.price[size] * p.baseCount, diff = loose - p.price[size];
    vs.replaceChildren(`${p.baseCount} ${base.name} sueltos: `, h('s', {}, fmt(loose)));
    save.textContent = diff > 0 ? `Ahorras ${fmt(diff)} al mes.` : '';
    save.hidden = !(diff > 0);
  };
  sizeHooks.push(upd);
  const key = () => `plan:${p.id}:${size}`;
  const add = h('button', { type: 'button', class: 'add', onclick: e => cart.some(l => l.key === key()) ? removeKey(key()) : addLine({ key: key(), title: p.name + ' (mensual)', detail: sizeLabel(size) + ', ' + p.includes, price: p.price[size] }, e.currentTarget) });
  addButtons.push({ btn: add, key, label: 'Lo quiero' });
  plansBox.append(h('article', { class: 'plan' + (idx === 1 ? ' plan--hot' : ''), 'data-reveal': '' },
    h('p', { class: 'plan__label' }, idx === 1 ? 'El más completo' : 'Para empezar'),
    h('h3', { class: 'plan__name' }, p.name),
    h('p', { class: 'plan__inc' }, p.includes),
    h('div', { class: 'plan__price' }, priceEl, h('span', { class: 'per' }, 'al mes')),
    vs, save,
    h('div', { class: 'plan__cta' }, h('small', { class: 'plan__vs', 'data-size-label': '' }), add)));
});

/* ---------- Hogar y oficina ---------- */
const rail = $('[data-ba-rail]');
const homeBox = $('[data-home]');
const baCaptions = { rugs: 'Alfombra', furniture: 'Sofá', mattress: 'Colchón' };
D.home.services.filter(s => s.ba).forEach(s => rail.append(beforeAfter(s.ba, baCaptions[s.id], '2/1')));

const plural = u => u.endsWith('l') ? u + 'es' : u + 's';
function stepper(value, min, onChange, label) {
  const input = h('input', { type: 'number', inputmode: 'numeric', min, value, 'aria-label': label });
  const set = v => { v = Math.max(min, Math.min(999, Math.round(+v || min))); input.value = v; onChange(v); };
  input.addEventListener('change', () => set(input.value));
  return h('div', { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': 'Menos', onclick: () => set(+input.value - 1) }, '−'), input,
    h('button', { type: 'button', 'aria-label': 'Más', onclick: () => set(+input.value + 1) }, '+'));
}

D.home.services.forEach(s => {
  const P = s.pricing;
  const st = { opt: 0, qty: P.type === 'tiers' ? P.default : 1, plan: 0, m2: P.default || 50 };
  const priceEl = h('span', { class: 'price' }), maxEl = h('span', { class: 'calc__max' }), math = h('p', { class: 'calc__math' });
  const ctrl = h('div', { class: 'calc__ctrl' });
  let calc;
  if (P.type === 'options') {
    const chipsEl = h('div', { class: 'chips', role: 'group', 'aria-label': 'Elige ' + P.unit }, P.options.map((o, i) => h('button', { type: 'button', class: 'chip', 'aria-pressed': i === 0, onclick: () => { st.opt = i; $$('.chip', chipsEl).forEach((c, j) => c.setAttribute('aria-pressed', j === i)); upd(); } }, o.label)));
    ctrl.append(h('span', { class: 'calc__lbl' }, 'Elige'), chipsEl, h('span', { class: 'calc__lbl' }, 'Cantidad'), stepper(1, 1, v => { st.qty = v; upd(); }, 'Cantidad'));
    calc = () => { const o = P.options[st.opt]; return { price: o.price * st.qty, max: o.max ? o.max * st.qty : null, mathTxt: `${st.qty} × ${o.max ? fmt(o.price) + ' a ' + fmt(o.max) : fmt(o.price)}`, line: { key: `home:${s.id}:${st.opt}`, title: `${s.name}: ${o.label}`, price: o.price, max: o.max ?? null, qty: st.qty } }; };
  } else if (P.type === 'tiers') {
    const tiersEl = h('div', { class: 'tiers' }, P.tiers.map(t => h('div', { class: 'tier' }, h('b', {}, fmt(t.price)), h('small', {}, t.label + ' · c/u'))));
    ctrl.append(h('span', { class: 'calc__lbl' }, 'Cantidad de ' + plural(P.unit)), stepper(P.default, P.min, v => { st.qty = v; upd(); }, 'Cantidad'), tiersEl);
    calc = () => {
      const ti = P.tiers.findIndex(t => st.qty >= t.from && (t.to == null || st.qty <= t.to));
      $$('.tier', tiersEl).forEach((e, i) => e.classList.toggle('is-on', i === ti));
      const t = P.tiers[ti];
      return { price: t.price * st.qty, mathTxt: `${st.qty} × ${fmt(t.price)} c/u`, line: { key: `home:${s.id}:${st.qty}`, title: s.name, detail: `${st.qty} ${st.qty === 1 ? P.unit : plural(P.unit)} a ${fmt(t.price)} c/u`, price: t.price * st.qty, qty: 1 } };
    };
  } else if (P.type === 'per_m2') {
    const chipsEl = h('div', { class: 'chips', role: 'group', 'aria-label': 'Tipo de limpieza' }, P.plans.map((o, i) => h('button', { type: 'button', class: 'chip', 'aria-pressed': i === 0, onclick: () => { st.plan = i; $$('.chip', chipsEl).forEach((c, j) => c.setAttribute('aria-pressed', j === i)); upd(); } }, `${o.label} · ${fmt(o.price)}/m²`)));
    const num = h('input', { type: 'number', inputmode: 'numeric', min: 1, value: st.m2, 'aria-label': 'Metros cuadrados' });
    const range = h('input', { type: 'range', class: 'range', min: 10, max: 600, step: 5, value: st.m2, 'aria-label': 'Metros cuadrados' });
    range.addEventListener('input', () => { st.m2 = +range.value; num.value = st.m2; upd(); });
    num.addEventListener('input', () => { st.m2 = Math.max(1, Math.min(10000, +num.value || 1)); range.value = st.m2; upd(); });
    ctrl.append(h('span', { class: 'calc__lbl' }, 'Tipo'), chipsEl, h('div', { class: 'calc__area' }, h('span', { class: 'calc__lbl' }, 'Área'), h('div', { class: 'stepper stepper--area' }, num, h('span', { class: 'calc__lbl' }, 'm²'))), range);
    calc = () => { const o = P.plans[st.plan]; const tot = Math.round(o.price * st.m2 * 100) / 100; return { price: tot, mathTxt: `${st.m2} m² × ${fmt(o.price)}`, line: { key: `home:${s.id}:${st.plan}:${st.m2}`, title: `${s.name}: ${o.label}`, detail: `${st.m2} m² a ${fmt(o.price)}/m²`, price: tot, qty: 1 } }; };
  }
  const add = h('button', { type: 'button', class: 'add', onclick: e => addLine(calc().line, e.currentTarget) }, icon('i-plus'), h('span', {}, 'Agregar'));
  priceEls.push({ el: priceEl, get: () => calc().price, home: true });
  function upd() { const r = calc(); odo(priceEl, r.price); maxEl.textContent = r.max ? ' a ' + fmt(r.max) : ''; math.textContent = r.mathTxt; }
  homeBox.append(h('article', { class: 'calc', 'data-reveal': '' },
    h('div', { class: 'calc__head' }, h('div', {}, h('h3', { class: 'calc__name' }, s.name), s.time ? h('p', { class: 'calc__time' }, icon('i-clock'), s.time) : null)),
    s.img ? h('div', { class: 'calc__img' }, picture(s.img, s.name, '(min-width: 900px) 600px, 90vw')) : null,
    bulletList(s.bullets),
    s.idealFor ? h('p', { class: 'calc__ideal' }, 'Ideal para: ' + s.idealFor.join(', ').toLowerCase() + '.') : null,
    ctrl,
    h('div', { class: 'calc__foot' }, h('div', {}, h('small', {}, 'Total estimado'), h('div', {}, priceEl, maxEl), math), add),
    P.monthly ? h('div', { class: 'calc__quote' }, h('span', {}, P.monthly), h('button', { type: 'button', onclick: e => addLine({ key: `home:${s.id}:monthly`, title: `${s.name}: plan mensual`, detail: 'tarifa especial', price: null }, e.currentTarget) }, 'Solicitar tarifa')) : null));
  upd();
});

/* ---------- Cobertura y mapa ---------- */
const geo = D.contact.geo;
const zones = geo?.areas?.features || D.contact.coverage.map(n => ({ properties: { name: n } }));
$('[data-coverage]').append(...zones.map((f, i) => h('li', {}, h('span', { class: 'cov__n' }, String(i + 1).padStart(2, '0')), h('div', {}, h('b', {}, f.properties.name), f.properties.detail ? h('small', {}, f.properties.detail) : null))));

const mapCanvas = $('[data-map-canvas]');
const ML = 'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl';
let mapState = 'idle', mapObj = null;
function mapFallback() {
  if (mapState === 'live' || mapState === 'fallback') return;
  mapState = 'fallback';
  try { mapObj?.remove(); } catch (e) {}
  mapCanvas.replaceChildren(h('img', { class: 'map__fallback', src: 'assets/map-fallback.webp', alt: 'Mapa de Guayaquil y Samborondón con las zonas de cobertura de Nemo: Vía Samborondón y Ceibos / Vía la Costa', loading: 'lazy' }));
  mapCanvas.classList.add('is-fallback');
  const cap = $('.map__cap'); if (cap) cap.textContent = 'Zonas aproximadas de cobertura.';
}
function pinEl(name) { return h('div', { class: 'pin' }, h('span', { class: 'pin__label' }, name), h('span', { class: 'pin__dot' })); }
function bounds() {
  let a = [180, 90, -180, -90];
  for (const f of geo.areas.features) for (const [x, y] of f.geometry.coordinates[0]) a = [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)];
  return [[a[0], a[1]], [a[2], a[3]]];
}
function startMap() {
  if (mapState !== 'idle' || !geo) return;
  mapState = 'loading';
  const timer = setTimeout(mapFallback, 6000);
  document.head.append(h('link', { rel: 'stylesheet', href: ML + '.css' }));
  const js = h('script', { src: ML + '.js', async: true });
  js.onerror = () => { clearTimeout(timer); mapFallback(); };
  js.onload = () => {
    if (mapState !== 'loading') return;
    try {
      const gl = window.maplibregl;
      const m = mapObj = new gl.Map({
        container: mapCanvas, style: 'https://tiles.openfreemap.org/styles/dark',
        center: geo.center, zoom: geo.zoom, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false, touchPitch: false,
        attributionControl: { compact: false },
        locale: {
          'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + rueda para hacer zoom en el mapa',
          'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + rueda para hacer zoom en el mapa',
          'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa',
          'NavigationControl.ZoomIn': 'Acercar', 'NavigationControl.ZoomOut': 'Alejar',
        },
      });
      m.on('error', () => {});
      m.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');
      m.on('load', () => {
        if (mapState !== 'loading') return;
        clearTimeout(timer); mapState = 'live';
        m.addSource('zonas', { type: 'geojson', data: geo.areas });
        m.addLayer({ id: 'zonas-fill', type: 'fill', source: 'zonas', paint: { 'fill-color': D.brand.colors.orange, 'fill-opacity': 0.2 } });
        m.addLayer({ id: 'zonas-line', type: 'line', source: 'zonas', paint: { 'line-color': D.brand.colors.orange, 'line-width': 2 } });
        geo.areas.features.forEach(f => new gl.Marker({ element: pinEl(f.properties.name), anchor: 'bottom' }).setLngLat(f.properties.pin).addTo(m));
        const pad = Math.min(56, mapCanvas.clientWidth * 0.12);
        m.fitBounds(bounds(), { padding: { top: pad + 34, bottom: pad, left: pad, right: pad }, duration: 0 });
        mapCanvas.classList.add('is-live');
      });
    } catch (e) { clearTimeout(timer); mapFallback(); }
  };
  document.head.append(js);
}
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); startMap(); } }, { rootMargin: '600px 0px' });
  io.observe(mapCanvas);
} else startMap();

/* ---------- Mundos ---------- */
const pill = $('.world-switch__pill');
function placePill() {
  const b = $(`[data-world-btn="${html.dataset.world}"]`);
  pill.style.width = b.offsetWidth + 'px';
  pill.style.transform = `translateX(${b.offsetLeft}px)`;
}
function setWorld(w, origin) {
  if (html.dataset.world === w) return;
  const apply = () => {
    html.dataset.world = w;
    $('meta[name="theme-color"]').content = w === 'home' ? '#EAF0F5' : '#F4EFE6';
    $$('[data-world-btn]').forEach(b => b.setAttribute('aria-selected', b.dataset.worldBtn === w));
    $('#world-car').hidden = w !== 'car'; $('#world-home').hidden = w !== 'home';
    placePill(); navState();
  };
  if (origin) { html.style.setProperty('--vt-x', origin.x + 'px'); html.style.setProperty('--vt-y', origin.y + 'px'); }
  if (document.startViewTransition && !reduced) {
    const vt = document.startViewTransition(apply);
    vt.ready.catch(() => {});
    vt.finished.catch(() => {}).then(() => window.ScrollTrigger?.refresh());
  }
  else { apply(); window.ScrollTrigger?.refresh(); }
}
$$('[data-world-btn]').forEach(b => b.addEventListener('click', e => setWorld(b.dataset.worldBtn, { x: e.clientX, y: e.clientY })));
$$('[data-go-world]').forEach(a => a.addEventListener('click', e => {
  const w = a.dataset.goWorld; const target = $(a.getAttribute('href'));
  e.preventDefault();
  setMenu(false);
  setWorld(w, { x: e.clientX, y: e.clientY });
  setTimeout(() => { if (window.__lenis) window.__lenis.scrollTo(target, { offset: -80 }); else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); }, 60);
}));
addEventListener('resize', placePill);
document.fonts?.ready.then(placePill);

/* ---------- Navegación y menú ---------- */
const nav = $('[data-nav]');
const menu = $('[data-menu]'), burger = $('[data-menu-toggle]');
function setMenu(open) {
  const was = burger.getAttribute('aria-expanded') === 'true';
  if (open === was) return;
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  document.body.classList.toggle('menu-open', open);
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
    window.__lenis?.stop();
    setTimeout(() => $('a', menu)?.focus({ preventScroll: true }), 60);
  } else {
    menu.classList.remove('is-open');
    window.__lenis?.start();
    setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, reduced ? 0 : 320);
    burger.focus({ preventScroll: true });
  }
}
burger.addEventListener('click', () => setMenu(true));
$('[data-menu-close]').addEventListener('click', () => setMenu(false));
$$('a:not([data-go-world])', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
menu.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const f = $$('a,button', menu); const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!menu.hidden) setMenu(false);
  if (!chips.hidden) { sizeMenu(false); sizeBtn.focus(); }
  if (!$('[data-cart-sheet]').hidden && !wide.matches) toggleSheet(false);
});
const picker0 = $('.sizes__picker'), plansSec = $('#planes');
let navRaf = 0;
function navState() {
  navRaf = 0;
  nav.classList.toggle('is-scrolled', scrollY > 8);
  const nh = nav.offsetHeight;
  const show = html.dataset.world === 'car' && picker0.getBoundingClientRect().bottom < nh && plansSec.getBoundingClientRect().bottom > nh + 120;
  nav.classList.toggle('has-size', show);
  if (!show && !chips.hidden) sizeMenu(false);
}
addEventListener('scroll', () => { if (!navRaf) navRaf = requestAnimationFrame(navState); }, { passive: true });

/* ---------- Botón flotante: aparece al pasar el hero ---------- */
new IntersectionObserver(([e]) => document.body.classList.toggle('past-hero', !e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 }).observe($('.hero'));

/* ---------- Inicio ---------- */
setSize(size, false);
renderCart();
placePill();
navState();

/* ---------- Movimiento ---------- */
function motion() {
  const g = window.gsap, ST = window.ScrollTrigger;
  const startHero = () => { wipe?.startDemo(); };
  if (!g || reduced) { startHero(); return; }
  html.classList.add('js-motion');
  g.registerPlugin(ST, window.SplitText);

  if (window.Lenis && fine) {
    const lenis = new window.Lenis({ lerp: .11 });
    window.__lenis = lenis;
    lenis.on('scroll', ST.update);
    g.ticker.add(t => lenis.raf(t * 1000)); g.ticker.lagSmoothing(0);
  }

  g.from('.hero__copy > *', { y: 28, opacity: 0, stagger: .08, duration: 1, ease: 'expo.out', delay: .05, clearProps: 'transform,opacity' });
  g.from('.hero__stage', { clipPath: 'inset(0 0 100% 0)', duration: 1.2, ease: 'expo.inOut', clearProps: 'clipPath' });
  startHero();

  const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal]').forEach(el => rio.observe(el));

  document.fonts.ready.then(() => {
    $$('[data-split]').forEach(el => {
      const split = window.SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
      g.from(split.lines, { yPercent: 105, duration: 1.1, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: el, start: 'top 90%' } });
    });
    ST.refresh();
  });

  g.from('.final__logo', { y: 40, rotate: -6, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.final', start: 'top 80%' } });
}
if (document.readyState === 'complete') motion(); else addEventListener('load', motion, { once: true });
