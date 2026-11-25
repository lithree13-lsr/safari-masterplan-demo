/* 主程序：首页 → 总图；分区、图层、详情卡、网址状态。
   层级：总图 → 全部分区 → 单个分区。打开的图层在每一层都保留。
   状态写进网址的 # 后面（例如 #zone=AW&l=walk,exp），复制链接就能分享同一个画面。
   视图（2026-11-25）：「总图」和「道路」两张图共用同一个相机，切换时只换叠加层，不换底图。 */
(() => {
  'use strict';
  const P = window.PARK;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const zoneById = Object.fromEntries(P.zones.map(z => [z.id, z]));
  const pathD = pts => 'M' + pts.map(p => p.join(' ')).join('L');
  const mobile = () => innerWidth < 760;
  // 小立方体图标（建筑图钉和列表用）
  const CUBE = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.8 14 5v6L8 14.2 2 11V5z"/><path d="M2 5l6 3.2L14 5M8 8.2v6"/></svg>';

  // 星形图标（重点景点）
  const STAR = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1.5l1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.3 4 13.5l1-4.4-3.4-3 4.5-.5z"/></svg>';
  const inZone = (ref, id) => ref.zone === id || zoneById[ref.zone]?.parent === id;

  const S = { view: 'plan', zonesOn: false, zone: null, layers: new Set(['buildings', 'key']) };
  const LAYERS = [
    { group: '游线', items: P.routes.map(r => ({ id: r.id, name: r.name, sub: r.sub, color: r.color })) },
    { group: '内容', items: [
      { id: 'exp', name: '体验点', sub: '每个分区的看点', color: '#f4efe6' },
      { id: 'key', name: '重点景点', sub: '点星标看 3D 模型', color: '#f2c14e' },
      { id: 'buildings', name: '3D 建筑', sub: '点建筑名看模型', color: '#d9774a' },
    ] },
  ];

  // ---------- 叠加层：分区轮廓、游线（SVG，世界坐标） ----------
  const zonesG = $('#zones'), routesG = $('#routes'), dim = $('#dim');
  [...P.zones].sort((a, b) => !!a.parent - !!b.parent).forEach(z => {   // 子分区（绿洲）画在最上面
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', pathD(z.outline) + 'Z');
    p.setAttribute('class', 'zone');
    p.dataset.zone = z.id;
    zonesG.appendChild(p);
  });
  P.routes.forEach(r => {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'route');
    g.dataset.route = r.id;
    g.style.setProperty('--c', r.color);
    g.innerHTML = `<path class="route-glow" d="${pathD(r.path)}"/><path class="route-line" d="${pathD(r.path)}"/>`;
    routesG.appendChild(g);
  });

  // ---------- 道路分析图（SVG）：先画深色路缘，再按道路等级画颜色、粗细、虚线 ----------
  const roadsG = $('#roads');
  const RC = P.road_classes;
  P.roads.forEach(r => {
    const c = RC[r.class];
    const d = pathD(r.path);
    roadsG.insertAdjacentHTML('beforeend',
      `<path class="road-casing" d="${d}" style="stroke-width:${c.width + 4}px"/>` +
      `<path class="road road-${r.class}" d="${d}" style="stroke:${c.color};stroke-width:${c.width}px${c.dash ? `;stroke-dasharray:${c.dash}` : ''}"/>`);
  });
  $('#legend').innerHTML = `<p class="group">道路等级</p>` + Object.values(RC).map(c =>
    `<div class="lg"><svg width="40" height="12"><line x1="2" y1="6" x2="38" y2="6" stroke="${c.color}" stroke-width="${c.width}" stroke-linecap="round" ${c.dash ? `stroke-dasharray="${c.dash}"` : ''}/></svg><span>${esc(c.name)}</span></div>`).join('')
    + `<p class="group">节点</p><div class="lg"><span class="node-ic gate"></span><span>出入口</span></div><div class="lg"><span class="node-ic stop"></span><span>车站 / 落客</span></div>`;

  // ---------- 图钉：HTML 元素，不缩放，每次相机变化时重新定位 ----------
  const pinsEl = $('#pins');
  const pins = [];
  function addPin(el, at, kind, ref) { el.classList.add('pin', kind); pinsEl.appendChild(el); pins.push({ el, at, kind, ref }); return el; }
  P.zones.forEach(z => {
    const el = document.createElement('button');
    el.innerHTML = `<span>${esc(z.name)}</span>`;
    el.dataset.zone = z.id;
    addPin(el, z.label, 'zlabel', z);
  });
  P.experiences.forEach(x => {
    const el = document.createElement('div');
    el.innerHTML = `<i></i><span>${esc(x.name)}</span>`;
    el.dataset.exp = x.id;
    addPin(el, x.at, 'exp', x);
  });
  P.buildings.forEach(b => {
    const el = document.createElement('button');
    el.innerHTML = `<i aria-hidden="true">${CUBE}</i><span>${esc(b.name)}</span>`;
    el.dataset.building = b.id;
    el.title = `${b.name}：查看 3D 模型`;
    addPin(el, [b.at[0], b.at[1] - b.size[1] / 2 - 10], 'bld', b);
  });

  P.attractions.forEach(a => {
    const el = document.createElement('button');
    el.innerHTML = `<i aria-hidden="true">${STAR}</i><span>${esc(a.name)}</span>`;
    el.dataset.attraction = a.id;
    el.title = `${a.name}：查看 3D 模型`;
    addPin(el, a.at, 'key', a);
  });
  P.nodes.forEach(n => {
    const el = document.createElement('div');
    el.innerHTML = `<i class="node-ic ${n.type}"></i><span>${esc(n.name)}</span>`;
    addPin(el, n.at, 'node', n);
  });

  function visible(p) {
    if (p.kind === 'node') return S.view === 'roads';
    if (p.kind === 'key') return S.layers.has('key') || (S.zone && inZone(p.ref, S.zone));
    if (p.kind === 'zlabel') return (S.zonesOn || S.zone) && p.ref.id !== S.zone;
    if (p.kind === 'exp') return S.layers.has('exp') || (S.zone && (p.ref.zone === S.zone || zoneById[p.ref.zone]?.parent === S.zone));
    if (p.kind === 'bld') return S.layers.has('buildings') || (S.zone && (p.ref.zone === S.zone || zoneById[p.ref.zone]?.parent === S.zone));
  }
  function place() {
    const W = innerWidth, H = innerHeight;
    for (const p of pins) {
      if (!p.on) continue;
      const [sx, sy] = Camera.toScreen(p.at[0], p.at[1]);
      const off = sx < -200 || sy < -60 || sx > W + 200 || sy > H + 60;
      p.el.style.visibility = off ? 'hidden' : '';
      if (!off) p.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
    }
  }
  Camera.onChange(place);

  // ---------- 统一刷新界面 ----------
  function render() {
    document.body.classList.toggle('zones-on', S.zonesOn || !!S.zone);
    $('#zonesBtn').classList.toggle('on', S.zonesOn || !!S.zone);
    for (const p of zonesG.children) {
      p.classList.toggle('sel', p.dataset.zone === S.zone);
      p.classList.toggle('child-of-sel', zoneById[p.dataset.zone].parent === S.zone && !!S.zone);
    }
    for (const g of routesG.children) g.classList.toggle('on', S.layers.has(g.dataset.route));
    document.body.classList.toggle('view-roads', S.view === 'roads');
    document.querySelectorAll('[data-view-mode]').forEach(b => b.classList.toggle('cur', b.dataset.viewMode === S.view));
    const z = S.zone && zoneById[S.zone];
    dim.setAttribute('d', z ? `M-20000 -20000H30000V30000H-20000Z ${pathD(z.outline)}Z` : '');
    for (const p of pins) { p.on = !!visible(p); p.el.classList.toggle('on', p.on); p.el.classList.toggle('in-zone', !!z && p.kind !== 'zlabel'); }
    renderLayers(); renderCard(); renderCrumbs(); writeHash();
    place();
  }

  function renderCrumbs() {
    const z = S.zone && zoneById[S.zone];
    $('#crumbs').innerHTML = `<button data-action="plan" class="${!S.zonesOn && !z ? 'cur' : ''}">总规划</button>`
      + (S.zonesOn || z ? `<button data-action="all-zones" class="${!z ? 'cur' : ''}">分区</button>` : '')
      + (z ? `<button class="cur">${esc(z.name)}</button>` : '');
  }

  function renderLayers() {
    const n = [...S.layers].length;
    $('#layerCount').textContent = n ? n : '';
    $('#layersBody').innerHTML = LAYERS.map(g => `<p class="group">${g.group}</p>` + g.items.map(it => `
      <label class="layer">
        <span class="sw" style="--c:${it.color}"></span>
        <span class="lt"><b>${esc(it.name)}</b><small>${esc(it.sub)}</small></span>
        <input type="checkbox" data-layer="${it.id}" ${S.layers.has(it.id) ? 'checked' : ''}><span class="tog" aria-hidden="true"></span>
      </label>`).join('')).join('')
      + (n ? `<button class="clear" data-action="clear-layers">全部关闭</button>` : '');
  }

  function renderCard() {
    const card = $('#card');
    const z = S.zone && zoneById[S.zone];
    if (!z && !S.zonesOn) { card.classList.remove('open'); return; }
    if (!z) {
      card.innerHTML = `<div class="card-scroll">
        <p class="eyebrow">共 ${P.zones.length} 个分区</p><h2>全部分区</h2>
        <p class="desc">在图上点一个分区，或者从下面的列表打开。</p>
        <ul class="list">${P.zones.map(q => `<li><button data-open-zone="${q.id}"><span class="no">${q.id}</span><span><b>${esc(q.name)}</b><small>${esc(q.en)}</small></span><i>›</i></button></li>`).join('')}</ul>
      </div>`;
    } else {
      const exps = P.experiences.filter(x => x.zone === z.id || zoneById[x.zone]?.parent === z.id);
      const blds = P.buildings.filter(b => b.zone === z.id || zoneById[b.zone]?.parent === z.id);
      const kids = P.zones.filter(q => q.parent === z.id);
      const keys = P.attractions.filter(a => inZone(a, z.id));
      card.innerHTML = `
        <div class="card-head"><button data-action="all-zones">‹ 全部分区</button><button class="x" data-action="plan" aria-label="关闭">×</button></div>
        <div class="card-scroll">
          <p class="eyebrow">${esc(z.tagline)}</p>
          <h2>${esc(z.name)}</h2><p class="en">${esc(z.en)}</p>
          <p class="desc">${esc(z.desc)}</p>
          <div class="tags">${z.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
          ${keys.length ? `<h3>重点景点 · 3D <span>${keys.length}</span></h3><ul class="list">${keys.map(a => `<li><button data-attraction="${a.id}"><span class="cube star">${STAR}</span><span><b>${esc(a.name)}</b><small>${esc(a.en)} · 查看 3D</small></span><i>›</i></button></li>`).join('')}</ul>` : ''}
          ${blds.length ? `<h3>建筑 · 3D <span>${blds.length}</span></h3><ul class="list">${blds.map(b => `<li><button data-building="${b.id}"><span class="cube">${CUBE}</span><span><b>${esc(b.name)}</b><small>${b.area.toLocaleString()} ㎡ · ${b.floors} 层 · 查看 3D</small></span><i>›</i></button></li>`).join('')}</ul>` : ''}
          ${exps.length ? `<h3>体验点 <span>${exps.length}</span></h3><ul class="list">${exps.map(x => `<li><button data-goto="${x.id}"><span class="dot"></span><span><b>${esc(x.name)}</b><small>在图上定位</small></span><i>›</i></button></li>`).join('')}</ul>` : ''}
          ${kids.length ? `<h3>区内目的地</h3><ul class="list">${kids.map(q => `<li><button data-open-zone="${q.id}"><span class="no">${q.id}</span><span><b>${esc(q.name)}</b><small>${esc(q.tagline)}</small></span><i>›</i></button></li>`).join('')}</ul>` : ''}
        </div>`;
    }
    card.classList.add('open');
  }

  // ---------- 动作 ----------
  const cardPad = () => mobile() ? [80, 30, innerHeight * 0.5, 30] : [90, 440, 80, 300];
  const planPad = () => mobile() ? [80, 20, 90, 20] : [80, 70, 60, $('#layers').classList.contains('closed') ? 70 : 300];
  function openZone(id, { fly = true } = {}) {
    const z = zoneById[id]; if (!z) return;
    S.zone = id; S.zonesOn = true;
    render();
    if (fly) Camera.flyTo(z.bbox, { pad: cardPad() });
  }
  function allZones() { S.zone = null; S.zonesOn = true; render(); Camera.fit({ pad: cardPad() }); }
  function toPlan() { S.zone = null; S.zonesOn = false; render(); Camera.fit({ pad: planPad() }); }
  function gotoExp(id) {
    const x = P.experiences.find(q => q.id === id); if (!x) return;
    const r = 260;
    Camera.flyTo([x.at[0] - r, x.at[1] - r, x.at[0] + r, x.at[1] + r], { pad: cardPad() });
    const pin = pinsEl.querySelector(`[data-exp="${id}"]`);
    pin.classList.remove('pulse'); void pin.offsetWidth; pin.classList.add('pulse');
  }

  function enter(zones) {
    const intro = $('#intro');
    $('#app').hidden = false;
    Camera.jump();
    intro.classList.add('leaving');
    setTimeout(() => { intro.hidden = true; }, 900);
    setTimeout(() => (zones ? allZones() : (render(), Camera.fit({ pad: planPad(), dur: 1600 }))), 60);
    if (mobile()) $('#layers').classList.add('closed');
  }
  function home() {
    BCard.close(true);
    const intro = $('#intro');
    intro.hidden = false;
    requestAnimationFrame(() => intro.classList.remove('leaving'));
    history.replaceState(null, '', location.pathname);
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action],[data-open-zone],[data-goto],[data-building],[data-attraction],[data-view-mode],[data-zone]');
    if (!t) return;
    if (t.dataset.attraction) return BCard.open(P.attractions.find(a => a.id === t.dataset.attraction), t);
    if (t.dataset.viewMode) { S.view = t.dataset.viewMode; return render(); }
    if (t.dataset.building) return BCard.open(P.buildings.find(b => b.id === t.dataset.building), t);
    if (t.dataset.openZone) return openZone(t.dataset.openZone);
    if (t.dataset.goto) return gotoExp(t.dataset.goto);
    if (t.dataset.zone && t.classList.contains('pin')) return openZone(t.dataset.zone);
    switch (t.dataset.action) {
      case 'enter': return enter(false);
      case 'enter-zones': return enter(true);
      case 'home': return home();
      case 'plan': return toPlan();
      case 'all-zones': return allZones();
      case 'toggle-zones': return (S.zonesOn || S.zone) ? toPlan() : allZones();
      case 'toggle-layers': return $('#layers').classList.toggle('closed');
      case 'clear-layers': S.layers.clear(); return render();
      case 'zoom-in': return Camera.zoomBy(1.8);
      case 'zoom-out': return Camera.zoomBy(1 / 1.8);
      case 'fit': return Camera.fit({ pad: S.zone || S.zonesOn ? cardPad() : planPad() });
    }
  });
  document.addEventListener('change', e => {
    const id = e.target.dataset.layer; if (!id) return;
    e.target.checked ? S.layers.add(id) : S.layers.delete(id);
    render();
  });
  // 在图上点分区（点在 SVG 轮廓上）
  Camera.onTap((cx, cy) => {
    const el = document.elementFromPoint(cx, cy);
    const z = el?.closest?.('path.zone');
    if (z && (S.zonesOn || S.zone)) openZone(z.dataset.zone);
    $('#hint').classList.add('gone');
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !$('#bcard').hidden) return;
    if (S.zone) allZones(); else if (S.zonesOn) toPlan();
  });

  // ---------- 网址状态 ----------
  function writeHash() {
    if ($('#app').hidden) return;
    const q = [];
    if (S.zone) q.push('zone=' + S.zone); else if (S.zonesOn) q.push('zones=1');
    if (S.layers.size) q.push('l=' + [...S.layers].join(','));
    if (S.view !== 'plan') q.push('v=' + S.view);
    history.replaceState(null, '', q.length ? '#' + q.join('&') : location.pathname + '#plan');
  }
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!location.hash) return false;
    if (h.has('l')) S.layers = new Set(h.get('l').split(',').filter(Boolean));
    if (h.get('v') === 'roads') S.view = 'roads';
    $('#intro').hidden = true;
    $('#app').hidden = false;
    Camera.jump();
    if (mobile()) $('#layers').classList.add('closed');
    if (h.get('zone') && zoneById[h.get('zone')]) setTimeout(() => openZone(h.get('zone')), 50);
    else if (h.get('zones')) setTimeout(allZones, 50);
    else { render(); setTimeout(() => Camera.fit({ pad: planPad(), dur: 10 }), 30); }
    return true;
  }

  readHash();
  render();
  // 在地址栏里手动改 # 后面的内容时，重新载入，按新状态打开
  addEventListener('hashchange', () => location.reload());
})();

