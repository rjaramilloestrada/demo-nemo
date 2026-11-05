// Hero "Limpia la pantalla": el usuario borra la foto sucia y aparece la limpia.
export function initWipe(stage, { beforeSrc, threshold = 0.55, onProgress, onClean, autoDemoDelay = 1800 } = {}) {
  const canvas = stage.querySelector('.hero__canvas');
  const fx = stage.querySelector('.hero__fx');
  const cursor = stage.querySelector('.hero__cursor');
  const ctx = canvas.getContext('2d');
  const fctx = fx.getContext('2d');
  const mask = document.createElement('canvas'); // máscara de baja resolución para medir avance
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  const img = new Image();
  img.decoding = 'async';
  img.src = beforeSrc;

  let W = 0, H = 0, dpr = 1, brush = 60, clean = false, touched = false, last = null, demoTimer, measureT = 0;
  const bubbles = [];
  let raf = 0;

  function layout() {
    const r = stage.getBoundingClientRect();
    if (Math.round(r.width) === W && Math.round(r.height) === H) return;
    W = Math.round(r.width); H = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [canvas, fx]) { c.width = W * dpr; c.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mask.width = 48; mask.height = Math.round(48 * H / W);
    brush = Math.max(46, Math.min(W, H) * 0.17);
    paintDirty();
  }

  function paintDirty() {
    if (clean || !img.complete || !img.naturalWidth) return;
    ctx.globalCompositeOperation = 'source-over';
    // object-fit: cover con foco 50% 40%
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (W - w) * 0.5, (H - h) * 0.4, w, h);
    // velo de polvo para que el contraste sea evidente
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(120,105,85,.20)');
    g.addColorStop(1, 'rgba(60,55,45,.28)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    stage.classList.add('is-ready');
    mctx.globalCompositeOperation = 'source-over';
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, mask.width, mask.height);
  }

  function dab(x, y) {
    const r = brush / 2;
    const g = ctx.createRadialGradient(x, y, r * 0.25, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    const k = mask.width / W;
    mctx.globalCompositeOperation = 'destination-out';
    mctx.beginPath(); mctx.arc(x * k, y * k, r * k * 0.8, 0, Math.PI * 2); mctx.fill();
    if (Math.random() < 0.55) spawnBubble(x + (Math.random() - .5) * r, y + (Math.random() - .5) * r);
  }

  function stroke(x, y) {
    if (clean) return;
    if (last) {
      const dx = x - last.x, dy = y - last.y, d = Math.hypot(dx, dy), step = brush / 5;
      for (let i = step; i < d; i += step) dab(last.x + dx * i / d, last.y + dy * i / d);
    }
    dab(x, y);
    last = { x, y };
    const now = performance.now();
    if (now - measureT > 140) { measureT = now; measure(); }
    loop();
  }

  function measure() {
    const d = mctx.getImageData(0, 0, mask.width, mask.height).data;
    let gone = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 128) gone++;
    const p = gone / (d.length / 4);
    onProgress && onProgress(p);
    if (p >= threshold) finish();
  }

  function spawnBubble(x, y, big) {
    bubbles.push({ x, y, r: big ? 3 + Math.random() * 7 : 2 + Math.random() * 5, vx: (Math.random() - .5) * (big ? 3 : .6), vy: big ? -1 - Math.random() * 3 : -.2 - Math.random() * .6, life: 1, drop: !!big });
    if (bubbles.length > 220) bubbles.shift();
  }

  function loop() {
    if (raf) return;
    const tick = () => {
      fctx.clearRect(0, 0, W, H);
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.x += b.vx; b.y += b.vy; b.life -= b.drop ? 0.018 : 0.012;
        if (b.drop) b.vy += 0.12;
        if (b.life <= 0) { bubbles.splice(i, 1); continue; }
        fctx.globalAlpha = Math.max(0, b.life);
        if (b.drop) {
          fctx.fillStyle = '#F05E22';
          fctx.beginPath(); fctx.ellipse(b.x, b.y, b.r * .7, b.r, 0, 0, Math.PI * 2); fctx.fill();
        } else {
          fctx.strokeStyle = 'rgba(255,255,255,.9)'; fctx.lineWidth = 1.2;
          fctx.beginPath(); fctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); fctx.stroke();
          fctx.fillStyle = 'rgba(255,255,255,.55)';
          fctx.beginPath(); fctx.arc(b.x - b.r * .35, b.y - b.r * .35, b.r * .25, 0, Math.PI * 2); fctx.fill();
        }
      }
      fctx.globalAlpha = 1;
      raf = bubbles.length ? requestAnimationFrame(tick) : 0;
    };
    raf = requestAnimationFrame(tick);
  }

  function point(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // Con mouse se limpia al pasar el cursor. Con el dedo, el gesto se captura solo si
  // los primeros 10 px son más horizontales que verticales; si no, la página hace scroll.
  let down = false, pending = null;
  canvas.addEventListener('pointerdown', e => {
    if (clean) return;
    last = null;
    if (e.pointerType === 'mouse') {
      down = true; markTouched();
      canvas.setPointerCapture?.(e.pointerId);
      const p = point(e); stroke(p.x, p.y);
      return;
    }
    down = false;
    pending = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', e => {
    const p = point(e);
    if (cursor) cursor.style.transform = `translate(${p.x}px,${p.y}px)`;
    if (clean) return;
    if (e.pointerType === 'mouse') { markTouched(); stroke(p.x, p.y); return; }
    if (pending && pending.id === e.pointerId) {
      const dx = e.clientX - pending.x, dy = e.clientY - pending.y;
      if (Math.hypot(dx, dy) < 10) return;
      const r = canvas.getBoundingClientRect(), start = { x: pending.x - r.left, y: pending.y - r.top };
      pending = null;
      if (Math.abs(dx) > Math.abs(dy)) {
        down = true; markTouched();
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        stroke(start.x, start.y); stroke(p.x, p.y);
      } else {
        down = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      return;
    }
    if (down) stroke(p.x, p.y);
  });
  const up = () => { down = false; last = null; pending = null; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' || !down) up(); });

  function markTouched() {
    if (touched) return;
    touched = true; clearTimeout(demoTimer);
    stage.closest('.hero')?.classList.add('is-touched');
  }

  // Pasada automática de demostración si nadie toca
  function autoDemo() {
    if (touched || clean) return;
    const t0 = performance.now(), dur = 1300;
    last = null;
    const run = now => {
      if (touched || clean) return;
      const t = Math.min(1, (now - t0) / dur);
      const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = W * (0.12 + 0.76 * e);
      const y = H * (0.30 + 0.18 * Math.sin(e * Math.PI * 2));
      stroke(x, y);
      if (t < 1) requestAnimationFrame(run); else last = null;
    };
    requestAnimationFrame(run);
  }

  function finish() {
    if (clean) return;
    clean = true; clearTimeout(demoTimer);
    // barrido final tipo jalador de izquierda a derecha
    const t0 = performance.now(), dur = 650;
    const sweep = now => {
      const t = Math.min(1, (now - t0) / dur);
      const x = W * t;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, x, H);
      for (let i = 0; i < 4; i++) spawnBubble(x, Math.random() * H);
      loop();
      if (t < 1) requestAnimationFrame(sweep);
      else {
        ctx.clearRect(0, 0, W, H);
        for (let i = 0; i < 26; i++) spawnBubble(W * (.3 + Math.random() * .4), H * (.35 + Math.random() * .2), true);
        loop();
        try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
        onProgress && onProgress(1);
        onClean && onClean();
      }
    };
    requestAnimationFrame(sweep);
  }

  const ro = new ResizeObserver(() => layout());
  ro.observe(stage);
  img.addEventListener('load', () => { W = H = 0; layout(); });
  if (img.complete) layout();

  return {
    startDemo() { demoTimer = setTimeout(autoDemo, autoDemoDelay); },
    finish,
    get clean() { return clean; },
  };
}
