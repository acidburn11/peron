const M = {
  ro: {
    leaveNow: (to) => `Pleaca acum spre ${to}`,
    leaveBody: (line, t, stop, late) => `${line} la ${t} din ${stop}${late > 0 ? ` (intarziere +${late} min)` : ''}`,
    leaveWalk: (t) => `Pleaca la ${t}`,
    noTrip: (to) => `Nu am gasit nicio legatura spre ${to}`,
    disr: (where) => `Perturbare: ${where}`
  },
  en: {
    leaveNow: (to) => `Leave now for ${to}`,
    leaveBody: (line, t, stop, late) => `${line} at ${t} from ${stop}${late > 0 ? ` (delayed +${late} min)` : ''}`,
    leaveWalk: (t) => `Leave at ${t}`,
    noTrip: (to) => `No connection found to ${to}`,
    disr: (where) => `Disruption: ${where}`
  }
};
export const msg = (lang, k, ...a) => (M[lang] || M.ro)[k](...a);
