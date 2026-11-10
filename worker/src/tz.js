const fmtCache = new Map();
const fmt = tz => {
  if (!fmtCache.has(tz)) fmtCache.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }));
  return fmtCache.get(tz);
};
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function parts(ms, tz) {
  const o = {};
  fmt(tz).formatToParts(new Date(ms)).forEach(p => o[p.type] = p.value);
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, wd: WD[o.weekday] };
}
export function zoned(y, m, d, h, mi, tz) {
  const target = Date.UTC(y, m - 1, d, h, mi);
  let g = target;
  for (let i = 0; i < 3; i++) { const p = parts(g, tz); g = target - (Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - g); }
  return g;
}
export const hhmm = (ms, tz) => { const p = parts(ms, tz); return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };
export function nextOccurrence(dep, after, tz) {
  const [h, mi] = dep.arrive.split(':').map(Number);
  for (let k = 0; k < 9; k++) {
    const p = parts(after + k * 86400000, tz);
    const dateStr = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
    if (dep.date ? dep.date !== dateStr : !(dep.days || []).includes(p.wd)) continue;
    const t = zoned(p.y, p.m, p.d, h, mi, tz);
    if (t > after + 5 * 60000) return t;
  }
  return null;
}
