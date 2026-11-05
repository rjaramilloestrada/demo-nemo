import { initWipe } from './fx/wipe.js';

const D = JSON.parse(document.getElementById('data').textContent);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
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

/* Odómetro: cada dígito es un carrete que rueda */
function odo(el, value) {
  const str = value == null ? 'Consultar' : fmt(value);
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
  const w = Array.from({ length: 10 }, (_, d) => { m.textContent = String(d).repeat(10); return m.getBoundingClientRect().width / 10; });
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
document.fonts?.ready.then(() => { for (const p of priceEls) { digitW.delete(p.el); if (p.el.dataset.v) setReels(p.el, p.el.dataset.v); } });

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
  const a = btn.getBoundingClientRect(), b = $('[data-cart-count]').getBoundingClientRect();
  const f = h('i', { class: 'flyer' });
  document.body.append(f);
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2 || innerWidth / 2, y1 = b.top + b.height / 2 || innerHeight - 40;
  f.animate([
    { transform: `translate(${x0}px,${y0}px) rotate(-45deg) scale(1)` },
    { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 120}px) rotate(-45deg) scale(1.4)`, offset: .45 },
    { transform: `translate(${x1}px,${y1}px) rotate(-45deg) scale(.4)`, opacity: .3 },
  ], { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => f.remove();
  f.style.left = '0px'; f.style.top = '0px';
}
function addLine(line, btn) {
  const ex = cart.find(l => l.key === line.key);
  if (ex) ex.qty += line.qty || 1; else cart.push({ qty: 1, ...line });
  saveCart(); flyFrom(btn);
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
  $('[data-cart-total]').textContent = t.ranged ? `${fmt(t.min)} a ${fmt(t.max)}` : fmt(t.min);
  $('[data-cart-lines]').replaceChildren(...cart.map(l => h('li', {},
    h('span', {}, (l.qty > 1 ? l.qty + ' × ' : '') + l.title, l.detail ? h('small', {}, l.detail) : null),
    h('b', {}, l.price == null ? 'Por confirmar' : lineMax(l) != null ? `${fmt(lineTotal(l))} a ${fmt(lineMax(l))}` : fmt(lineTotal(l))),
    h('button', { type: 'button', 'aria-label': 'Quitar ' + l.title, onclick: () => removeKey(l.key) }, icon('i-x')))));
  const note = $('[data-cart-note]');
  const msgs = [];
  if (t.ranged) msgs.push('Algunos precios son un rango que Nemo confirma según la pieza.');
  if (t.pending) msgs.push(`${t.pending} ítem${t.pending > 1 ? 's' : ''} se cotiza${t.pending > 1 ? 'n' : ''} por WhatsApp.`);
  note.hidden = !msgs.length; note.textContent = msgs.join(' ');
  $('[data-cart-send]').href = waLink(cartMessage());
  if (!cart.length) toggleSheet(false);
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
function toggleSheet(open) {
  const btn = $('[data-cart-toggle]'), sheet = $('[data-cart-sheet]');
  open = open ?? btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', open); sheet.hidden = !open;
}
$('[data-cart-toggle]').addEventListener('click', () => toggleSheet());
$('[data-cart-clear]').addEventListener('click', () => { cart.splice(0); saveCart(); });
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

/* ---------- Marquee ---------- */
const words = ['Classic Wash', 'Premium Wash', 'Detailing Pro', 'Cerámico 9H', 'Gtechniq', 'Alfombras', 'Colchones', 'Muebles', 'Oficinas', 'Ventanales'];
const track = $('[data-marquee]');
for (let k = 0; k < 2; k++) words.forEach(w => track.append(h('span', {}, w)));

/* ---------- Selector de tamaño ---------- */
const CARS = {
  S: { body: 'M14,58 L12,46 Q14,38 34,37 L58,35 Q70,22 90,21 L122,21 Q138,22 150,35 L176,39 Q190,42 190,52 L190,58 Z', glass: 'M62,35 L92,24 L120,24 L144,35 Z', w: [46, 154, 11], s: .86 },
  M: { body: 'M10,58 L9,40 Q10,30 28,28 L46,27 Q56,13 76,12 L132,12 Q148,13 158,28 L178,32 Q192,35 192,48 L192,58 Z', glass: 'M50,27 L78,15 L130,15 L152,28 Z', w: [44, 158, 12], s: .93 },
  L: { body: 'M6,58 L6,24 Q6,10 22,9 L40,8 Q46,7 56,6 L146,6 Q156,7 164,22 L182,26 Q194,29 194,42 L194,58 Z', glass: 'M44,22 L58,10 L144,10 L158,22 Z', w: [42, 160, 13], s: 1 },
  XL: { body: 'M4,58 L4,30 Q4,28 8,28 L100,28 Q104,7 112,6 L150,6 Q158,7 166,24 L184,27 Q196,30 196,42 L196,58 Z', glass: 'M104,27 L114,10 L148,10 L160,24 Z', w: [40, 164, 13.5], s: 1.04 },
};
const carSvg = $('.sizes__car');
function drawCar(id, animate) {
  const c = CARS[id];
  const set = { body: c.body, glass: c.glass };
  const g = window.gsap;
  if (animate && g && !reduced) {
    g.to('.sizes__body', { attr: { d: set.body }, duration: .8, ease: 'expo.out' });
    g.to('.sizes__glass', { attr: { d: set.glass }, duration: .8, ease: 'expo.out' });
    g.to('.sizes__w1,.sizes__h1', { attr: { cx: c.w[0] }, duration: .8, ease: 'expo.out' });
    g.to('.sizes__w2,.sizes__h2', { attr: { cx: c.w[1] }, duration: .8, ease: 'expo.out' });
    g.to('.sizes__w1,.sizes__w2', { attr: { r: c.w[2] }, duration: .8, ease: 'expo.out' });
    g.fromTo(carSvg, { y: -10 }, { y: 0, scale: c.s, duration: .9, ease: 'bounce.out', transformOrigin: '50% 100%' });
  } else {
    $('.sizes__body').setAttribute('d', set.body); $('.sizes__glass').setAttribute('d', set.glass);
    $$('.sizes__w1,.sizes__h1').forEach(e => e.setAttribute('cx', c.w[0]));
    $$('.sizes__w2,.sizes__h2').forEach(e => e.setAttribute('cx', c.w[1]));
    $$('.sizes__w1,.sizes__w2').forEach(e => e.setAttribute('r', c.w[2]));
    carSvg.style.transform = `scale(${c.s})`; carSvg.style.transformOrigin = '50% 100%';
  }
  $('.sizes__examples').textContent = sizeById(id).examples;
}
const picker = $('[data-size-picker]');
const chips = $('[data-size-chips]');
D.sizes.forEach(s => {
  picker.append(h('button', { type: 'button', role: 'radio', class: 'size-opt magnetic-soft', 'data-size': s.id, 'aria-checked': 'false', onclick: () => setSize(s.id, true) },
    h('b', {}, s.label), h('small', {}, s.examples), h('i', {}, icon('i-check'))));
  chips.append(h('button', { type: 'button', 'data-size': s.id, 'aria-pressed': 'false', onclick: () => setSize(s.id, true) }, s.id === 'XL' ? 'XL' : s.label.split(' ')[0]));
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

/* ---------- Escalera de servicios ---------- */
function bulletList(items, visible = 4) {
  return h('ul', { class: 'svc__list' }, items.map((t, i) => h('li', { class: i >= visible ? 'is-more' : null }, t)));
}
function picture(name, alt, sizes = '(min-width: 900px) 400px, 86vw') {
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
const ladderTrack = $('[data-ladder-track]');
D.car.ladder.forEach(s => {
  const priceEl = h('span', { class: 'price' });
  priceEls.push({ el: priceEl, get: () => s.price[size] });
  const key = () => `car:${s.id}:${size}`;
  const add = h('button', { type: 'button', class: 'add', onclick: e => {
    if (cart.some(l => l.key === key())) { removeKey(key()); return; }
    addLine({ key: key(), title: s.name, detail: sizeLabel(size), price: s.price[size] }, e.currentTarget);
  } });
  addButtons.push({ btn: add, key });
  const more = s.bullets.length > 4;
  const card = h('article', { class: 'svc', 'data-lvl': s.level, style: `--lvl:${s.level}` },
    h('div', { class: 'svc__top' }, h('span', { class: 'svc__n' }, String(s.n).padStart(2, '0')),
      h('span', { class: 'svc__lvl', 'aria-label': `Nivel ${s.level} de 6` }, Array.from({ length: 6 }, (_, i) => h('i', { class: i < s.level ? 'on' : null })))),
    h('div', {}, s.family ? h('p', { class: 'svc__fam' }, s.family) : s.kicker ? h('p', { class: 'svc__fam' }, s.kicker) : null, h('h3', { class: 'svc__name' }, s.name)),
    s.lead ? h('p', { class: 'svc__lead' }, s.lead) : null,
    s.ba ? beforeAfter(s.ba, null, '4/3') : s.img ? h('div', { class: 'svc__img' }, picture(s.img, s.name)) : null,
    s.bulletsTitle ? h('p', { class: 'svc__bt' }, s.bulletsTitle) : null,
    bulletList(s.bullets),
    more ? h('button', { type: 'button', class: 'svc__more', onclick: e => { const c = e.currentTarget.closest('.svc'); c.classList.toggle('is-open'); e.currentTarget.textContent = c.classList.contains('is-open') ? 'Ver menos' : `Ver los ${s.bullets.length} puntos`; window.ScrollTrigger?.refresh(); } }, `Ver los ${s.bullets.length} puntos`) : null,
    s.note ? h('p', { class: 'svc__lead' }, s.note) : null,
    s.addon ? (() => {
      const k = () => `car:${s.id}-addon:${size}`;
      const b = h('button', { type: 'button', class: 'add', style: 'height:36px;padding:0 12px;font-size:12.5px', onclick: e => cart.some(l => l.key === k()) ? removeKey(k()) : addLine({ key: k(), title: s.addon.name + ' (adicional a ' + s.name + ')', price: s.addon.price }, e.currentTarget) });
      addButtons.push({ btn: b, key: k });
      return h('div', { class: 'svc__addon' }, h('span', {}, 'Adicional: ', h('b', {}, s.addon.name + ' ' + fmt(s.addon.price))), b);
    })() : null,
    h('div', { class: 'svc__foot' },
      h('div', { class: 'svc__price' }, h('small', { 'data-size-label': '' }), priceEl,
        s.duration ? h('span', { class: 'svc__dur' }, icon('i-clock'), 'Aprox. ' + s.duration) : null),
      add));
  ladderTrack.append(card);
});
sizeHooks.push(() => $$('[data-size-label]').forEach(e => e.textContent = sizeLabel(size)));

/* ---------- Adicionales ---------- */
const extrasBox = $('[data-extras]');
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
    x.img ? h('div', { class: 'extra__img' }, picture(x.img, x.name + ': antes y después', '(min-width: 700px) 380px, 90vw')) : null,
    h('div', { class: 'extra__row' }, h('p', { class: 'extra__name' }, x.name, x.detail ? h('small', {}, x.detail) : null), priceEl),
    chipsEl,
    h('div', { class: 'extra__row' }, h('small', { class: 'muted', 'data-extra-size': x.price ? '' : null }, x.price ? '' : 'Precio único'), add)));
});
sizeHooks.push(() => $$('[data-extra-size]').forEach(e => e.textContent = sizeLabel(size) + (size === 'XL' ? ': consultar' : '')));

/* ---------- Planes ---------- */
const plansBox = $('[data-plans]');
D.car.plans.forEach((p, idx) => {
  const base = D.car.ladder.find(s => s.id === p.baseService);
  const priceEl = h('span', { class: 'price' });
  priceEls.push({ el: priceEl, get: () => p.price[size] });
  const vs = h('p', { class: 'plan__vs' }), save = h('span', { class: 'plan__save' });
  const upd = () => {
    const loose = base.price[size] * p.baseCount, diff = loose - p.price[size];
    vs.replaceChildren(`${p.baseCount} ${base.name} sueltos: `, h('s', {}, fmt(loose)));
    save.textContent = diff > 0 ? `Ahorras ${fmt(diff)} al mes` : '';
    save.hidden = !(diff > 0);
  };
  sizeHooks.push(upd);
  const key = () => `plan:${p.id}:${size}`;
  const add = h('button', { type: 'button', class: 'add', onclick: e => cart.some(l => l.key === key()) ? removeKey(key()) : addLine({ key: key(), title: p.name + ' (mensual)', detail: sizeLabel(size) + ', ' + p.includes, price: p.price[size] }, e.currentTarget) });
  addButtons.push({ btn: add, key, label: 'Lo quiero' });
  const hot = idx === 1;
  plansBox.append(h('article', { class: 'plan' + (hot ? ' plan--hot' : ''), 'data-reveal': '' },
    hot ? h('div', { class: 'plan__bubbles', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h('i', { style: `left:${(i * 7.3) % 100}%;width:${8 + (i * 13) % 26}px;height:${8 + (i * 13) % 26}px;animation-duration:${6 + (i % 5) * 1.7}s;animation-delay:-${i * .8}s` }))) : null,
    h('div', { class: 'plan__top' }, h('p', { class: 'plan__name' }, p.name), save),
    h('p', { class: 'plan__inc' }, p.includes.replace(/gratis$/i, 'gratis')),
    h('div', { class: 'plan__price' }, priceEl, h('span', { class: 'muted' }, '/ mes')),
    vs,
    h('div', {}, add)));
});

/* ---------- Hogar y oficina ---------- */
const rail = $('[data-ba-rail]');
const homeBox = $('[data-home]');
const baCaptions = { rugs: 'Alfombra', furniture: 'Sofá', mattress: 'Colchón' };
const baRatio = { rugs: '706/333', furniture: '2/1', mattress: '353/520' };
D.home.services.filter(s => s.ba).forEach(s => rail.append(beforeAfter(s.ba, baCaptions[s.id], baRatio[s.id])));

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
  const priceEl = h('span', { class: 'price' }), maxEl = h('span', { class: 'muted', style: 'font-weight:600' }), math = h('p', { class: 'calc__math' });
  const ctrl = h('div', { class: 'calc__ctrl' });
  let calc; // () => {price, max, title, detail, key, qty}
  if (P.type === 'options') {
    const chipsEl = h('div', { class: 'chips', role: 'group', 'aria-label': 'Elige ' + P.unit }, P.options.map((o, i) => h('button', { type: 'button', class: 'chip', 'aria-pressed': i === 0, onclick: e => { st.opt = i; $$('.chip', chipsEl).forEach((c, j) => c.setAttribute('aria-pressed', j === i)); upd(); } }, o.label)));
    ctrl.append(h('span', { class: 'calc__lbl' }, 'Elige'), chipsEl, h('span', { class: 'calc__lbl' }, 'Cantidad'), stepper(1, 1, v => { st.qty = v; upd(); }, 'Cantidad'));
    calc = () => { const o = P.options[st.opt]; return { unit: o.price, price: o.price * st.qty, max: o.max ? o.max * st.qty : null, mathTxt: `${st.qty} × ${o.max ? fmt(o.price) + ' a ' + fmt(o.max) : fmt(o.price)}`, line: { key: `home:${s.id}:${st.opt}`, title: `${s.name}: ${o.label}`, price: o.price, max: o.max ?? null, qty: st.qty } }; };
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
    ctrl.append(h('span', { class: 'calc__lbl' }, 'Tipo'), chipsEl, h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px' }, h('span', { class: 'calc__lbl' }, 'Área'), h('div', { class: 'stepper', style: 'padding:0 14px' }, num, h('span', { class: 'muted' }, 'm²'))), range);
    calc = () => { const o = P.plans[st.plan]; const tot = Math.round(o.price * st.m2 * 100) / 100; return { price: tot, mathTxt: `${st.m2} m² × ${fmt(o.price)}`, line: { key: `home:${s.id}:${st.plan}:${st.m2}`, title: `${s.name}: ${o.label}`, detail: `${st.m2} m² a ${fmt(o.price)}/m²`, price: tot, qty: 1 } }; };
  }
  const add = h('button', { type: 'button', class: 'add', onclick: e => addLine(calc().line, e.currentTarget) }, icon('i-plus'), h('span', {}, 'Agregar'));
  priceEls.push({ el: priceEl, get: () => calc().price, home: true });
  function upd() { const r = calc(); odo(priceEl, r.price); maxEl.textContent = r.max ? ' a ' + fmt(r.max) : ''; math.textContent = r.mathTxt; }
  const card = h('article', { class: 'calc', 'data-reveal': '' },
    h('div', { class: 'calc__head' }, h('div', {}, h('h3', { class: 'calc__name' }, s.name), s.time ? h('p', { class: 'calc__time' }, icon('i-clock'), s.time) : null)),
    s.img ? h('div', { class: 'calc__img' }, picture(s.img, s.name, '(min-width:800px) 600px, 90vw')) : null,
    bulletList(s.bullets, 6),
    s.idealFor ? h('p', { class: 'muted', style: 'font-size:13px' }, 'Ideal para: ' + s.idealFor.join(', ').toLowerCase() + '.') : null,
    ctrl,
    h('div', { class: 'calc__foot' }, h('div', {}, h('small', { class: 'muted', style: 'font-size:11.5px' }, 'Total estimado'), h('div', {}, priceEl, maxEl), math), add),
    P.monthly ? h('div', { class: 'calc__quote' }, h('span', {}, P.monthly), h('button', { type: 'button', onclick: e => addLine({ key: `home:${s.id}:monthly`, title: `${s.name}: plan mensual`, detail: 'tarifa especial', price: null }, e.currentTarget) }, 'Solicitar tarifa')) : null);
  homeBox.append(card);
  upd();
});

/* ---------- Cobertura ---------- */
$('[data-coverage]').append(...D.contact.coverage.map(z => h('li', {}, z)));
const grid = $('.map__grid');
const svgLine = (x1, y1, x2, y2) => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => l.setAttribute(k, v)); grid.append(l); };
for (let x = 0; x <= 400; x += 40) svgLine(x, 0, x, 320);
for (let y = 0; y <= 320; y += 40) svgLine(0, y, 400, y);

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
    $('meta[name="theme-color"]').content = w === 'home' ? D.brand.colors.navy : D.brand.colors.carbon;
    $$('[data-world-btn]').forEach(b => b.setAttribute('aria-selected', b.dataset.worldBtn === w));
    $('#world-car').hidden = w !== 'car'; $('#world-home').hidden = w !== 'home';
    placePill();
  };
  if (origin) { html.style.setProperty('--vt-x', origin.x + 'px'); html.style.setProperty('--vt-y', origin.y + 'px'); }
  if (document.startViewTransition && !reduced) document.startViewTransition(apply).finished.then(() => window.ScrollTrigger?.refresh());
  else { apply(); window.ScrollTrigger?.refresh(); }
}
$$('[data-world-btn]').forEach(b => b.addEventListener('click', e => setWorld(b.dataset.worldBtn, { x: e.clientX, y: e.clientY })));
$$('[data-go-world]').forEach(a => a.addEventListener('click', e => {
  const w = a.dataset.goWorld; const target = $(a.getAttribute('href'));
  e.preventDefault();
  setWorld(w, { x: e.clientX, y: e.clientY });
  setTimeout(() => { if (window.__lenis) window.__lenis.scrollTo(target, { offset: -70 }); else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); }, 60);
}));
addEventListener('resize', placePill);
document.fonts?.ready.then(placePill);

/* ---------- Botón flotante: aparece al pasar el hero ---------- */
new IntersectionObserver(([e]) => document.body.classList.toggle('past-hero', !e.isIntersecting), { rootMargin: '-40% 0px 0px 0px' }).observe($('.hero'));

/* ---------- Inicio ---------- */
setSize(size, false);
renderCart();
placePill();

/* ---------- Movimiento (GSAP) ---------- */
function motion() {
  const g = window.gsap, ST = window.ScrollTrigger;
  const intro = $('.intro');
  const startHero = () => { wipe?.startDemo(); };
  if (!g || reduced) { intro?.remove(); $$('[data-reveal]').forEach(e => { e.style.opacity = 1; e.style.transform = 'none'; }); startHero(); return; }
  g.registerPlugin(ST, window.SplitText);

  // Scroll suave
  if (window.Lenis && fine) {
    const lenis = new window.Lenis({ lerp: .11 });
    window.__lenis = lenis;
    lenis.on('scroll', ST.update);
    g.ticker.add(t => lenis.raf(t * 1000)); g.ticker.lagSmoothing(0);
  }

  // Intro de marca
  const heroIn = () => {
    g.from('.hero__stage', { clipPath: 'inset(12% 12% 12% 12% round 28px)', scale: 1.06, duration: 1.3, ease: 'expo.out' });
    g.from('.hero__copy > *', { y: 30, opacity: 0, stagger: .08, duration: 1, ease: 'expo.out', delay: .1, clearProps: 'transform' });
    g.from('.nav', { y: -20, opacity: 0, duration: .8, ease: 'expo.out', delay: .2, clearProps: 'transform,opacity' });
    startHero();
  };
  if (intro && getComputedStyle(intro).display !== 'none') {
    try { sessionStorage.setItem('intro', '1'); } catch (e) {}
    const tl = g.timeline({ onComplete: () => { intro.remove(); } });
    tl.set('.intro__squeegee', { opacity: 1 })
      .to('.intro__squeegee', { x: () => innerWidth, duration: .75, ease: 'power3.inOut' }, .1)
      .to('.intro__logo', { clipPath: 'inset(0 0% 0 0)', duration: .6, ease: 'power3.inOut' }, .2)
      .to('.intro__logo', { scale: .9, opacity: 0, duration: .45, ease: 'power2.in' }, '+=.25')
      .to(intro, { yPercent: -100, duration: .8, ease: 'expo.inOut' }, '-=.2')
      .add(heroIn, '-=.55');
  } else { intro?.remove(); heroIn(); }

  // Títulos por líneas
  document.fonts.ready.then(() => {
    $$('[data-split]').forEach(el => {
      const split = window.SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
      g.from(split.lines, { yPercent: 105, duration: 1.1, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: el, start: 'top 88%' } });
    });
    ST.refresh();
  });

  // Reveals
  ST.batch('[data-reveal]', { start: 'top 90%', onEnter: els => g.to(els, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: .08, overwrite: true }) });

  // Nav
  const nav = $('[data-nav]');
  ST.create({ start: 0, end: 'max', onUpdate: s => {
    nav.classList.toggle('is-scrolled', s.scroll() > 40);
    const hide = s.direction === 1 && s.scroll() > 400;
    nav.classList.toggle('is-hidden', hide); html.classList.toggle('nav-up', hide);
  } });

  // Marquee con velocidad del scroll
  const mq = $('[data-marquee]');
  let x = 0, skew = 0, vel = 0;
  ST.create({ start: 0, end: 'max', onUpdate: s => { vel = s.getVelocity(); } });
  g.ticker.add(() => {
    const half = mq.scrollWidth / 2; if (!half) return;
    x -= .6 + Math.min(Math.abs(vel) / 260, 8); if (-x >= half) x += half;
    skew += (g.utils.clamp(-10, 10, vel / -260) - skew) * .1; vel *= .92;
    mq.style.transform = `translate3d(${x}px,0,0) skewX(${skew}deg)`;
  });

  // Escalera fijada (escritorio) o carrusel (móvil)
  const ladder = $('[data-ladder]'), trk = $('[data-ladder-track]'), bar = $('.ladder__bar');
  const cards = $$('.svc', trk);
  const setProg = p => { bar.style.setProperty('--lp', .1 + .9 * p); cards.forEach(c => c.style.setProperty('--sheen', (-60 + p * 120) + '%')); };
  const mm = g.matchMedia();
  mm.add('(min-width: 900px) and (min-height: 760px)', () => {
    const intro = $('.ladder__intro'); trk.prepend(intro); ladder.classList.add('is-pinned');
    const dist = () => Math.max(0, trk.scrollWidth - innerWidth);
    g.to(trk, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: ladder, start: 'top top+=' + 100, end: () => '+=' + dist(), pin: true, scrub: .6, invalidateOnRefresh: true, anticipatePin: 1, onUpdate: s => setProg(s.progress) } });
    return () => { ladder.prepend(intro); ladder.classList.remove('is-pinned'); };
  });
  mm.add('(max-width: 899px), (max-height: 759px)', () => {
    ladder.classList.add('is-static');
    const onS = () => setProg(trk.scrollLeft / Math.max(1, trk.scrollWidth - trk.clientWidth));
    trk.addEventListener('scroll', onS, { passive: true }); onS();
    return () => { ladder.classList.remove('is-static'); trk.removeEventListener('scroll', onS); };
  });

  // Barra de tamaño fija mientras recorres los servicios de autos
  ST.create({ trigger: '.ladder', endTrigger: '#planes', start: 'top 60%', end: 'bottom 40%', toggleClass: { targets: '[data-sizebar]', className: 'is-on' } });

  // Mapa: dibujar rutas
  $$('.map__river, .map__road').forEach(p => {
    const L = p.getTotalLength();
    g.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', scrollTrigger: { trigger: '.map', start: 'top 80%' }, onComplete: () => { if (p.classList.contains('map__road')) p.style.strokeDasharray = '4 6'; } });
  });
  g.from('.map__zone', { scale: 0, transformOrigin: 'center', stagger: .25, duration: 1, ease: 'back.out(2)', scrollTrigger: { trigger: '.map', start: 'top 70%' } });

  // Logo final
  g.from('.final__logo', { y: 40, rotate: -8, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.final', start: 'top 80%' } });
  g.to('.badge', { rotate: 360, duration: 18, repeat: -1, ease: 'none' });

  // Botones magnéticos
  if (fine) $$('.magnetic').forEach(b => {
    const xTo = g.quickTo(b, 'x', { duration: .5, ease: 'power3' }), yTo = g.quickTo(b, 'y', { duration: .5, ease: 'power3' });
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * .3); yTo((e.clientY - r.top - r.height / 2) * .35); });
    b.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}
if (document.readyState === 'complete') motion(); else addEventListener('load', motion, { once: true });
