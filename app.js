'use strict';
const API = 'https://api.transitous.org/api';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const DEF = { modes: { BUS: true, TRAM: true, SUBWAY: true, RAIL: true, FERRY: true }, transfers: 'any', walk: 15, speed: 'normal', wheelchair: false, alertStops: 2, sound: true, home: null, work: null };
const saved = store.get('opts', {});
const O = { ...DEF, ...saved, modes: { ...DEF.modes, ...(saved.modes || {}) } };
const saveOpts = () => store.set('opts', O);
const st = { loc: store.get('loc', null), from: null, to: null, when: 'now', time: '', plan: [], cursor: null, cur: null, follow: false };

/* ---------- icoane ---------- */
const I = {
  bus: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 18v2M16 18v2"/><circle cx="8.5" cy="14.5" r=".6"/><circle cx="15.5" cy="14.5" r=".6"/></svg>',
  tram: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="13" rx="3"/><path d="M6 13h12M9 3h6M12 3v3M8 19l-2 2M16 19l2 2"/></svg>',
  metro: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 16V8l4 5 4-5v8"/></svg>',
  train: '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="15" rx="4"/><path d="M6 11h12M9 18l-2 3M15 18l2 3"/><circle cx="9.5" cy="14.5" r=".6"/><circle cx="14.5" cy="14.5" r=".6"/></svg>',
  ferry: '<svg viewBox="0 0 24 24"><path d="M4 14h16l-2 5H6zM7 14V9h10v5M12 5v4M3 21c2 0 2-1 4.5-1s2.5 1 4.5 1 2-1 4.5-1 2.5 1 4.5 1"/></svg>',
  cable: '<svg viewBox="0 0 24 24"><path d="M3 4l18 4M12 6v4"/><rect x="7" y="10" width="10" height="10" rx="2"/><path d="M7 15h10"/></svg>',
  walk: '<svg viewBox="0 0 24 24"><circle cx="13" cy="4" r="1.6"/><path d="M10 21l2-6 3 3v3M9 12l1-4 3-1 2 4 3 1M10 8l-3 3"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/></svg>',
  work: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 13h18"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M5 9l7 7 7-7"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
  me: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="7" rx="1.5"/><path d="M12 10v11M9 21h6"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4h11l-2 4 2 4H5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M12 20V5M6 11l6-6 6 6"/></svg>',
  stairs: '<svg viewBox="0 0 24 24"><path d="M4 20h4v-4h4v-4h4V8h4"/></svg>',
  sliders: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'
};
const RAIL = ['RAIL', 'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_FAST_RAIL', 'REGIONAL_RAIL', 'SUBURBAN'];
const MK = m => m === 'WALK' ? 'walk' : m === 'TRAM' ? 'tram' : (m === 'SUBWAY' || m === 'METRO') ? 'metro' : RAIL.includes(m) ? 'train' : m === 'FERRY' ? 'ferry' : ['FUNICULAR', 'AERIAL_LIFT', 'CABLE_CAR', 'AREAL_LIFT'].includes(m) ? 'cable' : 'bus';
const MN = { bus: 'Autobuz', tram: 'Tramvai', metro: 'Metrou', train: 'Tren', ferry: 'Feribot', cable: 'Telecabina', walk: 'Pe jos' };
const MC = { bus: '#1F6FB2', tram: '#C9362B', metro: '#6A3FA0', train: '#2D3B55', ferry: '#0E8A9E', cable: '#7A5A2E', walk: '#3B82C4' };
const modeName = m => MN[MK(m)];
const colorOf = l => l.routeColor && l.routeColor.length === 6 ? '#' + l.routeColor : MC[MK(l.mode)];
const textOf = l => l.routeTextColor && l.routeTextColor.length === 6 ? '#' + l.routeTextColor : '#fff';
const lineName = l => l.routeShortName || l.displayName || l.tripShortName || modeName(l.mode);
const badge = l => `<span class="badge" style="background:${colorOf(l)};color:${textOf(l)}">${I[MK(l.mode)]}${esc(lineName(l))}</span>`;

/* ---------- utilitare ---------- */
const fmt = (iso, tz) => { try { return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) }); } catch { return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }); } };
const mins = iso => Math.round((new Date(iso) - Date.now()) / 60000);
const durS = s => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`; };
const delayM = (a, b) => a && b ? Math.round((new Date(a) - new Date(b)) / 60000) : 0;
const R = Math.PI / 180;
const dist = (a, b) => { const x = (b[1] - a[1]) * R * Math.cos((a[0] + b[0]) / 2 * R), y = (b[0] - a[0]) * R; return Math.hypot(x, y) * 6371000; };
const ll = p => [p.lat, p.lon];
const meters = d => d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`;
const inMin = iso => { const m = mins(iso); return m <= 0 ? 'acum' : m < 60 ? `${m} min` : fmt(iso); };
const liveTag = (l, a = l.startTime, b = l.scheduledStartTime) => {
  if (!l.realTime) return '';
  const d = delayM(a, b);
  return d > 0 ? `<span class="live late">+${d} min</span>` : d < 0 ? `<span class="live">${d} min</span>` : '<span class="live">la timp</span>';
};
function decode(str, precision = 6) {
  const f = 10 ** precision; let i = 0, lat = 0, lon = 0; const out = [];
  while (i < str.length) {
    for (const k of [0, 1]) {
      let b, s = 0, r = 0;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << s; s += 5; } while (b >= 32);
      const v = r & 1 ? ~(r >> 1) : r >> 1;
      if (k) lon += v; else lat += v;
    }
    out.push([lat / f, lon / f]);
  }
  return out;
}
const geom = g => g && g.points ? decode(g.points, g.precision) : [];
let toastT;
function toast(t) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => e.hidden = true, 3500); }

const cache = new Map();
async function api(path, params, ttl = 60000) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.append(k, Array.isArray(v) ? v.join(',') : v);
  const url = `${API}${path}?${q}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.d;
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 25000);
  let r;
  try { r = await fetch(url, { signal: ac.signal }); }
  catch { throw new Error('Nu am putut contacta serverul. Verifica conexiunea.'); }
  finally { clearTimeout(to); }
  if (!r.ok) throw new Error(r.status === 429 ? 'Prea multe cereri. Incearca peste un minut.' : `Serverul a raspuns cu eroarea ${r.status}.`);
  const d = await r.json();
  cache.set(url, { t: Date.now(), d });
  return d;
}

/* ---------- harta ---------- */
const map = L.map('map', { zoomControl: false, attributionControl: true }).setView(st.loc || [44.4268, 26.1025], st.loc ? 16 : 13);
map.attributionControl.setPrefix('<a href="https://transitous.org/sources/" target="_blank" rel="noopener">Date Transitous</a>');
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
const routeL = L.featureGroup().addTo(map);
const stopsL = L.layerGroup().addTo(map);
let meM = null;
const divI = (cls, html = '', size = [20, 20]) => L.divIcon({ className: '', html: `<div class="${cls}">${html}</div>`, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] });

function centerOn(latlng, z = map.getZoom()) {
  const off = (innerHeight - sheetY) / 2 - (live ? 75 : 40);
  map.setView(map.unproject(map.project(latlng, z).add([0, off]), z), z, { animate: true });
}
function drawMe() {
  if (!st.loc) return;
  if (!meM) meM = L.marker(st.loc, { icon: divI('me', '', [20, 20]), zIndexOffset: 1000, interactive: false }).addTo(map);
  else meM.setLatLng(st.loc);
  if (st.follow) centerOn(st.loc);
}
let watchId = null;
function startWatch() {
  if (!navigator.geolocation || watchId !== null) return;
  watchId = navigator.geolocation.watchPosition(p => {
    const first = st.acc == null;
    st.loc = [p.coords.latitude, p.coords.longitude]; st.acc = p.coords.accuracy;
    if (first && view === 'home') centerOn(st.loc, 16);
    store.set('loc', st.loc); drawMe(); if (live) liveTick();
    if (!st.homeLoaded && view === 'home') { st.homeLoaded = true; renderHome(); }
  }, e => { if (e.code === 1) st.denied = true; }, { enableHighAccuracy: true, maximumAge: 4000 });
}
const needLoc = () => st.loc ? Promise.resolve(st.loc) : new Promise((ok, no) => {
  if (!navigator.geolocation) return no(new Error('Locatia nu este disponibila.'));
  navigator.geolocation.getCurrentPosition(p => { st.loc = [p.coords.latitude, p.coords.longitude]; store.set('loc', st.loc); drawMe(); ok(st.loc); },
    () => no(new Error('Permite accesul la locatie din Setari > Confidentialitate > Localizare > Safari.')), { enableHighAccuracy: true, timeout: 10000 });
});
$('#recenter').onclick = async () => {
  try { await needLoc(); st.follow = true; $('#recenter').classList.add('on'); centerOn(st.loc, Math.max(map.getZoom(), 16)); } catch (e) { toast(e.message); }
};
map.on('dragstart', () => { st.follow = false; $('#recenter').classList.remove('on'); });

/* statii pe harta */
let stopsT, stopsKey = '';
map.on('moveend', () => { clearTimeout(stopsT); stopsT = setTimeout(loadMapStops, 500); });
async function loadMapStops() {
  if (map.getZoom() < 16 || !['home', 'stop'].includes(view)) { stopsL.clearLayers(); stopsKey = ''; return; }
  const b = map.getBounds().pad(0.2), r = v => v.toFixed(3);
  const key = [r(b.getSouth()), r(b.getWest()), r(b.getNorth()), r(b.getEast())].join();
  if (key === stopsKey) return;
  stopsKey = key;
  try {
    const list = await api('/v6/map/stops', { min: `${b.getSouth()},${b.getWest()}`, max: `${b.getNorth()},${b.getEast()}`, language: 'ro' }, 300000);
    stopsL.clearLayers();
    list.slice(0, 250).forEach(p => {
      const mk = MK((p.modes || [])[0] || 'BUS');
      L.marker(ll(p), { icon: divI('stopm', '', [16, 16]) }).on('add', e => e.target.getElement()?.firstChild?.style.setProperty('--sc', MC[mk]))
        .on('click', () => openStop(p)).addTo(stopsL);
    });
  } catch {}
}

/* apasare lunga pe harta = destinatie */
let lpT, lpAt = 0, lp0;
const mc = map.getContainer();
mc.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return clearTimeout(lpT);
  lp0 = [e.touches[0].clientX, e.touches[0].clientY];
  lpT = setTimeout(() => { const r = mc.getBoundingClientRect(); map.fire('contextmenu', { latlng: map.containerPointToLatLng([lp0[0] - r.left, lp0[1] - r.top]) }); }, 650);
}, { passive: true });
mc.addEventListener('touchmove', e => { if (lp0 && Math.hypot(e.touches[0].clientX - lp0[0], e.touches[0].clientY - lp0[1]) > 10) clearTimeout(lpT); }, { passive: true });
mc.addEventListener('touchend', () => clearTimeout(lpT));
map.on('contextmenu', async e => {
  if (live || Date.now() - lpAt < 1000 || !$('#pick').hidden) return;
  lpAt = Date.now();
  try { navigator.vibrate?.(30); } catch {}
  const p = await namePlace(e.latlng.lat, e.latlng.lng);
  st.to = p;
  if (!st.from) { try { await needLoc(); st.from = myPlace(); } catch { return openSearch('from'); } }
  plan();
});
const myPlace = () => ({ name: 'Locatia mea', lat: st.loc[0], lon: st.loc[1], me: true });
async function namePlace(lat, lon) {
  try {
    const r = await api('/v1/reverse-geocode', { place: `${lat},${lon}`, numResults: 1 }, 86400000);
    const m = r[0];
    if (m && dist([lat, lon], ll(m)) < 120) return { name: m.name, lat, lon };
  } catch {}
  return { name: 'Punct pe harta', lat, lon };
}

/* ---------- panou glisant ---------- */
const sheet = $('#sheet'), pane = $('#pane');
let sheetY = 0, sheetPos = 'half';
function snaps() {
  const H = innerHeight;
  return { peek: H - 170, half: Math.round(H * .46), full: live ? 150 : Math.round(H * .09) + 20 };
}
function setSheet(pos, instant) {
  sheetPos = pos; sheetY = snaps()[pos];
  sheet.classList.toggle('drag', !!instant);
  sheet.style.transform = `translateY(${sheetY}px)`;
  pane.style.height = (innerHeight - sheetY - 26) + 'px';
  $('#recenter').style.bottom = (innerHeight - sheetY + 12) + 'px';
}
(function drag() {
  let y0, s0, t0, on = false;
  const down = e => {
    if (e.target.closest('button,input,a,select') && !e.target.closest('#grab')) return;
    on = true; y0 = e.clientY; s0 = sheetY; t0 = Date.now(); sheet.classList.add('drag');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = e => {
    if (!on) return;
    const s = snaps(); sheetY = Math.min(s.peek + 40, Math.max(s.full - 20, s0 + e.clientY - y0));
    sheet.style.transform = `translateY(${sheetY}px)`;
  };
  const up = e => {
    if (!on) return; on = false; sheet.classList.remove('drag');
    const s = snaps(), v = (e.clientY - y0) / Math.max(1, Date.now() - t0);
    let pos;
    if (Math.abs(v) > .5) pos = v > 0 ? (sheetPos === 'full' ? 'half' : 'peek') : (sheetPos === 'peek' ? 'half' : 'full');
    else pos = Object.entries(s).sort((a, b) => Math.abs(a[1] - sheetY) - Math.abs(b[1] - sheetY))[0][0];
    setSheet(pos);
  };
  const attach = el => { el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); };
  attach($('#grab'));
  pane.addEventListener('pointerdown', e => { if (e.target.closest('.phd')) down(e); });
  pane.addEventListener('pointermove', move); pane.addEventListener('pointerup', up); pane.addEventListener('pointercancel', up);
})();
addEventListener('resize', () => setSheet(sheetPos, true));

function fitTo(bounds) {
  if (!bounds || !bounds.isValid()) return;
  const top = live ? 150 : 80;
  map.fitBounds(bounds, { paddingTopLeft: [30, top], paddingBottomRight: [30, innerHeight - sheetY + 20], maxZoom: 17 });
}

/* ---------- vederi ---------- */
let view = 'home', stopTimer = null;
const hist = [];
function go(v, render, push = true) {
  if (push && view !== v) hist.push(view);
  view = v; clearInterval(stopTimer);
  render(); pane.scrollTop = 0;
  $('#top').hidden = !!live;
  loadMapStops();
}
function back() {
  const v = hist.pop() || 'home';
  if (v === 'home' || (v === 'results' && !st.plan.length)) { routeL.clearLayers(); hist.length = 0; go('home', renderHome, false); setSheet('half'); return; }
  if (v === 'results') { go('results', renderResults, false); drawEnds(); return; }
  if (v === 'route') { go('route', () => renderRoute(st.cur), false); return; }
  if (v === 'stop' && st.stop) return go('stop', () => renderStop(st.stop), false);
  go('home', renderHome, false);
}
const hd = (title, extra = '', noBack) => `<div class="phd">${noBack ? '' : `<button class="icb" data-act="back" aria-label="Inapoi">${I.back}</button>`}<h2>${title}</h2>${extra}</div>`;
pane.addEventListener('click', e => { if (e.target.closest('[data-act="back"]')) back(); });

/* ---------- acasa ---------- */
function placeBtn(kind) {
  const p = O[kind], lbl = kind === 'home' ? 'Acasa' : 'Serviciu';
  return `<button class="qb" data-q="${kind}"><span class="ic">${I[kind]}</span><span><b>${lbl}</b><small>${p ? esc(p.name) : 'Seteaza adresa'}</small></span></button>`;
}
async function renderHome() {
  const favs = store.get('favs', []), rec = store.get('recent', []).filter(r => !favs.some(f => f.k === r.k)).slice(0, 5);
  pane.innerHTML = `<div class="quick">${placeBtn('home')}${placeBtn('work')}</div>
    <h3>Statii in apropiere</h3><div id="near">${st.loc ? '<div class="skel" style="height:60px"></div>' : `<button class="row" id="askLoc"><span class="ic">${I.me}</span><span class="tx"><div>Arata statiile din jurul meu</div><small>Necesita acces la locatie</small></span></button>`}</div>
    ${favs.length ? '<h3>Trasee salvate</h3>' + favs.map(x => routeRow(x, 'favs', I.star)).join('') : ''}
    ${rec.length ? '<h3>Recente</h3>' + rec.map(x => routeRow(x, 'recent', I.clock)).join('') : ''}`;
  pane.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    const p = O[b.dataset.q];
    if (!p) return openSearch('to', pl => { O[b.dataset.q] = pl; saveOpts(); renderHome(); }, b.dataset.q === 'home' ? 'Adresa de acasa' : 'Adresa serviciului');
    routeTo(p);
  });
  $('#askLoc')?.addEventListener('click', async () => { try { await needLoc(); map.setView(st.loc, 16); renderHome(); } catch (e) { toast(e.message); } });
  pane.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const x = [...favs, ...rec].find(y => y.k === b.dataset.k);
    st.from = x.from.me && st.loc ? myPlace() : x.from; st.to = x.to; st.when = 'now'; plan();
  });
  pane.querySelectorAll('[data-del]').forEach(b => b.onclick = e => {
    e.stopPropagation(); store.set(b.dataset.l, store.get(b.dataset.l, []).filter(y => y.k !== b.dataset.del)); renderHome();
  });
  if (st.loc) nearStops();
}
const routeRow = (x, list, ic) => `<div class="row"><span class="ic">${ic}</span><button class="tx" data-k="${esc(x.k)}" style="text-align:left"><div>${esc(x.to.name)}</div><small>de la ${esc(x.from.name)}</small></button><button class="x" data-del="${esc(x.k)}" data-l="${list}" aria-label="Sterge">${I.close}</button></div>`;
async function nearStops() {
  const [la, lo] = st.loc, d = .005;
  try {
    const list = await api('/v6/map/stops', { min: `${la - d},${lo - d * 1.4}`, max: `${la + d},${lo + d * 1.4}`, language: 'ro' }, 300000);
    const seen = new Set();
    const top = list.map(p => ({ p, d: dist(st.loc, ll(p)) })).sort((a, b) => a.d - b.d)
      .filter(x => { const k = x.p.name; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
    const el = $('#near'); if (!el) return;
    el.innerHTML = top.length ? top.map((x, i) => `<button class="row" data-s="${i}"><span class="ic">${I[MK((x.p.modes || [])[0] || 'BUS')]}</span><span class="tx"><div>${esc(x.p.name)}</div><small>${meters(x.d)}, ~${Math.max(1, Math.round(x.d / 80))} min pe jos</small></span>${I.chev}</button>`).join('')
      : '<p class="row" style="color:var(--muted)">Nicio statie in apropiere.</p>';
    el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => openStop(top[b.dataset.s].p));
  } catch (e) { const el = $('#near'); if (el) el.innerHTML = `<p style="color:var(--late)">${esc(e.message)}</p>`; }
}
function routeTo(p) {
  st.to = p;
  needLoc().then(() => { st.from = myPlace(); plan(); }).catch(() => openSearch('from'));
}

/* ---------- cautare ---------- */
let srch = { field: 'to', cb: null };
const rememberPlace = p => { if (p.me || p.name === 'Punct pe harta') return; store.set('places', [p, ...store.get('places', []).filter(x => x.name !== p.name)].slice(0, 10)); };
function openSearch(field = 'to', cb = null, title) {
  srch = { field, cb };
  $('#search').hidden = false;
  $('#fFromWrap').hidden = !!cb; $('#swap').hidden = !!cb;
  $('#fTo').placeholder = title || 'Destinatie';
  $('#fFrom').value = st.from ? st.from.name : (st.loc && !cb ? 'Locatia mea' : '');
  if (!st.from && st.loc && !cb) st.from = myPlace();
  $('#fTo').value = cb ? '' : st.to ? st.to.name : '';
  const inp = field === 'from' && !cb ? $('#fFrom') : $('#fTo');
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
  focusField(field === 'from' && !cb ? 'from' : 'to');
}
function focusField(f) {
  srch.field = f;
  $('#fFromWrap').classList.toggle('on', f === 'from'); $('#fToWrap').classList.toggle('on', f === 'to');
  showQuick();
}
$('#fFrom').addEventListener('focus', () => { focusField('from'); $('#fFrom').select(); });
$('#fTo').addEventListener('focus', () => focusField('to'));
$('#closeSearch').onclick = () => { $('#search').hidden = true; };
$('#openSearch').onclick = () => openSearch('to');
$('#swap').onclick = () => {
  [st.from, st.to] = [st.to, st.from];
  $('#fFrom').value = st.from?.name || ''; $('#fTo').value = st.to?.name || '';
  if (st.from && st.to) finishSearch();
};
function showQuick() {
  const items = [];
  if (srch.field === 'from' || srch.cb) items.push({ ic: I.me, t: 'Locatia mea', act: 'me' });
  items.push({ ic: I.map, t: 'Alege pe harta', act: 'pick' });
  if (!srch.cb) ['home', 'work'].forEach(k => O[k] && items.push({ ic: I[k], t: k === 'home' ? 'Acasa' : 'Serviciu', s: O[k].name, p: O[k] }));
  store.get('places', []).forEach(p => items.push({ ic: I.clock, t: p.name, s: p.sub || '', p }));
  renderSugg(items);
}
function renderSugg(items) {
  $('#sugg').innerHTML = items.map((x, i) => `<li><button class="row" data-i="${i}"><span class="ic">${x.ic}</span><span class="tx"><div>${esc(x.t)}</div>${x.s ? `<small>${esc(x.s)}</small>` : ''}</span></button></li>`).join('') || '<li class="hint">Niciun rezultat</li>';
  $('#sugg').querySelectorAll('[data-i]').forEach(b => b.onclick = () => pickItem(items[b.dataset.i]));
}
async function pickItem(x) {
  if (x.act === 'me') { try { await needLoc(); return setField(myPlace()); } catch (e) { return toast(e.message); } }
  if (x.act === 'pick') return pickOnMap();
  setField(x.p);
}
function setField(p) {
  if (srch.cb) { $('#search').hidden = true; rememberPlace(p); const cb = srch.cb; srch.cb = null; return cb(p); }
  if (srch.field === 'from') { st.from = p; $('#fFrom').value = p.name; } else { st.to = p; $('#fTo').value = p.name; }
  rememberPlace(p);
  if (st.from && st.to) return finishSearch();
  if (srch.field === 'from') $('#fTo').focus(); else $('#fFrom').focus();
}
function finishSearch() { $('#search').hidden = true; document.activeElement?.blur(); plan(); }
let sT;
['fFrom', 'fTo'].forEach(id => $('#' + id).addEventListener('input', e => {
  if (id === 'fFrom') st.from = null; else if (!srch.cb) st.to = null;
  clearTimeout(sT);
  const t = e.target.value.trim();
  if (t.length < 2) return showQuick();
  sT = setTimeout(async () => {
    try {
      const r = await api('/v1/geocode', { text: t, place: st.loc ? st.loc.join(',') : '', placeBias: st.loc ? 2 : '', numResults: 12, language: 'ro' }, 86400000);
      if (e.target.value.trim() !== t) return;
      renderSugg(r.map(m => ({ ic: m.type === 'STOP' ? I[MK((m.modes || [])[0] || 'BUS')] : I.pin, t: m.name, s: sub(m), p: { name: m.name, lat: m.lat, lon: m.lon, sub: sub(m) } })));
    } catch (err) { $('#sugg').innerHTML = `<li class="hint">${esc(err.message)}</li>`; }
  }, 300);
}));
function sub(m) {
  const areas = (m.areas || []).filter(a => !a.default && a.name !== m.name).map(a => a.name);
  const s = [m.street && m.street !== m.name ? m.street + (m.houseNumber ? ' ' + m.houseNumber : '') : '', ...areas.slice(-2)].filter(Boolean);
  return (m.type === 'STOP' ? 'Statie' + (s.length ? ', ' : '') : '') + [...new Set(s)].join(', ');
}

/* alegere pe harta */
let pickCb = null;
function pickOnMap() {
  const target = srch;
  $('#search').hidden = true; $('#pick').hidden = false; $('#top').hidden = true;
  setSheet('peek');
  if (st.loc) map.setView(st.loc, 16);
  pickCb = async ok => {
    $('#pick').hidden = true; $('#top').hidden = !!live; setSheet('half');
    if (!ok) { $('#search').hidden = false; return; }
    const c = map.getCenter(), p = await namePlace(c.lat, c.lng);
    $('#search').hidden = false; srch = target; setField(p);
  };
}
$('#pickOk').onclick = () => pickCb?.(true);
$('#pickNo').onclick = () => pickCb?.(false);

/* ---------- optiuni ---------- */
function renderOpts() {
  const MODES = [['BUS', 'bus', 'Autobuz'], ['TRAM', 'tram', 'Tramvai'], ['SUBWAY', 'metro', 'Metrou'], ['RAIL', 'train', 'Tren'], ['FERRY', 'ferry', 'Feribot']];
  const seg = (k, vals) => `<div class="seg" data-o="${k}">${vals.map(([v, t]) => `<button data-v="${v}" class="${String(O[k]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const tg = k => `<button class="tg ${O[k] ? 'on' : ''}" data-t="${k}" aria-label="Comuta"></button>`;
  $('#opts').innerHTML = `<div class="ohd"><button class="icb" id="closeOpts" aria-label="Inchide">${I.back}</button><h2>Optiuni</h2></div><div class="obody">
    <h3>Mijloace de transport</h3>
    <div class="chk">${MODES.map(([k, ic, t]) => `<button data-m="${k}" class="${O.modes[k] ? 'on' : ''}">${I[ic]}${t}</button>`).join('')}</div>
    <h3>Preferinte traseu</h3>
    <div class="opt"><span>Schimbari maxime</span>${seg('transfers', [['any', 'Oricate'], ['0', '0'], ['1', '1'], ['2', '2']])}</div>
    <div class="opt"><span>Mers pe jos maxim<small>pana la prima si de la ultima statie</small></span>${seg('walk', [[10, '10'], [15, '15'], [20, '20'], [30, '30 min']])}</div>
    <div class="opt"><span>Viteza de mers</span>${seg('speed', [['slow', 'Lent'], ['normal', 'Normal'], ['fast', 'Rapid']])}</div>
    <div class="opt"><span>Accesibil scaun rulant<small>evita scarile unde exista date</small></span>${tg('wheelchair')}</div>
    <h3>Traseu live</h3>
    <div class="opt"><span>Avertizare inainte de coborare</span>${seg('alertStops', [[1, '1 statie'], [2, '2 statii'], [3, '3 statii']])}</div>
    <div class="opt"><span>Sunet la alerte</span>${tg('sound')}</div>
    <h3>Locuri</h3>
    <div class="opt"><span>Acasa<small>${O.home ? esc(O.home.name) : 'nesetat'}</small></span><button class="btn ghost" data-p="home">${O.home ? 'Schimba' : 'Seteaza'}</button></div>
    <div class="opt"><span>Serviciu<small>${O.work ? esc(O.work.name) : 'nesetat'}</small></span><button class="btn ghost" data-p="work">${O.work ? 'Schimba' : 'Seteaza'}</button></div>
    <div class="opt"><span>Istoric cautari</span><button class="btn ghost" id="clr">Sterge</button></div>
    <p class="credit">Date de transport: <a href="https://transitous.org/sources/" target="_blank" rel="noopener">surse Transitous</a>. Harta &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>.<br>
    Transitous este gratuit si intretinut de voluntari: <a href="https://transitous.org/donate/" target="_blank" rel="noopener">doneaza</a>.<br>
    Cod sursa si contact: <a href="https://github.com/acidburn11/peron" target="_blank" rel="noopener">github.com/acidburn11/peron</a></p></div>`;
  $('#closeOpts').onclick = () => { $('#opts').hidden = true; if (view === 'results' && st.from && st.to) plan(); };
  $('#opts').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    O.modes[b.dataset.m] = !O.modes[b.dataset.m];
    if (!Object.values(O.modes).some(Boolean)) { O.modes[b.dataset.m] = true; return toast('Pastreaza cel putin un mijloc de transport.'); }
    saveOpts(); renderOpts();
  });
  $('#opts').querySelectorAll('.seg[data-o] button').forEach(b => b.onclick = () => {
    const k = b.parentElement.dataset.o, v = b.dataset.v; O[k] = typeof DEF[k] === 'number' ? +v : v; saveOpts(); renderOpts();
  });
  $('#opts').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { O[b.dataset.t] = !O[b.dataset.t]; saveOpts(); renderOpts(); });
  $('#opts').querySelectorAll('[data-p]').forEach(b => b.onclick = () => openSearch('to', p => { O[b.dataset.p] = p; saveOpts(); renderOpts(); if (view === 'home') renderHome(); }, b.dataset.p === 'home' ? 'Adresa de acasa' : 'Adresa serviciului'));
  $('#clr').onclick = () => { store.set('recent', []); store.set('places', []); toast('Istoricul a fost sters.'); if (view === 'home') renderHome(); };
}
$('#openOpts').onclick = () => { renderOpts(); $('#opts').hidden = false; };

/* ---------- planificare ---------- */
const favKey = (f, t) => `${(+f.lat).toFixed(4)},${(+f.lon).toFixed(4)}>${(+t.lat).toFixed(4)},${(+t.lon).toFixed(4)}`;
function planParams() {
  const p = { fromPlace: `${st.from.lat},${st.from.lon}`, toPlace: `${st.to.lat},${st.to.lon}`, detailedTransfers: true, language: 'ro', maxPreTransitTime: O.walk * 60, maxPostTransitTime: O.walk * 60 };
  if (!Object.values(O.modes).every(Boolean)) {
    const m = [];
    if (O.modes.BUS) m.push('BUS', 'COACH');
    if (O.modes.TRAM) m.push('TRAM');
    if (O.modes.SUBWAY) m.push('SUBWAY');
    if (O.modes.RAIL) m.push(...RAIL);
    if (O.modes.FERRY) m.push('FERRY');
    m.push('FUNICULAR', 'AERIAL_LIFT');
    p.transitModes = m;
  }
  if (O.transfers !== 'any') p.maxTransfers = O.transfers;
  if (O.speed !== 'normal') p.pedestrianSpeed = O.speed === 'slow' ? 1 : 1.6;
  if (O.wheelchair) p.pedestrianProfile = 'WHEELCHAIR';
  if (st.when !== 'now' && st.time) { p.time = new Date(st.time).toISOString(); p.arriveBy = st.when === 'arr'; }
  return p;
}
async function plan(more) {
  if (!st.from || !st.to) return openSearch(st.from ? 'to' : 'from');
  if (view !== 'results') go('results', renderResults);
  if (!more) {
    st.plan = []; st.direct = []; st.loading = true; renderResults(); drawEnds(); setSheet('half');
    if (!st.from.me || st.to) { const k = favKey(st.from, st.to); store.set('recent', [{ k, from: st.from, to: st.to }, ...store.get('recent', []).filter(x => x.k !== k)].slice(0, 10)); }
  }
  try {
    const p = planParams(); if (more) p.pageCursor = st.cursor;
    const d = await api('/v6/plan', p);
    const its = (d.itineraries || []).filter(it => it.legs.some(l => l.mode !== 'WALK'));
    st.plan = more ? [...st.plan, ...its] : its;
    st.direct = more ? st.direct : (d.direct || []);
    st.cursor = st.when === 'arr' ? d.previousPageCursor : d.nextPageCursor;
    st.err = null;
  } catch (e) { st.err = e.message; }
  st.loading = false;
  if (view === 'results') renderResults();
}
function drawEnds() {
  routeL.clearLayers(); stopsL.clearLayers();
  if (!st.from || !st.to) return;
  L.marker(ll(st.from), { icon: divI('endm', '', [22, 22]), interactive: false }).addTo(routeL).getElement()?.firstChild?.style.setProperty('background', '#14213D');
  L.marker(ll(st.to), { icon: divI('endm', '', [22, 22]), interactive: false }).addTo(routeL).getElement()?.firstChild?.style.setProperty('background', '#C9362B');
  fitTo(routeL.getBounds());
}
function renderResults() {
  const whenSeg = `<div class="when"><div class="seg" id="whenSeg">${[['now', 'Acum'], ['dep', 'Plecare'], ['arr', 'Sosire']].map(([v, t]) => `<button data-v="${v}" class="${st.when === v ? 'on' : ''}">${t}</button>`).join('')}</div>${st.when !== 'now' ? `<input type="datetime-local" id="whenT" value="${esc(st.time)}">` : ''}</div>`;
  const od = `<button class="od" id="editOD"><span style="display:flex;flex-direction:column;align-items:center;gap:3px"><span class="dot o"></span><span class="dot d"></span></span><span class="tx"><div>${esc(st.from?.name)}</div><div>${esc(st.to?.name)}</div></span>${I.chev}</button>`;
  let body;
  if (st.loading) body = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  else if (st.err) body = `<p style="color:var(--late)">${esc(st.err)}</p><button class="btn ghost" id="retry">Incearca din nou</button>`;
  else if (!st.plan.length) body = `<p style="color:var(--muted)">Nu am gasit trasee cu transport public. Incearca alta ora, mai multe mijloace de transport din Optiuni sau un punct mai aproape de o statie.</p>`;
  else {
    const walk = st.direct.find(x => x.legs.length === 1 && x.legs[0].mode === 'WALK');
    body = (walk ? `<div class="row" style="border:0"><span class="ic">${I.walk}</span><span class="tx"><div>Pe jos</div><small>${meters(walk.legs[0].distance || 0)}</small></span><span class="rt">${durS(walk.duration)}</span></div>` : '')
      + st.plan.map((it, i) => card(it, i)).join('')
      + (st.cursor ? `<button class="btn ghost" id="more" style="width:100%">${st.when === 'arr' ? 'Mai devreme' : 'Mai tarziu'}</button>` : '');
  }
  pane.innerHTML = hd('Trasee', `<button class="icb" id="optsBtn" aria-label="Optiuni">${I.sliders}</button>`) + od + whenSeg + body;
  $('#editOD').onclick = () => openSearch('to');
  $('#optsBtn').onclick = () => { renderOpts(); $('#opts').hidden = false; };
  $('#retry')?.addEventListener('click', () => plan());
  $('#more')?.addEventListener('click', e => { e.target.textContent = 'Se incarca...'; plan(true); });
  $('#whenSeg').querySelectorAll('button').forEach(b => b.onclick = () => {
    st.when = b.dataset.v;
    if (st.when !== 'now' && !st.time) st.time = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    if (st.when === 'now') plan(); else renderResults();
  });
  $('#whenT')?.addEventListener('change', e => { st.time = e.target.value; plan(); });
  pane.querySelectorAll('.card').forEach(b => b.onclick = () => { st.cur = st.plan[b.dataset.i]; go('route', () => renderRoute(st.cur)); });
}
function legsStrip(legs) {
  return legs.map(l => l.mode === 'WALK' ? `<span class="wk">${I.walk}${Math.max(1, Math.round(l.duration / 60))}</span>` : badge(l)).join(I.chev);
}
function card(it, i) {
  const f = it.legs.find(l => l.mode !== 'WALK');
  const walkT = it.legs.filter(l => l.mode === 'WALK').reduce((s, l) => s + l.duration, 0);
  const tz = it.legs[0].from.tz;
  return `<button class="card" data-i="${i}">
    <div class="t1"><div class="legs">${legsStrip(it.legs)}</div><div class="dur">${Math.round(it.duration / 60)}<small>min</small></div></div>
    <div class="t2"><span>${f ? `${liveTag(f) || ''} <b>${inMin(f.startTime)}</b> din ${esc(f.from.name)}` : ''}</span><span>${fmt(it.startTime, tz)}&ndash;${fmt(it.endTime, tz)}</span></div>
    <div class="t2" style="margin-top:4px"><span>${I.walk.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} ${durS(walkT)} pe jos${it.transfers ? `, ${it.transfers} ${it.transfers === 1 ? 'schimbare' : 'schimbari'}` : ''}</span></div>
  </button>`;
}

/* ---------- detalii traseu ---------- */
const DIR = { DEPART: 'Porneste', CONTINUE: 'Continua', LEFT: 'Fa stanga', RIGHT: 'Fa dreapta', SLIGHTLY_LEFT: 'Tine stanga', SLIGHTLY_RIGHT: 'Tine dreapta', HARD_LEFT: 'Vireaza strans la stanga', HARD_RIGHT: 'Vireaza strans la dreapta', UTURN_LEFT: 'Intoarce-te', UTURN_RIGHT: 'Intoarce-te', CIRCLE_CLOCKWISE: 'Intra in sensul giratoriu', CIRCLE_COUNTERCLOCKWISE: 'Intra in sensul giratoriu', STAIRS: 'Foloseste scarile', ELEVATOR: 'Ia liftul' };
const ANG = { LEFT: -90, RIGHT: 90, SLIGHTLY_LEFT: -45, SLIGHTLY_RIGHT: 45, HARD_LEFT: -135, HARD_RIGHT: 135, UTURN_LEFT: 180, UTURN_RIGHT: 180, CIRCLE_CLOCKWISE: 90, CIRCLE_COUNTERCLOCKWISE: -90 };
const stepTxt = s => (DIR[s.relativeDirection] || 'Continua') + (s.streetName && !['STAIRS', 'ELEVATOR'].includes(s.relativeDirection) ? ' pe ' + s.streetName : '');
const stepIc = s => s.relativeDirection === 'STAIRS' ? I.stairs : I.arrow.replace('<svg', `<svg style="transform:rotate(${ANG[s.relativeDirection] || 0}deg)"`);
const stopsOf = l => [l.from, ...(l.intermediateStops || []), l.to];

function drawRoute(it, focus = -1) {
  routeL.clearLayers(); stopsL.clearLayers();
  it.legs.forEach((l, i) => {
    const pts = geom(l.legGeometry); if (!pts.length) return;
    const dim = focus >= 0 && i !== focus ? .35 : 1;
    if (l.mode === 'WALK') L.polyline(pts, { color: '#3B82C4', weight: 5, dashArray: '1 9', lineCap: 'round', opacity: dim }).addTo(routeL);
    else {
      L.polyline(pts, { color: '#fff', weight: 10, opacity: dim }).addTo(routeL);
      L.polyline(pts, { color: colorOf(l), weight: 6, opacity: dim }).addTo(routeL);
      (l.intermediateStops || []).forEach(s => L.circleMarker(ll(s), { radius: 3.5, color: colorOf(l), weight: 2, fillColor: '#fff', fillOpacity: 1, opacity: dim }).addTo(routeL));
      L.marker(ll(l.from), { icon: L.divIcon({ className: '', html: `<div class="legm" style="background:${colorOf(l)};color:${textOf(l)}">${I[MK(l.mode)]}${esc(lineName(l))}</div>`, iconSize: [0, 0] }), interactive: false, opacity: dim }).addTo(routeL);
    }
  });
  const a = it.legs[0].from, z = it.legs.at(-1).to;
  L.marker(ll(a), { icon: divI('endm', '', [22, 22]), interactive: false }).addTo(routeL).getElement()?.firstChild?.style.setProperty('background', '#14213D');
  L.marker(ll(z), { icon: divI('endm', '', [22, 22]), interactive: false }).addTo(routeL).getElement()?.firstChild?.style.setProperty('background', '#C9362B');
}
function renderRoute(it) {
  drawRoute(it);
  setTimeout(() => fitTo(routeL.getBounds()), 30);
  const k = favKey(st.from, st.to), isFav = store.get('favs', []).some(x => x.k === k);
  const tz = it.legs[0].from.tz;
  let tl = `<li class="nd" style="--c:var(--ink)"><span class="tm">${fmt(it.startTime, tz)}</span><span class="rl"></span><span class="bd">${esc(st.from?.name || it.legs[0].from.name)}</span></li>`;
  it.legs.forEach((l, i) => {
    if (l.mode === 'WALK') {
      const steps = (l.steps || []).filter(s => s.distance > 0 || s.relativeDirection === 'STAIRS' || s.relativeDirection === 'ELEVATOR');
      tl += `<li class="sg" data-leg="${i}"><span class="tm"></span><span class="rl wl"><i></i></span><div class="bd"><span class="wk">${I.walk}</span> Mergi pe jos ${durS(l.duration)}${l.distance ? ` (${meters(l.distance)})` : ''}${i < it.legs.length - 1 ? ` pana la <b>${esc(l.to.name)}</b>` : ''}
        ${steps.length ? `<div><button class="more" data-tg="w${i}">Indicatii pas cu pas ${I.down}</button></div><ul class="inner" id="w${i}" hidden>${steps.map(s => `<li>${stepIc(s)}<span>${esc(stepTxt(s))}</span><span class="d">${meters(s.distance)}</span></li>`).join('')}</ul>` : ''}</div></li>`;
      if (i < it.legs.length - 1 && it.legs[i + 1].mode === 'WALK') return;
      return;
    }
    const c = colorOf(l), inter = l.intermediateStops || [];
    tl += `<li class="nd" style="--c:${c}"><span class="tm">${fmt(l.startTime, l.from.tz)}${delayM(l.startTime, l.scheduledStartTime) > 0 ? `<small class="late">${fmt(l.scheduledStartTime, l.from.tz)}</small>` : ''}</span><span class="rl"></span><span class="bd">${esc(l.from.name)}<small>${l.from.track ? `Peron/linia ${esc(l.from.track)}` : 'Urca aici'}</small></span></li>
      <li class="sg" data-leg="${i}" style="--c:${c}"><span class="tm"></span><span class="rl"><i></i></span><div class="bd">${badge(l)} spre <b>${esc(l.headsign || l.to.name)}</b> ${liveTag(l)}
        <div class="sub">${inter.length + 1} ${inter.length ? 'statii' : 'statie'}, ${durS(l.duration)}${l.agencyName ? `, ${esc(l.agencyName)}` : ''}</div>
        ${inter.length ? `<button class="more" data-tg="s${i}">Arata statiile ${I.down}</button><ul class="inner" id="s${i}" hidden>${inter.map(s => `<li><span>${esc(s.name)}</span><span class="d">${s.arrival ? fmt(s.arrival, s.tz) : ''}</span></li>`).join('')}</ul>` : ''}</div></li>
      <li class="nd" style="--c:${c}"><span class="tm">${fmt(l.endTime, l.to.tz)}</span><span class="rl"></span><span class="bd">${esc(l.to.name)}<small>Coboara aici</small></span></li>`;
  });
  const last = it.legs.at(-1);
  if (last.mode === 'WALK') tl += `<li class="nd end"><span class="tm">${fmt(it.endTime, last.to.tz)}</span><span class="rl"></span><span class="bd">${esc(st.to?.name || last.to.name)}</span></li>`;
  pane.innerHTML = hd(`${Math.round(it.duration / 60)} min`, `<button class="icb fav ${isFav ? 'on' : ''}" id="favB" aria-label="Salveaza traseul">${I.star}</button>`)
    + `<div class="legs" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:-4px 0 12px">${legsStrip(it.legs)}</div>`
    + `<button class="go" id="startLive">${I.play}Porneste traseul live</button><ul class="tl">${tl}</ul>`;
  $('#favB').onclick = () => {
    let f = store.get('favs', []);
    f = f.some(x => x.k === k) ? f.filter(x => x.k !== k) : [{ k, from: st.from, to: st.to }, ...f];
    store.set('favs', f); $('#favB').classList.toggle('on'); toast($('#favB').classList.contains('on') ? 'Traseu salvat.' : 'Traseu sters din salvate.');
  };
  $('#startLive').onclick = () => startLive(it);
  pane.querySelectorAll('[data-tg]').forEach(b => b.onclick = e => { e.stopPropagation(); const el = $('#' + b.dataset.tg); el.hidden = !el.hidden; b.classList.toggle('open', !el.hidden); });
  pane.querySelectorAll('.sg[data-leg]').forEach(li => li.onclick = () => {
    const i = +li.dataset.leg; drawRoute(it, i);
    const pts = geom(it.legs[i].legGeometry); if (pts.length) fitTo(L.latLngBounds(pts));
  });
}

/* ---------- statie ---------- */
function openStop(p) { st.stop = p; go('stop', () => renderStop(p)); }
async function renderStop(p) {
  routeL.clearLayers();
  L.marker(ll(p), { icon: divI('endm', '', [22, 22]), interactive: false }).addTo(routeL).getElement()?.firstChild?.style.setProperty('background', '#FFC72C');
  if (sheetPos === 'peek') setSheet('half');
  centerOn(ll(p), Math.max(map.getZoom(), 16));
  const d = st.loc ? dist(st.loc, ll(p)) : null;
  pane.innerHTML = hd(esc(p.name)) + `<div style="color:var(--muted);margin:-6px 0 10px;font-size:14px">${d !== null ? `${meters(d)} de tine` : ''}</div>
    <div class="btns"><button class="btn ghost" id="fromHere">Pleaca de aici</button><button class="btn" id="toHere">Mergi aici</button></div>
    <h3>Urmatoarele plecari</h3><div id="deps"><div class="skel" style="height:56px"></div><div class="skel" style="height:56px"></div></div>`;
  $('#toHere').onclick = () => routeTo({ name: p.name, lat: p.lat, lon: p.lon });
  $('#fromHere').onclick = () => { st.from = { name: p.name, lat: p.lat, lon: p.lon }; st.to = null; openSearch('to'); };
  const load = async () => {
    try {
      const r = await api('/v6/stoptimes', { stopId: p.stopId, n: 40, language: 'ro' }, 25000);
      const el = $('#deps'); if (!el || view !== 'stop') return;
      const groups = new Map();
      (r.stopTimes || []).forEach(s => {
        if (s.place.departure == null && s.place.scheduledDeparture == null) return;
        const k = lineName(s) + '|' + (s.headsign || s.tripTo?.name || '');
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(s);
      });
      const tOf = s => new Date(s.place.departure || s.place.scheduledDeparture);
      st.depGroups = [...groups.values()].map(g => g.sort((a, b) => tOf(a) - tOf(b))).sort((a, b) => tOf(a[0]) - tOf(b[0]));
      el.innerHTML = st.depGroups.length ? st.depGroups.map((g, gi) => {
        const s = g[0], t = s.place.departure || s.place.scheduledDeparture, m = mins(t);
        const nx = g.slice(1, 3).map(x => inMin(x.place.departure || x.place.scheduledDeparture)).join(', ');
        return `<button class="dep" data-g="${gi}">${badge(s)}<span class="tx"><div>${esc(s.headsign || s.tripTo?.name || '')}</div><small>${s.cancelled || s.tripCancelled ? '<span class="late">Anulat</span>' : liveTag(s, t, s.place.scheduledDeparture) || 'Dupa program'}${s.place.track ? `, peron ${esc(s.place.track)}` : ''}</small></span>
          <span class="times"><span class="n">${m <= 0 ? 'acum' : m < 60 ? `${m}<small> min</small>` : fmt(t, s.place.tz)}</span>${nx ? `<span class="o">${nx}</span>` : ''}</span></button>`;
      }).join('') : '<p style="color:var(--muted)">Nicio plecare in perioada urmatoare.</p>';
      el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => openTrip(st.depGroups[b.dataset.g][0], p));
    } catch (e) { const el = $('#deps'); if (el) el.innerHTML = `<p style="color:var(--late)">${esc(e.message)}</p>`; }
  };
  load();
  clearInterval(stopTimer); stopTimer = setInterval(load, 30000);
}

/* ---------- cursa ---------- */
async function openTrip(s, from) {
  go('trip', () => { pane.innerHTML = hd(`${badge(s)} spre ${esc(s.headsign || '')}`) + '<div class="skel"></div>'; });
  try {
    const t = await api('/v6/trip', { tripId: s.tripId, language: 'ro' }, 30000);
    if (view !== 'trip') return;
    const l = t.legs.find(x => x.mode !== 'WALK') || t.legs[0];
    const stops = t.legs.flatMap((x, i) => i ? [...(x.intermediateStops || []), x.to] : stopsOf(x));
    routeL.clearLayers();
    t.legs.forEach(x => { const pts = geom(x.legGeometry); if (pts.length) { L.polyline(pts, { color: '#fff', weight: 10 }).addTo(routeL); L.polyline(pts, { color: colorOf(l), weight: 6 }).addTo(routeL); } });
    stops.forEach(p => L.circleMarker(ll(p), { radius: p.stopId === from.stopId ? 7 : 4, color: colorOf(l), weight: 3, fillColor: p.stopId === from.stopId ? colorOf(l) : '#fff', fillOpacity: 1 }).addTo(routeL));
    fitTo(routeL.getBounds());
    const now = Date.now(), cur = stops.findIndex(p => p.stopId === from.stopId);
    pane.innerHTML = hd(`${badge(l)} spre ${esc(l.headsign || l.to.name)}`) + `<div style="color:var(--muted);font-size:14px;margin:-6px 0 8px">${esc(l.agencyName || '')} ${liveTag(l)}</div>
      <ul class="stops" style="--c:${colorOf(l)}">${stops.map((p, i) => { const tt = p.departure || p.arrival; return `<li class="${tt && new Date(tt) < now ? 'past' : ''} ${i === cur ? 'now' : ''}"><span>${esc(p.name)}</span><span class="d">${tt ? fmt(tt, p.tz) : ''}</span></li>`; }).join('')}</ul>`;
    pane.querySelector('.stops li.now')?.scrollIntoView({ block: 'center' });
  } catch (e) { pane.innerHTML = hd('Cursa') + `<p style="color:var(--late)">${esc(e.message)}</p>`; }
}

/* ---------- traseu live ---------- */
let live = null;
async function startLive(it) {
  live = { it, i: 0, idx: 0, alerted: {}, banner: null };
  const now = Date.now();
  while (live.i < it.legs.length - 1 && new Date(it.legs[live.i].endTime) < now) live.i++;
  try { live.ctx = new (window.AudioContext || window.webkitAudioContext)(); await live.ctx.resume(); } catch {}
  try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch {}
  try { live.lock = await navigator.wakeLock?.request('screen'); } catch {}
  startWatch();
  st.follow = true; $('#recenter').classList.add('on');
  $('#top').hidden = true; $('#livebar').hidden = false;
  hist.push(view); view = 'live';
  live.timer = setInterval(liveTick, 5000);
  live.rt = setInterval(refreshRT, 60000);
  setSheet('peek');
  drawRoute(it, live.i);
  if (st.loc) centerOn(st.loc, 17);
  refreshRT(); liveTick();
}
function stopLive() {
  if (!live) return;
  clearInterval(live.timer); clearInterval(live.rt);
  try { live.lock?.release(); } catch {}
  try { live.ctx?.close(); } catch {}
  live = null;
  $('#livebar').hidden = true; $('#livebar').classList.remove('flash');
  st.follow = false; $('#recenter').classList.remove('on');
  view = 'route'; hist.pop();
  go('route', () => renderRoute(st.cur), false);
  $('#top').hidden = false; setSheet('half');
}
document.addEventListener('visibilitychange', async () => {
  if (live && document.visibilityState === 'visible') { try { live.lock = await navigator.wakeLock?.request('screen'); } catch {} refreshRT(); liveTick(); }
});
function alertUser(key, text) {
  if (!live || live.alerted[key]) return;
  live.alerted[key] = true; live.banner = text; live.bannerAt = Date.now();
  const b = $('#livebar'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
  if (O.sound) try {
    const c = live.ctx, t = c.currentTime;
    [0, .22, .44].forEach((d, k) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = k === 2 ? 1175 : 880; g.gain.setValueAtTime(.35, t + d); g.gain.exponentialRampToValueAtTime(.001, t + d + .2); o.connect(g).connect(c.destination); o.start(t + d); o.stop(t + d + .2); });
  } catch {}
  try { navigator.vibrate?.([250, 120, 250]); } catch {}
  try { if (Notification.permission === 'granted') navigator.serviceWorker.ready.then(r => r.showNotification('Peron', { body: text, tag: 'peron-live', renotify: true, icon: 'icon-192.png' })); } catch {}
}
function setLeg(i) {
  live.i = Math.max(0, Math.min(live.it.legs.length - 1, i)); live.idx = 0; live.done = false;
  drawRoute(live.it, live.i); liveTick();
}
function walkInfo(l, pos) {
  const steps = (l.steps || []).filter(s => s.polyline && s.polyline.points);
  if (!steps.length || !pos) return null;
  let best = 0, bd = Infinity;
  steps.forEach((s, k) => { s._p = s._p || geom(s.polyline); s._p.forEach(p => { const d = dist(pos, p); if (d < bd) { bd = d; best = k; } }); });
  const nx = steps[best + 1];
  return { next: nx, dNext: nx ? dist(pos, nx._p[0]) : null, off: bd > 60 };
}
function bar(c, ci, icon, title, sub, big) {
  const b = $('#livebar');
  b.style.setProperty('--c', c); b.style.setProperty('--ci', ci);
  b.innerHTML = `<div class="bi">${icon}</div><div class="bt"><b>${title}</b><span>${sub}</span></div>${big ? `<div class="bn">${big}</div>` : ''}`;
}
function liveTick() {
  if (!live) return;
  const legs = live.it.legs, l = legs[live.i], now = Date.now(), pos = st.acc != null ? st.loc : null;
  if (live.banner && now - live.bannerAt > 20000) live.banner = null;
  let body = '';
  if (live.done) {
    bar('#16884F', '#fff', I.flag, 'Ai ajuns', esc(st.to?.name || l.to.name));
    body = `<p>Ai ajuns la destinatie.</p>`;
  } else if (l.mode === 'WALK') {
    const d = pos ? dist(pos, ll(l.to)) : null, nx = legs[live.i + 1], w = walkInfo(l, pos);
    if (d !== null && d < 30) { if (nx) return setLeg(live.i + 1); alertUser('end', 'Ai ajuns la destinatie'); live.done = true; return liveTick(); }
    if (!pos && now > new Date(l.endTime).getTime() && nx) return setLeg(live.i + 1);
    const ins = w && w.next && w.dNext < 400 ? `${esc(stepTxt(w.next))}` : `Mergi pana la ${esc(l.to.name)}`;
    bar('#3B82C4', '#fff', w && w.next && w.dNext < 400 ? stepIc(w.next) : I.walk, ins, w && w.next && w.dNext < 400 ? `in ${meters(w.dNext)}` : nx ? `apoi ${esc(lineName(nx))} spre ${esc(nx.headsign || nx.to.name)}` : 'destinatia finala', d !== null ? meters(d) : durS(l.duration));
    if (nx && nx.mode !== 'WALK') {
      const m = mins(nx.startTime), need = d !== null ? d / ((O.speed === 'slow' ? 1 : O.speed === 'fast' ? 1.6 : 1.25) * 60) : 0;
      if (m >= 0 && d !== null && need > m) alertUser('hurry' + live.i, `Grabeste-te: ${lineName(nx)} pleaca in ${m} min, mai ai ${meters(d)}`);
    }
    body = `<div class="stepnow">${I.walk}<div><b>Mergi pe jos${nx ? ` pana la ${esc(l.to.name)}` : ''}</b><div style="color:var(--muted);font-size:14px">${d !== null ? `${meters(d)} ramasi` : durS(l.duration)}${w && w.off ? ', esti in afara traseului' : ''}</div></div></div>
      ${nx ? `<div class="row"><span class="ic">${I[MK(nx.mode)]}</span><span class="tx"><div>${badge(nx)} spre ${esc(nx.headsign || nx.to.name)}</div><small>pleaca ${inMin(nx.startTime) === 'acum' ? 'acum' : 'in ' + inMin(nx.startTime)} ${liveTag(nx)}</small></span></div>` : ''}
      ${(l.steps || []).length ? `<h3>Indicatii</h3><ul class="inner">${l.steps.filter(s => s.distance > 0).map(s => `<li>${stepIc(s)}<span>${esc(stepTxt(s))}</span><span class="d">${meters(s.distance)}</span></li>`).join('')}</ul>` : ''}`;
  } else {
    const stops = stopsOf(l), last = stops.length - 1, c = colorOf(l), ci = textOf(l);
    if (pos) {
      let best = live.idx, bd = Infinity;
      for (let k = live.idx; k <= last; k++) { const d = dist(pos, ll(stops[k])); if (d < bd) { bd = d; best = k; } }
      if (bd < 200) live.idx = best;
    } else stops.forEach((s, k) => { const t = s.departure || s.arrival; if (t && new Date(t) <= now) live.idx = Math.max(live.idx, k); });
    const dEnd = pos ? dist(pos, ll(l.to)) : null;
    const dFrom = pos ? dist(pos, ll(l.from)) : null;
    const boarded = live.idx > 0 || (now > new Date(l.startTime).getTime() + 90000 && (dFrom === null || dFrom > 150));
    const left = last - live.idx;
    if (!boarded) {
      const m = mins(l.startTime);
      bar(c, ci, I[MK(l.mode)], `Urca in ${esc(lineName(l))}`, `spre ${esc(l.headsign || l.to.name)}, ${esc(l.from.name)}`, m <= 0 ? 'acum' : `${m}<small>min</small>`);
      if (m <= 1) alertUser('board' + live.i, `Urca acum in ${lineName(l)} spre ${l.headsign || l.to.name}`);
      else if (m <= 3 && !live.alerted['near' + live.i]) alertUser('near' + live.i, `${lineName(l)} soseste in ${m} min`);
      body = `<div class="stepnow" style="--c:${c}">${I[MK(l.mode)].replace('<svg', `<svg style="color:${c}"`)}<div><b>Asteapta ${badge(l)}</b><div style="color:var(--muted);font-size:14px">${esc(l.from.name)}${l.from.track ? `, peron ${esc(l.from.track)}` : ''}<br>Pleaca la ${fmt(l.startTime, l.from.tz)} ${liveTag(l)}</div></div></div>
        <div class="row"><span class="ic">${I.flag}</span><span class="tx"><div>Cobori la ${esc(l.to.name)}</div><small>${last} ${last === 1 ? 'statie' : 'statii'}, ${durS(l.duration)}</small></span></div>`;
    } else {
      if (left === 0 || (dEnd !== null && dEnd < 70)) {
        alertUser('off' + live.i, `Coboara acum: ${l.to.name}`);
        if (dEnd !== null ? dEnd < 40 : now > new Date(l.endTime).getTime() + 60000) {
          if (live.i < legs.length - 1) { live.alerted['board' + live.i] = true; return setLeg(live.i + 1); }
          live.done = true; return liveTick();
        }
      } else if (left <= O.alertStops) alertUser('pre' + live.i, `Pregateste-te: cobori peste ${left} ${left === 1 ? 'statie' : 'statii'}, la ${l.to.name}`);
      bar(c, ci, I[MK(l.mode)], left === 0 ? 'Coboara acum!' : left === 1 ? 'Coboara la urmatoarea' : `Coboara la ${esc(l.to.name)}`,
        left <= 1 ? esc(l.to.name) : `urmatoarea: ${esc(stops[Math.min(live.idx + 1, last)].name)}`, left > 1 ? `${left}<small>statii</small>` : '');
      const pct = Math.round(live.idx / Math.max(1, last) * 100);
      body = `<div style="display:flex;align-items:center;gap:8px">${badge(l)}<span>spre <b>${esc(l.headsign || l.to.name)}</b></span></div>
        <div class="prog" style="--c:${c}"><i style="width:${pct}%"></i></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--muted)"><span>${left} ${left === 1 ? 'statie ramasa' : 'statii ramase'}</span><span>sosire ${fmt(l.endTime, l.to.tz)} ${liveTag(l, l.endTime, l.scheduledEndTime)}</span></div>
        <ul class="stops" style="--c:${c}">${stops.map((s, k) => `<li class="${k < live.idx ? 'past' : k === live.idx ? 'now' : k === last ? 'end' : ''}"><span>${esc(s.name)}</span><span class="d">${s.arrival || s.departure ? fmt(s.arrival || s.departure, s.tz) : ''}</span></li>`).join('')}</ul>`;
    }
  }
  const nextLegs = legs.slice(live.i + 1).filter(x => x.mode !== 'WALK');
  pane.innerHTML = (live.banner ? `<div class="alert">${I.bell}<span>${esc(live.banner)}</span></div>` : '') + body
    + (nextLegs.length && !live.done ? `<h3>Urmeaza</h3>${nextLegs.map(x => `<div class="row"><span class="ic">${I[MK(x.mode)]}</span><span class="tx"><div>${badge(x)} ${esc(x.from.name)}</div><small>${fmt(x.startTime, x.from.tz)} ${liveTag(x)}</small></span></div>`).join('')}` : '')
    + `<div class="lnav"><button class="btn ghost" id="lPrev" ${live.i === 0 ? 'disabled' : ''}>Etapa anterioara</button><button class="btn ghost" id="lNext">${live.i < legs.length - 1 ? 'Etapa urmatoare' : 'Am ajuns'}</button></div>
       <div class="lnav"><button class="btn stop" id="lStop">Opreste traseul live</button></div>
       ${pos ? '' : '<p style="color:var(--muted);font-size:13px">Fara GPS: pozitia este estimata dupa orar.</p>'}`;
  $('#lPrev').onclick = () => setLeg(live.i - 1);
  $('#lNext').onclick = () => live.i < legs.length - 1 ? setLeg(live.i + 1) : (live.done = true, liveTick());
  $('#lStop').onclick = stopLive;
  pane.querySelector('.stops li.now')?.scrollIntoView({ block: 'nearest' });
}
async function refreshRT() {
  if (!live) return;
  for (const l of live.it.legs.slice(live.i, live.i + 3).filter(l => l.tripId && l.mode !== 'WALK')) {
    try {
      const t = await api('/v6/trip', { tripId: l.tripId, language: 'ro' }, 45000);
      const by = {};
      (t.legs || []).forEach(x => stopsOf(x).forEach(p => p.stopId && (by[p.stopId] = p)));
      stopsOf(l).forEach(p => { const n = by[p.stopId]; if (n) Object.assign(p, { arrival: n.arrival ?? p.arrival, departure: n.departure ?? p.departure, track: n.track ?? p.track }); });
      if (l.from.departure) l.startTime = l.from.departure;
      if (l.to.arrival) l.endTime = l.to.arrival;
      if ((t.legs || []).some(x => x.realTime)) l.realTime = true;
    } catch {}
  }
  liveTick();
}

/* ---------- pornire ---------- */
setSheet('half', true);
renderHome();
loadMapStops();
startWatch();
if (st.loc) drawMe();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
