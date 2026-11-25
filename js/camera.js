/* 相机：负责总图的拖动、缩放、惯性和飞行动画。

   关键做法（缩放不闪烁）：
   - 只有底图 #world 用 CSS transform 缩放。
   - 线条在屏幕大小的 SVG 里，由一个 <g id="cam"> 统一变换，线宽用 non-scaling-stroke。
   - 文字和图钉不放在缩放层里：每次相机变化时，通知监听者（app.js）按屏幕坐标重新摆放。

   坐标：世界坐标 = 底图像素（5100 × 3450）。屏幕坐标 = 世界坐标 × k + (x, y)。 */
window.Camera = (() => {
  'use strict';
  const [W, H] = window.PARK.canvas;
  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  const cam = document.getElementById('cam');
  const base = document.getElementById('base');
  const listeners = [];
  const EASE = t => 1 - Math.pow(1 - t, 4);

  let x = 0, y = 0, k = 0.2;              // 当前相机
  let minK = 0.1, maxK = 2.2;
  let vx = 0, vy = 0;                     // 松手后的惯性速度
  let anim = null, dirty = true;
  let level = 0;                          // 已加载的底图清晰度：0 小图，1 中图，2 大图

  world.style.width = W + 'px';
  world.style.height = H + 'px';
  base.style.width = W + 'px';
  base.style.height = H + 'px';

  // ---------- 渐进加载底图：先模糊小图，再中图；放大到一定程度再换大图 ----------
  function loadLevel(n) {
    if (n <= level) return;
    level = n;
    const src = n === 1 ? 'assets/plan/base-2040.webp' : 'assets/plan/base-4080.webp';
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    img.decode().then(() => { base.src = src; base.classList.add('sharp'); }).catch(() => {});
  }
  loadLevel(1);

  // ---------- 渲染：只在相机变化时更新 ----------
  function apply() {
    world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${k})`;
    cam.setAttribute('transform', `translate(${x} ${y}) scale(${k})`);
    if (k > 0.42) loadLevel(2);
    listeners.forEach(f => f());
  }
  function tick() {
    if (anim) {
      const t = Math.min(1, (performance.now() - anim.t0) / anim.dur);
      const e = EASE(t);
      k = Math.exp(anim.lk0 + (anim.lk1 - anim.lk0) * e);   // 缩放在对数空间插值，飞行更自然
      // 让目标中心点在动画过程中平滑移到屏幕中心
      const cx = anim.cx0 + (anim.cx1 - anim.cx0) * e, cy = anim.cy0 + (anim.cy1 - anim.cy0) * e;
      x = anim.sx - cx * k; y = anim.sy - cy * k;
      dirty = true;
      if (t >= 1) anim = null;
    } else if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
      x += vx; y += vy; vx *= 0.92; vy *= 0.92; clamp(); dirty = true;
    }
    if (dirty) { apply(); dirty = false; }
    requestAnimationFrame(tick);
  }

  function size() { return [stage.clientWidth, stage.clientHeight]; }
  function clamp() {                       // 不让总图被拖出屏幕太远
    const [vw, vh] = size();
    const m = 0.35;
    x = Math.min(vw * (1 - m), Math.max(vw * m - W * k, x));
    y = Math.min(vh * (1 - m), Math.max(vh * m - H * k, y));
  }
  function zoomAt(sx, sy, f) {
    const nk = Math.min(maxK, Math.max(minK, k * f));
    x = sx - (sx - x) * (nk / k);
    y = sy - (sy - y) * (nk / k);
    k = nk; clamp(); dirty = true;
  }

  // 飞到一个世界坐标范围 [x0, y0, x1, y1]；pad 是四周留白（屏幕像素，可分别给 [上,右,下,左]）
  function flyTo(bbox, { pad = [90, 90, 90, 90], dur = 900 } = {}) {
    const [vw, vh] = size();
    const [pt, pr, pb, pl] = Array.isArray(pad) ? pad : [pad, pad, pad, pad];
    const bw = bbox[2] - bbox[0], bh = bbox[3] - bbox[1];
    const tk = Math.min(maxK, Math.max(minK, Math.min((vw - pl - pr) / bw, (vh - pt - pb) / bh)));
    const sx = pl + (vw - pl - pr) / 2, sy = pt + (vh - pt - pb) / 2;
    anim = {
      t0: performance.now(), dur, sx, sy,
      lk0: Math.log(k), lk1: Math.log(tk),
      cx0: (sx - x) / k, cy0: (sy - y) / k,          // 当前屏幕上 (sx, sy) 处对应的世界点
      cx1: (bbox[0] + bbox[2]) / 2, cy1: (bbox[1] + bbox[3]) / 2,
    };
    vx = vy = 0;
  }
  function fit(opts) {
    const [vw, vh] = size();
    minK = Math.min(vw / W, vh / H) * 0.5;
    flyTo([250, 250, W - 250, H - 250], opts);
  }
  function jump() {                        // 立即铺满（首次进入时不做动画）
    const [vw, vh] = size();
    minK = Math.min(vw / W, vh / H) * 0.5;
    k = Math.max(vw / W, vh / H) * 1.02;
    x = (vw - W * k) / 2; y = (vh - H * k) / 2; dirty = true;
  }

  // ---------- 手势：拖动、惯性、滚轮、双指、双击 ----------
  const pointers = new Map();
  let last = null, moved = 0, pinch = null, lastTap = 0;
  const isUI = el => el.closest('.ui, button, a, .pin');

  stage.addEventListener('pointerdown', e => {
    if (isUI(e.target)) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    anim = null; vx = vy = 0; moved = 0;
    last = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k };
    }
    stage.classList.add('grabbing');
  });
  stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const r = stage.getBoundingClientRect();
      zoomAt((a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top, (pinch.k * d / pinch.d) / k);
      moved += 10;
      return;
    }
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
    x += dx; y += dy; moved += Math.abs(dx) + Math.abs(dy);
    const now = performance.now(), dt = Math.max(1, now - last.t);
    vx = dx * 16 / dt; vy = dy * 16 / dt;   // 估算速度（每帧像素），松手后用作惯性
    last = { x: e.clientX, y: e.clientY, t: now };
    clamp(); dirty = true;
  });
  const end = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size) return;
    stage.classList.remove('grabbing');
    if (performance.now() - last.t > 80) vx = vy = 0;   // 停住再松手就没有惯性
    if (moved < 6) {                                     // 几乎没动：当作点击
      vx = vy = 0;
      const now = performance.now();
      const r = stage.getBoundingClientRect();
      if (now - lastTap < 300) zoomAnimated(e.clientX - r.left, e.clientY - r.top, 2);
      else onTap.forEach(f => f(e.clientX, e.clientY));
      lastTap = now;
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    anim = null;
    const r = stage.getBoundingClientRect();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0018)));
  }, { passive: false });
  window.addEventListener('resize', () => { const [vw, vh] = size(); minK = Math.min(vw / W, vh / H) * 0.5; clamp(); dirty = true; });

  function zoomAnimated(sx, sy, f) {
    const tk = Math.min(maxK, Math.max(minK, k * f));
    const cx = (sx - x) / k, cy = (sy - y) / k;
    const [vw, vh] = size();
    const hw = vw / 2 / tk, hh = vh / 2 / tk;
    flyTo([cx - hw, cy - hh, cx + hw, cy + hh], { pad: 0, dur: 450 });
  }

  const onTap = [];
  requestAnimationFrame(tick);

  return {
    onChange: f => listeners.push(f),
    onTap: f => onTap.push(f),
    toScreen: (px, py) => [px * k + x, py * k + y],
    toWorld: (sx, sy) => [Math.round((sx - x) / k), Math.round((sy - y) / k)],   // 取坐标用：屏幕点 → 底图像素
    get k() { return k; },
    flyTo, fit, jump,
    zoomBy: f => { const [vw, vh] = size(); zoomAnimated(vw / 2, vh / 2, f); },
    refresh: () => { dirty = true; },
  };
})();
