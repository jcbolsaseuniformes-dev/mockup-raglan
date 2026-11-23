/* Aba Estoque do Camisa Raglan: porte do Estoque JC (mesmos dados, ao vivo), com o visual do site.
   Carregado junto com as Pastas (área da equipe). Rota: #/estoque */
const R = document.createElement('section'); R.id = 'estoque'; R.dataset.tab = 'uni';
R.innerHTML = `
<header class="top glass">
  <div class="brand">
    <div class="es-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3v18M20 3v18M4 9h16M4 15h16"/><path d="M7 6.5h4M13 12.5h4M8 18.5h5"/></svg></div><div><div class="t1">Estoque</div><div class="t2">JC Bolsas e Uniformes</div></div>
  </div>
  <div class="stats">
    <div class="stat"><span id="es-totalPecas">0</span><small>peças</small></div>
    <div class="conn" id="es-conn"><i></i><span>conectando…</span></div>
  </div>
  <button class="btn-search" id="es-btnSearch" aria-label="Buscar"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg><span>Buscar</span></button>
</header>

<nav class="tabs ctabs" id="es-tabs" role="tablist" aria-label="Seções do estoque">
  <button type="button" role="tab" data-tab="uni" class="on" aria-selected="true">Uniformes</button>
  <button type="button" role="tab" data-tab="dtf" aria-selected="false">DTF</button>
  <button type="button" role="tab" data-tab="subl" aria-selected="false">Sublimação</button>
</nav>

<main id="es-planWrap">
  <svg id="es-plan" viewBox="125 20 714 896" preserveAspectRatio="xMidYMid meet"></svg>
  <div class="hint">Toque numa estante para abrir</div>
</main>

<!-- Painel da estante -->
<div id="es-panelBack" class="panel-back"></div>
<section id="es-panel" class="panel" aria-hidden="true">
  <div class="panel-head">
    <button class="icon-btn" id="es-btnClose" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    <div class="ph-title"><div id="es-pTitle">Estante</div><small id="es-pSub"></small></div>
    <button class="icon-btn es-trash" id="es-btnTrash" aria-label="Excluir bloco selecionado" disabled><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg></button>
  </div>
  <div class="stage" id="es-stage"><div class="scene" id="es-scene"></div></div>
  <div class="panel-foot" id="es-pFoot">Toque num bloco para editar · arraste para o lado para mover</div>
</section>

<!-- Formulário do bloco -->
<div id="es-formBack" class="sheet-back"></div>
<section id="es-form" class="sheet" aria-hidden="true">
  <div class="sheet-head">
    <div><div class="sh-t">Conteúdo do bloco</div><small id="es-fSub"></small></div>
    <button class="icon-btn" id="es-fClose" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  </div>
  <div class="sheet-scroll-wrap">
    <div class="sheet-body">
      <div class="stack-preview" id="es-fPreview"></div>
      <div class="items" id="es-fItems"></div>
      <button class="add-item" id="es-fAddItem">+ Adicionar outra peça neste bloco</button>
      <div class="editor" id="es-fEditor"></div>
    </div>
    <div class="sb-track"><div class="sb-thumb"></div></div>
  </div>
  <div class="sheet-foot">
    <button class="btn es-ghost" id="es-fCancel">Cancelar</button>
    <button class="btn gold" id="es-fSave">Salvar</button>
  </div>
</section>

<!-- Busca -->
<div id="es-searchBack" class="sheet-back"></div>
<section id="es-search" class="sheet search" aria-hidden="true">
  <div class="sheet-head">
    <div class="search-box"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
      <input id="es-q" type="search" placeholder="Buscar: camisa polo, azul, moletom, GG…" autocomplete="off"></div>
    <button class="icon-btn" id="es-sClose" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  </div>
  <div class="chips quick" id="es-sQuick"></div>
  <div class="s-total" id="es-sTotal"></div>
  <div class="sheet-scroll-wrap">
    <div class="sheet-body results" id="es-sResults"></div>
    <div class="sb-track"><div class="sb-thumb"></div></div>
  </div>
</section>

<main id="es-stockWrap" hidden>
  <div class="stock-head">
    <div>
      <div class="stock-title" id="es-stockTitle">DTF</div>
      <p class="stock-sub" id="es-stockSub"></p>
    </div>
  </div>
  <div class="stock-list" id="es-stockList"></div>
</main>

<div id="es-itemBack" class="sheet-back"></div>
<section id="es-itemSheet" class="sheet" aria-hidden="true">
  <div class="sheet-head">
    <div><div class="sh-t" id="es-itemSheetTitle">Novo item</div><small id="es-itemSheetSub"></small></div>
    <button class="icon-btn" id="es-itemClose" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  </div>
  <div class="sheet-scroll-wrap">
    <div class="sheet-body" id="es-itemBody"></div>
    <div class="sb-track"><div class="sb-thumb"></div></div>
  </div>
  <div class="sheet-foot">
    <button class="btn es-ghost" id="es-itemCancel">Cancelar</button>
    <button class="btn gold" id="es-itemSave">Salvar</button>
  </div>
</section>

<div id="es-toast" class="es-toast"></div>
`;
(document.getElementById('pastas') || document.body.lastElementChild).after(R);
if (!document.querySelector('link[href^="estoque.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'estoque.css?v=' + (new URL(import.meta.url).searchParams.get('v') || '1'); document.head.append(l); }
const esVisible = () => document.body.classList.contains('estoque-on');
const esChromeTop = () => { const w = R.querySelector('#es-planWrap'); const t = w && w.getBoundingClientRect().top; return t > 0 ? t : 166; };
const esSearch = () => location.search;


const $ = s => R.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const h = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const CORES = [['Branco', '#f4f4f4'], ['Preto', '#1f1f1f'], ['Cinza', '#8d8d8d'], ['Azul Marinho', '#1f2f5a'], ['Azul Royal', '#2453c4'], ['Azul Claro', '#7fb3e6'], ['Vermelho', '#c62828'], ['Vinho', '#6d1b2b'], ['Verde', '#2e7d32'], ['Verde Bandeira', '#12a150'], ['Amarelo', '#f2c230'], ['Laranja', '#ef7d1a'], ['Rosa', '#e88aa8'], ['Roxo', '#6a3d9a'], ['Bege', '#d8c3a0'], ['Marrom', '#6b4a2e']];
const SHELVES = { A: { x: 135, y: 40, w: 66, h: 155, side: 'left' }, B: { x: 474, y: 301, w: 66, h: 209, side: 'left' }, C: { x: 763, y: 158, w: 66, h: 155, side: 'right' } };

let S = null, cur = null, sel = null, query = '', suppressClick = false;
const seen = new Set(); let firstRender = true;
let lastBlockTap = { id: null, t: 0 };

/* ---------------- conexão em tempo real ---------------- */
let ws, queue = [], retry = 0;
/* ---- site: conexão com o servidor do Estoque JC (o mesmo do link trycloudflare; os dados ficam no PC da loja) ----
   Ordem: link colado neste aparelho → o próprio PC (127.0.0.1:8787) → link atual publicado pelo PC (jcConfig/estoque no Firebase). */
const ES_KEY = 'jc-estoque-url';
const FB = (window.PASTAS_CONFIG || {}).firebase || {};
const okTunnel = u => /^wss:\/\/[a-z0-9-]+\.trycloudflare\.com\/ws$/.test(u);
function toWs(u) {
  u = String(u || '').trim(); if (!u) return '';
  try { const x = new URL(/^[a-z]+:\/\//i.test(u) ? u : 'https://' + u);
    const p = x.protocol === 'https:' || x.protocol === 'wss:' ? 'wss://' : 'ws://';
    return p + x.host + '/ws'; } catch { return ''; }
}
async function publishedUrl() {
  if (!FB.apiKey || !FB.projectId) return '';
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents/jcConfig/estoque?key=${FB.apiKey}`, { cache: 'no-store' });
    if (!r.ok) return '';
    const d = await r.json(); const u = toWs(d.fields && d.fields.url && d.fields.url.stringValue);
    return okTunnel(u) ? u : '';
  } catch { return ''; }
}
function tryWs(url, ms) {
  return new Promise(res => {
    let w; try { w = new WebSocket(url); } catch { return res(null); }
    w._buf = []; w.onmessage = e => w._buf.push(e);
    const t = setTimeout(() => { try { w.close(); } catch {} res(null); }, ms);
    w.onopen = () => { clearTimeout(t); res(w); };
    w.onerror = () => { clearTimeout(t); res(null); };
  });
}
let esVia = '', connecting = false;
async function resolveWs() {
  const manual = (() => { try { return localStorage.getItem(ES_KEY) || ''; } catch { return ''; } })();
  const tries = [];
  const P = new URLSearchParams(esSearch()), forced = toWs(P.get('estoque'));
  if (forced) tries.push([forced, 'link']);
  if (manual) tries.push([manual, 'link']);
  if (location.protocol === 'http:' && location.hostname) tries.push([`ws://${location.hostname}:8787/ws`, 'rede']);
  if (!matchMedia('(pointer:coarse)').matches) tries.push(['ws://127.0.0.1:8787/ws', 'PC']);
  const pub = publishedUrl().then(u => (u && !tries.some(t => t[0] === u)) ? tryWs(u, 9000).then(w => w && Object.assign(w, { _via: 'internet' })) : null);
  const direct = tries.map(([u, via]) => tryWs(u, via === 'PC' ? 2500 : 9000).then(w => w && Object.assign(w, { _via: via })));
  const all = [...direct, pub];
  return new Promise(res => {
    let left = all.length, won = null;
    all.forEach(p => p.then(w => {
      left--;
      if (w && !won) { won = w; res(w); } else if (w) { try { w.close(); } catch {} }
      if (!left && !won) res(null);
    }));
  });
}
async function connect() {
  if (connecting) return; connecting = true;
  setConn('wait', 'conectando…');
  const w = await resolveWs(); connecting = false;
  if (!w) { setConn('off', 'sem conexão · toque para colar o link'); R.classList.add('es-noconn'); setTimeout(connect, Math.min(15000, 1500 * 2 ** retry++)); return; }
  ws = w; esVia = w._via; retry = 0; R.classList.remove('es-noconn');
  const onMsg = ev => { const m = JSON.parse(ev.data); if (m.type === 'state') { S = m.state; setConn('on', `ao vivo · ${m.clients} ${m.clients === 1 ? 'aparelho' : 'aparelhos'}`); render(); } };
  ws.onmessage = onMsg; const buf = ws._buf || []; ws._buf = null; buf.forEach(onMsg);
  while (queue.length) ws.send(queue.shift());
  ws.onclose = () => { if (ws !== w) return; setConn('off', 'sem conexão'); setTimeout(connect, Math.min(8000, 600 * 2 ** retry++)); };
  ws.onerror = null;
}
function askLink() {
  const cur = (() => { try { return localStorage.getItem(ES_KEY) || ''; } catch { return ''; } })();
  const v = prompt('Cole aqui o link do Estoque JC (o endereço que termina em trycloudflare.com).\nDeixe vazio para voltar ao automático.', cur.replace(/^wss:/, 'https:').replace(/\/ws$/, ''));
  if (v === null) return;
  const u = toWs(v);
  try { if (u) localStorage.setItem(ES_KEY, u); else localStorage.removeItem(ES_KEY); } catch {}
  try { ws && ws.close(); } catch {}
  ws = null; retry = 0; connect();
}

function send(op) { const s = JSON.stringify(op); if (ws && ws.readyState === 1) ws.send(s); else { queue.push(s); toast('Sem conexão — será enviado ao reconectar'); } }
function setConn(cls, txt) { const c = $('#es-conn'); c.className = 'conn ' + cls; c.querySelector('span').textContent = txt; }
let tt; function toast(t) { const e = $('#es-toast'); e.textContent = t; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('show'), 2200); }

/* ---------------- helpers ---------------- */
const blockQty = b => (b.itens || []).reduce((a, i) => a + (i.qtd || 0), 0);
const shelfQty = k => S.estantes[k].niveis.reduce((a, n) => a + n.reduce((x, b) => x + blockQty(b), 0), 0);
const totalQty = () => Object.keys(S.estantes).reduce((a, k) => a + shelfQty(k), 0);
const levelName = (k, i) => { const e = S.estantes[k]; return e.topo && i === e.niveis.length - 1 ? 'Topo' : `Prateleira ${i + 1}`; };
const shelfDesc = k => { const e = S.estantes[k]; const n = e.niveis.length - (e.topo ? 1 : 0); return `${n} prateleiras${e.topo ? ' + topo' : ''}`; };

/* ---------------- barra de rolagem discreta ---------------- */
function initScrollbars() {
  R.querySelectorAll('.sheet-scroll-wrap').forEach(wrap => {
    const body = wrap.querySelector('.sheet-body');
    const track = wrap.querySelector('.sb-track');
    const thumb = wrap.querySelector('.sb-thumb');
    let hideT = null, near = false, dragging = false, dragY0 = 0, scroll0 = 0;

    function sync() {
      const ch = body.clientHeight, sh = body.scrollHeight;
      if (sh <= ch + 2) { track.style.display = 'none'; return; }
      track.style.display = '';
      const th = Math.max(28, (ch / sh) * track.clientHeight);
      const maxTop = track.clientHeight - th;
      const top = (body.scrollTop / (sh - ch)) * maxTop;
      thumb.style.height = th + 'px';
      thumb.style.top = top + 'px';
    }
    function show(keep) {
      sync();
      track.classList.add('vis');
      clearTimeout(hideT);
      if (!keep && !near && !dragging) hideT = setTimeout(() => track.classList.remove('vis'), 900);
    }
    wrap._syncSb = sync;

    body.addEventListener('scroll', () => show(false), { passive: true });
    wrap.addEventListener('mousemove', e => {
      const r = wrap.getBoundingClientRect();
      near = (r.right - e.clientX) <= 44;
      if (near) show(true); else if (!dragging) { clearTimeout(hideT); hideT = setTimeout(() => track.classList.remove('vis'), 250); }
    });
    wrap.addEventListener('mouseleave', () => { near = false; if (!dragging) track.classList.remove('vis'); });
    thumb.addEventListener('pointerdown', e => {
      e.preventDefault(); dragging = true; dragY0 = e.clientY; scroll0 = body.scrollTop;
      track.classList.add('drag', 'vis'); thumb.setPointerCapture(e.pointerId);
    });
    thumb.addEventListener('pointermove', e => {
      if (!dragging) return;
      const ch = body.clientHeight, sh = body.scrollHeight;
      const maxTop = Math.max(1, track.clientHeight - thumb.clientHeight);
      body.scrollTop = scroll0 + ((e.clientY - dragY0) / maxTop) * (sh - ch);
    });
    const endDrag = () => { if (!dragging) return; dragging = false; track.classList.remove('drag'); if (!near) track.classList.remove('vis'); };
    thumb.addEventListener('pointerup', endDrag);
    thumb.addEventListener('pointercancel', endDrag);
    addEventListener('resize', sync);
  });
}
function syncScrollbars() { R.querySelectorAll('.sheet-scroll-wrap').forEach(w => w._syncSb && w._syncSb()); }

/* ---------------- planta (SVG) ---------------- */
function roundedPath(pts, r) {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2), rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [p1[0] + v1[0] / l1 * rr, p1[1] + v1[1] / l1 * rr], b = [p1[0] + v2[0] / l2 * rr, p1[1] + v2[1] / l2 * rr];
    d += (i ? 'L' : 'M') + a.join(',') + 'Q' + p1.join(',') + ' ' + b.join(',');
  }
  return d + 'Z';
}
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

const WALL_TOP = 40, WALL_H = 860;
let planSy = 1;

function isCompactPlan() {
  return window.matchMedia('(max-width: 700px)').matches;
}
function yMap(y, sy = planSy) { return WALL_TOP + (y - WALL_TOP) * sy; }
function shelfGeom(k) { const s = SHELVES[k]; return { ...s, y: yMap(s.y) }; }
function currentYScale() {
  if (!isCompactPlan()) return 1;
  const availW = Math.max(1, innerWidth - 16);
  const availH = Math.max(1, innerHeight - esChromeTop() - 28);
  const targetH = 714 * (availH / availW);
  return Math.min(2.6, Math.max(1, (targetH - 43) / WALL_H));
}

function drawStairs(g, cx, cy) {
  const R = 50, r0 = 8, rand = rng(42), N = 14, start = -100, sweep = 330;
  const pencil = '#9fb4d0';
  const j = (v, a = 0.8) => v + (rand() - 0.5) * a;
  const P = (ang, rad) => [cx + Math.cos(ang * Math.PI / 180) * rad, cy + Math.sin(ang * Math.PI / 180) * rad];
  const sk = el('g', { filter: 'url(#es-pencil)' }, g);
  el('circle', { cx, cy, r: R + 3, fill: '#121a28' }, sk);
  for (let i = 0; i < N; i++) {
    const a0 = start + i * sweep / N, a1 = a0 + sweep / N, dark = i / N;
    el('path', { d: `M${P(a0, r0)}L${P(a0, R)}A${R},${R} 0 0 1 ${P(a1, R)}L${P(a1, r0)}Z`, fill: `rgba(0,0,0,${0.08 + dark * 0.55})` }, sk);
    const lines = 3 + Math.round(dark * 9);
    for (let k = 0; k < lines; k++) {
      const t = (k + 0.5) / lines, aa = a0 + (a1 - a0) * t;
      const p = P(aa + 6, r0 + 3 + rand() * 5), q = P(aa - 4, R - 2 - rand() * 6);
      el('line', { x1: j(p[0]), y1: j(p[1]), x2: j(q[0]), y2: j(q[1]), stroke: pencil, 'stroke-width': 0.6, opacity: 0.4 + dark * 0.4 }, sk);
    }
    if (dark > 0.45) for (let k = 0; k < lines; k++) {
      const t = (k + 0.5) / lines; const p = P(a0 + 2, r0 + (R - r0) * t), q = P(a1 - 2, r0 + (R - r0) * (t + 0.15));
      el('line', { x1: j(p[0]), y1: j(p[1]), x2: j(q[0]), y2: j(q[1]), stroke: pencil, 'stroke-width': 0.35, opacity: 0.3 }, sk);
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i <= N; i++) {
      const a = start + i * sweep / N, p = P(a + j(0, 2), r0), q = P(a + j(0, 2), R + j(0, 1.5));
      el('line', { x1: j(p[0]), y1: j(p[1]), x2: j(q[0]), y2: j(q[1]), stroke: pencil, 'stroke-width': pass ? 0.6 : 1.1, 'stroke-linecap': 'round', opacity: pass ? 0.55 : 0.85 }, sk);
    }
    const pa = P(start, R + j(0, 1)), pb = P(start + sweep, R + j(0, 1));
    el('path', { d: `M${pa}A${R},${R} 0 1 1 ${pb}`, fill: 'none', stroke: pencil, 'stroke-width': pass ? 0.7 : 1.4, opacity: 0.85 }, sk);
  }
  const ra = R - 4; const ha = P(start, ra), hb = P(start + sweep, ra);
  el('path', { d: `M${ha}A${ra},${ra} 0 1 1 ${hb}`, fill: 'none', stroke: pencil, 'stroke-width': 0.6, 'stroke-dasharray': '2 1.5', opacity: 0.7 }, sk);
  el('circle', { cx, cy, r: r0, fill: '#2a2824', stroke: pencil, 'stroke-width': 1.2 }, sk);
  el('circle', { cx: cx - 2, cy: cy - 2, r: r0 * 0.45, fill: 'none', stroke: pencil, 'stroke-width': 0.6, opacity: 0.6 }, sk);
  for (let k = 0; k < 6; k++) el('line', { x1: cx - r0 + k * 2.6, y1: cy + r0 * 0.2, x2: cx - r0 + k * 2.6 + 3, y2: cy + r0 * 0.9, stroke: pencil, 'stroke-width': 0.4, opacity: 0.5 }, sk);
  const s1 = P(start + 20, R * 0.7), s2 = P(start + 110, R * 0.7);
  el('path', { d: `M${s1}A${R * 0.7},${R * 0.7} 0 0 1 ${s2}`, fill: 'none', stroke: '#5aa8ff', 'stroke-width': 1, 'marker-end': 'url(#es-arrow)', opacity: 0.9 }, g);
  const t = el('text', { x: cx - R - 10, y: cy + 4, 'text-anchor': 'end', fill: '#9a958a', 'font-size': 11, 'font-style': 'italic' }, g); t.textContent = 'escada caracol';
}

function buildPlan() {
  const svg = $('#es-plan'); svg.innerHTML = '';
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
  <filter id="es-pencil" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"/><feComponentTransfer><feFuncA type="linear" slope="0.95"/></feComponentTransfer></filter>
  <linearGradient id="es-woodP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2c4a78"/><stop offset="1" stop-color="#162a48"/></linearGradient>
  <pattern id="es-tiles" patternUnits="userSpaceOnUse" width="40" height="40"><path d="M40 0H0V40" fill="none" stroke="#ffffff07" stroke-width="1"/></pattern>
  <marker id="es-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#5aa8ff"/></marker>
  <linearGradient id="es-shelfShade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>`;
  if (!refineMobileScale._busy) planSy = currentYScale();
  const pts = [[135, 40], [829, 40], [829, 900], [474, 900], [474, 271], [135, 271]].map(([x, y]) => [x, yMap(y)]);
  const d = roundedPath(pts, 18);
  el('path', { d, class: 'floor' }, svg);
  el('path', { d, fill: 'url(#es-tiles)' }, svg);
  const rl = el('text', { x: 651, y: yMap(640), 'text-anchor': 'middle', class: 'room-lbl' }, svg); rl.textContent = 'ESTOQUE';
  el('path', { d, class: 'wall' }, svg);
  el('line', { x1: 230, y1: 40, x2: 397, y2: 40, class: 'door-gap' }, svg);
  for (const dd of ['M230 40 L230 124', 'M314 40 A84 84 0 0 1 230 124', 'M397 40 L397 124', 'M313 40 A84 84 0 0 0 397 124']) el('path', { d: dd, class: 'swing' }, svg);
  el('rect', { x: 226, y: 29, width: 175, height: 23, rx: 6, class: 'door' }, svg);
  // Single-leaf side door: hinged at the bottom, swings into the room (to the right).
  const doorX = 474, doorY = yMap(527), doorH = 121, doorY2 = doorY + doorH;
  el('line', { x1: doorX, y1: doorY + 4, x2: doorX, y2: doorY2 - 4, class: 'door-gap' }, svg);
  el('path', { d: `M${doorX} ${doorY2} L${doorX + doorH} ${doorY2}`, class: 'swing' }, svg);
  el('path', { d: `M${doorX} ${doorY} A${doorH} ${doorH} 0 0 1 ${doorX + doorH} ${doorY2}`, class: 'swing' }, svg);
  el('rect', { x: 463, y: doorY, width: 24, height: doorH, rx: 6, class: 'door' }, svg);
  drawStairs(el('g', {}, svg), 752, yMap(100));
  for (const k in SHELVES) {
    const s = shelfGeom(k);
    const g = el('g', { class: 'shelf', id: 'es-shelf-' + k, tabindex: 0, role: 'button' }, svg);
    el('rect', { x: s.x + 4, y: s.y + 6, width: s.w, height: s.h, rx: 6, fill: '#000', opacity: .45 }, g);
    el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: 6, fill: 'url(#es-woodP)', class: 'body' }, g);
    el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: 6, fill: 'url(#es-shelfShade)', 'pointer-events': 'none' }, g);
    g.dataset.k = k;
    const lx = s.side === 'left' ? s.x - 12 : s.x + s.w + 12, anchor = s.side === 'left' ? 'end' : 'start';
    const t = el('text', { x: lx, y: s.y + s.h / 2 - 4, 'text-anchor': anchor, class: 'lbl' }, g); t.textContent = 'Estante ' + k;
    el('text', { x: lx, y: s.y + s.h / 2 + 13, 'text-anchor': anchor, class: 'sub', id: 'es-sub-' + k }, g);
    el('rect', { x: s.x + s.w / 2 - 20, y: s.y + s.h / 2 - 11, width: 40, height: 22, rx: 11, class: 'badge' }, g);
    el('text', { x: s.x + s.w / 2, y: s.y + s.h / 2 + 4, 'text-anchor': 'middle', class: 'badge-t', id: 'es-badge-' + k }, g);
    g.addEventListener('click', () => openShelf(k));
    g.addEventListener('keydown', e => { if (e.key === 'Enter') openShelf(k); });
  }
  if (S) {
    for (const k in SHELVES) {
      const badge = $('#es-badge-' + k), sub = $('#es-sub-' + k);
      if (badge) badge.textContent = shelfQty(k);
      if (sub) sub.textContent = shelfDesc(k);
    }
  }
  placeShelfLabels();
  if (!refineMobileScale._busy) refineMobileScale();
}

function refineMobileScale() {
  if (!isCompactPlan() || refineMobileScale._busy) return;
  const svg = $('#es-plan'), wrap = $('#es-planWrap');
  if (!svg || !wrap || !wrap.clientWidth || !wrap.clientHeight) return;
  let bbox;
  try { bbox = svg.getBBox(); } catch (e) { return; }
  if (!bbox.width || !bbox.height) return;
  const padX = 8, padY = 16;
  const vw = bbox.width + padX * 2, vh = bbox.height + padY * 2;
  const desiredH = vw * (wrap.clientHeight / wrap.clientWidth);
  if (Math.abs(desiredH - vh) / desiredH < 0.015) return;
  const next = Math.min(2.6, Math.max(1, planSy + (desiredH - vh) / WALL_H));
  if (Math.abs(next - planSy) < 0.01) return;
  planSy = next;
  // Redraw once with the corrected scale (guard via a temporary flag on the function).
  refineMobileScale._busy = true;
  try { buildPlan(); } finally { refineMobileScale._busy = false; }
}

function placeShelfLabels() {
  const svg = $('#es-plan');
  if (!svg) return;
  const compact = isCompactPlan();
  for (const k in SHELVES) {
    const s = shelfGeom(k);
    const g = $('#es-shelf-' + k);
    if (!g) continue;
    const lbl = g.querySelector('text.lbl');
    const sub = $('#es-sub-' + k);
    let lx, ly, anchor;
    if (compact) {
      // Keep labels inside the walls so the viewBox can crop tightly
      // and the building fills the phone width. A sits under the entrance
      // swings, so its label goes to the lower-right of the shelf.
      if (k === 'A') {
        lx = s.x + s.w + 12;
        ly = s.y + s.h - 28;
        anchor = 'start';
      } else if (k === 'B') {
        lx = s.x + s.w + 12;
        ly = s.y + s.h / 2 - 4;
        anchor = 'start';
      } else {
        lx = s.x - 12;
        ly = s.y + s.h / 2 - 4;
        anchor = 'end';
      }
    } else {
      lx = s.side === 'left' ? s.x - 12 : s.x + s.w + 12;
      ly = s.y + s.h / 2 - 4;
      anchor = s.side === 'left' ? 'end' : 'start';
    }
    if (lbl) { lbl.setAttribute('x', lx); lbl.setAttribute('y', ly); lbl.setAttribute('text-anchor', anchor); }
    if (sub) { sub.setAttribute('x', lx); sub.setAttribute('y', ly + 17); sub.setAttribute('text-anchor', anchor); }
  }
  fitPlanViewBox();
}

function fitPlanViewBox() {
  const svg = $('#es-plan');
  if (!svg || !svg.getBBox) return;
  let bbox;
  try { bbox = svg.getBBox(); } catch (e) { return; }
  if (!bbox.width || !bbox.height) return;
  const compact = isCompactPlan();
  const padX = compact ? 8 : 24;
  const padY = compact ? 16 : 24;
  const x = bbox.x - padX;
  const y = bbox.y - padY;
  const w = bbox.width + padX * 2;
  const h = bbox.height + padY * 2;
  svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
}

function renderPlan() {
  updateHeader();
  const hits = query ? searchHits() : [];
  for (const k in SHELVES) {
    $('#es-badge-' + k).textContent = shelfQty(k);
    $('#es-sub-' + k).textContent = shelfDesc(k);
    $('#es-shelf-' + k).classList.toggle('hit', hits.some(r => r.k === k));
  }
  placeShelfLabels();
}

/* ---------------- painel da estante ---------------- */
function panelRect() {
  const vw = innerWidth, vh = innerHeight;
  if (vw <= 700) return { x: 0, y: 0, w: vw, h: vh };
  const s = Math.min(vw * 0.92, vh * 0.94, 860);
  return { x: (vw - s) / 2, y: (vh - s) / 2, w: s, h: s };
}
function placePanel() { const r = panelRect(), p = $('#es-panel'); Object.assign(p.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }); return r; }

function openShelf(k, opts = {}) {
  cur = k; sel = opts.sel || null;
  const p = $('#es-panel'), r = placePanel();
  p.classList.add('show'); p.setAttribute('aria-hidden', 'false'); $('#es-panelBack').classList.add('show');
  renderPanel();
  const sr = R.querySelector('#es-shelf-' + k + ' rect.body').getBoundingClientRect();
  p.animate([
    { transform: `translate(${sr.left - r.x}px,${sr.top - r.y}px) scale(${sr.width / r.w},${sr.height / r.h})`, opacity: .4, borderRadius: '60px' },
    { transform: 'none', opacity: 1 }
  ], { duration: opts.fast ? 0 : 480, easing: 'cubic-bezier(.2,1,.3,1)' });
  p.style.transformOrigin = '0 0';
  if (opts.flash) setTimeout(() => { const b = R.querySelector(`.block[data-id="${opts.flash}"]`); b && b.classList.add('flash'); }, 500);
}
function closeShelf() {
  if (!cur) return;
  const p = $('#es-panel'), r = panelRect(), k = cur;
  const sr = R.querySelector('#es-shelf-' + k + ' rect.body').getBoundingClientRect();
  const a = p.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${sr.left - r.x}px,${sr.top - r.y}px) scale(${sr.width / r.w},${sr.height / r.h})`, opacity: 0 }], { duration: 320, easing: 'cubic-bezier(.5,0,.8,.4)' });
  a.onfinish = () => { p.classList.remove('show'); p.setAttribute('aria-hidden', 'true'); };
  $('#es-panelBack').classList.remove('show'); cur = null; sel = null;
}

function renderPanel() {
  if (!cur || !S) return;
  const E = S.estantes[cur], n = E.niveis.length;
  $('#es-pTitle').textContent = E.nome;
  $('#es-pSub').textContent = `${shelfDesc(cur)} · ${shelfQty(cur)} peças`;
  if (sel && !E.niveis[sel.nivel]?.some(b => b.id === sel.id)) sel = null;
  $('#es-btnTrash').disabled = !sel;
  const stage = $('#es-stage'), SW = stage.clientWidth, SH = stage.clientHeight;
  const small = SW < 520;
  const H = Math.min((SH - 50) / n, 120);
  const W = Math.min(SW - (small ? 150 : 250), H * 3.6, 480);
  const D = W * 0.34, t = Math.max(8, H * 0.1), post = Math.max(10, W * 0.035);
  const scene = $('#es-scene'); scene.innerHTML = '';
  const unit = h('div', 'unit', scene);
  const ux = small ? 58 + (SW - 58 - 86 - W) / 2 : (SW - W) / 2 + 6, uy = (SH - n * H) / 2 + 6;
  Object.assign(unit.style, { left: ux + 'px', top: uy + 'px', width: W + 'px', height: n * H + 'px' });
  const face = (cls, css) => { const f = h('div', 'face ' + cls, unit); Object.assign(f.style, css); return f; };
  const yT = E.topo ? H : 0, yB = n * H;
  face('shadow-floor', { left: -W * 0.15 + 'px', top: yB - D * 0.6 + 'px', width: W * 1.3 + 'px', height: D * 1.4 + 'px', transform: `translateZ(${-D / 2}px) rotateX(90deg)` });
  face('back', { left: 0, top: yT - t + 'px', width: W + 'px', height: yB - yT + t + 'px', transform: `translateZ(${-D}px)` });
  face('side inner', { left: 0, top: yT - t + 'px', width: D + 'px', height: yB - yT + t + 'px', transformOrigin: 'left center', transform: 'rotateY(90deg)' });
  face('side', { left: W + 'px', top: yT - t + 'px', width: D + 'px', height: yB - yT + t + 'px', transformOrigin: 'left center', transform: 'rotateY(90deg)' });
  const boards = [yT]; for (let r = 0; r < n; r++) if ((r + 1) * H > yT) boards.push((r + 1) * H);
  boards.forEach(y => {
    const top = y === yT ? yT - t : y - t;
    face('board-top', { left: 0, top: top + 'px', width: W + 'px', height: D + 'px', transformOrigin: 'top center', transform: 'rotateX(-90deg)' });
    face('board-front', { left: 0, top: top + 'px', width: W + 'px', height: t + 'px', transform: 'translateZ(1px)' });
  });
  face('post-front', { left: 0, top: yT - t + 'px', width: post + 'px', height: yB - yT + t + 'px', transform: 'translateZ(2px)' });
  face('post-front', { left: W - post + 'px', top: yT - t + 'px', width: post + 'px', height: yB - yT + t + 'px', transform: 'translateZ(2px)' });
  const mk = h('div', 'marker', unit, '<span>≈2 m</span>'); Object.assign(mk.style, { left: (small ? -52 : -96) + 'px', top: yT - t + 'px', height: yB - yT + t + 'px' });
  if (small) mk.querySelector('span').style.cssText = 'left:6px;transform:translate(0,-50%) rotate(-90deg);transform-origin:0 50%;font-size:11px';

  for (let r = 0; r < n; r++) {
    const ni = n - 1 - r, blocks = E.niveis[ni];
    const isTopo = E.topo && ni === n - 1;
    const floorY = (r + 1) * H - t;
    const rowTop = r * H + (isTopo ? 4 : 8);
    const tag = h('div', 'lvl-tag' + (isTopo ? ' topo' : ''), unit, isTopo ? 'Topo' : (small ? `P${ni + 1}` : `Prateleira ${ni + 1}`));
    Object.assign(tag.style, { left: (small ? -40 : -86) + 'px', width: (small ? 34 : 78) + 'px', top: floorY - H / 2 + 'px' });
    const row = h('div', 'lvl-row', unit);
    const inset = isTopo ? post * 0.4 : post + 4;
    const rowW = W - inset * 2;
    /* Lift the row above the plank lip: with rotateX(9deg), a recessed block's
       bottom (~D*0.3 back) is visually covered by the front edge of the shelf. */
    const lift = Math.ceil(D * 0.3 * Math.tan(9 * Math.PI / 180)) + 3;
    const rowH = Math.max(8, floorY - rowTop - lift);
    Object.assign(row.style, { left: inset + 'px', width: rowW + 'px', top: rowTop + 'px', height: rowH + 'px', transform: `translateZ(${-D * 0.3}px)` });
    const Db = D * 0.5;
    const gap = 4, slotW = (rowW - gap * 3) / 4, step = slotW + gap;

    const ghost = h('div', 'slot-ghost', row);
    ghost.style.width = slotW + 'px';
    ghost.style.height = rowH * 0.72 + 'px';

    const bySlot = new Map();
    blocks.forEach((b, bi) => {
      const slot = typeof b.slot === 'number' ? b.slot : bi;
      const q = blockQty(b), itens = (b.itens || []).filter(i => i.qtd > 0);
      const isNew = !seen.has(b.id); seen.add(b.id);
      const bl = h('div', 'block' + (itens.length ? '' : ' empty') + (sel && sel.id === b.id ? ' sel' : '') + (isNew && !firstRender ? ' born' : ''), row);
      bl.dataset.id = b.id;
      const fill = itens.length ? Math.min(1, 0.35 + q / 60) : 0.72;
      bl.style.width = slotW + 'px';
      bl.style.left = slot * step + 'px';
      bl.style.height = rowH * fill + 'px';
      bySlot.set(slot, { b, bl });

      const bf = h('div', 'bf', bl), side = h('div', 'bside', bl), top = h('div', 'btop', bl);
      side.style.width = Db + 'px'; top.style.height = Db + 'px';
      const fillH = parseFloat(bl.style.height) || rowH;
      const minh = itens.length ? Math.max(2, Math.min(8, Math.floor((fillH - (itens.length - 1)) / itens.length))) : 7;
      bf.style.setProperty('--minh', minh + 'px');
      side.style.setProperty('--minh', minh + 'px');
      itens.forEach(it => {
        const lnew = !seen.has(it.id); seen.add(it.id);
        const L = h('div', 'layer' + (lnew ? ' new' : ''), bf); L.style.setProperty('--c', it.corHex || '#999'); L.style.setProperty('--q', Math.max(1, it.qtd));
        L.title = `${[it.tipo, it.gola, it.cor, it.tecido, it.tamanho].filter(Boolean).join(' · ')} · ${it.qtd}`;
        const L2 = h('div', 'layer', side); L2.style.setProperty('--c', it.corHex || '#999'); L2.style.setProperty('--q', Math.max(1, it.qtd));
      });
      if (itens.length) { top.style.background = itens[itens.length - 1].corHex; top.style.filter = 'brightness(1.15)'; h('div', 'qlbl', bl, q + ' pç'); }
      else { top.style.display = side.style.display = 'none'; }

      // arraste magnético horizontal (1 bloco por vez na largura exata do bloco)
      let startX = 0, dragging = false, targetSlot = slot, displaced = null;
      bl.addEventListener('pointerdown', e => {
        if (e.target.closest('.list-btn') || e.button > 0) return;
        startX = e.clientX; dragging = false; targetSlot = slot; displaced = null;
        const onMove = ev => {
          const rawDx = ev.clientX - startX;
          if (!dragging && Math.abs(rawDx) > 7) {
            dragging = true;
            bl.setPointerCapture(e.pointerId);
            bl.classList.add('dragging');
            ghost.classList.add('on');
          }
          if (!dragging) return;
          const localDx = rawDx / 0.94;
          const rawX = Math.max(0, Math.min(3 * step, slot * step + localDx));
          const nextSlot = Math.max(0, Math.min(3, Math.round(rawX / step)));
          const snapX = nextSlot * step;
          const dist = rawX - snapX;
          const ratio = Math.min(1, Math.abs(dist) / (step * 0.5));
          const magX = snapX + Math.sign(dist) * Math.pow(ratio, 1.6) * step * 0.22;
          bl.style.left = magX + 'px';
          ghost.style.left = snapX + 'px';
          if (nextSlot !== targetSlot) {
            if (displaced) { displaced.bl.style.left = targetSlot * step + 'px'; displaced = null; }
            targetSlot = nextSlot;
            if (targetSlot !== slot && bySlot.has(targetSlot)) {
              displaced = bySlot.get(targetSlot);
              displaced.bl.style.left = slot * step + 'px';
            }
          }
        };
        const onEnd = () => {
          removeEventListener('pointermove', onMove);
          removeEventListener('pointerup', onEnd);
          removeEventListener('pointercancel', onEnd);
          if (!dragging) return;
          suppressClick = true; setTimeout(() => { suppressClick = false; }, 120);
          bl.classList.remove('dragging');
          ghost.classList.remove('on');
          bl.style.left = targetSlot * step + 'px';
          if (targetSlot !== slot) send({ type: 'moveBlock', estante: cur, nivel: ni, id: b.id, slot: targetSlot });
        };
        addEventListener('pointermove', onMove);
        addEventListener('pointerup', onEnd);
        addEventListener('pointercancel', onEnd);
      });

      bl.addEventListener('click', e => {
        e.stopPropagation();
        if (suppressClick) return;
        const now = performance.now();
        const again = (sel && sel.id === b.id) || (lastBlockTap.id === b.id && now - lastBlockTap.t < 450);
        lastBlockTap = { id: b.id, t: now };
        if (again) { openForm(cur, ni, b.id); return; }
        sel = { nivel: ni, id: b.id }; renderPanel();
      });
      bl.addEventListener('dblclick', e => {
        e.preventDefault();
        e.stopPropagation();
        if (suppressClick) return;
        lastBlockTap = { id: b.id, t: performance.now() };
        if (!(sel && sel.id === b.id)) { sel = { nivel: ni, id: b.id }; renderPanel(); }
        openForm(cur, ni, b.id);
      });
      if (sel && sel.id === b.id) {
        const lb = h('button', 'list-btn', bl, '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>');
        lb.setAttribute('aria-label', 'Editar conteúdo do bloco');
        lb.addEventListener('click', e => { e.stopPropagation(); openForm(cur, ni, b.id); });
      }
    });

    const c = h('div', 'ctrl', unit);
    Object.assign(c.style, { left: W + (small ? 6 : 16) + 'px', top: floorY - H / 2 - 17 + 'px' });
    const minus = h('button', '', c, '−'), plus = h('button', '', c, '+');
    minus.setAttribute('aria-label', 'Remover bloco'); plus.setAttribute('aria-label', 'Adicionar bloco');
    if (!small) h('span', 'n', c, blocks.length);
    plus.onclick = e => { e.stopPropagation(); if (blocks.length >= 4) return toast('Máximo de 4 blocos por prateleira'); send({ type: 'addBlock', estante: cur, nivel: ni }); };
    minus.onclick = e => {
      e.stopPropagation(); if (!blocks.length) return;
      const sorted = [...blocks].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
      const last = sorted[sorted.length - 1];
      if (blockQty(last) > 0 && !confirm('O último bloco desta prateleira tem peças. Remover mesmo assim?')) return;
      send({ type: 'removeLast', estante: cur, nivel: ni });
    };
  }
  firstRender = false;
}

/* ---------------- formulário ---------------- */
let F = null; // {k, nivel, id, itens, ei}
function openForm(k, nivel, id) {
  const b = S.estantes[k].niveis[nivel].find(b => b.id === id); if (!b) return;
  F = { k, nivel, id, itens: JSON.parse(JSON.stringify(b.itens || [])), ei: 0 };
  if (!F.itens.length) F.itens.push(newItem());
  const slotNum = (typeof b.slot === 'number' ? b.slot : S.estantes[k].niveis[nivel].indexOf(b)) + 1;
  $('#es-fSub').textContent = `${S.estantes[k].nome} · ${levelName(k, nivel)} · Espaço ${slotNum}`;
  renderForm(); $('#es-form').classList.add('show'); $('#es-formBack').classList.add('show');
  requestAnimationFrame(syncScrollbars);
}
function closeForm() { $('#es-form').classList.remove('show'); $('#es-formBack').classList.remove('show'); F = null; }
const newItem = () => ({ id: 'n' + Math.random().toString(36).slice(2, 9), tipo: '', gola: '', cor: 'Branco', corHex: '#f4f4f4', tecido: '', tamanho: '', qtd: 1 });

function renderPreview() {
  const pv = $('#es-fPreview'); pv.innerHTML = '';
  if (!F) return;
  const itens = F.itens.filter(i => i.qtd > 0);
  const minh = itens.length ? Math.max(2, Math.min(8, Math.floor((70 - (itens.length - 1)) / itens.length))) : 7;
  pv.style.setProperty('--minh', minh + 'px');
  itens.forEach(it => { const L = h('div', 'layer', pv); L.style.setProperty('--c', it.corHex); L.style.setProperty('--q', Math.max(1, it.qtd)); });
}

function renderForm() {
  renderPreview();
  const box = $('#es-fItems'); box.innerHTML = '';
  F.itens.forEach((it, i) => {
    const row = h('div', 'irow', box);
    const title = [it.tipo || 'Escolha o tipo', it.gola].filter(Boolean).join(' · ');
    const sub = [it.cor, it.tecido, it.tamanho && 'Tam. ' + it.tamanho].filter(Boolean).join(' · ') || '—';
    const r = h('div', 'item' + (i === F.ei ? ' on' : ''), row,
      `<div class="dot" style="background:${esc(it.corHex)}"></div>
       <div class="txt"><b>${esc(title)}</b><small>${esc(sub)}</small></div>
       <div class="qty-in">
         <button type="button" class="qm" aria-label="menos">−</button>
         <input type="number" inputmode="numeric" min="0" value="${it.qtd}">
         <button type="button" class="qp" aria-label="mais">+</button>
         <button type="button" class="fast" aria-label="mais dez">+10</button>
       </div>`);
    const del = h('button', 'del', row, '✕'); del.setAttribute('aria-label', 'Remover peça');
    r.onclick = () => { F.ei = i; renderForm(); };
    const qWrap = r.querySelector('.qty-in');
    qWrap.onclick = e => e.stopPropagation();
    const [bm, qi, bp, b10] = qWrap.children;
    bm.onclick = e => { e.stopPropagation(); it.qtd = Math.max(0, it.qtd - 1); F.ei = i; renderForm(); };
    bp.onclick = e => { e.stopPropagation(); it.qtd++; F.ei = i; renderForm(); };
    b10.onclick = e => { e.stopPropagation(); it.qtd += 10; F.ei = i; renderForm(); };
    qi.onclick = e => e.stopPropagation();
    qi.oninput = () => { it.qtd = Math.max(0, parseInt(qi.value) || 0); renderPreview(); };
    qi.onchange = () => { it.qtd = Math.max(0, parseInt(qi.value) || 0); renderForm(); };
    del.onclick = e => { e.stopPropagation(); F.itens.splice(i, 1); if (!F.itens.length) F.itens.push(newItem()); F.ei = Math.min(F.ei, F.itens.length - 1); renderForm(); };
  });

  const it = F.itens[F.ei], ed = $('#es-fEditor'); ed.innerHTML = '';
  const field = (label) => { const f = h('div', 'field', ed); h('label', '', f, label); return h('div', 'chips', f); };
  const optChips = (label, list, key, listName, toggleOff) => {
    const c = field(label);
    const plus = h('button', 'chip plus', c, '+'); plus.title = 'Adicionar nova opção';
    plus.onclick = () => { const v = prompt(`Nova opção de ${label.toLowerCase()}:`); if (v && v.trim()) { send({ type: 'addOption', list: listName, value: v.trim() }); it[key] = v.trim(); setTimeout(renderForm, 250); } };
    (list || []).forEach(v => {
      const b = h('button', 'chip' + (it[key] === v ? ' on' : ''), c, esc(v));
      b.onclick = () => { it[key] = (toggleOff && it[key] === v) ? '' : v; renderForm(); };
    });
  };
  optChips('Tipo de peça', S.tipos, 'tipo', 'tipo', false);
  optChips('Gola', S.golas, 'gola', 'gola', true);

  const cc = field('Cor');
  CORES.forEach(([nome, hex]) => {
    const b = h('button', 'es-sw' + (it.corHex.toLowerCase() === hex ? ' on' : ''), cc);
    b.style.background = hex; b.title = nome;
    b.onclick = () => { it.cor = nome; it.corHex = hex; renderForm(); };
  });
  const cu = h('label', 'es-sw custom', cc, '<input type="color">'); cu.title = 'Outra cor';
  const ci = cu.querySelector('input'); ci.value = it.corHex;
  ci.oninput = () => { it.corHex = ci.value; if (CORES.some(c => c[0] === it.cor)) it.cor = 'Personalizada'; renderForm(); };

  optChips('Tecido', S.tecidos, 'tecido', 'tecido', true);
  optChips('Tamanho', S.tamanhos, 'tamanho', 'tamanho', true);
  requestAnimationFrame(syncScrollbars);
}

$('#es-fAddItem').onclick = () => {
  const last = F.itens[F.ei]; const n = newItem();
  if (last) { n.tipo = last.tipo; n.gola = last.gola; n.tecido = last.tecido; n.tamanho = last.tamanho; }
  F.itens.push(n); F.ei = F.itens.length - 1; renderForm();
};
$('#es-fSave').onclick = () => { if (!F) return; send({ type: 'setItems', estante: F.k, nivel: F.nivel, id: F.id, itens: F.itens.filter(i => i.qtd > 0) }); toast('Bloco salvo ✓'); closeForm(); };
$('#es-fCancel').onclick = closeForm; $('#es-fClose').onclick = closeForm; $('#es-formBack').onclick = closeForm;

/* ---------------- busca ---------------- */
function searchHits() {
  const toks = norm(query).split(/\s+/).filter(Boolean); if (!toks.length) return [];
  const out = [];
  for (const k in S.estantes) S.estantes[k].niveis.forEach((nv, ni) => nv.forEach((b, bi) => (b.itens || []).forEach(it => {
    const words = norm([it.tipo, it.gola, it.cor, it.tecido, 'estante ' + k, levelName(k, ni)].join(' ')).split(/[\s/-]+/);
    const size = norm(it.tamanho);
    const ok = toks.every(t => (t.length <= 2 || /^\d+$/.test(t)) ? (size === t || words.includes(t)) : (words.some(w => w.startsWith(t)) || size === t));
    if (ok) out.push({ k, ni, bi, b, it });
  })));
  return out;
}
function renderSearch() {
  const res = $('#es-sResults'); res.innerHTML = '';
  if (!query.trim()) { $('#es-sTotal').innerHTML = 'Digite ou toque num tipo acima para procurar em todas as estantes.'; renderPlan(); syncScrollbars(); return; }
  const hits = searchHits(), tot = hits.reduce((a, r) => a + r.it.qtd, 0);
  $('#es-sTotal').innerHTML = `<b>${tot.toLocaleString('pt-BR')}</b> peças encontradas em ${hits.length} ${hits.length === 1 ? 'registro' : 'registros'}`;
  if (!hits.length) h('div', 'empty-s', res, 'Nada encontrado 🙁');
  hits.forEach(r => {
    const slotNum = (typeof r.b.slot === 'number' ? r.b.slot : r.bi) + 1;
    const d = h('div', 'res', res, `<div class="dot" style="width:30px;height:30px;border-radius:8px;flex:none;background:${esc(r.it.corHex)};box-shadow:inset 0 -3px 0 #0004"></div>
      <div><div class="where">${esc(S.estantes[r.k].nome)} · ${esc(levelName(r.k, r.ni))} · Espaço ${slotNum}</div><div>${esc([r.it.tipo, r.it.gola].filter(Boolean).join(' · ') || '—')}</div><small style="color:#aaa">${esc([r.it.cor, r.it.tecido, r.it.tamanho && 'Tam. ' + r.it.tamanho].filter(Boolean).join(' · '))}</small></div>
      <div class="q">${r.it.qtd}<small>peças</small></div>`);
    d.onclick = () => { closeSearch(); openShelf(r.k, { sel: { nivel: r.ni, id: r.b.id }, flash: r.b.id }); };
  });
  renderPlan();
  requestAnimationFrame(syncScrollbars);
}
function openSearch() { $('#es-search').classList.add('show'); $('#es-searchBack').classList.add('show'); renderQuick(); renderSearch(); setTimeout(() => $('#es-q').focus(), 200); }
function closeSearch() { $('#es-search').classList.remove('show'); $('#es-searchBack').classList.remove('show'); }
function renderQuick() {
  const c = $('#es-sQuick'); c.innerHTML = '';
  if (!S) return;
  [...S.tipos, ...(S.golas || [])].forEach(t => { const b = h('button', 'chip', c, esc(t)); b.onclick = () => { $('#es-q').value = query = t; renderSearch(); }; });
}
$('#es-q').oninput = e => { query = e.target.value; renderSearch(); };
$('#es-btnSearch').onclick = openSearch; $('#es-sClose').onclick = closeSearch; $('#es-searchBack').onclick = closeSearch;

/* ---------------- geral ---------------- */
$('#es-btnClose').onclick = closeShelf; $('#es-panelBack').onclick = closeShelf;
$('#es-stage').addEventListener('click', () => { if (sel) { sel = null; renderPanel(); } });
$('#es-btnTrash').onclick = () => {
  if (!sel) return;
  const b = S.estantes[cur].niveis[sel.nivel].find(b => b.id === sel.id);
  if (b && blockQty(b) > 0 && !confirm(`Excluir este bloco com ${blockQty(b)} peças?`)) return;
  send({ type: 'deleteBlock', estante: cur, nivel: sel.nivel, id: sel.id }); sel = null; toast('Bloco excluído');
};
document.addEventListener('keydown', e => { if (!esVisible()) return; if (e.key === 'Escape') { if (CI) closeItemSheet(); else if (F) closeForm(); else if ($('#es-search').classList.contains('show')) closeSearch(); else closeShelf(); } if ((e.key === 'Delete') && sel && !F && !CI) $('#es-btnTrash').click(); });
function onPlanResize() { if (!esVisible()) return; if (Math.abs(currentYScale() - planSy) > 0.012) buildPlan(); else placeShelfLabels(); if (cur) { placePanel(); renderPanel(); } }
addEventListener('resize', onPlanResize);
addEventListener('orientationchange', () => setTimeout(onPlanResize, 120));

let booted = false;
function render() {
  if (!S) return;
  updateHeader();
  if (currentTab === 'uni') {
    renderPlan();
    if (cur) renderPanel();
    if ($('#es-search').classList.contains('show')) renderSearch();
  } else {
    renderStock(currentTab);
  }
  if (!booted) {
    booted = true;
    const P = new URLSearchParams(esSearch());
    const wanted = P.get('tab') || localStorage.getItem('estoque-jc-tab');
    if (wanted && wanted !== 'uni') setTab(wanted, false);
    if (P.get('estante') && S.estantes[P.get('estante')]) {
      setTab('uni', false);
      const k = P.get('estante'); let s = null;
      if (P.get('sel')) { const [ni, bi] = P.get('sel').split(':').map(Number); const b = S.estantes[k].niveis[ni]?.[bi]; if (b) s = { nivel: ni, id: b.id }; }
      openShelf(k, { sel: s, fast: true });
      if (s && P.get('form')) openForm(k, s.nivel, s.id);
    }
    if (P.get('q')) { query = P.get('q'); $('#es-q').value = query; setTab('uni', false); openSearch(); }
  }
}

/* ---------------- abas e consumíveis ---------------- */
const UNIDADES = [
  { id: 'pacote', one: 'pacote', many: 'pacotes' },
  { id: 'garrafa', one: 'garrafa', many: 'garrafas' },
  { id: 'bolsa', one: 'bolsa', many: 'bolsas' },
  { id: 'rolo', one: 'rolo', many: 'rolos' },
  { id: 'unidade', one: 'unidade', many: 'unidades' },
];
const TAB_META = {
  uni: { title: 'Uniformes' },
  dtf: { title: 'DTF', sub: 'Pó de poliamida, tintas CMYK e filme. Toque em + ou − para ajustar o estoque.' },
  subl: { title: 'Sublimação', sub: 'Tintas UltraChrome DS da Epson SureColor F6470 (bolsas de 1,6 L, CMYK) e rolos de papel.' },
};
let currentTab = 'uni';
let CI = null; // item sheet draft
let qtyTimers = {};

function unitLabel(u, q) {
  const f = UNIDADES.find(x => x.id === u);
  if (!f) return u || 'un.';
  return q === 1 ? f.one : f.many;
}
function stockList(tab) { return (S && S.consumables && Array.isArray(S.consumables[tab])) ? S.consumables[tab] : []; }
function itemQty(it) { return (it.kind === 'group' && Array.isArray(it.rows)) ? it.rows.reduce((a, r) => a + (r.qtd || 0), 0) : (it.qtd || 0); }
function stockTotal(tab) { return stockList(tab).reduce((a, it) => a + itemQty(it), 0); }
function iconSrc(it) { const s = 'estoque/' + (it.icon || 'icons/generic.webp'); return s + (s.includes('?') ? '&' : '?') + 'v=16'; }
function iconFallback(it) { const s = ('estoque/' + (it.icon || 'icons/generic.webp')).replace(/\.webp$/i, '.png'); return s + (s.includes('?') ? '&' : '?') + 'v=16'; }

function updateHeader() {
  const n = $('#es-totalPecas'), lab = n && n.parentElement && n.parentElement.querySelector('small');
  if (!n || !lab || !S) return;
  if (currentTab === 'uni') {
    n.textContent = totalQty().toLocaleString('pt-BR');
    lab.textContent = 'peças';
  } else {
    n.textContent = stockTotal(currentTab).toLocaleString('pt-BR');
    lab.textContent = 'unidades';
  }
}

function setTab(tab, persist = true) {
  if (!TAB_META[tab]) tab = 'uni';
  currentTab = tab;
  if (persist) {
    try { localStorage.setItem('estoque-jc-tab', tab); } catch {}
    try {
      const u = new URL(location.href);
      if (tab === 'uni') u.searchParams.delete('tab'); else u.searchParams.set('tab', tab);
      /* site: no URL change */
    } catch {}
  }
  R.dataset.tab = tab;
  R.querySelectorAll('.tabs button').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const stock = $('#es-stockWrap');
  if (tab === 'uni') {
    if (stock) stock.hidden = true;
    if (CI) closeItemSheet();
    if (S) { renderPlan(); requestAnimationFrame(() => onPlanResize()); }
  } else {
    if (cur) closeShelf();
    if (F) closeForm();
    closeSearch();
    if (stock) stock.hidden = false;
    if (S) renderStock(tab);
  }
  updateHeader();
}

R.querySelectorAll('.tabs button').forEach(b => {
  b.onclick = () => setTab(b.dataset.tab);
});

function rowLevel(row) {
  if (!row.min) return '';
  if ((row.qtd || 0) === 0) return 'out';
  if (row.qtd <= row.min) return 'low';
  return '';
}
function stockLevel(it) {
  if (it.kind === 'group' && Array.isArray(it.rows)) {
    if (it.rows.some(r => rowLevel(r) === 'out')) return 'low';
    if (it.rows.some(r => rowLevel(r) === 'low')) return 'low';
    return '';
  }
  return rowLevel(it);
}

function bindQty(wrap, getVal, sendQ, fieldName) {
  const minus = h('button', '', wrap, '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'Diminuir');
  const inp = document.createElement('input'); inp.type = 'number'; inp.min = '0'; inp.max = '99999'; inp.value = getVal(); inp.setAttribute('data-field', fieldName || 'qtd'); inp.setAttribute('inputmode', 'numeric'); wrap.appendChild(inp);
  const plus = h('button', '', wrap, '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'Aumentar');
  minus.onclick = () => sendQ(Math.max(0, getVal() - 1));
  plus.onclick = () => sendQ(getVal() + 1);
  inp.onchange = inp.onblur = () => sendQ(parseInt(inp.value, 10) || 0);
  inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
}

function renderStock(tab) {
  const title = $('#es-stockTitle'), sub = $('#es-stockSub'), list = $('#es-stockList');
  if (!title || !list) return;
  const meta = TAB_META[tab] || TAB_META.dtf;
  title.textContent = meta.title;
  sub.textContent = meta.sub || '';
  const items = stockList(tab);
  const focus = document.activeElement;
  const focusCard = focus && focus.closest && focus.closest('.stk');
  const focusId = focusCard && focusCard.dataset.id;
  const focusField = focus && focus.getAttribute && focus.getAttribute('data-field');

  list.innerHTML = '';
  items.forEach(it => {
    const lvl = stockLevel(it);
    const card = h('article', 'stk' + (lvl ? ' ' + lvl : ''), list);
    card.dataset.id = it.id;
    const tile = h('div', 'stk-tile', card);
    const img = document.createElement('img');
    img.alt = it.nome;
    img.src = iconSrc(it);
    img.onerror = () => { if (img.dataset.fb === '2') return; if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = iconFallback(it); return; } img.dataset.fb = '2'; img.src = 'estoque/icons/generic.webp'; };
    tile.appendChild(img);
    const info = h('div', 'stk-info', card);
    const builtInWarn = '';
    info.innerHTML = `<h3>${esc(it.nome)}</h3><small>${esc(it.kind === 'group' ? unitLabel(it.unidade, 2) : unitLabel(it.unidade, it.qtd))}${it.detalhe ? ' · ' + esc(it.detalhe) : ''}</small>`;
    if (it.kind === 'group' && Array.isArray(it.rows)) {
      const rows = h('div', 'stk-rows', card);
      it.rows.forEach(row => {
        const rl = rowLevel(row);
        const line = h('div', 'stk-row' + (rl ? ' ' + rl : ''), rows);
        const letter = h('span', 'stk-letter ' + row.key, line, esc(row.key));
        letter.title = row.cor || row.key;
        const qty = h('div', 'stk-qty', line);
        bindQty(qty, () => row.qtd || 0, q => send({ type: 'setConsumable', tab, id: it.id, row: row.key, patch: { qtd: Math.max(0, Math.min(99999, q)) } }), 'qtd-' + row.key);
        if (rl) h('span', 'stk-warn' + (rl === 'out' ? ' out' : ''), line, rl === 'out' ? 'FIM' : 'MÍN');
        else h('span', 'stk-warn', line, '');
      });
    } else {
      const qty = h('div', 'stk-qty', card);
      bindQty(qty, () => it.qtd || 0, q => send({ type: 'setConsumable', tab, id: it.id, patch: { qtd: Math.max(0, Math.min(99999, q)) } }), 'qtd');
      if (lvl) {
        const b = document.createElement('span');
        b.className = 'stk-badge ' + (lvl === 'out' ? 'out' : 'low');
        b.textContent = lvl === 'out' ? 'ESGOTADO' : 'BAIXO';
        info.querySelector('h3').appendChild(b);
      }
    }
  });
  if (focusId && focusField) {
    const el = list.querySelector(`.stk[data-id="${CSS.escape(focusId)}"] [data-field="${focusField}"]`);
    if (el) { el.focus(); if (typeof el.selectionStart === 'number') el.selectionStart = el.selectionEnd = el.value.length; }
  }
  updateHeader();
}

function openItemSheet(tab, it) {
  const isGroup = !!(it && it.kind === 'group');
  CI = { tab, id: it ? it.id : null, item: it ? JSON.parse(JSON.stringify(it)) : { kind: 'simple', nome: '', unidade: tab === 'subl' ? 'rolo' : 'unidade', qtd: 0, min: 0, detalhe: '', icon: 'icons/generic.webp' } };
  $('#es-itemSheetTitle').textContent = it ? 'Editar card' : 'Novo card';
  $('#es-itemSheetSub').textContent = TAB_META[tab].title;
  const body = $('#es-itemBody'); body.innerHTML = '';
  const field = (label, html) => { const f = h('div', 'field', body); h('label', '', f, label); f.insertAdjacentHTML('beforeend', html); return f; };
  field('Nome', `<input id="es-cNome" type="text" maxlength="80" value="${esc(CI.item.nome)}" placeholder="Ex.: Filme DTF 60 cm">`);
  if (!isGroup) {
    const units = UNIDADES.map(u => `<option value="${u.id}"${CI.item.unidade === u.id ? ' selected' : ''}>${u.many}</option>`).join('');
    const custom = UNIDADES.some(u => u.id === CI.item.unidade) ? '' : `<option value="${esc(CI.item.unidade)}" selected>${esc(CI.item.unidade)}</option>`;
    field('Unidade', `<select id="es-cUnidade">${units}${custom}</select>`);
  }
  field('Medida / detalhe', `<input id="es-cDetalhe" type="text" maxlength="80" value="${esc(CI.item.detalhe || '')}" placeholder="Ex.: 30 cm, 111,8 cm × 100 m, 1,6 L">`);
  if (isGroup) {
    const box = h('div', 'field', body);
    h('label', '', box, 'Estoque mínimo por cor (0 = sem alerta)');
    const grid = h('div', 'row2', box);
    grid.className = 'row2';
    (CI.item.rows || []).forEach(r => {
      const cell = h('div', '', grid);
      cell.innerHTML = `<label>${esc(r.key)} · ${esc(r.cor)}</label><input type="number" min="0" max="99999" data-minkey="${esc(r.key)}" value="${r.min || 0}">`;
    });
  } else {
    const row = h('div', 'field', body);
    row.innerHTML = `<div class="row2"><div><label>Quantidade</label><input id="es-cQtd" type="number" min="0" max="99999" value="${CI.item.qtd || 0}"></div><div><label>Estoque mínimo (opcional)</label><input id="es-cMin" type="number" min="0" max="99999" value="${CI.item.min || 0}" placeholder="0 = sem alerta"></div></div>`;
  }
  $('#es-itemSheet').classList.add('show'); $('#es-itemSheet').setAttribute('aria-hidden', 'false'); $('#es-itemBack').classList.add('show');
  setTimeout(() => $('#es-cNome').focus(), 200);
  requestAnimationFrame(syncScrollbars);
}
function closeItemSheet() {
  CI = null;
  $('#es-itemSheet').classList.remove('show'); $('#es-itemSheet').setAttribute('aria-hidden', 'true'); $('#es-itemBack').classList.remove('show');
}
function saveItemSheet() {
  if (!CI) return;
  const nome = $('#es-cNome').value;
  if (!nome.trim()) { toast('Dê um nome ao item'); return; }
  const detalhe = $('#es-cDetalhe').value;
  if (CI.id && CI.item.kind === 'group') {
    const rows = (CI.item.rows || []).map(r => {
      const inp = R.querySelector(`[data-minkey="${CSS.escape(r.key)}"]`);
      return { ...r, min: inp ? parseInt(inp.value, 10) || 0 : (r.min || 0) };
    });
    send({ type: 'setConsumable', tab: CI.tab, id: CI.id, patch: { nome, detalhe, rows, kind: 'group', icon: CI.item.icon, unidade: CI.item.unidade } });
  } else if (CI.id) {
    send({ type: 'setConsumable', tab: CI.tab, id: CI.id, patch: { nome, detalhe, unidade: $('#es-cUnidade').value, qtd: parseInt($('#es-cQtd').value, 10) || 0, min: parseInt($('#es-cMin').value, 10) || 0 } });
  } else {
    send({ type: 'addConsumable', tab: CI.tab, item: { kind: 'simple', icon: 'icons/generic.webp', nome, detalhe, unidade: $('#es-cUnidade').value, qtd: parseInt($('#es-cQtd').value, 10) || 0, min: parseInt($('#es-cMin').value, 10) || 0 } });
  }
  toast('Item salvo ✓');
  closeItemSheet();
}

$('#es-itemSave').onclick = saveItemSheet;
$('#es-itemCancel').onclick = closeItemSheet;
$('#es-itemClose').onclick = closeItemSheet;
$('#es-itemBack').onclick = closeItemSheet;

try { const t = localStorage.getItem('estoque-jc-tab'); if (t && TAB_META[t]) { currentTab = t; R.dataset.tab = t; } } catch {}
setTab(currentTab, false);

initScrollbars();
buildPlan();


/* ---- site: rota #/estoque e botão no topo ---- */
let started = false;
R.querySelector('#es-conn').addEventListener('click', () => { if (!ws || ws.readyState !== 1 || R.classList.contains('es-noconn')) askLink(); });
R.querySelector('#es-conn').addEventListener('contextmenu', e => { e.preventDefault(); askLink(); });
function esRoute() {
  const on = location.hash.startsWith('#/estoque');
  document.body.classList.toggle('estoque-on', on);
  const btn = document.querySelector('.ttab[data-tab="estoque"]');
  if (on) { fixSel(); setTimeout(fixSel, 0); }
  if (!on) { if (typeof CI !== 'undefined' && CI) closeItemSheet(); if (typeof F !== 'undefined' && F) closeForm(); if (cur) closeShelf(); closeSearch(); return; }
  if (!started) { started = true; connect(); }
  requestAnimationFrame(() => { if (currentTab === 'uni') { buildPlan(); if (S) renderPlan(); } onPlanResize(); });
}
function fixSel() { if (!esVisible()) return; const btn = document.querySelector('.ttab[data-tab="estoque"]');
  document.querySelectorAll('.ttab').forEach(t => { const want = t === btn; if (t.classList.contains('sel') !== want) t.classList.toggle('sel', want); }); }
const tbar = document.querySelector('.ttabs'); if (tbar && window.MutationObserver) new MutationObserver(fixSel).observe(tbar, { subtree: true, attributes: true, attributeFilter: ['class'] });
document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('.ttab[data-tab="estoque"]'); if (!t) return; e.stopPropagation(); e.preventDefault(); location.hash = '#/estoque'; }, true);
addEventListener('hashchange', esRoute); esRoute();
window.__estoque = { connect, askLink, get via() { return esVia; }, get state() { return S; } };
