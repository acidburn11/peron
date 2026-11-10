import { sendPush } from './webpush.js';

const UA = 'Peron/1.0 (+https://github.com/acidburn11/peron)';
const MAX_ALERTS = 40;

const cors = (env, req) => {
  const o = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  return { 'Access-Control-Allow-Origin': allowed.includes(o) ? o : allowed[0], 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
};
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const validSub = s => s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';
const clean = a => ({
  id: String(a.id || '').slice(0, 20), at: Number(a.at) || 0,
  title: String(a.title || 'Peron').slice(0, 80), body: String(a.body || '').slice(0, 300),
  trip: a.trip && a.trip.tripId && a.trip.stopId ? { tripId: String(a.trip.tripId).slice(0, 200), stopId: String(a.trip.stopId).slice(0, 200), kind: a.trip.kind === 'arr' ? 'arr' : 'dep', offset: Number(a.trip.offset) || 0 } : null
});

export default {
  async fetch(req, env) {
    const h = cors(env, req), url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    if (req.method === 'GET' && url.pathname === '/key') return new Response(env.VAPID_PUBLIC.trim(), { headers: { ...h, 'content-type': 'text/plain' } });
    if (req.method === 'GET' && url.pathname === '/') return new Response('Peron push OK', { headers: h });
    if (req.method !== 'POST' || !['/schedule', '/cancel'].includes(url.pathname)) return new Response('Not found', { status: 404, headers: h });
    const origin = req.headers.get('Origin') || '';
    if (!(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(origin)) return new Response('Forbidden', { status: 403, headers: h });
    let body;
    try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400, headers: h }); }
    const endpoint = url.pathname === '/schedule' ? body.sub?.endpoint : body.endpoint;
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) return new Response('Bad request', { status: 400, headers: h });
    if (url.pathname === '/schedule' && (!validSub(body.sub) || !Array.isArray(body.alerts))) return new Response('Bad request', { status: 400, headers: h });
    const stub = env.DEVICE.get(env.DEVICE.idFromName(await sha(endpoint)));
    const r = await stub.fetch('https://do' + url.pathname, { method: 'POST', body: JSON.stringify(body) });
    return new Response(await r.text(), { status: r.status, headers: h });
  }
};

export class Device {
  constructor(state, env) { this.state = state; this.env = env; }

  async fetch(req) {
    const url = new URL(req.url), body = await req.json(), s = this.state.storage;
    let alerts = (await s.get('alerts')) || [];
    const group = String(body.group || 'live').slice(0, 20);
    if (url.pathname === '/schedule') {
      await s.put('sub', body.sub);
      const now = Date.now();
      const add = body.alerts.slice(0, MAX_ALERTS).map(clean).filter(a => a.at > now - 60000 && a.at < now + 36 * 3600000).map(a => ({ ...a, group }));
      alerts = [...alerts.filter(a => a.group !== group), ...add].slice(-MAX_ALERTS);
    } else alerts = body.group ? alerts.filter(a => a.group !== group) : [];
    await s.put('alerts', alerts);
    await this.plan(alerts);
    return new Response(JSON.stringify({ ok: true, pending: alerts.length }), { headers: { 'content-type': 'application/json' } });
  }

  async plan(alerts) {
    if (!alerts.length) { await this.state.storage.deleteAlarm(); return; }
    const now = Date.now(), next = Math.min(...alerts.map(a => a.at));
    const soonTrip = alerts.some(a => a.trip && a.at - now < 25 * 60000);
    let t = next;
    if (soonTrip) t = Math.min(t, now + 60000);
    await this.state.storage.setAlarm(Math.max(t, now + 1000));
  }

  async refresh(alerts) {
    const now = Date.now(), trips = [...new Set(alerts.filter(a => a.trip && a.at - now < 25 * 60000 && a.at - now > -60000).map(a => a.trip.tripId))];
    for (const tripId of trips.slice(0, 5)) {
      try {
        const r = await fetch(`https://api.transitous.org/api/v6/trip?tripId=${encodeURIComponent(tripId)}`, { headers: { 'User-Agent': UA, Referer: 'https://acidburn11.github.io/peron/' } });
        if (!r.ok) continue;
        const t = await r.json(), by = {};
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

  async alarm() {
    const s = this.state.storage, sub = await s.get('sub');
    let alerts = (await s.get('alerts')) || [];
    if (!sub || !alerts.length) { await s.deleteAll(); return; }
    await this.refresh(alerts);
    const now = Date.now(), due = alerts.filter(a => a.at <= now + 10000);
    alerts = alerts.filter(a => a.at > now + 10000);
    for (const a of due) {
      if (now - a.at > 10 * 60000) continue;
      try {
        const r = await sendPush(sub, { title: a.title, body: a.body, tag: 'peron-' + a.group }, this.env);
        if (r.status === 404 || r.status === 410) { await s.deleteAll(); return; }
      } catch {}
    }
    await s.put('alerts', alerts);
    await this.plan(alerts);
  }
}
