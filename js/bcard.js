/* 3D 建筑卡片（方案：docs/proposals/2026-11-25-buildings-3d.md）
   第一层「卡片」：从建筑名的位置升起，背景是缓慢旋转的 3D 模型，上面是建筑信息和「进入 3D」。
   第二层「全屏 3D」：可以拖动旋转、缩放，提供 重置 / 俯视 / 正面 三个视角。
   Esc：全屏 → 卡片 → 总图。

   3D 用 Google 的 <model-viewer>（底层是 three.js），文件放在 assets/vendor/，不依赖外部 CDN。
   按需加载：第一次打开卡片时才加载这个 1 MB 的脚本，首页和总图不受影响。 */
window.BCard = (() => {
  'use strict';
  const root = document.getElementById('bcard');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const VIEWS = {                     // camera-orbit：水平角 俯仰角 距离
    home: '35deg 68deg auto',
    top: '0deg 1deg auto',
    front: '0deg 84deg auto',
  };
  let viewerReady = null, current = null;

  function loadViewer() {
    if (!viewerReady) viewerReady = new Promise((res, rej) => {
      if (customElements.get('model-viewer')) return res();
      if (!window.WebGLRenderingContext) return rej(new Error('这台设备不支持 WebGL'));
      const s = document.createElement('script');
      s.type = 'module';
      s.src = 'assets/vendor/model-viewer/model-viewer.min.js';
      s.onload = () => customElements.whenDefined('model-viewer').then(res);
      s.onerror = () => { viewerReady = null; rej(new Error('3D 组件加载失败')); };
      document.head.appendChild(s);
    });
    return viewerReady;
  }

  function open(b, fromEl) {
    if (!b) return;
    current = b;
    // 卡片从被点击的元素位置「长」出来：把起点写进 CSS 变量，动画从那里开始
    const r = fromEl?.getBoundingClientRect?.();
    if (r) {
      root.style.setProperty('--ox', `${r.left + r.width / 2}px`);
      root.style.setProperty('--oy', `${r.top + r.height / 2}px`);
    }
    root.innerHTML = `
      <div class="bc-backdrop" data-bc="close"></div>
      <article class="bc-card" role="dialog" aria-label="${esc(b.name)} 3D 模型">
        <div class="bc-stage"><div class="bc-loading"><span></span>正在加载 3D 模型…</div></div>
        <div class="bc-shade" aria-hidden="true"></div>
        <button class="bc-x" data-bc="close" aria-label="关闭">×</button>
        <div class="bc-info">
          <p class="eyebrow">${esc(b.en)}</p>
          <h2>${esc(b.name)}</h2>
          <dl><div><dt>建筑面积</dt><dd>${b.area.toLocaleString()} ㎡</dd></div><div><dt>层数</dt><dd>${b.floors}</dd></div></dl>
          <p class="bc-desc">${esc(b.desc)}</p>
          <button class="btn primary" data-bc="inside">进入 3D <span aria-hidden="true">→</span></button>
        </div>
        <div class="bc-tools">
          <button data-bc="view" data-view="home">重置</button>
          <button data-bc="view" data-view="top">俯视</button>
          <button data-bc="view" data-view="front">正面</button>
          <button data-bc="back">‹ 返回卡片</button>
        </div>
      </article>`;
    root.hidden = false;
    root.className = 'bcard';
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));

    loadViewer().then(() => {
      if (current !== b) return;
      const mv = document.createElement('model-viewer');
      Object.entries({
        src: `assets/models/${b.model}.glb`, alt: `${b.name} 3D 模型`,
        'camera-orbit': VIEWS.home, 'auto-rotate': '', 'rotation-per-second': '14deg', 'auto-rotate-delay': '0',
        'shadow-intensity': '1', 'shadow-softness': '0.8', exposure: '1.05', 'environment-image': 'neutral',
        'interaction-prompt': 'none', 'disable-zoom': '', 'disable-pan': '', 'interpolation-decay': '120',
      }).forEach(([k, v]) => mv.setAttribute(k, v));
      mv.addEventListener('load', () => root.querySelector('.bc-loading')?.remove());
      mv.addEventListener('error', () => fail('模型文件加载失败'));
      root.querySelector('.bc-stage').appendChild(mv);
    }).catch(err => fail(err.message));
  }

  function fail(msg) {
    const l = root.querySelector('.bc-loading');
    if (l) l.textContent = msg;
  }

  function inside(on) {
    root.classList.toggle('inside', on);
    const mv = root.querySelector('model-viewer');
    if (!mv) return;
    // 卡片里只自动旋转；全屏时可以自己拖动、缩放
    on ? (mv.setAttribute('camera-controls', ''), mv.removeAttribute('disable-zoom'), mv.removeAttribute('auto-rotate'))
       : (mv.removeAttribute('camera-controls'), mv.setAttribute('disable-zoom', ''), mv.setAttribute('auto-rotate', ''), view('home'));
  }
  function view(name) {
    const mv = root.querySelector('model-viewer');
    if (!mv) return;
    mv.cameraOrbit = VIEWS[name];
    mv.fieldOfView = 'auto';
    root.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  }
  function close(now) {
    if (root.hidden) return;
    current = null;
    root.classList.remove('open', 'inside');
    const done = () => { root.hidden = true; root.innerHTML = ''; };
    now === true ? done() : setTimeout(done, 450);
  }

  root.addEventListener('click', e => {
    const t = e.target.closest('[data-bc]'); if (!t) return;
    ({ close: () => close(), inside: () => inside(true), back: () => inside(false), view: () => view(t.dataset.view) })[t.dataset.bc]?.();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || root.hidden) return;
    root.classList.contains('inside') ? inside(false) : close();
  });

  return { open, close };
})();
