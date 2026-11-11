import { sendPush } from './webpush.js';
import { parts, hhmm, nextOccurrence } from './tz.js';
import { msg } from './msg.js';

const UA = 'Peron/1.0 (+https://github.com/acidburn11/peron)';
const API = 'https://api.transitous.org/api';
const MAX_ALERTS = 40;
const tget = async (path, q) => {
  const r = await fetch(`${API}${path}?${new URLSearchParams(q)}`, { headers: { 'User-Agent': UA, Referer: 'https://acidburn11.github.io/peron/' } });
  if (!r.ok) throw new Error('transitous ' + r.status);
  return r.json();
};
const origins = env => (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
const cors = (env, req) => { const o = req.headers.get('Origin') || ''; return { 'Access-Control-Allow-Origin': origins(env).includes(o) ? o : origins(env)[0], 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }; };
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const validSub = s => s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';
const str = (v, n) => String(v ?? '').slice(0, n);
const num = v => Number.isFinite(+v) ? +v : 0;
const place = p => ({ name: str(p?.name, 120), lat: num(p?.lat), lon: num(p?.lon) });
const validTz = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz; } catch { return 'Europe/Bucharest'; } };
const clean = a => ({
  id: str(a.id, 20), at: num(a.at), title: str(a.title || 'Peron', 80), body: str(a.body, 300),
  trip: a.trip && a.trip.tripId && a.trip.stopId ? { tripId: str(a.trip.tripId, 200), stopId: str(a.trip.stopId, 200), kind: a.trip.kind === 'arr' ? 'arr' : 'dep', offset: num(a.trip.offset) } : null
});
const json = (d, h, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...h, 'content-type': 'application/json' } });
const SHARE_ID = /^[A-Za-z0-9_-]{16,48}$/;
const BK_ID = /^[a-f0-9]{32,64}$/;
async function logIt(env, e) {
  try {
    const clip = v => typeof v === 'string' ? v.slice(0, 1500) : v;
    const entry = Object.fromEntries(Object.entries(e || {}).slice(0, 15).map(([k, v]) => [str(k, 30), clip(typeof v === 'object' ? JSON.stringify(v) : v)]));
    await env.LOG.get(env.LOG.idFromName('main')).fetch('https://do/add', { method: 'POST', body: JSON.stringify(entry) });
  } catch {}
}

export default {
  async fetch(req, env) {
    const h = cors(env, req), url = new URL(req.url), p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    if (req.method === 'GET' && p === '/key') return new Response(env.VAPID_PUBLIC.trim(), { headers: { ...h, 'content-type': 'text/plain' } });
    if (req.method === 'GET' && p === '/') return new Response('Peron push OK', { headers: h });
    if (req.method === 'GET' && p === '/logs') {
      if (!env.LOG_KEY || url.searchParams.get('key') !== env.LOG_KEY.trim()) return json({ error: 'forbidden' }, h, 403);
      const r = await env.LOG.get(env.LOG.idFromName('main')).fetch('https://do/get?n=' + (url.searchParams.get('n') || '50'));
      return new Response(await r.text(), { status: r.status, headers: { ...h, 'content-type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    if (req.method === 'GET' && p === '/backup') {
      const id = url.searchParams.get('id') || '';
      if (!BK_ID.test(id)) return json({ error: 'bad id' }, h, 400);
      const r = await env.BACKUP.get(env.BACKUP.idFromName(id)).fetch('https://do/get');
      return new Response(await r.text(), { status: r.status, headers: { ...h, 'content-type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    if (req.method === 'GET' && p === '/share') {
      const id = url.searchParams.get('id') || '';
      if (!SHARE_ID.test(id)) return json({ error: 'bad id' }, h, 400);
      const r = await env.SHARE.get(env.SHARE.idFromName(id)).fetch('https://do/get');
      return new Response(await r.text(), { status: r.status, headers: { ...h, 'content-type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    if (req.method !== 'POST') return json({ error: 'not found' }, h, 404);
    if (!origins(env).includes(req.headers.get('Origin') || '')) return json({ error: 'forbidden' }, h, 403);
    const raw = await req.text();
    if (raw.length > (p === '/backup/put' ? 1600000 : 150000)) return json({ error: 'too large' }, h, 413);
    let body; try { body = JSON.parse(raw); } catch { return json({ error: 'bad json' }, h, 400); }
    if (p === '/log') {
      await logIt(env, { src: 'app', ...body });
      return json({ ok: true }, h);
    }
    if (p === '/backup/put') {
      if (!BK_ID.test(body.id || '') || typeof body.data !== 'string') return json({ error: 'bad request' }, h, 400);
      const r = await env.BACKUP.get(env.BACKUP.idFromName(body.id)).fetch('https://do/put', { method: 'POST', body: raw });
      return new Response(await r.text(), { status: r.status, headers: { ...h, 'content-type': 'application/json' } });
    }
    if (p.startsWith('/share/')) {
      if (!SHARE_ID.test(body.id || '') || typeof body.key !== 'string' || body.key.length < 16) return json({ error: 'bad request' }, h, 400);
      const r = await env.SHARE.get(env.SHARE.idFromName(body.id)).fetch('https://do' + p, { method: 'POST', body: raw });
      return new Response(await r.text(), { status: r.status, headers: { ...h, 'content-type': 'application/json' } });
    }
    if (!['/schedule', '/cancel', '/depart', '/watch'].includes(p)) return json({ error: 'not found' }, h, 404);
    const endpoint = p === '/cancel' ? body.endpoint : body.sub?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) return json({ error: 'bad request' }, h, 400);
    if (p !== '/cancel' && !validSub(body.sub)) return json({ error: 'bad request' }, h, 400);
    const r = await env.DEVICE.get(env.DEVICE.idFromName(await sha(endpoint))).fetch('https://do' + p, { method: 'POST', body: raw });
    return new Response(await r.text(), { status: r.status, headers: { ...h, 'content-type': 'application/json' } });
  }
};

export class Device {
  constructor(state, env) { this.state = state; this.env = env; this.s = state.storage; }

  async fetch(req) {
    const p = new URL(req.url).pathname, body = await req.json(), s = this.s;
    if (body.sub) await s.put('sub', body.sub);
    if (body.lang) await s.put('lang', body.lang === 'en' ? 'en' : 'ro');
    if (body.tz) await s.put('tz', validTz(str(body.tz, 60)));
    const tz = (await s.get('tz')) || 'Europe/Bucharest', now = Date.now();
    if (p === '/schedule' || p === '/cancel') {
      let alerts = (await s.get('alerts')) || [];
      const group = str(body.group || 'live', 20);
      if (p === '/schedule') {
        if (!Array.isArray(body.alerts)) return json({ error: 'bad request' }, {}, 400);
        const add = body.alerts.slice(0, MAX_ALERTS).map(clean).filter(a => a.at > now - 60000 && a.at < now + 36 * 3600000).map(a => ({ ...a, group }));
        alerts = [...alerts.filter(a => a.group !== group), ...add].slice(-MAX_ALERTS);
      } else alerts = body.group ? alerts.filter(a => a.group !== group) : [];
      await s.put('alerts', alerts);
    }
    if (p === '/depart') {
      const old = Object.fromEntries(((await s.get('deps')) || []).map(d => [d.id, d]));
      const deps = (Array.isArray(body.list) ? body.list : []).slice(0, 10).filter(d => /^\d{2}:\d{2}$/.test(d.arrive || '')).map(d => {
        const n = { id: str(d.id, 20), from: place(d.from), to: place(d.to), arrive: d.arrive, days: Array.isArray(d.days) ? d.days.map(Number).filter(x => x >= 0 && x <= 6) : [], date: /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : null, walk: Math.min(1800, num(d.walk) || 900), on: d.on !== false };
        const o = old[n.id];
        const same = o && JSON.stringify([o.from, o.to, o.arrive, o.days, o.date, o.on]) === JSON.stringify([n.from, n.to, n.arrive, n.days, n.date, n.on]);
        if (same) return { ...n, target: o.target, stage: o.stage, at: o.at, plan: o.plan };
        const target = n.on ? nextOccurrence(n, now, tz) : null;
        return { ...n, target, stage: 'plan', at: target ? Math.max(now + 2000, target - 4 * 3600000) : null, plan: null };
      });
      await s.put('deps', deps);
    }
    if (p === '/watch') {
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 8).map(i => ({ stopId: str(i.stopId, 200), name: str(i.name, 120), line: i.line ? str(i.line, 20) : null })).filter(i => i.stopId);
      const w = (await s.get('watch')) || { seen: {} };
      w.items = items; w.at = items.length ? now + 3000 : null;
      await s.put('watch', w);
    }
    await this.plan();
    return json({ ok: true }, {});
  }

  async plan() {
    const s = this.s, now = Date.now();
    const alerts = (await s.get('alerts')) || [], deps = (await s.get('deps')) || [], w = await s.get('watch');
    const times = [...alerts.map(a => a.at), ...deps.filter(d => d.at).map(d => d.at)];
    if (w?.at) times.push(w.at);
    if (alerts.some(a => a.trip && a.at - now < 25 * 60000)) times.push(now + 60000);
    if (!times.length) { await s.deleteAlarm(); return; }
    await s.setAlarm(Math.max(Math.min(...times), now + 1000));
  }

  async push(data) {
    const sub = await this.s.get('sub');
    if (!sub) return false;
    try {
      const r = await sendPush(sub, data, this.env);
      if (r.status === 404 || r.status === 410) { await this.s.deleteAll(); return false; }
    } catch {}
    return true;
  }

  async refreshAlerts(alerts) {
    const now = Date.now(), trips = [...new Set(alerts.filter(a => a.trip && a.at - now < 25 * 60000 && a.at - now > -60000).map(a => a.trip.tripId))];
    for (const tripId of trips.slice(0, 5)) {
      try {
        const t = await tget('/v6/trip', { tripId }), by = {};
        (t.legs || []).forEach(l => [l.from, ...(l.intermediateStops || []), l.to].forEach(p => p && p.stopId && (by[p.stopId] = p)));
        alerts.forEach(a => {
          if (!a.trip || a.trip.tripId !== tripId) return;
          const p = by[a.trip.stopId]; if (!p) return;
          const iso = a.trip.kind === 'arr' ? (p.arrival || p.departure) : (p.departure || p.arrival);
          if (iso) a.at = new Date(iso).getTime() + a.trip.offset;
        });
      } catch {}
    }
  }

  async runAlerts() {
    let alerts = (await this.s.get('alerts')) || [];
    if (!alerts.length) return;
    await this.refreshAlerts(alerts);
    const now = Date.now(), due = alerts.filter(a => a.at <= now + 10000);
    alerts = alerts.filter(a => a.at > now + 10000);
    for (const a of due) if (now - a.at < 10 * 60000) if (!(await this.push({ title: a.title, body: a.body, tag: 'peron-' + a.group }))) return;
    await this.s.put('alerts', alerts);
  }

  async planTrip(d) {
    const q = { fromPlace: `${d.from.lat},${d.from.lon}`, toPlace: `${d.to.lat},${d.to.lon}`, time: new Date(d.target).toISOString(), arriveBy: 'true', maxPreTransitTime: d.walk, maxPostTransitTime: d.walk };
    const r = await tget('/v6/plan', q);
    const its = (r.itineraries || []).filter(it => new Date(it.endTime).getTime() <= d.target + 60000);
    const it = its.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0];
    if (!it) return null;
    const legs = it.legs, fi = legs.findIndex(l => !['WALK', 'RENTAL', 'BIKE', 'CAR'].includes(l.mode)), f = legs[fi];
    const before = legs.slice(0, Math.max(0, fi)).reduce((t, l) => t + (l.duration || 0), 0) * 1000;
    return { leave: new Date(it.startTime).getTime(), before, line: f ? (f.routeShortName || f.displayName || f.mode) : null, stop: f?.from?.name || '', tripId: f?.tripId || null, stopId: f?.from?.stopId || null, dep: f ? new Date(f.startTime).getTime() : null, sched: f ? new Date(f.scheduledStartTime || f.startTime).getTime() : null };
  }

  async runDeps() {
    const s = this.s, deps = (await s.get('deps')) || [], tz = (await s.get('tz')) || 'Europe/Bucharest', lang = (await s.get('lang')) || 'ro';
    let changed = false;
    for (const d of deps) {
      const now = Date.now();
      if (!d.at || d.at > now + 5000) continue;
      changed = true;
      const advance = () => { d.target = nextOccurrence(d, Math.max(now, d.target || now), tz); d.stage = 'plan'; d.plan = null; d.at = d.target ? Math.max(now + 60000, d.target - 4 * 3600000) : null; };
      if (!d.on || !d.target || d.target < now) { advance(); continue; }
      try {
        if (d.stage === 'plan' || d.stage === 'replan') {
          const pl = await this.planTrip(d);
          if (!pl) { if (d.target - now < 90 * 60000) { await this.push({ title: 'Peron', body: msg(lang, 'noTrip', d.to.name), tag: 'peron-dep-' + d.id }); advance(); } else d.at = now + 20 * 60000; continue; }
          d.plan = pl;
          if (d.stage === 'plan') { d.stage = 'replan'; d.at = Math.max(now + 60000, pl.leave - 35 * 60000); }
          else { d.stage = 'refresh'; d.at = Math.max(now + 30000, pl.leave - 12 * 60000); }
          if (pl.leave - now < 3 * 60000) { d.stage = 'notify'; d.at = now; }
        }
        if (d.stage === 'refresh' && d.at <= now + 5000) {
          const pl = d.plan;
          if (pl.tripId && pl.stopId) {
            try {
              const t = await tget('/v6/trip', { tripId: pl.tripId });
              const stp = (t.legs || []).flatMap(l => [l.from, ...(l.intermediateStops || []), l.to]).find(x => x && x.stopId === pl.stopId);
              if (stp && (stp.departure || stp.arrival)) { pl.dep = new Date(stp.departure || stp.arrival).getTime(); pl.leave = pl.dep - pl.before; }
            } catch {}
          }
          d.stage = 'notify'; d.at = Math.max(now + 5000, pl.leave - 60000);
        }
        if (d.stage === 'notify' && d.at <= now + 5000) {
          const pl = d.plan, late = pl.dep && pl.sched ? Math.round((pl.dep - pl.sched) / 60000) : 0;
          await this.push({ title: msg(lang, 'leaveNow', d.to.name), body: pl.line ? msg(lang, 'leaveBody', pl.line, hhmm(pl.dep, tz), pl.stop, late) : msg(lang, 'leaveWalk', hhmm(pl.leave, tz)), tag: 'peron-dep-' + d.id });
          if (d.date) { d.on = false; d.at = null; d.target = null; } else advance();
        }
      } catch { d.at = now + 10 * 60000; }
    }
    if (changed) await s.put('deps', deps);
  }

  async runWatch() {
    const s = this.s, w = await s.get('watch'), now = Date.now();
    if (!w || !w.at || w.at > now + 5000) return;
    const tz = (await s.get('tz')) || 'Europe/Bucharest', lang = (await s.get('lang')) || 'ro', h = parts(now, tz).h;
    w.at = now + 60 * 60000;
    if (h >= 6 && h < 23 && w.items?.length) {
      for (const stopId of [...new Set(w.items.map(i => i.stopId))]) {
        try {
          const r = await tget('/v6/stoptimes', { stopId, n: 30, withAlerts: 'true' });
          for (const it of w.items.filter(i => i.stopId === stopId)) {
            const src = it.line ? (r.stopTimes || []).filter(x => (x.routeShortName || x.displayName) === it.line).map(x => x.place) : [r.place, ...(r.stopTimes || []).map(x => x.place)];
            for (const a of src.flatMap(p => p?.alerts || [])) {
              const k = await sha((a.headerText || '') + (a.descriptionText || ''));
              if (w.seen[k]) continue;
              w.seen[k] = now;
              await this.push({ title: msg(lang, 'disr', it.line ? `${it.line} (${it.name})` : it.name), body: str(a.headerText || a.descriptionText, 280), tag: 'peron-w-' + k.slice(0, 8) });
            }
          }
        } catch {}
      }
    }
    for (const k of Object.keys(w.seen)) if (now - w.seen[k] > 4 * 86400000) delete w.seen[k];
    await s.put('watch', w);
  }

  async alarm() {
    try {
      if (!(await this.s.get('sub'))) { await this.s.deleteAll(); return; }
      await this.runAlerts();
      if (!(await this.s.get('sub'))) return;
      await this.runDeps();
      await this.runWatch();
    } catch (e) { await logIt(this.env, { src: 'server', msg: String(e?.message || e), stack: String(e?.stack || '') }); }
    await this.plan();
  }
}

export class Share {
  constructor(state) { this.s = state.storage; }
  async fetch(req) {
    const p = new URL(req.url).pathname, s = this.s, now = Date.now();
    let d = await s.get('d');
    if (p === '/get') {
      if (!d || d.expires < now) return json({ error: 'expired' }, {}, 404);
      const { key, ...pub } = d;
      return json({ ...pub, now }, {});
    }
    const b = await req.json();
    if (p === '/share/start') {
      if (d && d.key !== b.key) return json({ error: 'forbidden' }, {}, 403);
      const m = b.meta || {};
      d = { key: b.key, created: now, expires: now + 8 * 3600000, status: 'live', name: str(m.name, 40), dest: place(m.dest), eta: num(m.eta), legs: (Array.isArray(m.legs) ? m.legs : []).slice(0, 20).map(l => ({ mode: str(l.mode, 20), name: str(l.name, 20), color: str(l.color, 9), pts: str(l.pts, 30000), prec: num(l.prec) || 6, start: num(l.start), end: num(l.end), from: str(l.from, 80), to: str(l.to, 80) })) };
    } else {
      if (!d || d.key !== b.key) return json({ error: 'forbidden' }, {}, 403);
      if (Array.isArray(b.pos) && b.pos.length === 2) d.pos = [num(b.pos[0]), num(b.pos[1])], d.posAt = now;
      if (b.eta) d.eta = num(b.eta);
      if (b.leg != null) d.leg = num(b.leg);
      d.updated = now;
      if (p === '/share/stop') { d.status = b.arrived ? 'arrived' : 'ended'; d.expires = now + (b.arrived ? 30 : 10) * 60000; }
    }
    d.updated = now;
    await s.put('d', d);
    await s.setAlarm(d.expires);
    return json({ ok: true }, {});
  }
  async alarm() { const d = await this.s.get('d'); if (!d || d.expires <= Date.now() + 1000) await this.s.deleteAll(); else await this.s.setAlarm(d.expires); }
}

export class Backup {
  constructor(state) { this.s = state.storage; }
  async fetch(req) {
    const p = new URL(req.url).pathname, now = Date.now();
    if (p === '/get') {
      const d = await this.s.get('d');
      return d ? json(d, {}) : json({ error: 'not found' }, {}, 404);
    }
    const b = await req.json();
    await this.s.put('d', { data: b.data, v: num(b.v) || now, at: now });
    await this.s.setAlarm(now + 400 * 86400000);
    return json({ ok: true, at: now }, {});
  }
  async alarm() { await this.s.deleteAll(); }
}

export class Log {
  constructor(state) { this.s = state.storage; }
  async fetch(req) {
    const u = new URL(req.url), logs = (await this.s.get('logs')) || [];
    if (u.pathname === '/get') return json(logs.slice(-Math.min(200, +u.searchParams.get('n') || 50)).reverse(), {});
    const e = await req.json();
    logs.push({ at: new Date().toISOString(), ...e });
    await this.s.put('logs', logs.slice(-200));
    return json({ ok: true }, {});
  }
}
