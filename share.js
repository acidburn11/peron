'use strict';
const en = !(navigator.language || '').toLowerCase().startsWith('ro');
const T = en ? {
  onWay: n => n ? `${n} is on the way` : 'On the way', to: d => `to ${d}`, eta: 'Arrives around', on: 'On', walking: 'Walking', updated: m => m < 1 ? 'updated just now' : `updated ${m} min ago`,
  est: 'Estimated position from the timetable', arrived: n => `${n || 'They'} arrived`, ended: 'Sharing has ended', expired: 'This link has expired.', err: 'Could not load the location.'
} : {
  onWay: n => n ? `${n} este pe drum` : 'Pe drum', to: d => `spre ${d}`, eta: 'Soseste pe la', on: 'In', walking: 'Pe jos', updated: m => m < 1 ? 'actualizat acum' : `actualizat acum ${m} min`,
  est: 'Pozitie estimata dupa orar', arrived: n => `${n || 'A'} ajuns`, ended: 'Urmarirea s-a incheiat', expired: 'Linkul a expirat.', err: 'Nu am putut incarca locatia.'
};
document.documentElement.lang = en ? 'en' : 'ro';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const id = location.hash.slice(1), PUSH = (window.PERON_PUSH || '').replace(/\/$/, '');
const map = L.map('map', { zoomControl: false }).setView([52, 19], 5);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
const lay = L.featureGroup().addTo(map);
let me = null, drawn = false;
function decode(str, p) { const f = 10 ** p; let i = 0, a = 0, b = 0; const o = []; while (i < str.length) { for (const k of [0, 1]) { let x, s = 0, r = 0; do { x = str.charCodeAt(i++) - 63; r |= (x & 31) << s; s += 5; } while (x >= 32); const v = r & 1 ? ~(r >> 1) : r >> 1; if (k) b += v; else a += v; } o.push([a / f, b / f]); } return o; }
const hm = ms => new Date(ms).toLocaleTimeString(en ? 'en-GB' : 'ro-RO', { hour: '2-digit', minute: '2-digit' });
function estimate(d, now) {
  const l = d.legs.find(x => now >= x.start && now <= x.end) || (now < d.legs[0]?.start ? d.legs[0] : d.legs.at(-1));
  if (!l || !l.pts) return null;
  const p = decode(l.pts, l.prec), f = Math.min(1, Math.max(0, (now - l.start) / Math.max(1, l.end - l.start)));
  return { at: p[Math.min(p.length - 1, Math.round(f * (p.length - 1)))], leg: l };
}
async function load() {
  if (!id || !PUSH) return card(`<div class="muted">${T.err}</div>`);
  try {
    const r = await fetch(`${PUSH}/share?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (r.status === 404) return card(`<h1>${T.expired}</h1>`);
    if (!r.ok) throw 0;
    const d = await r.json(), now = d.now;
    if (!drawn) {
      d.legs.forEach(l => { if (!l.pts) return; const p = decode(l.pts, l.prec); L.polyline(p, l.mode === 'WALK' ? { color: '#3B82C4', weight: 5, dashArray: '1 9', lineCap: 'round' } : { color: l.color || '#1F6FB2', weight: 6 }).addTo(lay); });
      L.marker([d.dest.lat, d.dest.lon], { icon: L.divIcon({ className: '', html: '<div class="end"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(lay);
      if (lay.getBounds().isValid()) map.fitBounds(lay.getBounds(), { padding: [40, 40], paddingBottomRight: [40, 200] });
      drawn = true;
    }
    const fresh = d.pos && d.posAt && now - d.posAt < 3 * 60000, e = estimate(d, now);
    const at = fresh ? d.pos : e?.at || d.pos;
    if (at) {
      if (!me) me = L.marker(at, { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 1000 }).addTo(map);
      me.setLatLng(at); me.getElement()?.firstChild?.classList.toggle('est', !fresh);
    }
    const leg = d.leg != null && fresh ? d.legs[d.leg] : e?.leg;
    const legTxt = leg ? (leg.name ? `${T.on} <span class="badge" style="background:${esc(leg.color)}">${esc(leg.name)}</span> &rarr; ${esc(leg.to)}` : T.walking) : '';
    if (d.status === 'arrived') return card(`<h1>${esc(T.arrived(d.name))}</h1><div class="muted">${esc(d.dest.name)}</div>`);
    if (d.status === 'ended') return card(`<h1>${T.ended}</h1>`);
    const upd = Math.round((now - (d.posAt || d.updated || d.created)) / 60000);
    card(`<h1>${esc(T.onWay(d.name))} ${esc(T.to(d.dest.name))}</h1><div class="muted">${T.eta}</div><div class="eta">${hm(d.eta)}</div><div style="margin-top:6px">${legTxt}</div><div class="muted">${fresh ? T.updated(upd) : T.est}</div><div class="foot">Peron &middot; <a href="https://transitous.org/sources/" target="_blank" rel="noopener">Transitous</a></div>`);
  } catch { card(`<div class="muted">${T.err}</div>`); }
}
const card = h => document.getElementById('card').innerHTML = h;
load(); setInterval(load, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
