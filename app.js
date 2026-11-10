'use strict';
const API = 'https://api.transitous.org/api';
const $ = s => document.querySelector(s);
const cache = new Map();
const st = { from: null, to: null, plan: null, cursor: null, cur: null, loc: null };

const MODE = {
  WALK: ['Pe jos', '#8A97A8'], BUS: ['Autobuz', '#1F6FB2'], COACH: ['Autocar', '#1F6FB2'],
  TRAM: ['Tramvai', '#C2352B'], SUBWAY: ['Metrou', '#6A3FA0'], METRO: ['Metrou', '#6A3FA0'],
  RAIL: ['Tren', '#2D3B55'], REGIONAL_RAIL: ['Tren', '#2D3B55'], REGIONAL_FAST_RAIL: ['Tren', '#2D3B55'],
  HIGHSPEED_RAIL: ['Tren', '#2D3B55'], LONG_DISTANCE: ['Tren', '#2D3B55'], NIGHT_RAIL: ['Tren', '#2D3B55'],
  SUBURBAN: ['Tren', '#2D3B55'], FERRY: ['Feribot', '#0E8A9E'], FUNICULAR: ['Funicular', '#7A5A2E'],
  AERIAL_LIFT: ['Telecabina', '#7A5A2E'], CABLE_CAR: ['Telecabina', '#7A5A2E'], AIRPLANE: ['Avion', '#555'],
  BIKE: ['Bicicleta', '#1E7F4F'], RENTAL: ['Inchiriere', '#1E7F4F'], CAR: ['Masina', '#555']
};
const modeName = m => (MODE[m] || [m])[0];
const legColor = l => l.routeColor ? '#' + l.routeColor : (MODE[l.mode] || [0, '#555'])[1];
const legText = l => l.routeTextColor ? '#' + l.routeTextColor : '#fff';

async function api(path, params, ttl = 60000) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.append(k, v);
  const url = `${API}${path}?${q}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.d;
  const r = await fetch(url, { referrerPolicy: 'strict-origin-when-cross-origin' });
  if (!r.ok) throw new Error(r.status === 429 ? 'Prea multe cereri. Incearca peste un minut.' : `Serverul a raspuns cu eroarea ${r.status}.`);
  const d = await r.json();
  cache.set(url, { t: Date.now(), d });
  return d;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (iso, tz) => new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) });
const dur = s => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const delay = (a, b) => Math.round((new Date(a) - new Date(b)) / 60000);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

/* ---------- navigare ---------- */
function show(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === id || (id === 'v-detail' && b.dataset.v === 'v-plan')));
  if (id === 'v-fav') renderFavs();
  if (id === 'v-detail' && map) setTimeout(() => map.invalidateSize(), 50);
  scrollTo(0, 0);
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => show(b.dataset.v));
$('#back').onclick = () => { stopLive(); show('v-plan'); };

/* ---------- locatie ---------- */
function locate() {
  return new Promise((ok, no) => navigator.geolocation
    ? navigator.geolocation.getCurrentPosition(p => { st.loc = [p.coords.latitude, p.coords.longitude]; store.set('loc', st.loc); ok(st.loc); },
      () => no(new Error('Nu am acces la locatie. Permite-o din Setari > Safari > Localizare.')), { enableHighAccuracy: true, timeout: 10000 })
    : no(new Error('Locatia nu este disponibila.')));
}
st.loc = store.get('loc', null);

/* ---------- autocomplete ---------- */
function autocomplete(input, list, onPick, type) {
  let timer, items = [];
  const close = () => { list.hidden = true; list.innerHTML = ''; };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const t = input.value.trim();
    if (t.length < 3) return close();
    timer = setTimeout(async () => {
      try {
        items = await api('/v1/geocode', { text: t, type, place: st.loc ? st.loc.join(',') : '', numResults: 8 }, 86400000);
        if (input.value.trim() !== t) return;
        list.innerHTML = items.map((m, i) => `<li data-i="${i}">${esc(m.name)}<small>${esc(sub(m))}</small></li>`).join('') || '<li>Niciun rezultat</li>';
        list.style.top = (input.closest('.field').offsetTop + input.closest('.field').offsetHeight) + 'px';
        list.hidden = false;
      } catch (e) { list.innerHTML = `<li>${esc(e.message)}</li>`; list.hidden = false; }
    }, 350);
  });
  list.addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    if (!li || list.dataset.for !== input.id) return;
    const m = items[li.dataset.i];
    input.value = m.name; close(); onPick(m);
  });
  input.addEventListener('focus', () => { list.dataset.for = input.id; });
  input.addEventListener('blur', () => setTimeout(close, 200));
}
function sub(m) {
  const area = (m.areas || []).filter(a => !a.default).map(a => a.name);
  const s = [m.street && (m.street + (m.houseNumber ? ' ' + m.houseNumber : '')), ...area.slice(-2)].filter(Boolean);
  return (m.type === 'STOP' ? 'Statie, ' : '') + [...new Set(s)].join(', ');
}
const place = m => ({ name: m.name, lat: m.lat, lon: m.lon });

autocomplete($('#from'), $('#sugg'), m => { st.from = place(m); $('#to').focus(); });
autocomplete($('#to'), $('#sugg'), m => { st.to = place(m); search(); });
$('#from').addEventListener('input', () => st.from = null);
$('#to').addEventListener('input', () => st.to = null);

$('#here').onclick = async () => {
  try { const [lat, lon] = await locate(); st.from = { name: 'Locatia mea', lat, lon }; $('#from').value = 'Locatia mea'; }
  catch (e) { msg('#results', e.message, true); }
};
$('#swap').onclick = () => {
  [st.from, st.to] = [st.to, st.from];
  $('#from').value = st.from?.name || ''; $('#to').value = st.to?.name || '';
};
$('#mode').onchange = () => {
  const t = $('#time'); t.hidden = $('#mode').value === 'now';
  if (!t.hidden && !t.value) { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); t.value = d.toISOString().slice(0, 16); }
};
$('#go').onclick = () => search();
$('#to').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

function msg(sel, text, err) { $(sel).innerHTML = `<p class="msg${err ? ' err' : ''}">${esc(text)}</p>`; }

/* ---------- cautare traseu ---------- */
async function search(more) {
  if (!st.from || !st.to) return msg('#results', 'Alege plecarea si destinatia din lista de sugestii.', true);
  const mode = $('#mode').value;
  const p = {
    fromPlace: `${st.from.lat},${st.from.lon}`, toPlace: `${st.to.lat},${st.to.lon}`,
    detailedTransfers: false, language: 'ro'
  };
  if (mode !== 'now' && $('#time').value) { p.time = new Date($('#time').value).toISOString(); p.arriveBy = mode === 'arr'; }
  if (more) p.pageCursor = st.cursor;
  if (!more) { msg('#results', 'Caut trasee...'); addRecent(); }
  try {
    const d = await api('/v6/plan', p);
    const its = d.itineraries || [];
    st.plan = more ? [...st.plan, ...its] : its;
    st.cursor = mode === 'arr' ? d.previousPageCursor : d.nextPageCursor;
    renderResults(d.direct || []);
  } catch (e) { msg('#results', e.message || 'Cererea a esuat. Verifica conexiunea.', true); }
}

function chips(legs) {
  return legs.map(l => l.mode === 'WALK'
    ? `<span class="walk">&#128694;${Math.max(1, Math.round(l.duration / 60))}</span>`
    : `<span class="chip" style="background:${legColor(l)};color:${legText(l)}">${esc(l.routeShortName || l.displayName || modeName(l.mode))}</span>`
  ).join('<span class="sep">&#8250;</span>');
}

function renderResults(direct) {
  const its = st.plan;
  if (!its.length) return msg('#results', 'Nu am gasit trasee. Incearca alta ora sau un punct apropiat de o statie.');
  const tz = its[0].legs[0].from.tz;
  let h = its.map((it, i) => {
    const first = it.legs.find(l => l.mode !== 'WALK');
    const late = first && first.realTime ? delay(first.startTime, first.scheduledStartTime) : 0;
    return `<button class="it" data-i="${i}">
      <div class="row"><span class="t">${fmt(it.startTime, tz)} &ndash; ${fmt(it.endTime, tz)}</span><span class="d">${dur(it.duration)}</span></div>
      <div class="chips">${chips(it.legs)}</div>
      ${first ? `<div class="d" style="margin-top:6px;font-size:15px">Din ${esc(first.from.name)} la ${fmt(first.startTime, first.from.tz)}${first.realTime ? (late > 0 ? ` <span class="late">+${late} min</span>` : ' <span class="rt">la timp</span>') : ''}</div>` : ''}
    </button>`;
  }).join('');
  const walk = direct.find(x => x.legs.length === 1 && x.legs[0].mode === 'WALK');
  if (walk) h = `<p class="msg" style="padding:12px 0 0">Pe jos: ${dur(walk.duration)}</p>` + h;
  if (st.cursor) h += `<button class="more" id="more">${$('#mode').value === 'arr' ? 'Mai devreme' : 'Mai tarziu'}</button>`;
  $('#results').innerHTML = h;
  $('#results').querySelectorAll('.it').forEach(b => b.onclick = () => openDetail(st.plan[b.dataset.i]));
  $('#more')?.addEventListener('click', () => search(true));
}

/* ---------- detalii ---------- */
let map, layer;
function decode(str, precision) {
  const f = Math.pow(10, precision); let i = 0, lat = 0, lon = 0; const out = [];
  while (i < str.length) {
    for (const k of [0, 1]) {
      let b, s = 0, r = 0;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << s; s += 5; } while (b >= 32);
      const v = r & 1 ? ~(r >> 1) : r >> 1;
      if (k === 0) lat += v; else lon += v;
    }
    out.push([lat / f, lon / f]);
  }
  return out;
}

function openDetail(it) {
  st.cur = it;
  show('v-detail');
  if (!map) {
    map = L.map('map', { zoomControl: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  }
  layer?.remove();
  layer = L.featureGroup().addTo(map);
  it.legs.forEach(l => {
    if (!l.legGeometry?.points) return;
    const pts = decode(l.legGeometry.points, l.legGeometry.precision);
    L.polyline(pts, l.mode === 'WALK' ? { color: '#5B6B82', weight: 4, dashArray: '2 8' } : { color: legColor(l), weight: 6 }).addTo(layer);
  });
  const a = it.legs[0].from, z = it.legs.at(-1).to;
  L.circleMarker([a.lat, a.lon], { radius: 7, color: '#14213D', fillColor: '#fff', fillOpacity: 1, weight: 3 }).addTo(layer);
  L.circleMarker([z.lat, z.lon], { radius: 7, color: '#14213D', fillColor: '#14213D', fillOpacity: 1, weight: 3 }).addTo(layer);
  setTimeout(() => { map.invalidateSize(); map.fitBounds(layer.getBounds(), { padding: [24, 24] }); }, 60);

  const node = (time, tz, name, extra = '') => `<li class="node"><span class="tm">${time ? fmt(time, tz) : ''}</span><span class="rail"></span><span class="nm">${esc(name)}${extra}</span></li>`;
  let h = '';
  it.legs.forEach((l, i) => {
    const late = l.realTime ? delay(l.startTime, l.scheduledStartTime) : 0;
    const tr = l.from.track ? ` <small class="d">linia ${esc(l.from.track)}</small>` : '';
    h += node(l.startTime, l.from.tz, i === 0 ? l.from.name : l.from.name, late > 0 ? ` <span class="late">+${late}</span>` : tr);
    const body = l.mode === 'WALK'
      ? `Pe jos ${dur(l.duration)}${l.distance ? `, ${Math.round(l.distance)} m` : ''}`
      : `<span class="chip" style="background:${legColor(l)};color:${legText(l)}">${esc(l.routeShortName || l.displayName || modeName(l.mode))}</span> ${modeName(l.mode)} spre <b>${esc(l.headsign || l.to.name)}</b><br>${(l.intermediateStops || []).length + 1} statii, ${dur(l.duration)}${l.agencyName ? `<br><small>${esc(l.agencyName)}</small>` : ''}`;
    h += `<li class="seg"><span class="tm"></span><span class="rail${l.mode === 'WALK' ? ' walk' : ''}" style="--c:${legColor(l)}"><i></i></span><div class="bd">${body}</div></li>`;
  });
  const last = it.legs.at(-1);
  h += node(last.endTime, last.to.tz, last.to.name);
  $('#strip').innerHTML = h;
  updStar();
}

/* ---------- salvate ---------- */
const favKey = (f, t) => `${f.lat.toFixed(4)},${f.lon.toFixed(4)}>${t.lat.toFixed(4)},${t.lon.toFixed(4)}`;
function updStar() {
  const on = st.from && st.to && store.get('favs', []).some(x => x.k === favKey(st.from, st.to));
  $('#fav').classList.toggle('on', !!on); $('#fav').innerHTML = on ? '&#9733;' : '&#9734;';
}
$('#fav').onclick = () => {
  if (!st.from || !st.to) return;
  const k = favKey(st.from, st.to); let f = store.get('favs', []);
  f = f.some(x => x.k === k) ? f.filter(x => x.k !== k) : [{ k, from: st.from, to: st.to }, ...f];
  store.set('favs', f); updStar();
};
function addRecent() {
  if (st.from.name === 'Locatia mea') return;
  const k = favKey(st.from, st.to);
  const r = [{ k, from: st.from, to: st.to }, ...store.get('recent', []).filter(x => x.k !== k)].slice(0, 8);
  store.set('recent', r);
}
function renderFavs() {
  const favs = store.get('favs', []), rec = store.get('recent', []).filter(r => !favs.some(f => f.k === r.k));
  const row = (x, list) => `<div class="fav"><button data-k="${esc(x.k)}">${esc(x.from.name)} &#8594; ${esc(x.to.name)}</button><button class="x" data-del="${esc(x.k)}" data-l="${list}" aria-label="Sterge">&#10005;</button></div>`;
  $('#favs').innerHTML = (favs.length ? '<h2>Trasee salvate</h2>' + favs.map(x => row(x, 'favs')).join('') : '<p class="msg">Apasa steaua dintr-un traseu ca sa il salvezi aici.</p>')
    + (rec.length ? '<h2>Cautari recente</h2>' + rec.map(x => row(x, 'recent')).join('') : '');
  $('#favs').querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const x = [...favs, ...rec].find(y => y.k === b.dataset.k);
    st.from = x.from; st.to = x.to; $('#from').value = x.from.name; $('#to').value = x.to.name;
    $('#mode').value = 'now'; $('#time').hidden = true; show('v-plan'); search();
  });
  $('#favs').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    store.set(b.dataset.l, store.get(b.dataset.l, []).filter(y => y.k !== b.dataset.del)); renderFavs();
  });
}

/* ---------- plecari ---------- */
autocomplete($('#stopq'), $('#stopsugg'), m => deps({ stopId: m.id }, m.name), 'STOP');
$('#near').onclick = async () => {
  msg('#deps', 'Caut statiile din jur...');
  try { const [lat, lon] = await locate(); $('#stopq').value = ''; deps({ center: `${lat},${lon}`, radius: 400 }, 'Langa tine'); }
  catch (e) { msg('#deps', e.message, true); }
};
async function deps(q, title) {
  msg('#deps', 'Incarc plecarile...');
  try {
    const d = await api('/v6/stoptimes', { ...q, n: 30, language: 'ro' }, 30000);
    const list = d.stopTimes || [];
    if (!list.length) return msg('#deps', 'Nicio plecare in perioada urmatoare.');
    const now = Date.now();
    $('#deps').innerHTML = `<h2>${esc(title)}</h2>` + list.map(s => {
      const p = s.place, t = p.departure || p.arrival, sch = p.scheduledDeparture || p.scheduledArrival;
      const m = Math.round((new Date(t) - now) / 60000), late = s.realTime ? delay(t, sch) : 0;
      return `<div class="dep">
        <span class="chip" style="background:${legColor(s)};color:${legText(s)}">${esc(s.routeShortName || s.displayName || modeName(s.mode))}</span>
        <div class="h"><div>${esc(s.headsign || s.tripTo?.name || '')}</div><small>${esc(p.name)}${p.track ? ', linia ' + esc(p.track) : ''}</small></div>
        <div class="w">${m <= 0 ? 'acum' : m < 60 ? m + ' min' : fmt(t, p.tz)}<small>${s.cancelled || s.tripCancelled ? '<span class="late">anulat</span>' : s.realTime ? (late > 0 ? `<span class="late">+${late} min</span>` : '<span class="rt">la timp</span>') : 'program'}</small></div>
      </div>`;
    }).join('');
  } catch (e) { msg('#deps', e.message, true); }
}

/* ---------- traseu live ---------- */
let live = null;
const R = Math.PI / 180;
const dist = (a, b) => { const x = (b[1] - a[1]) * R * Math.cos((a[0] + b[0]) / 2 * R), y = (b[0] - a[0]) * R; return Math.hypot(x, y) * 6371000; };
const ll = p => [p.lat, p.lon];
const legChip = l => `<span class="chip" style="background:${legColor(l)};color:${legText(l)}">${esc(l.routeShortName || l.displayName || modeName(l.mode))}</span>`;
const mins = iso => Math.round((new Date(iso) - Date.now()) / 60000);
const stopsOf = l => [l.from, ...(l.intermediateStops || []), l.to];

$('#start').onclick = () => live ? stopLive() : startLive();

async function startLive() {
  const it = st.cur;
  live = { it, i: 0, idx: 0, pos: null, alerted: {}, follow: true };
  const now = Date.now();
  while (live.i < it.legs.length - 1 && new Date(it.legs[live.i].endTime) < now) live.i++;
  $('#v-detail').classList.add('live'); $('#live').hidden = false; $('#start').textContent = 'Opreste';
  try { live.ctx = new (window.AudioContext || window.webkitAudioContext)(); live.ctx.resume(); } catch {}
  try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch {}
  try { live.lock = await navigator.wakeLock?.request('screen'); } catch {}
  if (navigator.geolocation) live.watch = navigator.geolocation.watchPosition(
    p => { if (!live) return; live.pos = [p.coords.latitude, p.coords.longitude]; live.acc = p.coords.accuracy; drawMe(); tick(); },
    () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
  live.timer = setInterval(tick, 10000);
  live.rt = setInterval(refreshRT, 60000);
  map.on('dragstart', () => live && (live.follow = false));
  refreshRT(); tick();
}

function stopLive() {
  if (!live) return;
  navigator.geolocation?.clearWatch(live.watch);
  clearInterval(live.timer); clearInterval(live.rt);
  live.lock?.release?.(); live.me?.remove(); live.ring?.remove(); live.ctx?.close?.();
  live = null;
  $('#v-detail').classList.remove('live'); $('#live').hidden = true; $('#start').textContent = 'Pornesc';
  setTimeout(() => map.invalidateSize(), 50);
}
document.addEventListener('visibilitychange', async () => {
  if (live && document.visibilityState === 'visible') { try { live.lock = await navigator.wakeLock?.request('screen'); } catch {} tick(); }
});

function drawMe() {
  if (!live.me) {
    live.ring = L.circle(live.pos, { radius: live.acc, color: '#1F6FB2', weight: 0, fillOpacity: .15 }).addTo(map);
    live.me = L.circleMarker(live.pos, { radius: 8, color: '#fff', weight: 3, fillColor: '#1F6FB2', fillOpacity: 1 }).addTo(map);
  }
  live.me.setLatLng(live.pos); live.ring.setLatLng(live.pos).setRadius(Math.min(live.acc, 200));
  if (live.follow) map.panTo(live.pos);
}

function notify(key, text) {
  if (live.alerted[key]) return;
  live.alerted[key] = true; live.banner = text;
  try {
    const c = live.ctx, t = c.currentTime;
    [0, .25, .5].forEach(d => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.3, t + d); g.gain.exponentialRampToValueAtTime(.001, t + d + .2); o.connect(g).connect(c.destination); o.start(t + d); o.stop(t + d + .2); });
  } catch {}
  try { if (Notification.permission === 'granted') navigator.serviceWorker.ready.then(r => r.showNotification('Peron', { body: text, tag: 'peron-live' })); } catch {}
}

function nextLeg() { if (live.i < live.it.legs.length - 1) { live.i++; live.idx = 0; live.banner = null; tick(); } else { live.done = true; tick(); } }
function prevLeg() { if (live.i > 0) { live.i--; live.idx = 0; live.done = false; live.banner = null; tick(); } }

function tick() {
  if (!live) return;
  const legs = live.it.legs, l = legs[live.i], now = Date.now(), pos = live.pos;
  let h = '';
  if (live.done) {
    h = `<div class="ins">Ai ajuns la <b>${esc(l.to.name)}</b></div>`;
  } else if (l.mode === 'WALK') {
    const d = pos ? dist(pos, ll(l.to)) : null;
    if (d !== null && d < 35 && live.i < legs.length - 1) return nextLeg();
    if (d !== null && d < 35) { notify('end', 'Ai ajuns la destinatie'); live.done = true; return tick(); }
    const nx = legs[live.i + 1];
    h = `<div class="ins">Mergi pe jos pana la <b>${esc(l.to.name)}</b></div>
      <div class="big">${d === null ? dur(l.duration) : d < 1000 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toFixed(1) + ' km'}</div>
      ${nx ? `<div class="sm">Apoi ${legChip(nx)} spre ${esc(nx.headsign || nx.to.name)}, pleaca ${depTxt(nx)}</div>` : ''}`;
    if (nx && nx.mode !== 'WALK' && mins(nx.startTime) <= 3 && d !== null && d > 150) notify('hurry' + live.i, `Grabeste-te: ${nx.routeShortName || modeName(nx.mode)} pleaca in ${Math.max(0, mins(nx.startTime))} min`);
  } else {
    const stops = stopsOf(l), last = stops.length - 1;
    if (pos) {
      let best = live.idx, bd = Infinity;
      for (let k = live.idx; k <= last; k++) { const d = dist(pos, ll(stops[k])); if (d < bd) { bd = d; best = k; } }
      if (bd < 250) live.idx = best;
    } else {
      stops.forEach((s, k) => { const t = s.departure || s.arrival; if (t && new Date(t) <= now) live.idx = Math.max(live.idx, k); });
    }
    const dEnd = pos ? dist(pos, ll(l.to)) : null;
    const boarded = live.idx > 0 || now > new Date(l.startTime).getTime() + 60000;
    const left = last - live.idx;
    if (!boarded) {
      const m = mins(l.startTime);
      h = `<div class="ins">Asteapta ${legChip(l)} spre <b>${esc(l.headsign || l.to.name)}</b></div>
        <div class="big">${m <= 0 ? 'Acum' : m + ' min'}</div>
        <div class="sm">${esc(l.from.name)}${l.from.track ? ', linia ' + esc(l.from.track) : ''}, ${rtTxt(l)}</div>`;
      if (m <= 1) notify('board' + live.i, `Soseste ${l.routeShortName || modeName(l.mode)} spre ${l.headsign || l.to.name}`);
    } else {
      if ((left === 0 || (dEnd !== null && dEnd < 60))) {
        notify('off' + live.i, `Coboara acum: ${l.to.name}`);
        if (live.i < legs.length - 1 && (dEnd === null || dEnd < 40 || now > new Date(l.endTime).getTime() + 120000)) return nextLeg();
        if (live.i === legs.length - 1 && dEnd !== null && dEnd < 40) { live.done = true; return tick(); }
      } else if (left === 1) notify('pre' + live.i, `Coboara la urmatoarea statie: ${l.to.name}`);
      h = `<div class="ins">${legChip(l)} Coboara la <b>${esc(l.to.name)}</b></div>
        <div class="big">${left === 0 ? 'Coboara acum' : left === 1 ? 'Urmatoarea statie' : left + ' statii'}</div>
        <div class="sm">Sosire ${fmt(l.endTime, l.to.tz)}${l.realTime ? (delay(l.endTime, l.scheduledEndTime) > 0 ? ` <span class="late">+${delay(l.endTime, l.scheduledEndTime)} min</span>` : ' <span class="rt">timp real</span>') : ''}</div>
        <ul class="stops">${stops.map((s, k) => `<li class="${k < live.idx ? 'past' : k === live.idx ? 'now' : k === last ? 'end' : ''}">${esc(s.name)}</li>`).join('')}</ul>`;
    }
  }
  const banner = live.banner && !live.done ? `<div class="alert">${esc(live.banner)}</div>` : '';
  $('#live').style.setProperty('--c', legColor(l));
  $('#live').innerHTML = banner + h + `<div class="nav"><button id="lp" ${live.i === 0 ? 'disabled' : ''}>&#8249; Inapoi</button><span>Etapa ${live.i + 1} din ${legs.length}</span><button id="ln">${live.done ? 'Gata' : 'Urmatoarea &#8250;'}</button></div>`
    + (pos ? '' : '<div class="sm">Fara GPS: pozitia este estimata dupa orar.</div>');
  $('#lp').onclick = prevLeg;
  $('#ln').onclick = () => live.done ? stopLive() : nextLeg();
  $('#live .stops li.now')?.scrollIntoView({ block: 'nearest' });
  if (live.banner && !live.bannerT) live.bannerT = setTimeout(() => { if (live) { live.banner = null; live.bannerT = null; tick(); } }, 15000);
}
const rtTxt = l => !l.realTime ? 'dupa program' : delay(l.startTime, l.scheduledStartTime) > 0 ? `<span class="late">intarziere ${delay(l.startTime, l.scheduledStartTime)} min</span>` : '<span class="rt">la timp</span>';
const depTxt = l => { const m = mins(l.startTime); return (m <= 0 ? 'acum' : m < 60 ? `in ${m} min` : 'la ' + fmt(l.startTime, l.from.tz)); };

async function refreshRT() {
  if (!live) return;
  const legs = live.it.legs.slice(live.i, live.i + 3).filter(l => l.tripId && l.mode !== 'WALK');
  for (const l of legs) {
    try {
      const t = await api('/v6/trip', { tripId: l.tripId, language: 'ro' }, 50000);
      const by = {};
      (t.legs || []).forEach(x => [x.from, ...(x.intermediateStops || []), x.to].forEach(p => p.stopId && (by[p.stopId] = p)));
      const upd = p => { const n = by[p.stopId]; if (n) Object.assign(p, { arrival: n.arrival, departure: n.departure, track: n.track ?? p.track, cancelled: n.cancelled }); };
      stopsOf(l).forEach(upd);
      if (l.from.departure) l.startTime = l.from.departure;
      if (l.to.arrival) l.endTime = l.to.arrival;
      l.realTime = (t.legs || []).some(x => x.realTime) || l.realTime;
    } catch {}
  }
  tick();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
