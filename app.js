'use strict';
const API = 'https://api.transitous.org/api';
const PUSH = (window.PERON_PUSH || '').replace(/\/$/, '');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const DEF = { lang: (navigator.language || '').toLowerCase().startsWith('ro') ? 'ro' : 'en', modes: { BUS: true, TRAM: true, SUBWAY: true, RAIL: true, FERRY: true }, transfers: 'any', walk: 15, speed: 'normal', wheelchair: false, alertStops: 2, sound: true, home: null, work: null, vehicles: true, rentals: false, useRental: false, lastAlert: false, theme: 'auto', fs: 'n', hc: false };
const saved = store.get('opts', {});
const O = { ...DEF, ...saved, modes: { ...DEF.modes, ...(saved.modes || {}) } };
const saveOpts = () => store.set('opts', O);
const APP_V = '2026.11.12.4';
let errN = 0;
const errSeen = new Set();
function reportErr(msg, extra = {}) {
  msg = String(msg || '').slice(0, 300);
  if (!PUSH || errN >= 10 || !msg || msg === 'Script error.' || errSeen.has(msg)) return;
  errSeen.add(msg); errN++;
  let v = ''; try { v = view; } catch {}
  fetch(PUSH + '/log', { method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ v: APP_V, msg, view: v, lang: O.lang, online: navigator.onLine, standalone: !!navigator.standalone, ua: navigator.userAgent.slice(0, 160), ...extra }) }).catch(() => {});
}
addEventListener('error', e => reportErr(e.message, { file: (e.filename || '').split('/').pop(), line: e.lineno, col: e.colno, stack: String(e.error?.stack || '').slice(0, 1200) }));
addEventListener('unhandledrejection', e => reportErr('promise: ' + (e.reason?.message || e.reason), { stack: String(e.reason?.stack || '').slice(0, 1200) }));
const st = { loc: store.get('loc', null), from: null, to: null, when: 'now', time: '', plan: [], cursor: null, cur: null, follow: false };

/* ---------- limbi ---------- */
const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const L10N = {
  ro: {
    whereTo: 'Unde mergi?', options: 'Optiuni', close: 'Inchide', back: 'Inapoi', swap: 'Inverseaza', myLoc: 'Locatia mea', recenter: 'Centreaza pe locatia mea',
    fromPh: 'Punct de plecare', toPh: 'Destinatie', pickHint: 'Muta harta pe locul dorit', cancel: 'Renunta', pickOk: 'Alege locul', pointOnMap: 'Punct pe harta',
    home: 'Acasa', work: 'Serviciu', setAddr: 'Seteaza adresa', homeAddr: 'Adresa de acasa', workAddr: 'Adresa serviciului',
    myStops: 'Statiile mele', nearStops: 'Statii in apropiere', savedRoutes: 'Trasee salvate', recent: 'Recente', from: 'de la',
    showNear: 'Arata statiile din jurul meu', needLoc: 'Necesita acces la locatie', noNear: 'Nicio statie in apropiere.', walkMin: (d, m) => `${d}, ~${m} min pe jos`,
    noDepSoon: 'Nicio plecare curand', depLoadErr: 'Nu am putut incarca plecarile', now: 'acum', min: 'min', inMin: m => `in ${m} min`, at: t => `la ${t}`,
    locUnavail: 'Locatia nu este disponibila.', locDenied: 'Permite accesul la locatie din Setari > Confidentialitate > Servicii de localizare > Site-uri Safari.',
    netErr: 'Nu am putut contacta serverul. Verifica conexiunea.', tooMany: 'Prea multe cereri. Incearca peste un minut.', srvErr: c => `Serverul a raspuns cu eroarea ${c}.`,
    stop: 'Statie', line: 'Linia', noResults: 'Niciun rezultat', chooseMap: 'Alege pe harta', delete: 'Sterge',
    trips: 'Trasee', nowT: 'Acum', depart: 'Plecare', arrive: 'Sosire', retry: 'Incearca din nou', later: 'Mai tarziu', earlier: 'Mai devreme', loading: 'Se incarca...',
    noTrips: 'Nu am gasit trasee cu transport public. Incearca alta ora, mai multe mijloace de transport din Optiuni sau un punct mai aproape de o statie.',
    onFoot: 'Pe jos', walkFor: d => `${d} pe jos`, transfers: n => pl(n, 'schimbare', 'schimbari'), fromStop: s => `din ${s}`,
    disruption: 'Perturbare pe traseu', disruptions: n => `${n} perturbari pe traseu`, details: 'Detalii', operatorPage: 'Pagina operatorului', disruptionT: 'Perturbare',
    fareEst: 'Bilet estimat', fareFrom: p => `de la ${p}`,
    startLive: 'Porneste traseul live', shareEta: 'Trimite ora sosirii', saveRoute: 'Salveaza traseul', routeSaved: 'Traseu salvat.', routeUnsaved: 'Traseu sters din salvate.',
    walkTo: (d, x) => `Mergi pe jos ${d}${x ? ` pana la <b>${x}</b>` : ''}`, stepByStep: 'Indicatii pas cu pas', showStops: 'Arata statiile', boardHere: 'Urca aici', alightHere: 'Coboara aici',
    platform: p => `Peron ${p}`, towards: 'spre', nStops: n => pl(n, 'statie', 'statii'), takeFrom: s => `Ia vehiculul de la statia ${s}. `, leaveAt: s => `Lasa-l la ${s}.`, openApp: 'Deschide aplicatia',
    bike: 'Bicicleta', scooter: 'Trotineta', car: 'Masina', cargo: 'Bicicleta cargo', seated: 'Scuter', moped: 'Moped', vehicle: 'Vehicul', electric: 'electric',
    avail: (n, f) => `${n} disponibile${f != null ? `, ${f} locuri libere` : ''}`,
    D_DEPART: 'Porneste', D_CONTINUE: 'Continua', D_LEFT: 'Fa stanga', D_RIGHT: 'Fa dreapta', D_SLIGHTLY_LEFT: 'Tine stanga', D_SLIGHTLY_RIGHT: 'Tine dreapta', D_HARD_LEFT: 'Vireaza strans la stanga', D_HARD_RIGHT: 'Vireaza strans la dreapta', D_UTURN: 'Intoarce-te', D_CIRCLE: 'Intra in sensul giratoriu', D_STAIRS: 'Foloseste scarile', D_ELEVATOR: 'Ia liftul', onStreet: s => ` pe ${s}`,
    M_bus: 'Autobuz', M_tram: 'Tramvai', M_metro: 'Metrou', M_train: 'Tren', M_ferry: 'Feribot', M_cable: 'Telecabina', M_walk: 'Pe jos',
    distFromYou: d => `${d} de tine`, leaveHere: 'Pleaca de aici', goHere: 'Mergi aici', nextDeps: 'Urmatoarele plecari', timetable: 'Orar', cancelled: 'Anulat', scheduled: 'Dupa program', onTime: 'la timp',
    noDeps: 'Nicio plecare in perioada urmatoare.', favStop: 'Statie favorita', stopFavOn: 'Statie adaugata la favorite.', stopFavOff: 'Statie scoasa din favorite.',
    today: 'Azi', tomorrow: 'Maine', allLines: 'Toate liniile', noTimetable: 'Nu exista plecari in aceasta zi.', trip: 'Cursa',
    lineTitle: n => `Linia ${n}`, directions: 'Directii', lineNotFound: 'Nu am gasit linia in zona hartii. Apropie harta de oras si incearca din nou.', stopsOnLine: n => `${n} statii`,
    reach: 'Unde ajung', reachSub: 'Zonele accesibile cu transportul public', reachFrom: 'Pornesti din locatia ta, acum.', reachCenter: 'Pornesti din centrul hartii, acum.', reachMin: m => `${m} min`, reachLegend: 'Zonele sunt aproximative: statiile in care ajungi plus mersul pe jos ramas.', reachNone: 'Nu am gasit statii accesibile.',
    lastHome: 'Ultima legatura spre casa', lastLeaves: (t, s) => `Pleaca la ${t} din ${s}`, lastIn: m => `in ${m}`, lastNone: 'Nu mai exista legaturi spre casa in seara asta.', lastPush: (l, m, s) => `Ultima legatura spre casa (${l}) pleaca in ${m} min din ${s}`,
    modesH: 'Mijloace de transport', prefsH: 'Preferinte traseu', maxTransfers: 'Schimbari maxime', any: 'Oricate', maxWalk: 'Mers pe jos maxim', maxWalkSub: 'pana la prima si de la ultima statie',
    speed: 'Viteza de mers', slow: 'Lent', normal: 'Normal', fast: 'Rapid', wheelchair: 'Accesibil scaun rulant', wheelchairSub: 'evita scarile unde exista date',
    useRental: 'Biciclete si trotinete partajate', useRentalSub: 'le include in trasee, unde exista', mapH: 'Harta', vehiclesO: 'Vehicule live', vehiclesSub: 'pozitii estimate dupa orarul in timp real', rentalsO: 'Statii de biciclete si trotinete',
    liveH: 'Traseu live si notificari', alertBefore: 'Avertizare inainte de coborare', stops1: '1 statie', stops2: '2 statii', stops3: '3 statii', soundO: 'Sunet la alerte',
    lastAlertO: 'Alerta pentru ultima legatura spre casa', lastAlertSub: 'cu 20 min inainte, seara', pushOk: 'Notificarile cu ecranul blocat sunt active', pushOff: 'Serverul de notificari nu este configurat', pushDenied: 'Notificarile sunt blocate. Activeaza-le din Setari > Notificari > Peron.', pushTest: 'Test notificare', pushInstall: 'Pentru notificari, adauga aplicatia pe ecranul principal si deschide-o de acolo.', pushTestBody: 'Notificarile functioneaza.',
    placesH: 'Locuri', unset: 'nesetat', change: 'Schimba', set: 'Seteaza', history: 'Istoric cautari', historyCleared: 'Istoricul a fost sters.', langO: 'Limba', keepOneMode: 'Pastreaza cel putin un mijloc de transport.',
    credit: 'Date de transport: <a href="https://transitous.org/sources/" target="_blank" rel="noopener">surse Transitous</a>. Harta &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>.<br>Transitous este gratuit si intretinut de voluntari: <a href="https://transitous.org/donate/" target="_blank" rel="noopener">doneaza</a>.<br>Cod sursa si contact: <a href="https://github.com/acidburn11/peron" target="_blank" rel="noopener">github.com/acidburn11/peron</a>',
    arrived: 'Ai ajuns', arrivedDest: 'Ai ajuns la destinatie.', walkUntil: s => `Mergi pana la ${s}`, rentUntil: (r, s) => `${r} pana la ${s}`, inDist: d => `in ${d}`, thenLine: (l, h) => `apoi ${l} spre ${h}`, finalDest: 'destinatia finala',
    hurry: (l, m, d) => `Grabeste-te: ${l} pleaca in ${m} min, mai ai ${d}`, remaining: d => `${d} ramasi`, offRoute: ', esti in afara traseului', leavesIn: t => `pleaca ${t}`, directions2: 'Indicatii',
    boardIn: l => `Urca in ${l}`, boardNow: (l, h) => `Urca acum in ${l} spre ${h}`, arrivesIn: (l, m) => `${l} soseste in ${m} min`, waitFor: 'Asteapta', leavesAt: t => `Pleaca la ${t}`, getOffAt: s => `Cobori la ${s}`,
    getOffNow: 'Coboara acum!', getOffNext: 'Coboara la urmatoarea', getOffAt2: s => `Coboara la ${s}`, nextStop: s => `urmatoarea: ${s}`, offNowPush: s => `Coboara acum: ${s}`, prepare: (n, s) => `Pregateste-te: cobori peste ${pl(n, 'statie', 'statii')}, la ${s}`,
    stopsLeft: n => n === 1 ? '1 statie ramasa' : `${n} statii ramase`, arrival: t => `sosire ${t}`, next: 'Urmeaza', prevLeg: 'Etapa anterioara', nextLeg: 'Etapa urmatoare', iArrived: 'Am ajuns', stopLive: 'Opreste', noGps: 'Fara GPS: pozitia este estimata dupa orar.',
    etaMsg: (to, t, l) => `Sunt pe drum spre ${to}. Ajung pe la ${t}${l ? ` (sunt in ${l})` : ''}.`, copied: 'Mesajul a fost copiat.', stopsCount: n => pl(n, 'statie', 'statii'),
    pushBoard: (l, h) => `${l} spre ${h} soseste in 2 min`, pushPre: (n, s) => `Pregateste-te: cobori peste ${pl(n, 'statie', 'statii')}, la ${s}`, pushAlight: s => `Coboara la urmatoarea: ${s}`, pushArrive: s => `Ai ajuns la ${s}`,
    langName: 'Romana'
  },
  en: {
    whereTo: 'Where to?', options: 'Settings', close: 'Close', back: 'Back', swap: 'Swap', myLoc: 'My location', recenter: 'Center on my location',
    fromPh: 'Starting point', toPh: 'Destination', pickHint: 'Move the map to the spot you want', cancel: 'Cancel', pickOk: 'Choose this spot', pointOnMap: 'Point on map',
    home: 'Home', work: 'Work', setAddr: 'Set address', homeAddr: 'Home address', workAddr: 'Work address',
    myStops: 'My stops', nearStops: 'Nearby stops', savedRoutes: 'Saved trips', recent: 'Recent', from: 'from',
    showNear: 'Show stops around me', needLoc: 'Needs location access', noNear: 'No stops nearby.', walkMin: (d, m) => `${d}, ~${m} min walk`,
    noDepSoon: 'No departures soon', depLoadErr: 'Could not load departures', now: 'now', min: 'min', inMin: m => `in ${m} min`, at: t => `at ${t}`,
    locUnavail: 'Location is not available.', locDenied: 'Allow location access in Settings > Privacy > Location Services > Safari Websites.',
    netErr: 'Could not reach the server. Check your connection.', tooMany: 'Too many requests. Try again in a minute.', srvErr: c => `The server returned error ${c}.`,
    stop: 'Stop', line: 'Line', noResults: 'No results', chooseMap: 'Choose on map', delete: 'Delete',
    trips: 'Trips', nowT: 'Now', depart: 'Depart', arrive: 'Arrive', retry: 'Try again', later: 'Later', earlier: 'Earlier', loading: 'Loading...',
    noTrips: 'No public transport trips found. Try another time, more transport modes in Settings, or a point closer to a stop.',
    onFoot: 'Walk', walkFor: d => `${d} walk`, transfers: n => `${n} ${n === 1 ? 'transfer' : 'transfers'}`, fromStop: s => `from ${s}`,
    disruption: 'Disruption on this trip', disruptions: n => `${n} disruptions on this trip`, details: 'Details', operatorPage: 'Operator page', disruptionT: 'Disruption',
    fareEst: 'Estimated fare', fareFrom: p => `from ${p}`,
    startLive: 'Start live trip', shareEta: 'Share arrival time', saveRoute: 'Save trip', routeSaved: 'Trip saved.', routeUnsaved: 'Trip removed from saved.',
    walkTo: (d, x) => `Walk ${d}${x ? ` to <b>${x}</b>` : ''}`, stepByStep: 'Step-by-step directions', showStops: 'Show stops', boardHere: 'Board here', alightHere: 'Get off here',
    platform: p => `Platform ${p}`, towards: 'to', nStops: n => `${n} ${n === 1 ? 'stop' : 'stops'}`, takeFrom: s => `Pick up at ${s}. `, leaveAt: s => `Drop off at ${s}.`, openApp: 'Open app',
    bike: 'Bike', scooter: 'Scooter', car: 'Car', cargo: 'Cargo bike', seated: 'Seated scooter', moped: 'Moped', vehicle: 'Vehicle', electric: 'electric',
    avail: (n, f) => `${n} available${f != null ? `, ${f} free docks` : ''}`,
    D_DEPART: 'Head', D_CONTINUE: 'Continue', D_LEFT: 'Turn left', D_RIGHT: 'Turn right', D_SLIGHTLY_LEFT: 'Keep left', D_SLIGHTLY_RIGHT: 'Keep right', D_HARD_LEFT: 'Turn sharp left', D_HARD_RIGHT: 'Turn sharp right', D_UTURN: 'Make a U-turn', D_CIRCLE: 'Enter the roundabout', D_STAIRS: 'Take the stairs', D_ELEVATOR: 'Take the elevator', onStreet: s => ` on ${s}`,
    M_bus: 'Bus', M_tram: 'Tram', M_metro: 'Metro', M_train: 'Train', M_ferry: 'Ferry', M_cable: 'Cable car', M_walk: 'Walk',
    distFromYou: d => `${d} from you`, leaveHere: 'Start here', goHere: 'Go here', nextDeps: 'Next departures', timetable: 'Timetable', cancelled: 'Cancelled', scheduled: 'Scheduled', onTime: 'on time',
    noDeps: 'No departures coming up.', favStop: 'Favorite stop', stopFavOn: 'Stop added to favorites.', stopFavOff: 'Stop removed from favorites.',
    today: 'Today', tomorrow: 'Tomorrow', allLines: 'All lines', noTimetable: 'No departures on this day.', trip: 'Trip',
    lineTitle: n => `Line ${n}`, directions: 'Directions', lineNotFound: 'Line not found in the map area. Move the map to the city and try again.', stopsOnLine: n => `${n} stops`,
    reach: 'Where can I go', reachSub: 'Areas reachable by public transport', reachFrom: 'Starting from your location, now.', reachCenter: 'Starting from the map center, now.', reachMin: m => `${m} min`, reachLegend: 'Areas are approximate: reachable stops plus the remaining walk.', reachNone: 'No reachable stops found.',
    lastHome: 'Last connection home', lastLeaves: (t, s) => `Leaves at ${t} from ${s}`, lastIn: m => `in ${m}`, lastNone: 'No more connections home tonight.', lastPush: (l, m, s) => `Last connection home (${l}) leaves in ${m} min from ${s}`,
    modesH: 'Transport modes', prefsH: 'Trip preferences', maxTransfers: 'Max transfers', any: 'Any', maxWalk: 'Max walking', maxWalkSub: 'to the first and from the last stop',
    speed: 'Walking speed', slow: 'Slow', normal: 'Normal', fast: 'Fast', wheelchair: 'Wheelchair accessible', wheelchairSub: 'avoids stairs where data exists',
    useRental: 'Shared bikes and scooters', useRentalSub: 'include them in trips where available', mapH: 'Map', vehiclesO: 'Live vehicles', vehiclesSub: 'positions estimated from the real-time schedule', rentalsO: 'Bike and scooter stations',
    liveH: 'Live trip and notifications', alertBefore: 'Warn before getting off', stops1: '1 stop', stops2: '2 stops', stops3: '3 stops', soundO: 'Alert sound',
    lastAlertO: 'Alert for the last connection home', lastAlertSub: '20 min before, in the evening', pushOk: 'Lock screen notifications are active', pushOff: 'The notification server is not configured', pushDenied: 'Notifications are blocked. Enable them in Settings > Notifications > Peron.', pushTest: 'Test notification', pushInstall: 'For notifications, add the app to your Home Screen and open it from there.', pushTestBody: 'Notifications are working.',
    placesH: 'Places', unset: 'not set', change: 'Change', set: 'Set', history: 'Search history', historyCleared: 'History cleared.', langO: 'Language', keepOneMode: 'Keep at least one transport mode.',
    credit: 'Transit data: <a href="https://transitous.org/sources/" target="_blank" rel="noopener">Transitous sources</a>. Map &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>.<br>Transitous is free and run by volunteers: <a href="https://transitous.org/donate/" target="_blank" rel="noopener">donate</a>.<br>Source code and contact: <a href="https://github.com/acidburn11/peron" target="_blank" rel="noopener">github.com/acidburn11/peron</a>',
    arrived: 'You have arrived', arrivedDest: 'You have arrived at your destination.', walkUntil: s => `Walk to ${s}`, rentUntil: (r, s) => `${r} to ${s}`, inDist: d => `in ${d}`, thenLine: (l, h) => `then ${l} to ${h}`, finalDest: 'final destination',
    hurry: (l, m, d) => `Hurry: ${l} leaves in ${m} min, ${d} to go`, remaining: d => `${d} left`, offRoute: ', you are off the route', leavesIn: t => `leaves ${t}`, directions2: 'Directions',
    boardIn: l => `Board ${l}`, boardNow: (l, h) => `Board ${l} to ${h} now`, arrivesIn: (l, m) => `${l} arrives in ${m} min`, waitFor: 'Wait for', leavesAt: t => `Leaves at ${t}`, getOffAt: s => `Get off at ${s}`,
    getOffNow: 'Get off now!', getOffNext: 'Get off at the next stop', getOffAt2: s => `Get off at ${s}`, nextStop: s => `next: ${s}`, offNowPush: s => `Get off now: ${s}`, prepare: (n, s) => `Get ready: ${n} ${n === 1 ? 'stop' : 'stops'} to go, getting off at ${s}`,
    stopsLeft: n => n === 1 ? '1 stop left' : `${n} stops left`, arrival: t => `arrives ${t}`, next: 'Up next', prevLeg: 'Previous step', nextLeg: 'Next step', iArrived: 'I have arrived', stopLive: 'Stop', noGps: 'No GPS: position is estimated from the timetable.',
    etaMsg: (to, t, l) => `On my way to ${to}. I'll arrive around ${t}${l ? ` (on ${l})` : ''}.`, copied: 'Message copied.', stopsCount: n => `${n} ${n === 1 ? 'stop' : 'stops'}`,
    pushBoard: (l, h) => `${l} to ${h} arrives in 2 min`, pushPre: (n, s) => `Get ready: ${n} ${n === 1 ? 'stop' : 'stops'} to go, getting off at ${s}`, pushAlight: s => `Get off at the next stop: ${s}`, pushArrive: s => `You have arrived at ${s}`,
    langName: 'English'
  }
};
const T = (k, ...a) => { const d = L10N[O.lang] || L10N.ro; const v = d[k] ?? L10N.ro[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
const LOC = () => O.lang === 'en' ? 'en-GB' : 'ro-RO';

/* ---------- icoane ---------- */
const sv = p => `<svg viewBox="0 0 24 24">${p}</svg>`;
const I = {
  bus: sv('<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 18v2M16 18v2"/><circle cx="8.5" cy="14.5" r=".6"/><circle cx="15.5" cy="14.5" r=".6"/>'),
  tram: sv('<rect x="6" y="6" width="12" height="13" rx="3"/><path d="M6 13h12M9 3h6M12 3v3M8 19l-2 2M16 19l2 2"/>'),
  metro: sv('<circle cx="12" cy="12" r="9"/><path d="M8 16V8l4 5 4-5v8"/>'),
  train: sv('<rect x="6" y="3" width="12" height="15" rx="4"/><path d="M6 11h12M9 18l-2 3M15 18l2 3"/><circle cx="9.5" cy="14.5" r=".6"/><circle cx="14.5" cy="14.5" r=".6"/>'),
  ferry: sv('<path d="M4 14h16l-2 5H6zM7 14V9h10v5M12 5v4M3 21c2 0 2-1 4.5-1s2.5 1 4.5 1 2-1 4.5-1 2.5 1 4.5 1"/>'),
  cable: sv('<path d="M3 4l18 4M12 6v4"/><rect x="7" y="10" width="10" height="10" rx="2"/><path d="M7 15h10"/>'),
  walk: sv('<circle cx="13" cy="4" r="1.6"/><path d="M10 21l2-6 3 3v3M9 12l1-4 3-1 2 4 3 1M10 8l-3 3"/>'),
  pin: sv('<path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  home: sv('<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>'),
  work: sv('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 13h18"/>'),
  clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  star: sv('<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>'),
  back: sv('<path d="M15 5l-7 7 7 7"/>'),
  close: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  down: sv('<path d="M5 9l7 7 7-7"/>'),
  play: sv('<path d="M7 4l13 8-13 8z"/>'),
  me: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  map: sv('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>'),
  bell: sv('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>'),
  flag: sv('<path d="M5 21V4h11l-2 4 2 4H5"/>'),
  arrow: sv('<path d="M12 20V5M6 11l6-6 6 6"/>'),
  stairs: sv('<path d="M4 20h4v-4h4v-4h4V8h4"/>'),
  sliders: sv('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  bike: sv('<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l2 7h-6M14 5h2l-1 4"/>'),
  scooter: sv('<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 18h7M16 4h2l-2 12M6 18l3-5"/>'),
  car: sv('<path d="M5 16V11l2-5h10l2 5v5M5 16h14M5 16v3M19 16v3M5 11h14"/><circle cx="8" cy="13.5" r=".6"/><circle cx="16" cy="13.5" r=".6"/>'),
  warn: sv('<path d="M12 3l10 18H2zM12 10v5M12 18v.01"/>'),
  share: sv('<path d="M12 15V3M7 8l5-5 5 5M5 12v8h14v-8"/>'),
  moon: sv('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  reach: sv('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5" stroke-dasharray="2 2"/><circle cx="12" cy="12" r="10" stroke-dasharray="2 3"/>'),
  route: sv('<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h8"/>'),
  cal: sv('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>')
};
const RAIL = ['RAIL', 'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_FAST_RAIL', 'REGIONAL_RAIL', 'SUBURBAN'];
const MK = m => m === 'WALK' ? 'walk' : m === 'TRAM' ? 'tram' : (m === 'SUBWAY' || m === 'METRO') ? 'metro' : RAIL.includes(m) ? 'train' : m === 'FERRY' ? 'ferry' : ['FUNICULAR', 'AERIAL_LIFT', 'CABLE_CAR', 'AREAL_LIFT'].includes(m) ? 'cable' : 'bus';
const MC = { bus: '#1F6FB2', tram: '#C9362B', metro: '#6A3FA0', train: '#2D3B55', ferry: '#0E8A9E', cable: '#7A5A2E', walk: '#3B82C4' };
const modeName = m => T('M_' + MK(m));
const hex = c => c && /^[0-9a-f]{6}$/i.test(c.replace('#', '')) ? '#' + c.replace('#', '') : null;
const colorOf = l => hex(l.routeColor) || MC[MK(l.mode)];
const textOf = l => hex(l.routeTextColor) || '#fff';
const lineName = l => l.routeShortName || l.displayName || l.tripShortName || modeName(l.mode);
const badge = l => `<span class="badge" style="background:${colorOf(l)};color:${textOf(l)}">${I[MK(l.mode)]}${esc(lineName(l))}</span>`;
const isStreet = l => ['WALK', 'RENTAL', 'BIKE', 'CAR'].includes(l.mode);
const rentKind = l => { const f = l.rental?.formFactor || ''; return f.startsWith('SCOOTER') || f === 'MOPED' ? 'scooter' : f === 'CAR' ? 'car' : 'bike'; };
const rentName = l => T(rentKind(l)) + (l.rental?.systemName ? ' ' + l.rental.systemName : '');
const streetIc = l => l.mode === 'WALK' ? I.walk : I[rentKind(l)];

/* ---------- utilitare ---------- */
const fmt = (iso, tz) => { const o = { hour: '2-digit', minute: '2-digit', hour12: false }; try { return new Date(iso).toLocaleTimeString(LOC(), tz ? { ...o, timeZone: tz } : o); } catch { return new Date(iso).toLocaleTimeString(LOC(), o); } };
const mins = iso => Math.round((new Date(iso) - Date.now()) / 60000);
const durS = s => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`; };
const delayM = (a, b) => a && b ? Math.round((new Date(a) - new Date(b)) / 60000) : 0;
const R = Math.PI / 180;
const dist = (a, b) => { const x = (b[1] - a[1]) * R * Math.cos((a[0] + b[0]) / 2 * R), y = (b[0] - a[0]) * R; return Math.hypot(x, y) * 6371000; };
const ll = p => [p.lat, p.lon];
const meters = d => d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`;
const inMin = (iso, tz) => { const m = mins(iso); return m <= 0 ? T('now') : m < 60 ? `${m} min` : fmt(iso, tz); };
const liveTag = (l, a = l.startTime, b = l.scheduledStartTime) => {
  if (!l.realTime) return '';
  const d = delayM(a, b);
  return d > 0 ? `<span class="live late">+${d} min</span>` : d < 0 ? `<span class="live">${d} min</span>` : `<span class="live">${T('onTime')}</span>`;
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
const toggles = root => root.querySelectorAll('[data-tg]').forEach(b => b.onclick = e => { e.stopPropagation(); const el = root.querySelector('#' + b.dataset.tg) || $('#' + b.dataset.tg); if (!el) return; el.hidden = !el.hidden; b.classList.toggle('open', !el.hidden); });

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
  catch { clearTimeout(to); const pc = typeof pcGet === 'function' && PC_LIM[path] ? pcGet(url) : null; if (pc) { setOffline(pc.t); return pc.d; } throw new Error(T('netErr')); }
  clearTimeout(to);
  if (!r.ok) throw new Error(r.status === 429 ? T('tooMany') : T('srvErr', r.status));
  const d = await r.json();
  if (cache.size > 300) cache.clear();
  cache.set(url, { t: Date.now(), d });
  if (st.offlineAt !== undefined && st.offlineAt !== null) setOffline(null);
  pcPut(path, url, d);
  return d;
}

/* perturbari, preturi, partajare */
function alertsOf(legs) {
  const seen = new Set(), out = [];
  legs.forEach(l => [...(l.alerts || []), ...(l.from?.alerts || []), ...(l.to?.alerts || [])].forEach(a => {
    const k = (a.headerText || '') + (a.descriptionText || '').slice(0, 40);
    if (!seen.has(k) && (a.headerText || a.descriptionText)) { seen.add(k); out.push(a); }
  }));
  return out;
}
const SEV = { SEVERE: '#C9362B', WARNING: '#D9822B', INFO: '#1F6FB2' };
const alertBox = (a, i) => `<div class="alr" style="--a:${SEV[a.severityLevel] || '#D9822B'}">${I.warn}<div><b>${esc(a.headerText || T('disruptionT'))}</b>${a.descriptionText ? `<button class="more" data-tg="al${i}">${T('details')} ${I.down}</button><div id="al${i}" hidden class="ald">${esc(a.descriptionText)}${a.url ? `<br><a href="${esc(a.url)}" target="_blank" rel="noopener">${T('operatorPage')}</a>` : ''}</div>` : ''}</div></div>`;
function priceOf(it) {
  try {
    const ft = it.fareTransfers; if (!ft || !ft.length) return null;
    const ok = p => !p.riderCategory || p.riderCategory.isDefaultFareCategory !== false;
    const cheapest = opts => { let best = null; (opts || []).forEach(o => { const arr = Array.isArray(o) ? o : [o]; if (!arr.length || !arr.every(ok)) return; const c = arr.reduce((t, p) => t + p.amount, 0); if (!best || c < best.c) best = { c, cur: arr[0].currency }; }); return best; };
    let total = 0, cur = null, missing = false;
    ft.forEach(t => {
      const legs = (t.effectiveFareLegProducts || []).map(cheapest), tr = cheapest((t.transferProducts || []).map(p => [p]));
      const use = t.rule === 'AB' ? [] : t.rule === 'A_AB' ? legs.slice(0, 1) : legs;
      [...use, ...(tr ? [tr] : [])].forEach(x => { if (!x) { missing = true; return; } total += x.c; cur = cur || x.cur; });
    });
    if (it.legs.some(l => !isStreet(l) && l.fareTransferIndex == null)) missing = true;
    if (!cur) return null;
    const p = new Intl.NumberFormat(LOC(), { style: 'currency', currency: cur }).format(total);
    return missing ? T('fareFrom', p) : p;
  } catch { return null; }
}
async function shareEta(it) {
  const end = it.legs.at(-1), cur = live ? live.it.legs[live.i] : null;
  const text = T('etaMsg', st.to?.name || end.to.name, fmt(end.endTime, end.to.tz), cur && !isStreet(cur) ? lineName(cur) : '');
  try { if (navigator.share) return await navigator.share({ text }); } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast(T('copied')); } catch { toast(text); }
}

/* ---------- harta ---------- */
const map = L.map('map', { zoomControl: false, attributionControl: true }).setView(st.loc || [44.4268, 26.1025], st.loc ? 16 : 13);
map.attributionControl.setPrefix('<a href="https://transitous.org/sources/" target="_blank" rel="noopener">Transitous</a>');
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
const reachL = L.layerGroup().addTo(map);
const routeL = L.featureGroup().addTo(map);
const stopsL = L.layerGroup().addTo(map);
const vehL = L.layerGroup().addTo(map), vehM = new Map();
const rentL = L.layerGroup().addTo(map);
let meM = null;
const divI = (cls, html = '', size = [20, 20]) => L.divIcon({ className: '', html: `<div class="${cls}">${html}</div>`, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] });
const endMark = (p, color, layer = routeL) => { const m = L.marker(ll(p), { icon: divI('endm', '', [22, 22]), interactive: false }).addTo(layer); m.getElement()?.firstChild?.style.setProperty('background', color); return m; };

/* ---------- panou glisant ---------- */
const sheet = $('#sheet'), pane = $('#pane');
let sheetY = 0, sheetPos = 'half', live = null;
function snaps() { const H = innerHeight; return { peek: H - 170, half: Math.round(H * .46), full: live ? 150 : Math.round(H * .09) + 20 }; }
function setSheet(pos, instant) {
  sheetPos = pos; sheetY = snaps()[pos];
  sheet.classList.toggle('drag', !!instant);
  sheet.style.transform = `translateY(${sheetY}px)`;
  pane.style.height = (innerHeight - sheetY - 26) + 'px';
  $('#recenter').style.bottom = (innerHeight - sheetY + 12) + 'px';
  $('#recenter').hidden = pos === 'full';
}
(function drag() {
  let y0, s0, t0, on = false;
  const down = e => {
    if (e.target.closest('button,input,a,select') && !e.target.closest('#grab')) return;
    on = true; y0 = e.clientY; s0 = sheetY; t0 = Date.now(); sheet.classList.add('drag');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = e => { if (!on) return; const s = snaps(); sheetY = Math.min(s.peek + 40, Math.max(s.full - 20, s0 + e.clientY - y0)); sheet.style.transform = `translateY(${sheetY}px)`; };
  const up = e => {
    if (!on) return; on = false; sheet.classList.remove('drag');
    const s = snaps(), v = (e.clientY - y0) / Math.max(1, Date.now() - t0);
    const pos = Math.abs(v) > .5 ? (v > 0 ? (sheetPos === 'full' ? 'half' : 'peek') : (sheetPos === 'peek' ? 'half' : 'full'))
      : Object.entries(s).sort((a, b) => Math.abs(a[1] - sheetY) - Math.abs(b[1] - sheetY))[0][0];
    setSheet(pos);
  };
  const g = $('#grab');
  g.addEventListener('pointerdown', down); g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  pane.addEventListener('pointerdown', e => { if (e.target.closest('.phd')) down(e); });
  pane.addEventListener('pointermove', move); pane.addEventListener('pointerup', up); pane.addEventListener('pointercancel', up);
})();
addEventListener('resize', () => setSheet(sheetPos, true));
function fitTo(bounds) {
  if (!bounds || !bounds.isValid()) return;
  map.fitBounds(bounds, { paddingTopLeft: [30, live ? 150 : 80], paddingBottomRight: [30, innerHeight - sheetY + 20], maxZoom: 17 });
}
function centerOn(latlng, z = map.getZoom()) {
  const off = (innerHeight - sheetY) / 2 - (live ? 75 : 40);
  map.setView(map.unproject(map.project(latlng, z).add([0, off]), z), z, { animate: true });
}

/* ---------- locatie ---------- */
let view = 'home', paneTimer = null;
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
    if (first && view === 'home') renderHome();
    updateCity();
  }, () => {}, { enableHighAccuracy: true, maximumAge: 4000 });
}
const needLoc = () => st.acc != null ? Promise.resolve(st.loc) : new Promise((ok, no) => {
  if (!navigator.geolocation) return no(new Error(T('locUnavail')));
  navigator.geolocation.getCurrentPosition(p => { st.loc = [p.coords.latitude, p.coords.longitude]; st.acc = p.coords.accuracy; store.set('loc', st.loc); drawMe(); ok(st.loc); },
    () => st.loc ? ok(st.loc) : no(new Error(T('locDenied'))), { enableHighAccuracy: true, timeout: 10000 });
});
const myPlace = () => ({ name: T('myLoc'), lat: st.loc[0], lon: st.loc[1], me: true });
$('#recenter').onclick = async () => {
  try { await needLoc(); st.follow = true; $('#recenter').classList.add('on'); centerOn(st.loc, Math.max(map.getZoom(), 16)); } catch (e) { toast(e.message); }
};
map.on('dragstart', () => { st.follow = false; $('#recenter').classList.remove('on'); });

/* ---------- statii pe harta ---------- */
let stopsT, stopsKey = '';
map.on('moveend', () => { clearTimeout(stopsT); stopsT = setTimeout(loadMapStops, 500); });
async function loadMapStops() {
  if (map.getZoom() < 16 || !['home', 'stop'].includes(view)) { stopsL.clearLayers(); stopsKey = ''; return; }
  const b = map.getBounds().pad(0.2), r = v => v.toFixed(3);
  const key = [r(b.getSouth()), r(b.getWest()), r(b.getNorth()), r(b.getEast())].join();
  if (key === stopsKey) return;
  stopsKey = key;
  try {
    const list = await api('/v6/map/stops', { min: `${b.getSouth()},${b.getWest()}`, max: `${b.getNorth()},${b.getEast()}`, language: O.lang }, 300000);
    stopsL.clearLayers();
    list.slice(0, 250).forEach(p => {
      const m = L.marker(ll(p), { icon: divI('stopm', '', [16, 16]) }).on('click', () => openStop(p)).addTo(stopsL);
      m.getElement()?.firstChild?.style.setProperty('--sc', MC[MK((p.modes || [])[0] || 'BUS')]);
    });
  } catch {}
}

/* ---------- vehicule live ---------- */
let vehSegs = [], vehKey = '', vehAt = 0, vehFocus = null;
map.on('moveend', () => loadVehicles());
setInterval(() => loadVehicles(true), 30000);
setInterval(drawVehicles, 1000);
async function loadVehicles(force) {
  if (!O.vehicles || map.getZoom() < 14 || document.hidden || !$('#pick').hidden || view === 'reach') { vehL.clearLayers(); vehM.clear(); vehSegs = []; vehKey = ''; return; }
  const b = map.getBounds().pad(.15), z = Math.round(map.getZoom()), r = v => v.toFixed(3);
  const key = [z, r(b.getSouth()), r(b.getWest()), r(b.getNorth()), r(b.getEast())].join();
  if (!force && key === vehKey && Date.now() - vehAt < 30000) return;
  vehKey = key; vehAt = Date.now();
  const t = Date.now();
  try {
    const list = await api('/v6/map/trips', { zoom: z, min: `${b.getSouth()},${b.getWest()}`, max: `${b.getNorth()},${b.getEast()}`, startTime: new Date(t - 30000).toISOString(), endTime: new Date(t + 120000).toISOString(), precision: 5 }, 20000);
    vehSegs = list.map(sg => {
      const pts = decode(sg.polyline, 5), cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
      const tr = (sg.trips || [])[0] || {};
      return { pts, cum, t0: +new Date(sg.departure), t1: +new Date(sg.arrival), id: tr.tripId, name: tr.displayName || tr.routeShortName || '', mode: sg.mode, color: sg.routeColor, rt: sg.realTime };
    }).filter(x => x.id && x.pts.length);
    drawVehicles();
  } catch {}
}
function posAt(sg, t) {
  const f = sg.t1 > sg.t0 ? Math.min(1, Math.max(0, (t - sg.t0) / (sg.t1 - sg.t0))) : 0, target = f * sg.cum.at(-1);
  let i = 1; while (i < sg.cum.length - 1 && sg.cum[i] < target) i++;
  const a = sg.pts[i - 1], b = sg.pts[i] || a, seg = (sg.cum[i] - sg.cum[i - 1]) || 1, k = Math.min(1, Math.max(0, (target - sg.cum[i - 1]) / seg));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}
function drawVehicles() {
  if (!vehSegs.length) return;
  const t = Date.now(), by = new Map();
  vehSegs.forEach(sg => {
    if (vehFocus && !vehFocus(sg)) return;
    const cur = by.get(sg.id), active = t >= sg.t0 && t <= sg.t1, soon = sg.t0 > t && sg.t0 - t < 120000;
    if (active) by.set(sg.id, { sg, at: posAt(sg, t), active: true });
    else if (soon && (!cur || (!cur.active && sg.t0 < cur.sg.t0))) by.set(sg.id, { sg, at: sg.pts[0] });
  });
  for (const [id, m] of vehM) if (!by.has(id)) { vehL.removeLayer(m); vehM.delete(id); }
  by.forEach((v, id) => {
    let m = vehM.get(id);
    if (!m) {
      const l = { mode: v.sg.mode, routeColor: v.sg.color, routeShortName: v.sg.name };
      m = L.marker(v.at, { icon: L.divIcon({ className: '', html: `<div class="vehm${v.sg.rt ? ' rt' : ''}" style="background:${colorOf(l)};color:${textOf(l)}">${I[MK(v.sg.mode)]}${esc(v.sg.name).slice(0, 5)}</div>`, iconSize: [0, 0] }), zIndexOffset: 500 })
        .on('click', () => openTrip({ tripId: id, routeShortName: v.sg.name, routeColor: v.sg.color, mode: v.sg.mode })).addTo(vehL);
      vehM.set(id, m);
    } else m.setLatLng(v.at);
  });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadVehicles(true); });

/* ---------- biciclete si trotinete ---------- */
let rentKey = '';
map.on('moveend', () => loadRentals());
async function loadRentals() {
  if (!O.rentals || map.getZoom() < 15 || view === 'reach') { rentL.clearLayers(); rentKey = ''; return; }
  const b = map.getBounds().pad(.15), r = v => v.toFixed(3);
  const key = [r(b.getSouth()), r(b.getWest()), r(b.getNorth()), r(b.getEast())].join();
  if (key === rentKey) return;
  rentKey = key;
  try {
    const d = await api('/v1/rentals', { min: `${b.getSouth()},${b.getWest()}`, max: `${b.getNorth()},${b.getEast()}`, withZones: false }, 60000);
    const prov = {}; (d.providers || []).forEach(x => prov[x.id] = x);
    rentL.clearLayers();
    const ffIc = ff => (ff || []).some(f => f.includes('BICYCLE')) ? I.bike : (ff || []).some(f => f.startsWith('SCOOTER') || f === 'MOPED') ? I.scooter : (ff || []).includes('CAR') ? I.car : I.bike;
    const pcol = pv => hex(pv?.color) || '#16884F';
    const pop = (name, pv, extra, uri) => `<b>${esc(name)}</b><br>${esc(pv?.name || '')}<br>${extra}${uri ? `<br><a href="${esc(uri)}" target="_blank" rel="noopener">${T('openApp')}</a>` : ''}`;
    (d.stations || []).slice(0, 300).forEach(x => {
      const pv = prov[x.providerId];
      L.marker([x.lat, x.lon], { icon: L.divIcon({ className: '', html: `<div class="rentm" style="--rc:${pcol(pv)}">${ffIc(x.formFactors)}<b>${x.numVehiclesAvailable}</b></div>`, iconSize: [0, 0] }) })
        .bindPopup(pop(x.name, pv, T('avail', x.numVehiclesAvailable, x.vehicleDocksAvailable), x.rentalUriIOS || x.rentalUriWeb || pv?.url)).addTo(rentL);
    });
    const FF = { BICYCLE: 'bike', CARGO_BICYCLE: 'cargo', SCOOTER_STANDING: 'scooter', SCOOTER_SEATED: 'seated', MOPED: 'moped', CAR: 'car' };
    (d.vehicles || []).filter(v => !v.stationId && !v.isDisabled && !v.isReserved).slice(0, 300).forEach(v => {
      const pv = prov[v.providerId];
      L.marker([v.lat, v.lon], { icon: L.divIcon({ className: '', html: `<div class="rentv" style="--rc:${pcol(pv)}">${ffIc([v.formFactor])}</div>`, iconSize: [0, 0] }) })
        .bindPopup(pop(T(FF[v.formFactor] || 'vehicle'), pv, v.propulsionType && v.propulsionType !== 'HUMAN' ? T('electric') : '', v.rentalUriIOS || v.rentalUriWeb || pv?.url)).addTo(rentL);
    });
  } catch {}
}

/* ---------- apasare lunga pe harta = destinatie ---------- */
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
  if (live || view === 'reach' || Date.now() - lpAt < 1000 || !$('#pick').hidden) return;
  lpAt = Date.now();
  try { navigator.vibrate?.(30); } catch {}
  st.to = await namePlace(e.latlng.lat, e.latlng.lng);
  try { await needLoc(); st.from = myPlace(); } catch { return openSearch('from'); }
  plan();
});
async function namePlace(lat, lon) {
  try {
    const r = await api('/v1/reverse-geocode', { place: `${lat},${lon}`, numResults: 1, language: O.lang }, 86400000);
    const m = r[0];
    if (m && dist([lat, lon], ll(m)) < 120) return { name: m.name, lat, lon };
  } catch {}
  return { name: T('pointOnMap'), lat, lon };
}

/* ---------- navigare intre panouri ---------- */
const backStack = ['home'];
function go(v, render) {
  view = v; clearInterval(paneTimer); vehFocus = null;
  if (v !== 'reach') reachL.clearLayers();
  render(); pane.scrollTop = 0;
  $('#top').hidden = !!live;
  loadMapStops(); loadVehicles(true); loadRentals();
}
function nav(v, render) { if (backStack.at(-1) !== v) backStack.push(v); go(v, render); }
function back() {
  backStack.pop();
  const prev = backStack.at(-1);
  if (prev === 'results' && (st.plan.length || st.loading)) { go('results', renderResults); drawEnds(); return; }
  if (prev === 'route' && st.cur) return go('route', () => renderRoute(st.cur));
  if (prev === 'stop' && st.stop) return go('stop', () => renderStop(st.stop));
  if (prev === 'line' && st.line) return go('line', () => renderLine(st.line, st.lineDir));
  const gen = { weather: renderWeather, deps: renderDeps, hist: renderHist, reach: renderReach, near: () => renderLineNear(st.line), cities: renderCities, net: () => renderNet(netCur?.key) };
  if (gen[prev]) return go(prev, gen[prev]);
  if (prev && prev !== 'home') return back();
  backStack.length = 0; backStack.push('home'); routeL.clearLayers(); go('home', renderHome); setSheet('half');
}
const hd = (title, extra = '', noBack) => `<div class="phd">${noBack ? '' : `<button class="icb" data-act="back" aria-label="${T('back')}">${I.back}</button>`}<h2>${title}</h2>${extra}</div>`;
pane.addEventListener('click', e => { if (e.target.closest('[data-act="back"]')) back(); });

/* ---------- acasa ---------- */
function placeBtn(kind) {
  const p = O[kind];
  return `<button class="qb" data-q="${kind}"><span class="ic">${I[kind]}</span><span><b>${T(kind)}</b><small>${p ? esc(p.name) : T('setAddr')}</small></span></button>`;
}
const routeRow = (x, list, ic) => `<div class="row"><span class="ic">${ic}</span><button class="tx" data-k="${esc(x.k)}" style="text-align:left"><div>${esc(x.to.name)}</div><small>${T('from')} ${esc(x.from.me ? T('myLoc') : x.from.name)}</small></button><button class="x" data-del="${esc(x.k)}" data-l="${list}" aria-label="${T('delete')}">${I.close}</button></div>`;
function renderHome() {
  const favs = store.get('favs', []), rec = store.get('recent', []).filter(r => !favs.some(f => f.k === r.k)).slice(0, 5), fst = store.get('fstops', []);
  pane.innerHTML = `<button class="cityrow" id="cityRow"></button><div class="quick">${placeBtn('home')}${placeBtn('work')}</div>
    <div id="lastHome"></div>
    <div class="tools t4"><button id="reachB">${I.reach}<span>${T('reach')}</span></button><button id="netB">${I.netmap}<span>${T('netT')}</span></button><button id="depsB">${I.dep}<span>${T('depsT')}</span></button><button id="histB">${I.hist}<span>${T('histT')}</span></button></div>
    ${myLines().length ? `<h3>${T('myLines')}</h3><div id="myLines"><div class="skel" style="height:70px"></div></div>` : ''}
    ${fst.length ? `<h3>${T('myStops')}</h3><div id="favStops"></div>` : ''}
    <h3>${T('nearStops')}</h3><div id="near">${st.loc ? '<div class="skel" style="height:60px"></div>' : `<button class="row" id="askLoc"><span class="ic">${I.me}</span><span class="tx"><div>${T('showNear')}</div><small>${T('needLoc')}</small></span></button>`}</div>
    ${favs.length ? `<h3>${T('savedRoutes')}</h3>` + favs.map(x => routeRow(x, 'favs', I.star)).join('') : ''}
    ${rec.length ? `<h3>${T('recent')}</h3>` + rec.map(x => routeRow(x, 'recent', I.clock)).join('') : ''}`;
  pane.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    const k = b.dataset.q, p = O[k];
    if (!p) return openSearch('to', pl => { O[k] = pl; saveOpts(); renderHome(); }, T(k + 'Addr'));
    routeTo(p);
  });
  $('#reachB').onclick = () => nav('reach', renderReach);
  $('#netB').onclick = () => { st.netModes = null; nav('net', () => renderNet()); };
  renderCityRow(); $('#cityRow').onclick = () => nav('cities', renderCities);
  $('#depsB').onclick = () => nav('deps', renderDeps);
  $('#histB').onclick = () => nav('hist', renderHist);
  $('#askLoc')?.addEventListener('click', async () => { try { await needLoc(); centerOn(st.loc, 16); renderHome(); } catch (e) { toast(e.message); } });
  pane.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const x = [...favs, ...rec].find(y => y.k === b.dataset.k);
    st.from = x.from.me && st.loc ? myPlace() : x.from; st.to = x.to; st.when = 'now'; plan();
  });
  pane.querySelectorAll('[data-del]').forEach(b => b.onclick = e => {
    e.stopPropagation(); store.set(b.dataset.l, store.get(b.dataset.l, []).filter(y => y.k !== b.dataset.del)); renderHome();
  });
  if (st.loc) nearStops();
  if (fst.length) loadFavStops();
  if (myLines().length) loadMyLines();
  lastHome();
  clearInterval(paneTimer);
  paneTimer = setInterval(() => { if (view === 'home') { if (fst.length) loadFavStops(); if (myLines().length) loadMyLines(); lastHome(); } }, 30000);
}
async function nearStops() {
  const [la, lo] = st.loc, d = .005;
  try {
    const list = await api('/v6/map/stops', { min: `${la - d},${lo - d * 1.4}`, max: `${la + d},${lo + d * 1.4}`, language: O.lang }, 300000);
    const seen = new Set();
    const top = list.map(p => ({ p, d: dist(st.loc, ll(p)) })).sort((a, b) => a.d - b.d)
      .filter(x => { if (seen.has(x.p.name)) return false; seen.add(x.p.name); return true; }).slice(0, 6);
    const el = $('#near'); if (!el || view !== 'home') return;
    el.innerHTML = top.length ? top.map((x, i) => `<button class="row" data-s="${i}"><span class="ic">${I[MK((x.p.modes || [])[0] || 'BUS')]}</span><span class="tx"><div>${esc(x.p.name)}</div><small>${T('walkMin', meters(x.d), Math.max(1, Math.round(x.d / 80)))}</small></span>${I.chev}</button>`).join('')
      : `<p class="muted">${T('noNear')}</p>`;
    el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => openStop(top[b.dataset.s].p));
  } catch (e) { const el = $('#near'); if (el) el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
const depT = s => new Date(s.place.departure || s.place.scheduledDeparture);
async function loadFavStops() {
  const fst = store.get('fstops', []).slice(0, 6);
  const res = await Promise.all(fst.map(p => api('/v6/stoptimes', { stopId: p.stopId, n: 10, language: O.lang }, 25000).catch(() => ttFallback(p.stopId))));
  const el = $('#favStops'); if (!el || view !== 'home') return;
  el.innerHTML = fst.map((p, i) => {
    const deps = (res[i]?.stopTimes || []).filter(s => (s.place.departure || s.place.scheduledDeparture) && depT(s) > Date.now() - 60000).sort((a, b) => depT(a) - depT(b)).slice(0, 3);
    return `<div class="fs"><button class="fsh" data-fs="${i}"><b>${esc(p.name)}</b>${I.chev}</button>${deps.length ? deps.map(s => { const t = s.place.departure || s.place.scheduledDeparture; return `<div class="fsr">${badge(s)}<span class="hs">${esc(s.headsign || '')}</span><b>${inMin(t, s.place.tz)}</b>${s.realTime ? '<i class="live"></i>' : ''}</div>`; }).join('') : `<div class="fsr muted">${res[i] ? T('noDepSoon') : T('depLoadErr')}</div>`}</div>`;
  }).join('');
  el.querySelectorAll('[data-fs]').forEach(b => b.onclick = () => openStop(fst[b.dataset.fs]));
}
function routeTo(p) { st.to = p; needLoc().then(() => { st.from = myPlace(); plan(); }).catch(() => openSearch('from')); }

/* ultima legatura spre casa */
let lastCalc = { k: '', t: 0, it: null };
async function lastHome() {
  const el = $('#lastHome'); if (!el) return;
  const h = new Date().getHours();
  if (!O.home || !st.loc || dist(st.loc, ll(O.home)) < 600 || (h < 17 && h >= 4)) { el.innerHTML = ''; return; }
  const k = st.loc.map(v => v.toFixed(3)).join() + O.home.lat;
  if (k !== lastCalc.k || Date.now() - lastCalc.t > 600000) {
    const end = new Date(); if (h >= 4) end.setDate(end.getDate() + 1); end.setHours(3, 30, 0, 0);
    try {
      const d = await api('/v6/plan', { fromPlace: st.loc.join(','), toPlace: `${O.home.lat},${O.home.lon}`, time: end.toISOString(), arriveBy: true, language: O.lang, maxPreTransitTime: O.walk * 60, maxPostTransitTime: O.walk * 60 }, 600000);
      const its = (d.itineraries || []).filter(it => it.legs.some(l => !isStreet(l)) && new Date(it.startTime) > Date.now() - 60000);
      lastCalc = { k, t: Date.now(), it: its.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0] || null };
      schedLastPush();
    } catch { return; }
  }
  const it = lastCalc.it;
  if (!$('#lastHome')) return;
  if (!it) { el.innerHTML = `<div class="lastc">${I.moon}<span class="tx"><b>${T('lastHome')}</b><small>${T('lastNone')}</small></span></div>`; return; }
  const f = it.legs.find(l => !isStreet(l)), m = mins(f.startTime);
  el.innerHTML = `<button class="lastc${m <= 30 ? ' soon' : ''}" id="lastB">${I.moon}<span class="tx"><b>${T('lastHome')}</b><small>${badge(f)} ${T('lastLeaves', fmt(f.startTime, f.from.tz), esc(f.from.name))}</small></span><span class="rt">${m <= 0 ? T('now') : durS(m * 60)}</span></button>`;
  $('#lastB').onclick = () => { st.from = myPlace(); st.to = O.home; st.cur = it; st.plan = [it]; st.direct = []; nav('route', () => renderRoute(it)); };
}
async function schedLastPush() {
  const it = lastCalc.it;
  if (!O.lastAlert || !PUSH || !it) return;
  const f = it.legs.find(l => !isStreet(l));
  try {
    await pushSchedule('last', [{ id: 'last', at: +new Date(f.startTime) - 20 * 60000, title: T('lastHome'), body: T('lastPush', lineName(f), 20, f.from.name), trip: f.tripId ? { tripId: f.tripId, stopId: f.from.stopId, kind: 'dep', offset: -20 * 60000 } : null }]);
  } catch {}
}

/* ---------- cautare ---------- */
let srch = { field: 'to', cb: null };
const rememberPlace = p => { if (p.me || p.name === T('pointOnMap')) return; store.set('places', [p, ...store.get('places', []).filter(x => x.name !== p.name)].slice(0, 10)); };
function openSearch(field = 'to', cb = null, title) {
  srch = { field, cb };
  $('#search').hidden = false;
  $('#fFromWrap').hidden = !!cb; $('#swap').hidden = !!cb;
  $('#fTo').placeholder = title || T('toPh');
  if (!st.from && st.loc && !cb) st.from = myPlace();
  $('#fFrom').value = st.from ? (st.from.me ? T('myLoc') : st.from.name) : '';
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
  $('#fFrom').value = st.from ? (st.from.me ? T('myLoc') : st.from.name) : ''; $('#fTo').value = st.to?.name || '';
  if (st.from && st.to) finishSearch();
};
function showQuick() {
  const items = [];
  if (srch.field === 'from' || srch.cb) items.push({ ic: I.me, t: T('myLoc'), act: 'me' });
  items.push({ ic: I.map, t: T('chooseMap'), act: 'pick' });
  if (!srch.cb) ['home', 'work'].forEach(k => O[k] && items.push({ ic: I[k], t: T(k), s: O[k].name, p: O[k] }));
  store.get('places', []).forEach(p => items.push({ ic: I.clock, t: p.name, s: p.sub || '', p }));
  renderSugg(items);
}
function renderSugg(items) {
  $('#sugg').innerHTML = items.map((x, i) => `<li><button class="row" data-i="${i}"><span class="ic"${x.color ? ` style="background:${x.color};color:#fff"` : ''}>${x.ic}</span><span class="tx"><div>${x.html || esc(x.t)}</div>${x.s ? `<small>${esc(x.s)}</small>` : ''}</span></button></li>`).join('') || `<li class="hint">${T('noResults')}</li>`;
  $('#sugg').querySelectorAll('[data-i]').forEach(b => b.onclick = () => pickItem(items[b.dataset.i]));
}
async function pickItem(x) {
  if (x.act === 'me') { try { await needLoc(); return setField(myPlace()); } catch (e) { return toast(e.message); } }
  if (x.act === 'pick') return pickOnMap();
  if (x.act === 'line') { $('#search').hidden = true; return openLine(x.line); }
  setField(x.p);
}
function setField(p) {
  if (srch.cb) { $('#search').hidden = true; rememberPlace(p); const cb = srch.cb; srch.cb = null; return cb(p); }
  if (srch.field === 'from') { st.from = p; $('#fFrom').value = p.me ? T('myLoc') : p.name; } else { st.to = p; $('#fTo').value = p.name; }
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
  if (t.length < 1 || (t.length < 2 && !/^\d$/.test(t))) return showQuick();
  sT = setTimeout(async () => {
    const lineQ = !srch.cb && id === 'fTo' && /^[A-Za-z]{0,3}\d{1,4}[A-Za-z]?$|^[A-Za-z]{1,2}$/.test(t);
    const [r, lines] = await Promise.all([
      t.length >= 2 ? api('/v1/geocode', { text: t, place: st.loc ? st.loc.join(',') : '', placeBias: st.loc ? 2 : '', numResults: 12, language: O.lang }, 86400000).catch(err => ({ err })) : [],
      lineQ ? findLines(t).catch(() => []) : []
    ]);
    if (e.target.value.trim() !== t) return;
    if (r.err && !lines.length) { $('#sugg').innerHTML = `<li class="hint">${esc(r.err.message)}</li>`; return; }
    renderSugg([
      ...lines.map(g => ({ ic: I[MK(g.mode)], color: colorOf(g), html: `${badge(g)} <span class="muted">${esc(modeName(g.mode))}</span>`, s: g.longName || g.dirs.map(d => d.last).slice(0, 2).join(' - '), act: 'line', line: g })),
      ...(r.err ? [] : r).map(m => ({ ic: m.type === 'STOP' ? I[MK((m.modes || [])[0] || 'BUS')] : I.pin, t: m.name, s: sub(m), p: { name: m.name, lat: m.lat, lon: m.lon, sub: sub(m) } }))
    ]);
  }, 300);
}));
function sub(m) {
  const areas = (m.areas || []).filter(a => !a.default && a.name !== m.name).map(a => a.name);
  const s = [m.street && m.street !== m.name ? m.street + (m.houseNumber ? ' ' + m.houseNumber : '') : '', ...areas.slice(-2)].filter(Boolean);
  return (m.type === 'STOP' ? T('stop') + (s.length ? ', ' : '') : '') + [...new Set(s)].join(', ');
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
  const MODES = [['BUS', 'bus'], ['TRAM', 'tram'], ['SUBWAY', 'metro'], ['RAIL', 'train'], ['FERRY', 'ferry']];
  const seg = (k, vals) => `<div class="seg" data-o="${k}">${vals.map(([v, t]) => `<button data-v="${v}" class="${String(O[k]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const tg = k => `<button class="tg ${O[k] ? 'on' : ''}" data-t="${k}" aria-label="${k}"></button>`;
  const opt = (label, sub, ctl) => `<div class="opt"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>${ctl}</div>`;
  const pushState = !PUSH ? T('pushOff') : ('Notification' in window && Notification.permission === 'denied') ? T('pushDenied') : '';
  $('#opts').innerHTML = `<div class="ohd"><button class="icb" id="closeOpts" aria-label="${T('close')}">${I.back}</button><h2>${T('options')}</h2></div><div class="obody">
    ${opt(T('langO'), '', seg('lang', [['ro', 'Romana'], ['en', 'English']]))}
    ${lookOptsHtml(opt, seg, tg)}
    <h3>${T('modesH')}</h3>
    <div class="chk">${MODES.map(([k, ic]) => `<button data-m="${k}" class="${O.modes[k] ? 'on' : ''}">${I[ic]}${T('M_' + ic)}</button>`).join('')}</div>
    <h3>${T('prefsH')}</h3>
    ${opt(T('maxTransfers'), '', seg('transfers', [['any', T('any')], ['0', '0'], ['1', '1'], ['2', '2']]))}
    ${opt(T('maxWalk'), T('maxWalkSub'), seg('walk', [[10, '10'], [15, '15'], [20, '20'], [30, '30 min']]))}
    ${opt(T('speed'), '', seg('speed', [['slow', T('slow')], ['normal', T('normal')], ['fast', T('fast')]]))}
    ${opt(T('wheelchair'), T('wheelchairSub'), tg('wheelchair'))}
    ${opt(T('useRental'), T('useRentalSub'), tg('useRental'))}
    <h3>${T('mapH')}</h3>
    ${opt(T('vehiclesO'), T('vehiclesSub'), tg('vehicles'))}
    ${opt(T('rentalsO'), '', tg('rentals'))}
    <h3>${T('liveH')}</h3>
    ${opt(T('alertBefore'), '', seg('alertStops', [[1, T('stops1')], [2, T('stops2')], [3, T('stops3')]]))}
    ${opt(T('soundO'), '', tg('sound'))}
    ${opt(T('lastAlertO'), T('lastAlertSub'), tg('lastAlert'))}
    ${pushState ? `<p class="muted" style="font-size:14px">${pushState}</p>` : opt(T('pushOk'), '', `<button class="btn ghost" id="pushTest">${T('pushTest')}</button>`)}
    ${opt(T('myName'), T('myNameSub'), `<input class="inp" id="myName" value="${esc(O.myName || '')}" maxlength="30" style="width:130px">`)}
    <h3>${T('placesH')}</h3>
    ${['home', 'work'].map(k => opt(T(k), O[k] ? esc(O[k].name) : T('unset'), `<button class="btn ghost" data-p="${k}">${O[k] ? T('change') : T('set')}</button>`)).join('')}
    ${opt(T('history'), '', `<button class="btn ghost" id="clr">${T('delete')}</button>`)}
    ${O.home || O.work ? `<h3>${T('siriH')}</h3>${['home', 'work'].filter(k => O[k]).map(k => opt(T(k), '', `<button class="btn ghost" data-siri="${k}">${I.link.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} ${T('copyLink')}</button>`)).join('')}<p class="muted" style="font-size:13px">${T('siriInfo')}</p>` : ''}
    ${bkOptsHtml(opt)}
    <p class="credit">${T('credit')}</p></div>`;
  $('#closeOpts').onclick = () => { $('#opts').hidden = true; if (view === 'results' && st.from && st.to) plan(); };
  $('#opts').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    O.modes[b.dataset.m] = !O.modes[b.dataset.m];
    if (!Object.values(O.modes).some(Boolean)) { O.modes[b.dataset.m] = true; return toast(T('keepOneMode')); }
    saveOpts(); renderOpts();
  });
  $('#opts').querySelectorAll('.seg[data-o] button').forEach(b => b.onclick = () => {
    const k = b.parentElement.dataset.o, v = b.dataset.v; O[k] = typeof DEF[k] === 'number' ? +v : v; saveOpts();
    if (k === 'lang') { cache.clear(); applyStatic(); refreshView(); }
    if (k === 'theme' || k === 'fs') applyLook();
    renderOpts();
  });
  $('#opts').querySelectorAll('[data-t]').forEach(b => b.onclick = async () => {
    const k = b.dataset.t; O[k] = !O[k]; saveOpts(); renderOpts(); applyLook();
    vehKey = rentKey = ''; loadVehicles(); loadRentals();
    if (k === 'lastAlert') { if (O.lastAlert) { try { await pushSubscribe(); schedLastPush(); } catch (e) { toast(e.message); } } else pushCancel('last'); }
  });
  $('#pushTest')?.addEventListener('click', async () => {
    try { await pushSchedule('test', [{ id: 'test', at: Date.now() + 5000, title: 'Peron', body: T('pushTestBody') }]); toast('OK'); } catch (e) { toast(e.message); }
  });
  $('#opts').querySelectorAll('[data-p]').forEach(b => b.onclick = () => openSearch('to', p => { O[b.dataset.p] = p; saveOpts(); renderOpts(); if (view === 'home') renderHome(); }, T(b.dataset.p + 'Addr')));
  bkOptsBind();
  $('#myName').onchange = e => { O.myName = e.target.value.trim(); saveOpts(); };
  $('#opts').querySelectorAll('[data-siri]').forEach(b => b.onclick = () => copyText(siriLink(O[b.dataset.siri]), T('linkCopied')));
  $('#clr').onclick = () => { store.set('recent', []); store.set('places', []); toast(T('historyCleared')); if (view === 'home') renderHome(); };
}
$('#openOpts').onclick = () => { renderOpts(); $('#opts').hidden = false; };
function applyStatic() {
  document.documentElement.lang = O.lang;
  document.querySelectorAll('[data-i18n]').forEach(e => e.textContent = T(e.dataset.i18n));
  document.querySelectorAll('[data-i18n-ph]').forEach(e => e.placeholder = T(e.dataset.i18nPh));
  document.querySelectorAll('[data-i18n-al]').forEach(e => e.setAttribute('aria-label', T(e.dataset.i18nAl)));
}
function refreshView() {
  if (live) return liveTick();
  renderWxChip();
  ({ home: renderHome, results: renderResults, route: () => renderRoute(st.cur), stop: () => renderStop(st.stop), line: () => renderLine(st.line, st.lineDir), reach: renderReach, weather: renderWeather, deps: renderDeps, hist: renderHist, near: () => renderLineNear(st.line), cities: renderCities, net: () => renderNet(netCur?.key) })[view]?.();
}

/* ---------- planificare ---------- */
const favKey = (f, t) => `${(+f.lat).toFixed(4)},${(+f.lon).toFixed(4)}>${(+t.lat).toFixed(4)},${(+t.lon).toFixed(4)}`;
function planParams() {
  const p = { fromPlace: `${st.from.lat},${st.from.lon}`, toPlace: `${st.to.lat},${st.to.lon}`, detailedTransfers: true, language: O.lang, maxPreTransitTime: O.walk * 60, maxPostTransitTime: O.walk * 60, withFares: true };
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
  if (O.useRental) { p.preTransitModes = ['WALK', 'RENTAL']; p.postTransitModes = ['WALK', 'RENTAL']; p.directModes = ['WALK', 'RENTAL']; }
  if (st.when !== 'now' && st.time) { p.time = new Date(st.time).toISOString(); p.arriveBy = st.when === 'arr'; }
  return p;
}
async function plan(more) {
  if (!st.from || !st.to) return openSearch(st.from ? 'to' : 'from');
  if (view !== 'results') { backStack.length = 1; nav('results', renderResults); }
  if (!more) {
    st.plan = []; st.direct = []; st.loading = true; renderResults(); drawEnds(); setSheet('half');
    const k = favKey(st.from, st.to); store.set('recent', [{ k, from: st.from, to: st.to }, ...store.get('recent', []).filter(x => x.k !== k)].slice(0, 10));
  }
  try {
    const p = planParams(); if (more) p.pageCursor = st.cursor;
    const d = await api('/v6/plan', p);
    const its = (d.itineraries || []).filter(it => it.legs.some(l => !isStreet(l)));
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
  endMark(st.from, '#14213D'); endMark(st.to, '#C9362B');
  fitTo(routeL.getBounds());
}
function renderResults() {
  const whenSeg = `<div class="when"><div class="seg" id="whenSeg">${[['now', T('nowT')], ['dep', T('depart')], ['arr', T('arrive')]].map(([v, t]) => `<button data-v="${v}" class="${st.when === v ? 'on' : ''}">${t}</button>`).join('')}</div>${st.when !== 'now' ? `<input type="datetime-local" id="whenT" value="${esc(st.time)}">` : ''}</div>`;
  const od = `<button class="od" id="editOD"><span style="display:flex;flex-direction:column;align-items:center;gap:3px"><span class="dot o"></span><span class="dot d"></span></span><span class="tx"><div>${esc(st.from?.me ? T('myLoc') : st.from?.name)}</div><div>${esc(st.to?.name)}</div></span>${I.chev}</button>`;
  let body;
  if (st.loading) body = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  else if (st.err) body = `<p class="err">${esc(st.err)}</p><button class="btn ghost" id="retry">${T('retry')}</button>`;
  else if (!st.plan.length) body = `<p class="muted">${T('noTrips')}</p>`;
  else {
    const dir = (st.direct || []).filter(x => x.legs.every(isStreet)).slice(0, 3);
    body = dir.map(x => { const m = x.legs.find(l => l.mode !== 'WALK') || x.legs[0]; return `<div class="row" style="border:0"><span class="ic">${streetIc(m)}</span><span class="tx"><div>${m.mode === 'WALK' ? T('onFoot') : esc(rentName(m))}</div><small>${meters(x.legs.reduce((t, l) => t + (l.distance || 0), 0))}</small></span><span class="rt">${durS(x.duration)}</span></div>`; }).join('')
      + st.plan.map((it, i) => card(it, i)).join('')
      + (st.cursor ? `<button class="btn ghost" id="more" style="width:100%">${st.when === 'arr' ? T('earlier') : T('later')}</button>` : '');
  }
  pane.innerHTML = hd(T('trips'), `<button class="icb" id="optsBtn" aria-label="${T('options')}">${I.sliders}</button>`) + od + whenSeg + body;
  $('#editOD').onclick = () => openSearch('to');
  $('#optsBtn').onclick = () => { renderOpts(); $('#opts').hidden = false; };
  $('#retry')?.addEventListener('click', () => plan());
  $('#more')?.addEventListener('click', e => { e.target.textContent = T('loading'); plan(true); });
  $('#whenSeg').querySelectorAll('button').forEach(b => b.onclick = () => {
    st.when = b.dataset.v;
    if (st.when !== 'now' && !st.time) st.time = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    if (st.when === 'now') plan(); else renderResults();
  });
  $('#whenT')?.addEventListener('change', e => { st.time = e.target.value; plan(); });
  pane.querySelectorAll('.card').forEach(b => b.onclick = () => { st.cur = st.plan[b.dataset.i]; nav('route', () => renderRoute(st.cur)); });
}
const legsStrip = legs => legs.map(l => isStreet(l) ? `<span class="wk"${l.mode !== 'WALK' ? ' style="color:#16884F"' : ''}>${streetIc(l)}${Math.max(1, Math.round(l.duration / 60))}</span>` : badge(l)).join(I.chev);
function card(it, i) {
  const f = it.legs.find(l => !isStreet(l)), price = priceOf(it), al = alertsOf(it.legs).length;
  const walkT = it.legs.filter(l => l.mode === 'WALK').reduce((s, l) => s + l.duration, 0), tz = it.legs[0].from.tz;
  return `<button class="card" data-i="${i}">
    <div class="t1"><div class="legs">${legsStrip(it.legs)}</div><div class="dur">${Math.round(it.duration / 60)}<small>min</small></div></div>
    <div class="t2"><span>${f ? `${liveTag(f)} <b>${inMin(f.startTime, f.from.tz)}</b> ${esc(T('fromStop', f.from.name))}` : ''}</span><span>${fmt(it.startTime, tz)}&ndash;${fmt(it.endTime, tz)}</span></div>
    <div class="t2" style="margin-top:4px"><span>${I.walk.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} ${T('walkFor', durS(walkT))}${it.transfers ? `, ${T('transfers', it.transfers)}` : ''}</span>${price ? `<b>${price}</b>` : ''}</div>
    ${al ? `<div class="t2 warn">${I.warn}<span>${al === 1 ? T('disruption') : T('disruptions', al)}</span></div>` : ''}
  </button>`;
}

/* ---------- detalii traseu ---------- */
const ANG = { LEFT: -90, RIGHT: 90, SLIGHTLY_LEFT: -45, SLIGHTLY_RIGHT: 45, HARD_LEFT: -135, HARD_RIGHT: 135, UTURN_LEFT: 180, UTURN_RIGHT: 180, CIRCLE_CLOCKWISE: 90, CIRCLE_COUNTERCLOCKWISE: -90 };
const DK = d => d?.startsWith('UTURN') ? 'D_UTURN' : d?.startsWith('CIRCLE') ? 'D_CIRCLE' : L10N.ro['D_' + d] ? 'D_' + d : 'D_CONTINUE';
const stepTxt = s => T(DK(s.relativeDirection)) + (s.streetName && !['STAIRS', 'ELEVATOR'].includes(s.relativeDirection) ? T('onStreet', s.streetName) : '');
const stepIc = s => s.relativeDirection === 'STAIRS' ? I.stairs : I.arrow.replace('<svg', `<svg style="transform:rotate(${ANG[s.relativeDirection] || 0}deg)"`);
const stopsOf = l => [l.from, ...(l.intermediateStops || []), l.to];
function drawRoute(it, focus = -1) {
  routeL.clearLayers(); stopsL.clearLayers();
  it.legs.forEach((l, i) => {
    const pts = geom(l.legGeometry); if (!pts.length) return;
    const dim = focus >= 0 && i !== focus ? .35 : 1;
    if (l.mode === 'WALK') L.polyline(pts, { color: '#3B82C4', weight: 5, dashArray: '1 9', lineCap: 'round', opacity: dim }).addTo(routeL);
    else if (isStreet(l)) L.polyline(pts, { color: '#16884F', weight: 5, dashArray: '8 6', opacity: dim }).addTo(routeL);
    else {
      L.polyline(pts, { color: '#fff', weight: 10, opacity: dim }).addTo(routeL);
      L.polyline(pts, { color: colorOf(l), weight: 6, opacity: dim }).addTo(routeL);
      (l.intermediateStops || []).forEach(s => L.circleMarker(ll(s), { radius: 3.5, color: colorOf(l), weight: 2, fillColor: '#fff', fillOpacity: 1, opacity: dim }).addTo(routeL));
      L.marker(ll(l.from), { icon: L.divIcon({ className: '', html: `<div class="legm" style="background:${colorOf(l)};color:${textOf(l)}">${I[MK(l.mode)]}${esc(lineName(l))}</div>`, iconSize: [0, 0] }), interactive: false, opacity: dim }).addTo(routeL);
    }
  });
  endMark(it.legs[0].from, '#14213D'); endMark(it.legs.at(-1).to, '#C9362B');
}
function renderRoute(it) {
  drawRoute(it);
  setTimeout(() => fitTo(routeL.getBounds()), 30);
  const k = st.from && st.to ? favKey(st.from, st.to) : '', isFav = store.get('favs', []).some(x => x.k === k);
  const tz = it.legs[0].from.tz, price = priceOf(it);
  let tl = `<li class="nd" style="--c:var(--ink)"><span class="tm">${fmt(it.startTime, tz)}</span><span class="rl"></span><span class="bd">${esc(st.from?.me ? T('myLoc') : st.from?.name || it.legs[0].from.name)}</span></li>`;
  it.legs.forEach((l, i) => {
    if (isStreet(l)) {
      const steps = (l.steps || []).filter(s => s.distance > 0 || s.relativeDirection === 'STAIRS' || s.relativeDirection === 'ELEVATOR');
      const tgt = i < it.legs.length - 1 ? esc(l.to.name) : '';
      const head = l.mode === 'WALK' ? T('walkTo', durS(l.duration), tgt) : `${esc(rentName(l))} ${durS(l.duration)}${tgt ? ` &rarr; <b>${tgt}</b>` : ''}`;
      const rent = l.mode !== 'WALK' && l.rental ? `<div class="sub">${l.rental.fromStationName ? esc(T('takeFrom', l.rental.fromStationName)) : ''}${l.rental.toStationName ? esc(T('leaveAt', l.rental.toStationName)) : ''}${l.rental.rentalUriIOS || l.rental.rentalUriWeb || l.rental.url ? ` <a href="${esc(l.rental.rentalUriIOS || l.rental.rentalUriWeb || l.rental.url)}" target="_blank" rel="noopener">${T('openApp')}</a>` : ''}</div>` : '';
      tl += `<li class="sg" data-leg="${i}"><span class="tm"></span><span class="rl wl"${l.mode !== 'WALK' ? ' style="--walk:#16884F"' : ''}><i></i></span><div class="bd"><span class="wk">${streetIc(l)}</span> ${head}${l.distance ? ` <span class="muted">(${meters(l.distance)})</span>` : ''}${rent}
        ${steps.length ? `<div><button class="more" data-tg="w${i}">${T('stepByStep')} ${I.down}</button></div><ul class="inner" id="w${i}" hidden>${steps.map(s => `<li>${stepIc(s)}<span>${esc(stepTxt(s))}</span><span class="d">${meters(s.distance)}</span></li>`).join('')}</ul>` : ''}</div></li>`;
      return;
    }
    const c = colorOf(l), inter = l.intermediateStops || [];
    tl += `<li class="nd" style="--c:${c}"><span class="tm">${fmt(l.startTime, l.from.tz)}${delayM(l.startTime, l.scheduledStartTime) > 0 ? `<small class="late">${fmt(l.scheduledStartTime, l.from.tz)}</small>` : ''}</span><span class="rl"></span><span class="bd">${esc(l.from.name)}<small>${l.from.track ? T('platform', esc(l.from.track)) : T('boardHere')}</small></span></li>
      <li class="sg" data-leg="${i}" style="--c:${c}"><span class="tm"></span><span class="rl"><i></i></span><div class="bd">${badge(l)} ${T('towards')} <b>${esc(l.headsign || l.to.name)}</b> ${liveTag(l)}
        <div class="sub">${T('nStops', inter.length + 1)}, ${durS(l.duration)}${l.agencyName ? `, ${esc(l.agencyName)}` : ''}</div>${(l.alerts || []).length ? `<div class="sub warn">${I.warn} ${esc(l.alerts[0].headerText || T('disruptionT'))}</div>` : ''}
        ${inter.length ? `<button class="more" data-tg="s${i}">${T('showStops')} ${I.down}</button><ul class="inner" id="s${i}" hidden>${inter.map(s => `<li><span>${esc(s.name)}</span><span class="d">${s.arrival ? fmt(s.arrival, s.tz) : ''}</span></li>`).join('')}</ul>` : ''}</div></li>
      <li class="nd" style="--c:${c}"><span class="tm">${fmt(l.endTime, l.to.tz)}</span><span class="rl"></span><span class="bd">${esc(l.to.name)}<small>${T('alightHere')}</small></span></li>`;
  });
  const last = it.legs.at(-1);
  if (isStreet(last)) tl += `<li class="nd end"><span class="tm">${fmt(it.endTime, last.to.tz)}</span><span class="rl"></span><span class="bd">${esc(st.to?.name || last.to.name)}</span></li>`;
  pane.innerHTML = hd(`${Math.round(it.duration / 60)} min`, k ? `<button class="icb fav ${isFav ? 'on' : ''}" id="favB" aria-label="${T('saveRoute')}">${I.star}</button>` : '')
    + `<div class="legs" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:-4px 0 12px">${legsStrip(it.legs)}</div>`
    + (price ? `<div class="muted" style="font-size:14px;margin:-6px 0 10px">${T('fareEst')}: <b style="color:var(--ink)">${price}</b></div>` : '')
    + alertsOf(it.legs).map(alertBox).join('')
    + ticketsHtml(it)
    + `<div style="display:flex;gap:8px"><button class="go" id="startLive" style="flex:1">${I.play}${T('startLive')}</button><button class="go ghost" id="shareB" aria-label="${T('shareEta')}" style="width:58px">${I.share}</button></div><ul class="tl">${tl}</ul>`;
  $('#favB')?.addEventListener('click', () => {
    let f = store.get('favs', []);
    f = f.some(x => x.k === k) ? f.filter(x => x.k !== k) : [{ k, from: st.from, to: st.to }, ...f];
    store.set('favs', f); $('#favB').classList.toggle('on'); toast($('#favB').classList.contains('on') ? T('routeSaved') : T('routeUnsaved'));
  });
  $('#startLive').onclick = () => startLive(it);
  $('#shareB').onclick = () => shareEta(it);
  toggles(pane);
  pane.querySelectorAll('.sg[data-leg]').forEach(li => li.onclick = () => {
    const i = +li.dataset.leg; drawRoute(it, i);
    const pts = geom(it.legs[i].legGeometry); if (pts.length) fitTo(L.latLngBounds(pts));
  });
}

/* ---------- statie ---------- */
function openStop(p) { st.stop = p; st.stopTab = 'dep'; nav('stop', () => renderStop(p)); }
function renderStop(p) {
  routeL.clearLayers(); endMark(p, '#FFC72C');
  if (sheetPos === 'peek') setSheet('half');
  centerOn(ll(p), Math.max(map.getZoom(), 16));
  const d = st.loc ? dist(st.loc, ll(p)) : null;
  const fk = p.stopId || p.name, isF = store.get('fstops', []).some(x => (x.stopId || x.name) === fk);
  const wItem = { stopId: p.stopId, name: p.name, line: null };
  pane.innerHTML = hd(esc(p.name), `${PUSH && p.stopId ? `<button class="icb bell ${isWatched(wItem) ? 'on' : ''}" id="wstop" aria-label="${T('watchB')}">${I.bell}</button>` : ''}<button class="icb fav ${isF ? 'on' : ''}" id="fstop" aria-label="${T('favStop')}">${I.star}</button>`)
    + `<div class="muted" style="margin:-6px 0 10px;font-size:14px">${d !== null ? T('distFromYou', meters(d)) : ''}</div><div id="stopAl"></div>
    <div class="btns"><button class="btn ghost" id="fromHere">${T('leaveHere')}</button><button class="btn" id="toHere">${T('goHere')}</button></div>
    <div class="seg wide" id="stopTabs"><button data-v="dep" class="${st.stopTab === 'dep' ? 'on' : ''}">${T('nextDeps')}</button><button data-v="tt" class="${st.stopTab === 'tt' ? 'on' : ''}">${I.cal.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} ${T('timetable')}</button></div>
    <div id="deps"><div class="skel" style="height:56px"></div><div class="skel" style="height:56px"></div></div>`;
  $('#toHere').onclick = () => routeTo({ name: p.name, lat: p.lat, lon: p.lon });
  $('#fromHere').onclick = () => { st.from = { name: p.name, lat: p.lat, lon: p.lon }; st.to = null; openSearch('to'); };
  $('#fstop').onclick = () => {
    let f = store.get('fstops', []);
    f = f.some(x => (x.stopId || x.name) === fk) ? f.filter(x => (x.stopId || x.name) !== fk) : [...f, { name: p.name, lat: p.lat, lon: p.lon, stopId: p.stopId, modes: p.modes }];
    store.set('fstops', f); $('#fstop').classList.toggle('on'); toast($('#fstop').classList.contains('on') ? T('stopFavOn') : T('stopFavOff'));
  };
  $('#wstop')?.addEventListener('click', e => toggleWatch([wItem], e.currentTarget));
  $('#stopTabs').querySelectorAll('button').forEach(b => b.onclick = () => { st.stopTab = b.dataset.v; renderStop(p); });
  clearInterval(paneTimer);
  if (st.stopTab === 'tt') return loadTimetable(p);
  const load = async () => {
    try {
      const r = await api('/v6/stoptimes', { stopId: p.stopId, n: 40, language: O.lang, withAlerts: true }, 25000).catch(e => { const f = ttFallback(p.stopId); if (f.stopTimes.length) return f; throw e; });
      const el = $('#deps'); if (!el || view !== 'stop' || st.stopTab !== 'dep') return;
      const al = alertsOf([{ from: r.place || {}, to: {} }, ...(r.stopTimes || []).map(x => ({ from: x.place, to: {} }))]);
      $('#stopAl').innerHTML = al.map((a, i) => alertBox(a, 's' + i)).join(''); toggles($('#stopAl'));
      const groups = new Map();
      (r.stopTimes || []).forEach(s => {
        if ((s.place.departure == null && s.place.scheduledDeparture == null) || depT(s) < Date.now() - 60000) return;
        const k = lineName(s) + '|' + (s.headsign || s.tripTo?.name || '');
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(s);
      });
      st.depGroups = [...groups.values()].map(g => g.sort((a, b) => depT(a) - depT(b))).sort((a, b) => depT(a[0]) - depT(b[0]));
      el.innerHTML = st.depGroups.length ? st.depGroups.map((g, gi) => {
        const s = g[0], t = s.place.departure || s.place.scheduledDeparture, m = mins(t);
        const nx = g.slice(1, 3).map(x => inMin(x.place.departure || x.place.scheduledDeparture, x.place.tz)).join(', ');
        return `<button class="dep" data-g="${gi}">${badge(s)}<span class="tx"><div>${esc(s.headsign || s.tripTo?.name || '')}</div><small>${s.cancelled || s.tripCancelled ? `<span class="late">${T('cancelled')}</span>` : liveTag(s, t, s.place.scheduledDeparture) || T('scheduled')}${s.place.track ? `, ${T('platform', esc(s.place.track))}` : ''}</small></span>
          <span class="times"><span class="n">${m <= 0 ? T('now') : m < 60 ? `${m}<small> min</small>` : fmt(t, s.place.tz)}</span>${nx ? `<span class="o">${nx}</span>` : ''}</span></button>`;
      }).join('') : `<p class="muted">${T('noDeps')}</p>`;
      el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => openTrip(st.depGroups[b.dataset.g][0], p));
    } catch (e) { const el = $('#deps'); if (el) el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  load();
  paneTimer = setInterval(() => view === 'stop' && st.stopTab === 'dep' && load(), 30000);
}
async function loadTimetable(p) {
  st.ttDay = st.ttDay || 0;
  const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + st.ttDay);
  const el = $('#deps');
  try {
    const r = await api('/v6/stoptimes', { stopId: p.stopId, time: day.toISOString(), window: 86400, n: 1, language: O.lang }, 600000);
    if (view !== 'stop' || st.stopTab !== 'tt') return;
    const list = (r.stopTimes || []).filter(s => s.place.scheduledDeparture || s.place.departure).filter(s => { const t = new Date(s.place.scheduledDeparture || s.place.departure); return t >= day && t < new Date(+day + 86400000); });
    const lines = new Map();
    list.forEach(s => { const k = lineName(s) + '|' + (s.headsign || ''); if (!lines.has(k)) lines.set(k, { s, items: [] }); lines.get(k).items.push(s); });
    const keys = [...lines.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!keys.includes(st.ttLine)) st.ttLine = keys[0];
    const g = lines.get(st.ttLine);
    let table = '';
    if (g) {
      const byH = {};
      g.items.forEach(s => { const [h, m] = fmt(s.place.scheduledDeparture || s.place.departure, s.place.tz).split(':'); (byH[h] = byH[h] || []).push(m); });
      table = `<table class="tt">${Object.keys(byH).sort().map(h => `<tr><th>${h}</th><td>${[...new Set(byH[h])].sort().join(' ')}</td></tr>`).join('')}</table>`;
    }
    el.innerHTML = `<div class="seg" id="ttDay" style="margin:10px 0"><button data-v="0" class="${st.ttDay === 0 ? 'on' : ''}">${T('today')}</button><button data-v="1" class="${st.ttDay === 1 ? 'on' : ''}">${T('tomorrow')}</button></div>
      ${keys.length ? `<div class="ttl">${keys.map(k => { const x = lines.get(k).s; return `<button data-k="${esc(k)}" class="${k === st.ttLine ? 'on' : ''}">${badge(x)}<small>${esc(x.headsign || '')}</small></button>`; }).join('')}</div>${table}` : `<p class="muted">${T('noTimetable')}</p>`}`;
    el.querySelectorAll('#ttDay button').forEach(b => b.onclick = () => { st.ttDay = +b.dataset.v; loadTimetable(p); });
    el.querySelectorAll('.ttl button').forEach(b => b.onclick = () => { st.ttLine = b.dataset.k; loadTimetable(p); });
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

/* ---------- cursa ---------- */
async function openTrip(s, from = {}) {
  nav('trip', () => { pane.innerHTML = hd(`${badge(s)} ${esc(s.headsign || '')}`) + '<div class="skel"></div>'; });
  try {
    const t = await api('/v6/trip', { tripId: s.tripId, language: O.lang }, 30000);
    if (view !== 'trip') return;
    const l = t.legs.find(x => !isStreet(x)) || t.legs[0];
    const stops = t.legs.flatMap((x, i) => i ? [...(x.intermediateStops || []), x.to] : stopsOf(x));
    routeL.clearLayers();
    t.legs.forEach(x => { const pts = geom(x.legGeometry); if (pts.length) { L.polyline(pts, { color: '#fff', weight: 10 }).addTo(routeL); L.polyline(pts, { color: colorOf(l), weight: 6 }).addTo(routeL); } });
    const now = Date.now();
    let cur = from.stopId ? stops.findIndex(p => p.stopId === from.stopId) : -1;
    if (cur < 0) cur = Math.max(0, stops.findIndex(p => { const tt = p.departure || p.arrival; return tt && new Date(tt) > now; }));
    stops.forEach((p, i) => L.circleMarker(ll(p), { radius: i === cur ? 7 : 4, color: colorOf(l), weight: 3, fillColor: i === cur ? colorOf(l) : '#fff', fillOpacity: 1 }).on('click', () => openStop(p)).addTo(routeL));
    fitTo(routeL.getBounds());
    vehFocus = sg => sg.id === s.tripId;
    pane.innerHTML = hd(`${badge(l)} ${T('towards')} ${esc(l.headsign || l.to.name)}`) + `<div class="muted" style="font-size:14px;margin:-6px 0 8px">${esc(l.agencyName || '')} ${liveTag(l)}</div>
      <ul class="stops" style="--c:${colorOf(l)}">${stops.map((p, i) => { const tt = p.departure || p.arrival; return `<li class="${tt && new Date(tt) < now ? 'past' : ''} ${i === cur ? 'now' : ''}" data-si="${i}"><span>${esc(p.name)}</span><span class="d">${tt ? fmt(tt, p.tz) : ''}</span></li>`; }).join('')}</ul>`;
    pane.querySelectorAll('[data-si]').forEach(li => li.onclick = () => openStop(stops[li.dataset.si]));
    pane.querySelector('.stops li.now')?.scrollIntoView({ block: 'center' });
  } catch (e) { pane.innerHTML = hd(T('trip')) + `<p class="err">${esc(e.message)}</p>`; }
}

/* ---------- linii ---------- */
function routeStops(resp, r) {
  const segs = r.segments || [];
  if (!segs.length) return [];
  return [segs[0].from, ...segs.map(s => s.to)].map(i => resp.stops[i]).filter(Boolean);
}
async function findLines(q) {
  const c = map.getCenter(), d = .05;
  const resp = await api('/experimental/map/routes', { zoom: 15, min: `${c.lat - d},${c.lng - d * 1.5}`, max: `${c.lat + d},${c.lng + d * 1.5}`, language: O.lang }, 3600000);
  const ql = q.toLowerCase(), groups = new Map();
  const add = exact => (resp.routes || []).forEach(r => (r.transitRoutes || []).forEach(tr => {
    const n = (tr.shortName || '').toLowerCase();
    if (exact ? n !== ql : !n.startsWith(ql)) return;
    const k = tr.shortName + '|' + r.mode;
    if (!groups.has(k)) groups.set(k, { routeShortName: tr.shortName, routeColor: tr.color, routeTextColor: tr.textColor, mode: r.mode, longName: tr.longName, variants: [] });
    groups.get(k).variants.push(r);
  }));
  add(true); if (!groups.size) add(false);
  return [...groups.values()].slice(0, 6).map(g => {
    const dirs = new Map();
    g.variants.forEach(r => { const ss = routeStops(resp, r), last = ss.at(-1)?.name || '?'; const cur = dirs.get(last); if (!cur || r.numStops > cur.n) dirs.set(last, { idx: r.routeIdx, n: r.numStops, last, first: ss[0]?.name || '' }); });
    return { ...g, dirs: [...dirs.values()].sort((a, b) => b.n - a.n).slice(0, 4), variants: undefined };
  });
}
function openLine(g) { st.line = g; st.lineDir = 0; nav('line', () => renderLine(g, 0)); }
async function renderLine(g, di) {
  st.lineDir = di;
  pane.innerHTML = hd(`${badge(g)} ${esc(modeName(g.mode))}`, PUSH ? `<button class="icb bell" id="wline" aria-label="${T('watchB')}">${I.bell}</button>` : '') + (g.longName ? `<div class="muted" style="font-size:14px;margin:-6px 0 8px">${esc(g.longName)}</div>` : '')
    + `<button class="btn" id="nearB" style="width:100%;margin:2px 0 6px">${I.me.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px"')} ${T('nearMe')}</button>`
    + `<h3>${T('directions')}</h3><div class="ttl">${g.dirs.map((d, i) => `<button data-d="${i}" class="${i === di ? 'on' : ''}"><small>${T('towards')}</small> ${esc(d.last)}</button>`).join('')}</div><div id="lineBody"><div class="skel"></div></div>`;
  pane.querySelectorAll('[data-d]').forEach(b => b.onclick = () => renderLine(g, +b.dataset.d));
  $('#nearB').onclick = () => nav('near', () => renderLineNear(g));
  vehFocus = sg => sg.name === g.routeShortName;
  vehKey = ''; loadVehicles(true);
  const d = g.dirs[di]; if (!d) return;
  try {
    const resp = await api('/experimental/map/route-details', { routeIdx: d.idx, language: O.lang }, 3600000);
    if (view !== 'line' || st.lineDir !== di) return;
    const r = (resp.routes || [])[0]; if (!r) throw new Error(T('lineNotFound'));
    const stops = routeStops(resp, r), col = colorOf(g);
    routeL.clearLayers();
    (r.segments || []).forEach(sg => { const pl = resp.polylines?.[sg.polyline]; const pts = pl ? geom(pl.polyline) : []; if (pts.length) { L.polyline(pts, { color: '#fff', weight: 10 }).addTo(routeL); L.polyline(pts, { color: col, weight: 6 }).addTo(routeL); } });
    stops.forEach(p => L.circleMarker(ll(p), { radius: 4, color: col, weight: 3, fillColor: '#fff', fillOpacity: 1 }).on('click', () => openStop(p)).addTo(routeL));
    fitTo(routeL.getBounds());
    const wItems = [stops[0], stops[Math.floor(stops.length / 2)]].filter(x => x?.stopId).map(x => ({ stopId: x.stopId, name: x.name, line: g.routeShortName }));
    const wb = $('#wline'); if (wb && wItems.length) { wb.classList.toggle('on', isWatched(wItems[0])); wb.onclick = () => toggleWatch(wItems, wb); }
    $('#lineBody').innerHTML = `<h3>${T('stopsOnLine', stops.length)}</h3><ul class="stops" style="--c:${col}">${stops.map((p, i) => `<li data-si="${i}"><span>${esc(p.name)}</span>${I.chev}</li>`).join('')}</ul>`;
    pane.querySelectorAll('[data-si]').forEach(li => li.onclick = () => openStop(stops[li.dataset.si]));
  } catch (e) { const el = $('#lineBody'); if (el) el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

/* ---------- unde ajung ---------- */
const BANDS = [[45, '#C9362B'], [30, '#E0A800'], [15, '#16884F']];
BANDS.forEach(([b]) => { const p = map.createPane('r' + b); p.style.zIndex = 350 + (60 - b); p.style.opacity = .32; p.style.pointerEvents = 'none'; });
const reachR = Object.fromEntries(BANDS.map(([b]) => [b, L.canvas({ pane: 'r' + b, padding: .5 })]));
async function renderReach(fromCenter) {
  const origin = !fromCenter && st.loc ? st.loc : [map.getCenter().lat, map.getCenter().lng];
  routeL.clearLayers(); reachL.clearLayers(); stopsL.clearLayers();
  pane.innerHTML = hd(T('reach')) + `<div class="muted" style="font-size:14px;margin:-6px 0 10px">${!fromCenter && st.loc ? T('reachFrom') : T('reachCenter')}</div>
    <div class="legend">${BANDS.slice().reverse().map(([b, c]) => `<span><i style="background:${c}"></i>${T('reachMin', b)}</span>`).join('')}</div>
    <div id="reachBody"><div class="skel" style="height:40px"></div></div>
    <button class="btn ghost" id="reachC" style="width:100%;margin-top:10px">${I.map.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px"')} ${T('reachCenter').replace(/,.*$/, '')}</button>
    <p class="muted" style="font-size:13px">${T('reachLegend')}</p>`;
  $('#reachC').onclick = () => renderReach(true);
  endMark({ lat: origin[0], lon: origin[1] }, '#14213D', reachL);
  try {
    const p = { one: origin.join(','), maxTravelTime: 45, language: O.lang, maxPreTransitTime: O.walk * 60 };
    if (O.wheelchair) p.pedestrianProfile = 'WHEELCHAIR';
    const r = await api('/v6/one-to-all', p, 300000);
    if (view !== 'reach') return;
    const all = r.all || [];
    const mx = Math.max(0, ...all.map(x => x.duration || 0));
    const toMin = mx > 120 ? v => v / 60 : v => v;
    const pts = [{ at: origin, d: 0 }, ...all.map(x => ({ at: ll(x.place), d: toMin(x.duration || 0) }))];
    const speed = O.speed === 'slow' ? 60 : O.speed === 'fast' ? 95 : 75;
    BANDS.forEach(([b, c]) => pts.forEach(x => { if (x.d < b) L.circle(x.at, { radius: Math.min((b - x.d) * speed, 1200), renderer: reachR[b], stroke: false, fillColor: c, fillOpacity: 1, interactive: false }).addTo(reachL); }));
    const cnt = BANDS.map(([b]) => all.filter(x => toMin(x.duration || 0) <= b).length);
    $('#reachBody').innerHTML = all.length ? `<div class="legend">${BANDS.slice().reverse().map(([b], i) => `<span><b>${cnt[2 - i]}</b> ${T('stopsCount', cnt[2 - i]).replace(/^\d+\s/, '')} &le; ${b} min</span>`).join('')}</div>` : `<p class="muted">${T('reachNone')}</p>`;
    const far = pts.filter(x => x.d < 45);
    if (far.length > 1) fitTo(L.latLngBounds(far.map(x => x.at)));
  } catch (e) { const el = $('#reachBody'); if (el) el.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

/* ---------- notificari push ---------- */
const b64u = s => { s = s.trim(); const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
let pushKey = null;
async function pushSubscribe() {
  if (!PUSH) throw new Error(T('pushOff'));
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error(T('pushInstall'));
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission !== 'granted') throw new Error(T('pushDenied'));
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    pushKey = pushKey || await (await fetch(PUSH + '/key')).text();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(pushKey) });
  }
  return sub;
}
async function pushSchedule(group, alerts) {
  const sub = await pushSubscribe();
  const r = await fetch(PUSH + '/schedule', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON(), group, alerts }) });
  if (!r.ok) throw new Error(T('srvErr', r.status));
}
async function pushCancel(group) {
  try {
    if (!PUSH || !('serviceWorker' in navigator)) return;
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) await fetch(PUSH + '/cancel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint, group }) });
  } catch {}
}
function liveAlerts(it) {
  const out = [];
  const tAt = (s, kind, l) => +new Date(kind === 'dep' ? (s.departure || s.scheduledDeparture || l.startTime) : (s.arrival || s.scheduledArrival || l.endTime));
  it.legs.forEach((l, i) => {
    if (isStreet(l) || new Date(l.endTime) < Date.now()) return;
    const stops = stopsOf(l), last = stops.length - 1, nm = lineName(l), h = l.headsign || l.to.name;
    const tr = (s, kind, off) => l.tripId && s.stopId ? { tripId: l.tripId, stopId: s.stopId, kind, offset: off } : null;
    out.push({ id: `b${i}`, at: tAt(l.from, 'dep', l) - 120000, title: nm, body: T('pushBoard', nm, h), trip: tr(l.from, 'dep', -120000) });
    const n = Math.min(O.alertStops, last);
    if (n > 1 && last - n >= 1) { const s = stops[last - n]; out.push({ id: `p${i}`, at: tAt(s, 'dep', l), title: nm, body: T('pushPre', n, l.to.name), trip: tr(s, 'dep', 0) }); }
    if (last >= 1) { const s = stops[last - 1]; out.push({ id: `o${i}`, at: tAt(s, 'dep', l), title: nm, body: T('pushAlight', l.to.name), trip: tr(s, 'dep', 0) }); }
  });
  const end = it.legs.at(-1);
  out.push({ id: 'end', at: +new Date(end.endTime), title: 'Peron', body: T('pushArrive', st.to?.name || end.to.name), trip: !isStreet(end) && end.tripId && end.to.stopId ? { tripId: end.tripId, stopId: end.to.stopId, kind: 'arr', offset: 0 } : null });
  return out.filter(a => a.at > Date.now() - 30000);
}

/* ---------- traseu live ---------- */
async function startLive(it) {
  live = { it, i: 0, idx: 0, alerted: {}, banner: null, startedAt: Date.now() };
  const now = Date.now();
  while (live.i < it.legs.length - 1 && new Date(it.legs[live.i].endTime) < now) live.i++;
  try { live.ctx = new (window.AudioContext || window.webkitAudioContext)(); await live.ctx.resume(); } catch {}
  if (PUSH) pushSchedule('live', liveAlerts(it)).then(() => { if (live) live.pushOn = true; }).catch(e => toast(e.message));
  else try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch {}
  try { live.lock = await navigator.wakeLock?.request('screen'); } catch {}
  startWatch();
  st.follow = true; $('#recenter').classList.add('on');
  $('#top').hidden = true; $('#livebar').hidden = false;
  nav('live', () => {});
  live.timer = setInterval(liveTick, 5000);
  live.rt = setInterval(refreshRT, 60000);
  setSheet('peek');
  drawRoute(it, live.i);
  if (st.loc) centerOn(st.loc, 17);
  refreshRT(); liveTick();
}
function stopLive() {
  if (!live) return;
  setTimeout(showUpdate, 1000);
  recordTrip(); followStop(live.done);
  clearInterval(live.timer); clearInterval(live.rt);
  try { live.lock?.release(); } catch {}
  try { live.ctx?.close(); } catch {}
  live = null;
  pushCancel('live');
  $('#livebar').hidden = true; $('#livebar').classList.remove('flash');
  st.follow = false; $('#recenter').classList.remove('on');
  $('#top').hidden = false; setSheet('half');
  back();
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
  if (!live.pushOn) try { if (Notification.permission === 'granted') navigator.serviceWorker.ready.then(r => r.showNotification('Peron', { body: text, tag: 'peron-live', renotify: true, icon: 'icon-192.png' })); } catch {}
}
function setLeg(i) {
  if (i > live.i) recordPunct(live.it.legs[live.i]);
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
    bar('#16884F', '#fff', I.flag, T('arrived'), esc(st.to?.name || l.to.name));
    if (!live.endDone) { live.endDone = true; recordPunct(live.it.legs.at(-1)); recordTrip(); followStop(true); }
    body = `<p>${T('arrivedDest')}</p>`;
  } else if (isStreet(l)) {
    const d = pos ? dist(pos, ll(l.to)) : null, nx = legs[live.i + 1], w = walkInfo(l, pos);
    if (d !== null && d < 30) { if (nx) return setLeg(live.i + 1); alertUser('end', T('arrivedDest')); live.done = true; return liveTick(); }
    if (!pos && now > new Date(l.endTime).getTime() && nx) return setLeg(live.i + 1);
    const step = w && w.next && w.dNext < 400;
    const ins = step ? esc(stepTxt(w.next)) : l.mode === 'WALK' ? esc(T('walkUntil', l.to.name)) : esc(T('rentUntil', rentName(l), l.to.name));
    bar(l.mode === 'WALK' ? '#3B82C4' : '#16884F', '#fff', step ? stepIc(w.next) : streetIc(l), ins,
      step ? T('inDist', meters(w.dNext)) : nx ? esc(T('thenLine', lineName(nx), nx.headsign || nx.to.name)) : T('finalDest'), d !== null ? meters(d) : durS(l.duration));
    if (nx && !isStreet(nx)) {
      const m = mins(nx.startTime), need = d !== null ? d / ((O.speed === 'slow' ? 1 : O.speed === 'fast' ? 1.6 : 1.25) * 60) : 0;
      if (m >= 0 && d !== null && need > m) alertUser('hurry' + live.i, T('hurry', lineName(nx), m, meters(d)));
    }
    body = `<div class="stepnow">${streetIc(l)}<div><b>${l.mode === 'WALK' ? esc(T('walkUntil', l.to.name)) : esc(T('rentUntil', rentName(l), l.to.name))}</b><div class="muted" style="font-size:14px">${d !== null ? T('remaining', meters(d)) : durS(l.duration)}${w && w.off ? T('offRoute') : ''}</div></div></div>
      ${nx && !isStreet(nx) ? `<div class="row"><span class="ic">${I[MK(nx.mode)]}</span><span class="tx"><div>${badge(nx)} ${T('towards')} ${esc(nx.headsign || nx.to.name)}</div><small>${T('leavesIn', mins(nx.startTime) <= 0 ? T('now') : T('inMin', mins(nx.startTime)))} ${liveTag(nx)}</small></span></div>` : ''}
      ${(l.steps || []).length ? `<h3>${T('directions2')}</h3><ul class="inner">${l.steps.filter(s => s.distance > 0).map(s => `<li>${stepIc(s)}<span>${esc(stepTxt(s))}</span><span class="d">${meters(s.distance)}</span></li>`).join('')}</ul>` : ''}`;
  } else {
    const stops = stopsOf(l), last = stops.length - 1, c = colorOf(l), ci = textOf(l);
    if (pos) {
      let best = live.idx, bd = Infinity;
      for (let k = live.idx; k <= last; k++) { const d = dist(pos, ll(stops[k])); if (d < bd) { bd = d; best = k; } }
      if (bd < 200) live.idx = best;
    } else stops.forEach((s, k) => { const t = s.departure || s.arrival; if (t && new Date(t) <= now) live.idx = Math.max(live.idx, k); });
    const dEnd = pos ? dist(pos, ll(l.to)) : null, dFrom = pos ? dist(pos, ll(l.from)) : null;
    const boarded = live.idx > 0 || (now > new Date(l.startTime).getTime() + 90000 && (dFrom === null || dFrom > 150));
    const left = last - live.idx;
    if (!boarded) {
      const m = mins(l.startTime);
      bar(c, ci, I[MK(l.mode)], esc(T('boardIn', lineName(l))), `${T('towards')} ${esc(l.headsign || l.to.name)}, ${esc(l.from.name)}`, m <= 0 ? T('now') : `${m}<small>min</small>`);
      if (m <= 1) alertUser('board' + live.i, T('boardNow', lineName(l), l.headsign || l.to.name));
      else if (m <= 3) alertUser('near' + live.i, T('arrivesIn', lineName(l), m));
      body = `<div class="stepnow">${I[MK(l.mode)].replace('<svg', `<svg style="color:${c}"`)}<div><b>${T('waitFor')} ${badge(l)}</b><div class="muted" style="font-size:14px">${esc(l.from.name)}${l.from.track ? `, ${T('platform', esc(l.from.track))}` : ''}<br>${T('leavesAt', fmt(l.startTime, l.from.tz))} ${liveTag(l)}</div></div></div>
        <div class="row"><span class="ic">${I.flag}</span><span class="tx"><div>${esc(T('getOffAt', l.to.name))}</div><small>${T('nStops', last)}, ${durS(l.duration)}</small></span></div>`;
    } else {
      if (left === 0 || (dEnd !== null && dEnd < 70)) {
        alertUser('off' + live.i, T('offNowPush', l.to.name));
        if (dEnd !== null ? dEnd < 40 : now > new Date(l.endTime).getTime() + 60000) {
          if (live.i < legs.length - 1) return setLeg(live.i + 1);
          live.done = true; return liveTick();
        }
      } else if (left <= O.alertStops) alertUser('pre' + live.i, T('prepare', left, l.to.name));
      bar(c, ci, I[MK(l.mode)], left === 0 ? T('getOffNow') : left === 1 ? T('getOffNext') : esc(T('getOffAt2', l.to.name)),
        left <= 1 ? esc(l.to.name) : esc(T('nextStop', stops[Math.min(live.idx + 1, last)].name)), left > 1 ? `${left}<small>${O.lang === 'en' ? 'stops' : 'statii'}</small>` : '');
      const pct = Math.round(live.idx / Math.max(1, last) * 100);
      body = `<div style="display:flex;align-items:center;gap:8px">${badge(l)}<span>${T('towards')} <b>${esc(l.headsign || l.to.name)}</b></span></div>
        <div class="prog" style="--c:${c}"><i style="width:${pct}%"></i></div>
        <div class="muted" style="display:flex;justify-content:space-between;font-size:14px"><span>${T('stopsLeft', left)}</span><span>${T('arrival', fmt(l.endTime, l.to.tz))} ${liveTag(l, l.endTime, l.scheduledEndTime)}</span></div>
        <ul class="stops" style="--c:${c}">${stops.map((s, k) => `<li class="${k < live.idx ? 'past' : k === live.idx ? 'now' : k === last ? 'end' : ''}"><span>${esc(s.name)}</span><span class="d">${s.arrival || s.departure ? fmt(s.arrival || s.departure, s.tz) : ''}</span></li>`).join('')}</ul>`;
    }
  }
  const nextLegs = legs.slice(live.i + 1).filter(x => !isStreet(x)), lal = alertsOf([l]);
  pane.innerHTML = (live.banner ? `<div class="alert">${I.bell}<span>${esc(live.banner)}</span></div>` : '') + altHtml() + lal.map((a, i) => alertBox(a, 'l' + i)).join('') + body
    + (nextLegs.length && !live.done ? `<h3>${T('next')}</h3>${nextLegs.map(x => `<div class="row"><span class="ic">${I[MK(x.mode)]}</span><span class="tx"><div>${badge(x)} ${esc(x.from.name)}</div><small>${fmt(x.startTime, x.from.tz)} ${liveTag(x)}</small></span></div>`).join('')}` : '')
    + `<div class="lnav"><button class="btn ghost" id="lPrev" ${live.i === 0 ? 'disabled' : ''}>${T('prevLeg')}</button><button class="btn ghost" id="lNext">${live.i < legs.length - 1 ? T('nextLeg') : T('iArrived')}</button></div>
       ${PUSH ? `<div class="lnav"><button class="btn ${live.share ? '' : 'ghost'}" id="lFollow">${I.follow.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px"')} ${T('follow')}</button></div>` : ''}
       <div class="lnav"><button class="btn ghost" id="lShare">${I.share.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px"')} ${T('shareEta')}</button><button class="btn stop" id="lStop">${T('stopLive')}</button></div>
       ${pos ? '' : `<p class="muted" style="font-size:13px">${T('noGps')}</p>`}`;
  $('#lPrev').onclick = () => setLeg(live.i - 1);
  $('#lNext').onclick = () => live.i < legs.length - 1 ? setLeg(live.i + 1) : (live.done = true, liveTick());
  $('#lStop').onclick = stopLive;
  altBind(); checkAlt();
  $('#lShare').onclick = () => shareEta(live.it);
  $('#lFollow')?.addEventListener('click', followStart);
  if (!live.done) followUpdate();
  toggles(pane);
  pane.querySelector('.stops li.now')?.scrollIntoView({ block: 'nearest' });
}
async function refreshRT() {
  if (!live) return;
  for (const l of live.it.legs.slice(live.i, live.i + 3).filter(l => l.tripId && !isStreet(l))) {
    try {
      const t = await api('/v6/trip', { tripId: l.tripId, language: O.lang }, 45000);
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

/* ======================= extensii v6 ======================= */
Object.assign(L10N.ro, {
  tools: 'Unelte', depsT: 'Plecari programate', depsSub: 'Notificare cand trebuie sa pleci', histT: 'Calatoriile mele', histSub: 'Istoric si statistici',
  depsInfo: 'Primesti o notificare exact cand trebuie sa pleci, calculata cu intarzierile in timp real.', addDep: 'Adauga plecare', noDeps2: 'Nicio plecare programata.',
  depFrom: 'De unde', depTo: 'Unde', arriveBy: 'Vreau sa ajung la', repeat: 'Repeta', once: 'O singura data', date: 'Data', save: 'Salveaza', saved: 'Salvat.', depArr: t => `sosire ${t}`,
  wd: ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'], weekdays: 'L-V', everyDay: 'zilnic', pickPlace: 'Alege locul', needPush: 'Necesita notificari active.',
  watchOn: 'Vei primi notificari la perturbari.', watchOff: 'Alertele de perturbari au fost oprite.', watchB: 'Alerte perturbari',
  follow: 'Urmareste-ma', followMsg: (d, l) => `Sunt pe drum spre ${d}. Ma poti urmari aici: ${l}`, followOn: 'Linkul de urmarire este activ.', myName: 'Numele tau', myNameSub: 'apare cand trimiti linkul de urmarire',
  offline: t => `Fara semnal, date salvate la ${t}`, offlineNow: 'Fara semnal',
  histEmpty: 'Calatoriile apar aici dupa ce folosesti traseul live.', thisMonth: 'Luna aceasta', lastMonth: 'Luna trecuta', allTime: 'Tot', tripsN: n => pl(n, 'calatorie', 'calatorii'),
  timeOnTransit: 'timp pe drum', kmTransit: 'km cu transportul public', kmWalk: 'km pe jos', co2: kg => `~${kg} kg CO2 economisit fata de masina (estimare)`, byMode: 'Pe mijloace de transport',
  siriH: 'Comenzi Siri', siriInfo: 'In aplicatia Scurtaturi: + > Adauga actiune > Deschide URL-uri > lipeste linkul. Denumeste scurtatura, de exemplu „Du-ma acasa”, si spune „Hey Siri, du-ma acasa”. Linkul se deschide in Safari.', copyLink: 'Copiaza link', linkCopied: 'Link copiat.',
  wxT: 'Vremea', feels: t => `se simte ca ${t}`, wind: 'Vant', gusts: 'rafale', humidity: 'Umiditate', next24: 'Urmatoarele 24 de ore', nextDays: 'Urmatoarele zile', wxWarnH: 'Atentie la vreme', wxNoWarn: 'Fara fenomene periculoase in urmatoarele 24 de ore.',
  wxNote: 'Avertizari calculate din prognoza, nu sunt avertizarile oficiale.', wxOfficial: 'Avertizari oficiale: MeteoAlarm', wxCredit: 'Date meteo: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0)', wxErr: 'Nu am putut incarca vremea.',
  w_storm: 'Furtuna', w_rain: 'Ploaie abundenta', w_ice: 'Polei / ploaie inghetata', w_snow: 'Ninsoare abundenta', w_wind: 'Vant puternic', w_heat: 'Canicula', w_cold: 'Ger', w_fog: 'Ceata', today2: 'Azi', tomorrow2: 'Maine',
  wc: { 0: 'Senin', 1: 'Mai mult senin', 2: 'Partial noros', 3: 'Innorat', 45: 'Ceata', 48: 'Ceata cu chiciura', 51: 'Burnita', 53: 'Burnita', 55: 'Burnita densa', 56: 'Burnita inghetata', 57: 'Burnita inghetata', 61: 'Ploaie slaba', 63: 'Ploaie', 65: 'Ploaie puternica', 66: 'Ploaie inghetata', 67: 'Ploaie inghetata', 71: 'Ninsoare slaba', 73: 'Ninsoare', 75: 'Ninsoare puternica', 77: 'Graupel', 80: 'Averse', 81: 'Averse', 82: 'Averse puternice', 85: 'Averse de ninsoare', 86: 'Averse de ninsoare', 95: 'Furtuna', 96: 'Furtuna cu grindina', 99: 'Furtuna cu grindina' }
});
Object.assign(L10N.en, {
  tools: 'Tools', depsT: 'Scheduled departures', depsSub: 'Get notified when to leave', histT: 'My trips', histSub: 'History and stats',
  depsInfo: 'You get a notification exactly when you need to leave, based on real-time delays.', addDep: 'Add departure', noDeps2: 'No scheduled departures.',
  depFrom: 'From', depTo: 'To', arriveBy: 'Arrive by', repeat: 'Repeat', once: 'Once', date: 'Date', save: 'Save', saved: 'Saved.', depArr: t => `arrive ${t}`,
  wd: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], weekdays: 'Mon-Fri', everyDay: 'daily', pickPlace: 'Choose place', needPush: 'Requires notifications.',
  watchOn: 'You will be notified about disruptions.', watchOff: 'Disruption alerts turned off.', watchB: 'Disruption alerts',
  follow: 'Follow me', followMsg: (d, l) => `On my way to ${d}. Follow me here: ${l}`, followOn: 'The follow link is active.', myName: 'Your name', myNameSub: 'shown when you share a follow link',
  offline: t => `Offline, data saved at ${t}`, offlineNow: 'Offline',
  histEmpty: 'Trips appear here after you use live trips.', thisMonth: 'This month', lastMonth: 'Last month', allTime: 'All', tripsN: n => `${n} ${n === 1 ? 'trip' : 'trips'}`,
  timeOnTransit: 'travel time', kmTransit: 'km by public transport', kmWalk: 'km walked', co2: kg => `~${kg} kg CO2 saved vs. driving (estimate)`, byMode: 'By transport mode',
  siriH: 'Siri shortcuts', siriInfo: 'In the Shortcuts app: + > Add Action > Open URLs > paste the link. Name the shortcut, for example "Take me home", then say "Hey Siri, take me home". The link opens in Safari.', copyLink: 'Copy link', linkCopied: 'Link copied.',
  wxT: 'Weather', feels: t => `feels like ${t}`, wind: 'Wind', gusts: 'gusts', humidity: 'Humidity', next24: 'Next 24 hours', nextDays: 'Next days', wxWarnH: 'Weather warnings', wxNoWarn: 'No hazardous weather in the next 24 hours.',
  wxNote: 'Warnings are derived from the forecast, not official warnings.', wxOfficial: 'Official warnings: MeteoAlarm', wxCredit: 'Weather data: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0)', wxErr: 'Could not load the weather.',
  w_storm: 'Thunderstorm', w_rain: 'Heavy rain', w_ice: 'Freezing rain / ice', w_snow: 'Heavy snow', w_wind: 'Strong wind', w_heat: 'Heat', w_cold: 'Severe cold', w_fog: 'Fog', today2: 'Today', tomorrow2: 'Tomorrow',
  wc: { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail' }
});
Object.assign(I, {
  dep: sv('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6M12 2v3"/>'),
  hist: sv('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  bellOff: sv('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>'),
  follow: sv('<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><path d="M19 3l2-2M21 7h2"/>'),
  link: sv('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
  trash: sv('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  plus: sv('<path d="M12 5v14M5 12h14"/>')
});
const WXI = {
  sun: sv('<circle cx="12" cy="12" r="4.5" fill="#FFC72C" stroke="#E0A800"/><path stroke="#E0A800" d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: sv('<path fill="#C9D3E3" stroke="#8A97A8" d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>'),
  partly: sv('<circle cx="9" cy="9" r="3.5" fill="#FFC72C" stroke="#E0A800"/><path stroke="#E0A800" d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1 1M13.6 4.4l-1 1"/><path fill="#E8EDF4" stroke="#8A97A8" d="M8 20h9.5a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.5A2.8 2.8 0 0 0 8 20z"/>'),
  cloud: sv('<path fill="#E8EDF4" stroke="#8A97A8" d="M7 19h10.5a4 4 0 0 0 .3-8A6 6 0 0 0 6.2 12.6 3.3 3.3 0 0 0 7 19z"/>'),
  fog: sv('<path stroke="#8A97A8" d="M4 9h16M3 13h18M5 17h14M7 21h10"/>'),
  rain: sv('<path fill="#E8EDF4" stroke="#8A97A8" d="M7 15h10.5a4 4 0 0 0 .3-8A6 6 0 0 0 6.2 8.6 3.3 3.3 0 0 0 7 15z"/><path stroke="#3B82C4" d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>'),
  snow: sv('<path fill="#E8EDF4" stroke="#8A97A8" d="M7 15h10.5a4 4 0 0 0 .3-8A6 6 0 0 0 6.2 8.6 3.3 3.3 0 0 0 7 15z"/><path stroke="#7DB7EA" d="M8 18v3M6.5 19.5h3M12 18v3M10.5 19.5h3M16 18v3M14.5 19.5h3"/>'),
  storm: sv('<path fill="#C9D3E3" stroke="#5E6E85" d="M7 14h10.5a4 4 0 0 0 .3-8A6 6 0 0 0 6.2 7.6 3.3 3.3 0 0 0 7 14z"/><path fill="#FFC72C" stroke="#E0A800" d="M12.5 13l-3 5h3l-1.5 4 4.5-6h-3l1.5-3z"/>')
};
const wxIcon = (c, day = 1) => c === 0 || c === 1 ? (day ? WXI.sun : WXI.moon) : c === 2 ? (day ? WXI.partly : WXI.cloud) : c === 3 ? WXI.cloud : c === 45 || c === 48 ? WXI.fog : c >= 95 ? WXI.storm : (c >= 71 && c <= 77) || c === 85 || c === 86 ? WXI.snow : c >= 51 ? WXI.rain : WXI.cloud;
const tzName = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'Europe/Bucharest'; } };
const rand = n => b64e(crypto.getRandomValues(new Uint8Array(n)));
const b64e = u => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const baseUrl = () => location.origin + location.pathname.replace(/[^/]*$/, '');
async function copyText(t, okMsg) { try { await navigator.clipboard.writeText(t); toast(okMsg); } catch { prompt('', t); } }
async function pushPost(path, body) {
  const sub = await pushSubscribe();
  const r = await fetch(PUSH + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON(), lang: O.lang, tz: tzName(), ...body }) });
  if (!r.ok) throw new Error(T('srvErr', r.status));
}

/* ---------- mod fara semnal ---------- */
const PC_LIM = { '/v6/plan': 6, '/v6/stoptimes': 25, '/v6/trip': 10 };
function pcPut(path, url, d) {
  const lim = PC_LIM[path]; if (!lim) return;
  const idx = store.get('pcidx', {}), list = (idx[path] || []).filter(u => u !== url);
  list.unshift(url);
  while (list.length > lim) { try { localStorage.removeItem('pc:' + list.pop()); } catch {} }
  idx[path] = list;
  try { localStorage.setItem('pc:' + url, JSON.stringify({ t: Date.now(), d })); store.set('pcidx', idx); }
  catch { Object.values(idx).flat().forEach(u => { try { localStorage.removeItem('pc:' + u); } catch {} }); store.set('pcidx', {}); }
}
const pcGet = url => { try { return JSON.parse(localStorage.getItem('pc:' + url)); } catch { return null; } };
function setOffline(t) {
  st.offlineAt = t;
  const e = $('#offline'); if (!e) return;
  e.hidden = !t && navigator.onLine;
  e.textContent = t ? T('offline', new Date(t).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' })) : T('offlineNow');
}
addEventListener('online', () => { setOffline(null); loadWeather(true); });
addEventListener('offline', () => setOffline(st.offlineAt || null));
async function prefetchTT() {
  if (!navigator.onLine) return;
  const today = new Date().toDateString();
  for (const p of store.get('fstops', []).slice(0, 6)) {
    const k = 'tt:' + p.stopId, cur = store.get(k, null);
    if (cur && cur.day === today) continue;
    try {
      const r = await api('/v6/stoptimes', { stopId: p.stopId, time: new Date().toISOString(), window: 86400, n: 1, language: O.lang }, 600000);
      store.set(k, { day: today, list: (r.stopTimes || []).slice(0, 500).map(s => ({ routeShortName: s.routeShortName, displayName: s.displayName, routeColor: s.routeColor, routeTextColor: s.routeTextColor, mode: s.mode, headsign: s.headsign, realTime: false, place: { departure: s.place.scheduledDeparture || s.place.departure, scheduledDeparture: s.place.scheduledDeparture, tz: s.place.tz, name: s.place.name } })) });
    } catch {}
  }
}
const ttFallback = stopId => ({ stopTimes: (store.get('tt:' + stopId, null)?.list || []).filter(s => new Date(s.place.departure) > Date.now() - 60000) });

/* ---------- vremea ---------- */
const WX = { d: null, at: 0, pos: null, city: '', warn: [] };
async function loadWeather(force) {
  const pos = st.loc || [map.getCenter().lat, map.getCenter().lng];
  if (!force && WX.d && Date.now() - WX.at < 15 * 60000 && WX.pos && dist(pos, WX.pos) < 5000) return;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${pos[0].toFixed(3)}&longitude=${pos[1].toFixed(3)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,is_day&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_gusts_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3&wind_speed_unit=kmh`;
    const r = await fetch(u); if (!r.ok) throw 0;
    WX.d = await r.json(); WX.at = Date.now(); WX.pos = pos;
    WX.warn = wxWarnings(WX.d);
    renderWxChip();
    try {
      const g = await api('/v1/reverse-geocode', { place: pos.join(','), numResults: 1, language: O.lang }, 3600000);
      const ar = (g[0]?.areas || []).filter(a => a.adminLevel >= 6 && a.adminLevel <= 8).sort((a, b) => b.adminLevel - a.adminLevel);
      WX.city = ar[0]?.name || (g[0]?.areas || []).at(-1)?.name || '';
    } catch {}
    if (view === 'weather') renderWeather();
  } catch { if (view === 'weather') renderWeather(); }
}
const wxTime = (d, s) => Date.parse(s + 'Z') - d.utc_offset_seconds * 1000;
const wxHM = (d, ms) => new Date(ms + d.utc_offset_seconds * 1000).toISOString().slice(11, 16);
function wxWarnings(d) {
  const h = d.hourly, now = Date.now(), out = [];
  const typeOf = i => {
    const c = h.weather_code[i], g = h.wind_gusts_10m[i], p = h.precipitation[i], t = h.temperature_2m[i], r = [];
    if (c >= 95) r.push(['storm', 3, null]);
    if ([56, 57, 66, 67].includes(c)) r.push(['ice', 3, null]);
    if (p >= 7 || c === 65 || c === 82) r.push(['rain', 2, p]);
    if (c === 75 || c === 86) r.push(['snow', 2, p]);
    if (g >= 60) r.push(['wind', g >= 90 ? 3 : 2, g]);
    if (t >= 35) r.push(['heat', 2, t]);
    if (t <= -15) r.push(['cold', 2, t]);
    if (c === 45 || c === 48) r.push(['fog', 1, null]);
    return r;
  };
  const open = {};
  h.time.forEach((s, i) => {
    const t = wxTime(d, s); if (t < now - 3600000 || t > now + 24 * 3600000) return;
    const found = typeOf(i), seen = new Set();
    found.forEach(([k, sev, v]) => {
      seen.add(k);
      if (open[k] && open[k].to === t - 3600000) { open[k].to = t; open[k].sev = Math.max(open[k].sev, sev); if (v != null) open[k].v = k === 'cold' ? Math.min(open[k].v ?? v, v) : Math.max(open[k].v ?? v, v); }
      else { open[k] = { k, sev, from: t, to: t, v }; out.push(open[k]); }
    });
  });
  return out.sort((a, b) => b.sev - a.sev || a.from - b.from);
}
function renderWxChip() {
  const c = WX.d?.current, b = $('#wx'); if (!b) return;
  if (!c) { b.hidden = true; return; }
  b.hidden = false;
  const sev = Math.max(0, ...WX.warn.map(w => w.sev));
  b.innerHTML = `${wxIcon(c.weather_code, c.is_day)}<b>${Math.round(c.temperature_2m)}&deg;</b>${sev >= 2 ? `<i class="wxdot${sev >= 3 ? ' s3' : ''}"></i>` : ''}`;
  b.setAttribute('aria-label', `${T('wxT')}: ${Math.round(c.temperature_2m)} ${T('wc')[c.weather_code] || ''}`);
}
$('#wx').onclick = () => { nav('weather', renderWeather); setSheet('full'); loadWeather(); };
function renderWeather() {
  const d = WX.d;
  if (!d) { pane.innerHTML = hd(T('wxT')) + `<p class="muted">${T('wxErr')}</p>`; return; }
  const c = d.current, h = d.hourly, now = Date.now(), wc = T('wc');
  const start = Math.max(0, h.time.findIndex(s => wxTime(d, s) >= now - 1800000));
  const hours = h.time.slice(start, start + 24).map((s, j) => { const i = start + j; return `<div class="wxh"><small>${wxHM(d, wxTime(d, s))}</small>${wxIcon(h.weather_code[i], h.is_day[i])}<b>${Math.round(h.temperature_2m[i])}&deg;</b><small class="pp">${h.precipitation_probability[i] ?? 0}%</small></div>`; }).join('');
  const SEVC = { 1: '#1F6FB2', 2: '#D9822B', 3: '#C9362B' };
  const warn = WX.warn.length ? WX.warn.map(w => `<div class="alr" style="--a:${SEVC[w.sev]}">${I.warn}<div><b>${T('w_' + w.k)}</b><div class="ald" style="margin-top:2px">${wxHM(d, w.from)}&ndash;${wxHM(d, w.to + 3600000)}${w.v != null ? `, ${w.k === 'wind' ? `${T('gusts')} ${Math.round(w.v)} km/h` : w.k === 'rain' || w.k === 'snow' ? `${w.v.toFixed(1)} mm/h` : `${Math.round(w.v)}&deg;C`}` : ''}</div></div></div>`).join('') : `<p class="muted" style="font-size:14px">${T('wxNoWarn')}</p>`;
  const days = d.daily.time.map((s, i) => `<div class="wxd"><span>${i === 0 ? T('today2') : i === 1 ? T('tomorrow2') : new Date(s + 'T12:00').toLocaleDateString(LOC(), { weekday: 'long' })}</span>${wxIcon(d.daily.weather_code[i])}<span class="muted">${d.daily.precipitation_probability_max[i] ?? 0}%</span><b>${Math.round(d.daily.temperature_2m_min[i])}&deg; / ${Math.round(d.daily.temperature_2m_max[i])}&deg;</b></div>`).join('');
  pane.innerHTML = hd(esc(WX.city || T('wxT')))
    + `<div class="wxnow">${wxIcon(c.weather_code, c.is_day)}<div><div class="wxt">${Math.round(c.temperature_2m)}&deg;</div><div>${esc(wc[c.weather_code] || '')}</div><small class="muted">${T('feels', Math.round(c.apparent_temperature) + '&deg;')}</small></div>
      <div class="wxm"><span>${T('wind')} <b>${Math.round(c.wind_speed_10m)} km/h</b></span><span>${T('gusts')} <b>${Math.round(c.wind_gusts_10m)} km/h</b></span><span>${T('humidity')} <b>${c.relative_humidity_2m}%</b></span></div></div>
    <h3>${T('wxWarnH')}</h3>${warn}
    <p class="muted" style="font-size:12px;margin:4px 0">${T('wxNote')} <a href="https://meteoalarm.org/" target="_blank" rel="noopener">${T('wxOfficial')}</a></p>
    <h3>${T('next24')}</h3><div class="wxhs">${hours}</div>
    <h3>${T('nextDays')}</h3>${days}
    <p class="credit">${T('wxCredit')}</p>`;
}
setInterval(() => loadWeather(), 10 * 60000);

/* ---------- plecari programate ---------- */
const depsList = () => store.get('deps', []);
const daysTxt = d => d.date ? new Date(d.date + 'T12:00').toLocaleDateString(LOC(), { day: 'numeric', month: 'short' }) : d.days.length === 7 ? T('everyDay') : d.days.join() === '1,2,3,4,5' ? T('weekdays') : d.days.map(x => T('wd')[x]).join(' ');
async function syncDeps() { if (!PUSH) throw new Error(T('pushOff')); await pushPost('/depart', { list: depsList().map(d => ({ ...d, buffer: bufferFor(d) })) }); }
function renderDeps() {
  const list = depsList();
  pane.innerHTML = hd(T('depsT'), `<button class="icb" id="addDep" aria-label="${T('addDep')}">${I.plus}</button>`) + `<p class="muted" style="font-size:14px;margin-top:-4px">${T('depsInfo')}</p>`
    + (list.length ? list.map((d, i) => `<div class="row"><span class="ic">${I.dep}</span><button class="tx" data-e="${i}" style="text-align:left"><div>${esc(d.to.name)}</div><small>${T('depArr', d.arrive)}, ${esc(daysTxt(d))} · ${T('from')} ${esc(d.from.name)}</small></button><button class="tg ${d.on ? 'on' : ''}" data-on="${i}" aria-label="on"></button></div>`).join('') : `<p class="muted">${T('noDeps2')}</p>`)
    + `<button class="btn" id="addDep2" style="width:100%;margin-top:12px">${T('addDep')}</button>`;
  $('#addDep').onclick = $('#addDep2').onclick = () => editDep(null);
  pane.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editDep(+b.dataset.e));
  pane.querySelectorAll('[data-on]').forEach(b => b.onclick = async () => {
    const l = depsList(); l[b.dataset.on].on = !l[b.dataset.on].on; store.set('deps', l); renderDeps();
    try { await syncDeps(); } catch (e) { toast(e.message); }
  });
}
function editDep(i) {
  const l = depsList();
  const d = st.depEdit = i == null ? { id: rand(6), from: O.home || (st.loc ? { name: T('myLoc'), lat: st.loc[0], lon: st.loc[1] } : null), to: O.work, arrive: '09:00', days: [1, 2, 3, 4, 5], date: null, on: true } : structuredClone(l[i]);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const draw = () => {
    pane.innerHTML = hd(i == null ? T('addDep') : T('depsT'), i == null ? '' : `<button class="icb" id="delDep" aria-label="${T('delete')}">${I.trash}</button>`)
      + `<button class="row" id="dFrom"><span class="ic"><span class="dot o"></span></span><span class="tx"><small>${T('depFrom')}</small><div>${esc(d.from?.name || T('pickPlace'))}</div></span>${I.chev}</button>
      <button class="row" id="dTo"><span class="ic"><span class="dot d"></span></span><span class="tx"><small>${T('depTo')}</small><div>${esc(d.to?.name || T('pickPlace'))}</div></span>${I.chev}</button>
      <div class="opt"><span>${T('arriveBy')}</span><input type="time" id="dArr" value="${d.arrive}" class="inp"></div>
      <div class="opt"><span>${T('repeat')}</span><div class="seg"><button data-r="rep" class="${d.date ? '' : 'on'}">${T('repeat')}</button><button data-r="once" class="${d.date ? 'on' : ''}">${T('once')}</button></div></div>
      ${d.date ? `<div class="opt"><span>${T('date')}</span><input type="date" id="dDate" value="${d.date}" class="inp"></div>` : `<div class="chk days">${order.map(x => `<button data-wd="${x}" class="${d.days.includes(x) ? 'on' : ''}">${T('wd')[x]}</button>`).join('')}</div>`}
      <button class="btn" id="dSave" style="width:100%;margin-top:14px">${T('save')}</button>`;
    $('#dFrom').onclick = () => openSearch('to', p => { d.from = p; draw(); }, T('depFrom'));
    $('#dTo').onclick = () => openSearch('to', p => { d.to = p; draw(); }, T('depTo'));
    $('#dArr').onchange = e => d.arrive = e.target.value;
    $('#dDate')?.addEventListener('change', e => d.date = e.target.value);
    pane.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { d.date = b.dataset.r === 'once' ? new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null; draw(); });
    pane.querySelectorAll('[data-wd]').forEach(b => b.onclick = () => { const x = +b.dataset.wd; d.days = d.days.includes(x) ? d.days.filter(y => y !== x) : [...d.days, x]; draw(); });
    $('#delDep')?.addEventListener('click', async () => { store.set('deps', depsList().filter(x => x.id !== d.id)); try { await syncDeps(); } catch {} back(); });
    $('#dSave').onclick = async () => {
      if (!d.from || !d.to || !d.arrive || (!d.date && !d.days.length)) return toast(T('pickPlace'));
      const all = depsList(), k = all.findIndex(x => x.id === d.id);
      if (k >= 0) all[k] = d; else all.push(d);
      store.set('deps', all);
      try { await syncDeps(); toast(T('saved')); } catch (e) { toast(e.message); }
      back();
    };
  };
  nav('depEdit', draw);
}

/* ---------- alerte perturbari ---------- */
const watchList = () => store.get('watch', []);
const watchKey = w => w.stopId + '|' + (w.line || '');
const isWatched = w => watchList().some(x => watchKey(x) === watchKey(w));
async function toggleWatch(items, btn) {
  if (!PUSH) return toast(T('pushOff'));
  const on = isWatched(items[0]);
  let l = watchList().filter(x => !items.some(i => watchKey(i) === watchKey(x)));
  if (!on) l = [...l, ...items];
  store.set('watch', l.slice(0, 8));
  btn?.classList.toggle('on', !on);
  try { await pushPost('/watch', { items: watchList() }); toast(on ? T('watchOff') : T('watchOn')); } catch (e) { toast(e.message); }
}

/* ---------- urmareste-ma ---------- */
async function followStart() {
  if (!PUSH || !live) return toast(T('pushOff'));
  const it = live.it, end = it.legs.at(-1), dest = st.to || end.to;
  if (!live.share) {
    live.share = { id: rand(18), key: rand(24), last: 0 };
    const meta = { name: O.myName || '', dest: { name: dest.name, lat: dest.lat, lon: dest.lon }, eta: +new Date(end.endTime),
      legs: it.legs.map(l => ({ mode: l.mode, name: isStreet(l) ? '' : lineName(l), color: isStreet(l) ? (l.mode === 'WALK' ? '#3B82C4' : '#16884F') : colorOf(l), pts: l.legGeometry?.points || '', prec: l.legGeometry?.precision || 6, start: +new Date(l.startTime), end: +new Date(l.endTime), from: l.from.name, to: l.to.name })) };
    const r = await fetch(PUSH + '/share/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: live.share.id, key: live.share.key, meta }) });
    if (!r.ok) { live.share = null; return toast(T('srvErr', r.status)); }
    followUpdate(true);
  }
  const link = baseUrl() + 'share.html#' + live.share.id, text = T('followMsg', dest.name, link);
  try { if (navigator.share) await navigator.share({ text }); else await copyText(text, T('copied')); } catch {}
  liveTick();
}
function followUpdate(force) {
  const sh = live?.share; if (!sh || (!force && Date.now() - sh.last < 20000)) return;
  sh.last = Date.now();
  fetch(PUSH + '/share/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: sh.id, key: sh.key, pos: st.acc != null ? st.loc : null, eta: +new Date(live.it.legs.at(-1).endTime), leg: live.i }) }).catch(() => {});
}
function followStop(arrived) {
  const sh = live?.share; if (!sh) return;
  fetch(PUSH + '/share/stop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: sh.id, key: sh.key, arrived: !!arrived, pos: st.acc != null ? st.loc : null }), keepalive: true }).catch(() => {});
}

/* ---------- istoric ---------- */
const polyKm = l => { const p = geom(l.legGeometry); let s = 0; for (let i = 1; i < p.length; i++) s += dist(p[i - 1], p[i]); return s / 1000 || (l.distance || 0) / 1000; };
function recordTrip() {
  if (!live || live.recorded) return;
  const mins2 = (Date.now() - live.startedAt) / 60000;
  if (mins2 < 3 || (live.i < live.it.legs.length - 1 && !live.done)) return;
  live.recorded = true;
  const it = live.it;
  const trip = { at: live.startedAt, dur: Math.round(mins2), from: st.from?.me ? T('myLoc') : (st.from?.name || it.legs[0].from.name), to: st.to?.name || it.legs.at(-1).to.name,
    legs: it.legs.map(l => ({ m: isStreet(l) ? (l.mode === 'WALK' ? 'walk' : rentKind(l)) : MK(l.mode), n: isStreet(l) ? '' : lineName(l), c: isStreet(l) ? '' : colorOf(l), km: +polyKm(l).toFixed(2) })) };
  store.set('trips', [trip, ...store.get('trips', [])].slice(0, 500));
}
function renderHist() {
  const all = store.get('trips', []), per = st.histPer || 'm0', now = new Date();
  const inPer = t => { const d = new Date(t.at); if (per === 'all') return true; const m = per === 'm0' ? now.getMonth() : (now.getMonth() + 11) % 12, y = per === 'm0' || now.getMonth() > 0 ? now.getFullYear() : now.getFullYear() - 1; return d.getMonth() === m && d.getFullYear() === y; };
  const list = all.filter(inPer);
  const km = { walk: 0, transit: 0 }, byM = {};
  list.forEach(t => t.legs.forEach(l => { if (l.m === 'walk') km.walk += l.km; else if (!['bike', 'scooter', 'car'].includes(l.m)) { km.transit += l.km; byM[l.m] = (byM[l.m] || 0) + l.km; } }));
  const totMin = list.reduce((s, t) => s + t.dur, 0), mx = Math.max(1, ...Object.values(byM));
  pane.innerHTML = hd(T('histT')) + `<div class="seg wide" id="hPer">${[['m0', T('thisMonth')], ['m1', T('lastMonth')], ['all', T('allTime')]].map(([v, t]) => `<button data-v="${v}" class="${per === v ? 'on' : ''}">${t}</button>`).join('')}</div>`
    + (list.length ? `<div class="stats"><div><b>${list.length}</b><small>${T('tripsN', list.length).replace(/^\d+\s/, '')}</small></div><div><b>${durS(totMin * 60)}</b><small>${T('timeOnTransit')}</small></div><div><b>${km.transit.toFixed(1)}</b><small>${T('kmTransit')}</small></div><div><b>${km.walk.toFixed(1)}</b><small>${T('kmWalk')}</small></div></div>
      <p class="muted" style="font-size:14px">${T('co2', (km.transit * 0.12).toFixed(1))}</p>
      <h3>${T('byMode')}</h3>${Object.entries(byM).sort((a, b) => b[1] - a[1]).map(([m, v]) => `<div class="bar2"><span>${I[m] || I.bus}${T('M_' + m)}</span><i style="width:${Math.max(4, v / mx * 100)}%;background:${MC[m] || '#1F6FB2'}"></i><b>${v.toFixed(1)} km</b></div>`).join('')}
      <h3>${T('recent')}</h3>${list.slice(0, 40).map(t => `<div class="row"><span class="ic">${I.route}</span><span class="tx"><div>${esc(t.to)}</div><small>${new Date(t.at).toLocaleDateString(LOC(), { day: 'numeric', month: 'short' })}, ${t.dur} min · ${t.legs.filter(l => l.n).map(l => esc(l.n)).join(' › ')}</small></span><button class="x" data-dt="${t.at}" aria-label="${T('delete')}">${I.close}</button></div>`).join('')}`
      : `<p class="muted">${T('histEmpty')}</p>`);
  pane.querySelectorAll('#hPer button').forEach(b => b.onclick = () => { st.histPer = b.dataset.v; renderHist(); });
  pane.querySelectorAll('[data-dt]').forEach(b => b.onclick = () => { store.set('trips', store.get('trips', []).filter(t => String(t.at) !== b.dataset.dt)); renderHist(); });
  pane.insertAdjacentHTML('beforeend', punctHtml());
}

/* ---------- linkuri Siri si deschidere directa ---------- */
const siriLink = p => `${baseUrl()}?to=${(+p.lat).toFixed(5)},${(+p.lon).toFixed(5)}&name=${encodeURIComponent(p.name)}`;
function handleUrl() {
  const q = new URLSearchParams(location.search);
  if (![...q.keys()].length) return;
  history.replaceState(null, '', location.pathname);
  const to = (q.get('to') || '').split(',').map(Number);
  if (to.length === 2 && to.every(Number.isFinite)) return routeTo({ name: q.get('name') || T('pointOnMap'), lat: to[0], lon: to[1] });
  if (q.get('go') === 'home' && O.home) return routeTo(O.home);
  if (q.get('go') === 'work' && O.work) return routeTo(O.work);
}

/* ---------- backup ---------- */
Object.assign(L10N.ro, {
  bkH: 'Backup', bkAuto: 'Backup automat criptat', bkLast: t => `ultimul backup: ${t}`, bkNever: 'inca nu s-a facut', bkCode: 'Cod de recuperare', bkCodeSub: 'Pastreaza-l intr-un loc sigur. Fara el, backup-ul nu poate fi citit.', bkShow: 'Arata codul', bkCopy: 'Copiaza codul',
  bkExport: 'Exporta in Fisiere', bkImport: 'Importa din fisier', bkRestore: 'Restaureaza cu cod', bkAsk: 'Introdu codul de recuperare', bkConfirm: 'Datele actuale din aplicatie vor fi inlocuite. Continui?',
  bkDone: 'Datele au fost restaurate.', bkBad: 'Codul nu este corect sau backup-ul nu exista.', bkBadFile: 'Fisierul nu este un backup Peron.', bkNow: 'Fa backup acum', bkOk: 'Backup facut.', bkSaved: 'Fisier creat.'
});
Object.assign(L10N.en, {
  bkH: 'Backup', bkAuto: 'Automatic encrypted backup', bkLast: t => `last backup: ${t}`, bkNever: 'not done yet', bkCode: 'Recovery code', bkCodeSub: 'Keep it somewhere safe. Without it, the backup cannot be read.', bkShow: 'Show code', bkCopy: 'Copy code',
  bkExport: 'Export to Files', bkImport: 'Import from file', bkRestore: 'Restore with code', bkAsk: 'Enter your recovery code', bkConfirm: 'Current app data will be replaced. Continue?',
  bkDone: 'Data restored.', bkBad: 'Wrong code or no backup found.', bkBadFile: 'This file is not a Peron backup.', bkNow: 'Back up now', bkOk: 'Backup done.', bkSaved: 'File created.'
});
const BK_KEYS = ['opts', 'favs', 'recent', 'places', 'fstops', 'deps', 'watch', 'trips'];
const B32 = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789';
const newCode = () => { const b = crypto.getRandomValues(new Uint8Array(24)); return [...b].map(x => B32[x & 31]).join('').match(/.{4}/g).join('-'); };
const normCode = c => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
const hexOf = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
async function bkKey(code) {
  const c = normCode(code), raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('peron-key:' + c));
  return { id: (await hexOf('peron-id:' + c)).slice(0, 40), key: await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']) };
}
const bkData = () => Object.fromEntries(BK_KEYS.map(k => [k, store.get(k, null)]).filter(([, v]) => v != null));
function bkApply(data) { BK_KEYS.forEach(k => { if (data[k] !== undefined) try { localStorage.setItem(k, JSON.stringify(data[k])); } catch {} }); }
const bkState = () => store.get('bk', null);
let bkT = null, bkBusy = false;
function bkSchedule() { if (!PUSH) return; clearTimeout(bkT); bkT = setTimeout(bkUpload, 8000); }
async function bkUpload(force) {
  if (!PUSH || bkBusy || (!navigator.onLine && !force)) return;
  bkBusy = true;
  try {
    let b = bkState();
    if (!b) { b = { code: newCode(), at: 0 }; store.set('bk', b); }
    const { id, key } = await bkKey(b.code), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(bkData()))));
    const all = new Uint8Array(iv.length + ct.length); all.set(iv); all.set(ct, iv.length);
    let bin = ''; for (let i = 0; i < all.length; i += 8192) bin += String.fromCharCode(...all.subarray(i, i + 8192));
    const r = await fetch(PUSH + '/backup/put', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, data: btoa(bin), v: Date.now() }) });
    if (!r.ok) throw new Error(T('srvErr', r.status));
    store.set('bk', { ...b, at: Date.now() });
    if (force) toast(T('bkOk'));
  } catch (e) { if (force) toast(e.message); }
  bkBusy = false;
}
async function bkRestore(code) {
  try {
    const { id, key } = await bkKey(code);
    const r = await fetch(`${PUSH}/backup?id=${id}`, { cache: 'no-store' });
    if (!r.ok) throw 0;
    const d = await r.json(), all = Uint8Array.from(atob(d.data), c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12))));
    if (!confirm(T('bkConfirm'))) return;
    bkApply(data);
    localStorage.setItem('bk', JSON.stringify({ code: normCode(code).match(/.{1,4}/g).join('-'), at: d.at }));
    toast(T('bkDone')); setTimeout(() => location.reload(), 800);
  } catch { toast(T('bkBad')); }
}
async function bkExport() {
  const json = JSON.stringify({ app: 'peron', v: 1, at: new Date().toISOString(), data: bkData() }, null, 1);
  const name = `peron-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  toast(T('bkSaved'));
}
function bkImport() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    try {
      const j = JSON.parse(await inp.files[0].text());
      if (j.app !== 'peron' || !j.data) throw 0;
      if (!confirm(T('bkConfirm'))) return;
      bkApply(j.data); toast(T('bkDone')); setTimeout(() => location.reload(), 800);
    } catch { toast(T('bkBadFile')); }
  };
  inp.click();
}
const _storeSet = store.set;
store.set = (k, v) => { _storeSet(k, v); if (BK_KEYS.includes(k)) bkSchedule(); };
function bkOptsHtml(opt) {
  const b = bkState(), last = b?.at ? new Date(b.at).toLocaleString(LOC(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : T('bkNever');
  return `<h3>${T('bkH')}</h3>
    ${PUSH ? opt(T('bkAuto'), T('bkLast', last), `<button class="btn ghost" id="bkNow">${T('bkNow')}</button>`) : ''}
    ${PUSH && b ? `<div class="opt"><span>${T('bkCode')}<small>${T('bkCodeSub')}</small><code id="bkCode" hidden class="bkcode">${b.code}</code></span><div style="display:flex;flex-direction:column;gap:6px"><button class="btn ghost" id="bkShow">${T('bkShow')}</button><button class="btn ghost" id="bkCopy">${T('bkCopy')}</button></div></div>` : ''}
    <div class="btns" style="flex-wrap:wrap"><button class="btn ghost" id="bkExp">${T('bkExport')}</button><button class="btn ghost" id="bkImp">${T('bkImport')}</button>${PUSH ? `<button class="btn ghost" id="bkRes" style="flex-basis:100%">${T('bkRestore')}</button>` : ''}</div>`;
}
function bkOptsBind() {
  $('#bkNow')?.addEventListener('click', () => bkUpload(true).then(renderOpts));
  $('#bkShow')?.addEventListener('click', () => { const c = $('#bkCode'); c.hidden = !c.hidden; });
  $('#bkCopy')?.addEventListener('click', () => copyText(bkState().code, T('copied')));
  $('#bkExp').onclick = bkExport;
  $('#bkImp').onclick = bkImport;
  $('#bkRes')?.addEventListener('click', () => { const c = prompt(T('bkAsk')); if (c && normCode(c).length >= 20) bkRestore(c); else if (c) toast(T('bkBad')); });
}

/* ---------- v9: afisare, punctualitate, alternative, bilete, liniile mele ---------- */
Object.assign(L10N.ro, {
  lookH: 'Afisare', themeO: 'Tema', thAuto: 'Auto', thLight: 'Luminoasa', thDark: 'Intunecata', fsO: 'Marime text', fsN: 'Normal', fsL: 'Mare', fsXL: 'Foarte mare', hcO: 'Contrast ridicat',
  punctH: 'Punctualitate pe liniile tale', punctEmpty: 'Apare dupa cateva calatorii live cu date in timp real.', avgDelay: d => d > 0 ? `in medie +${d} min` : d < 0 ? `in medie ${d} min` : 'in medie la timp', onTimePct: p => `${p}% la timp`,
  per_m: 'dimineata', per_d: 'ziua', per_e: 'seara', per_n: 'noaptea', worstAt: (p, d) => `${p} +${d} min`, samples: n => `${n} ${n === 1 ? 'calatorie' : 'calatorii'}`, bufferTxt: m => `+${m} min rezerva, din istoric`,
  altH: 'Alternativa mai rapida', altTxt: (l, d) => `${l} are +${d} min intarziere.`, altCancel: l => `${l} a fost anulat.`, altArr: (t, g) => `Ajungi la ${t}, cu ${g} min mai devreme.`, altUse: 'Schimba traseul', altIgnore: 'Raman pe traseu', altSwitched: 'Traseul a fost schimbat.',
  tickets: 'Bilete si informatii', ticketsSub: 'site-ul operatorului',
  nearMe: 'Cand vine langa mine', nearTitle: n => `Linia ${n} langa tine`, toward: s => `spre ${s}`, atStop: (s, d, m) => `${s}, ${d} (~${m} min pe jos)`, catchable: 'il prinzi', catchNext: m => `nu-l prinzi pe primul, il prinzi pe cel de peste ${m}`, tooLate: 'nu mai ajungi la niciunul', noDepLine: 'Nicio plecare curand din statia cea mai apropiata.',
  myLines: 'Liniile mele', addMyLine: 'Adauga la liniile mele', lineAdded: 'Linie adaugata pe ecranul principal.', lineRemoved: 'Linie scoasa de pe ecranul principal.', needLocLine: 'Pentru asta e nevoie de locatia ta.'
});
Object.assign(L10N.en, {
  lookH: 'Display', themeO: 'Theme', thAuto: 'Auto', thLight: 'Light', thDark: 'Dark', fsO: 'Text size', fsN: 'Normal', fsL: 'Large', fsXL: 'Extra large', hcO: 'High contrast',
  punctH: 'Punctuality on your lines', punctEmpty: 'Shows up after a few live trips with real-time data.', avgDelay: d => d > 0 ? `on average +${d} min` : d < 0 ? `on average ${d} min` : 'on average on time', onTimePct: p => `${p}% on time`,
  per_m: 'mornings', per_d: 'daytime', per_e: 'evenings', per_n: 'nights', worstAt: (p, d) => `${p} +${d} min`, samples: n => `${n} ${n === 1 ? 'trip' : 'trips'}`, bufferTxt: m => `+${m} min buffer, from history`,
  altH: 'Faster alternative', altTxt: (l, d) => `${l} is ${d} min late.`, altCancel: l => `${l} was cancelled.`, altArr: (t, g) => `Arrive at ${t}, ${g} min earlier.`, altUse: 'Switch trip', altIgnore: 'Keep my trip', altSwitched: 'Trip switched.',
  tickets: 'Tickets and info', ticketsSub: 'operator website',
  nearMe: 'When does it come near me', nearTitle: n => `Line ${n} near you`, toward: s => `to ${s}`, atStop: (s, d, m) => `${s}, ${d} (~${m} min walk)`, catchable: 'you can make it', catchNext: m => `you will miss the first one, you can make the one in ${m}`, tooLate: 'you cannot make any of them', noDepLine: 'No departures soon from the nearest stop.',
  myLines: 'My lines', addMyLine: 'Add to my lines', lineAdded: 'Line added to the home screen.', lineRemoved: 'Line removed from the home screen.', needLocLine: 'This needs your location.'
});
I.ticket = sv('<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>');
I.zap = sv('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>');
BK_KEYS.push('punct', 'mylines');

function applyLook() {
  const r = document.documentElement;
  if (O.theme === 'auto') r.removeAttribute('data-theme'); else r.dataset.theme = O.theme;
  r.classList.toggle('hc', !!O.hc);
  r.classList.toggle('fs-l', O.fs === 'l'); r.classList.toggle('fs-xl', O.fs === 'xl');
}
function lookOptsHtml(opt, seg, tg) {
  return `<h3>${T('lookH')}</h3>${opt(T('themeO'), '', seg('theme', [['auto', T('thAuto')], ['light', T('thLight')], ['dark', T('thDark')]]))}
    ${opt(T('fsO'), '', seg('fs', [['n', T('fsN')], ['l', T('fsL')], ['xl', T('fsXL')]]))}${opt(T('hcO'), '', tg('hc'))}`;
}

/* punctualitate */
const perOf = h => h >= 5 && h < 10 ? 'm' : h >= 10 && h < 16 ? 'd' : h >= 16 && h < 21 ? 'e' : 'n';
function recordPunct(l) {
  if (!l || isStreet(l) || !l.realTime || l._punct) return;
  l._punct = true;
  const e = { at: Date.now(), line: lineName(l), mode: MK(l.mode), c: colorOf(l), tc: textOf(l), h: new Date(l.scheduledStartTime || l.startTime).getHours(), d0: delayM(l.startTime, l.scheduledStartTime), d1: delayM(l.endTime, l.scheduledEndTime), to: st.to?.name || '' };
  store.set('punct', [e, ...store.get('punct', [])].slice(0, 1000));
}
function punctStats() {
  const by = {};
  store.get('punct', []).forEach(e => { (by[e.line + '|' + e.mode] = by[e.line + '|' + e.mode] || []).push(e); });
  return Object.values(by).filter(a => a.length >= 2).map(a => {
    const avg = Math.round(a.reduce((s, e) => s + e.d1, 0) / a.length), ok = Math.round(a.filter(e => e.d1 <= 1).length / a.length * 100);
    const pers = {}; a.forEach(e => (pers[perOf(e.h)] = pers[perOf(e.h)] || []).push(e.d1));
    const worst = Object.entries(pers).filter(([, v]) => v.length >= 2).map(([p, v]) => [p, Math.round(v.reduce((s, x) => s + x, 0) / v.length)]).sort((x, y) => y[1] - x[1])[0];
    return { e: a[0], n: a.length, avg, ok, worst: worst && worst[1] > avg && worst[1] > 0 ? worst : null };
  }).sort((x, y) => y.n - x.n);
}
function punctHtml() {
  const s = punctStats();
  return `<h3>${T('punctH')}</h3>` + (s.length ? s.slice(0, 12).map(x => `<div class="row"><span>${badge({ mode: x.e.mode === 'metro' ? 'SUBWAY' : x.e.mode === 'train' ? 'RAIL' : x.e.mode.toUpperCase(), routeShortName: x.e.line, routeColor: x.e.c, routeTextColor: x.e.tc })}</span><span class="tx"><div class="${x.avg >= 3 ? 'late' : ''}">${T('avgDelay', x.avg)}, ${T('onTimePct', x.ok)}</div><small>${T('samples', x.n)}${x.worst ? ' &middot; ' + T('worstAt', T('per_' + x.worst[0]), x.worst[1]) : ''}</small></span></div>`).join('') : `<p class="muted" style="font-size:14px">${T('punctEmpty')}</p>`);
}
function bufferFor(dep) {
  const a = store.get('punct', []).filter(e => e.to && e.to === dep.to?.name);
  if (a.length < 2) return 0;
  return Math.min(10, Math.max(0, Math.round(a.reduce((s, e) => s + e.d1, 0) / a.length)));
}

/* alternativa la intarziere */
async function checkAlt() {
  if (!live || live.altBusy || live.done) return;
  const legs = live.it.legs, l = legs[live.i];
  const nt = !isStreet(l) && live.idx === 0 && Date.now() < new Date(l.startTime).getTime() + 60000 ? l : isStreet(l) && legs[live.i + 1] && !isStreet(legs[live.i + 1]) ? legs[live.i + 1] : null;
  if (!nt) return;
  const late = delayM(nt.startTime, nt.scheduledStartTime), canc = nt.cancelled || nt.tripCancelled;
  if (late < 5 && !canc) return;
  if (Date.now() - (live.altAt || 0) < 180000) return;
  live.altAt = Date.now(); live.altBusy = true;
  try {
    const from = st.acc != null ? { lat: st.loc[0], lon: st.loc[1] } : (isStreet(l) ? l.from : nt.from), dest = legs.at(-1).to;
    const p = { fromPlace: `${from.lat},${from.lon}`, toPlace: `${dest.lat},${dest.lon}`, detailedTransfers: true, language: O.lang, maxPreTransitTime: O.walk * 60, maxPostTransitTime: O.walk * 60 };
    const d = await api('/v6/plan', p, 60000);
    const curEnd = new Date(legs.at(-1).endTime).getTime();
    const best = (d.itineraries || []).filter(it => it.legs.some(x => !isStreet(x)) && !it.legs.some(x => x.tripId && x.tripId === nt.tripId)).sort((a, b) => new Date(a.endTime) - new Date(b.endTime))[0];
    const gain = best ? Math.round((curEnd - new Date(best.endTime).getTime()) / 60000) : 0;
    live.alt = best && (gain >= 3 || canc) ? { it: best, gain, line: lineName(nt), late, canc } : null;
  } catch {}
  if (live) { live.altBusy = false; liveTick(); }
}
function altHtml() {
  const a = live?.alt; if (!a || live.altDismissed === a.it) return '';
  const e = a.it.legs.at(-1);
  return `<div class="altc">${I.zap}<div><b>${T('altH')}</b><div>${esc(a.canc ? T('altCancel', a.line) : T('altTxt', a.line, a.late))} ${T('altArr', fmt(e.endTime, e.to.tz), Math.max(a.gain, 0))}</div>
    <div class="legs" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:8px 0">${legsStrip(a.it.legs)}</div>
    <div class="btns"><button class="btn" id="altUse">${T('altUse')}</button><button class="btn ghost" id="altNo">${T('altIgnore')}</button></div></div></div>`;
}
function altBind() {
  $('#altUse')?.addEventListener('click', () => {
    const it = live.alt.it;
    Object.assign(live, { it, i: 0, idx: 0, alerted: {}, alt: null, done: false, endDone: false });
    st.cur = it; drawRoute(it, 0);
    if (PUSH) pushSchedule('live', liveAlerts(it)).catch(() => {});
    toast(T('altSwitched')); liveTick();
  });
  $('#altNo')?.addEventListener('click', () => { live.altDismissed = live.alt.it; liveTick(); });
}

/* bilete */
function ticketsHtml(it) {
  const seen = new Map();
  it.legs.forEach(l => { if (!isStreet(l) && l.agencyUrl && !seen.has(l.agencyUrl)) seen.set(l.agencyUrl, l.agencyName || new URL(l.agencyUrl).hostname); });
  if (!seen.size) return '';
  return `<div class="tix">${I.ticket}<span>${T('tickets')}: ${[...seen].map(([u, n]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join(', ')}</span></div>`;
}

/* liniile mele, langa mine */
const myLines = () => store.get('mylines', []);
const lineKey = g => g.routeShortName + '|' + g.mode;
async function lineNear(g) {
  if (!st.loc) throw new Error(T('needLocLine'));
  const out = [];
  for (const d of g.dirs.slice(0, 2)) {
    try {
      const resp = await api('/experimental/map/route-details', { routeIdx: d.idx, language: O.lang }, 3600000);
      const r = (resp.routes || [])[0]; if (!r) continue;
      const stops = routeStops(resp, r).slice(0, -1);
      if (!stops.length) continue;
      const near = stops.map(s => ({ s, d: dist(st.loc, ll(s)) })).sort((a, b) => a.d - b.d)[0];
      const walkMin = Math.max(1, Math.round(near.d / (O.speed === 'slow' ? 60 : O.speed === 'fast' ? 95 : 75)));
      const res = await api('/v6/stoptimes', { stopId: near.s.stopId, n: 40, language: O.lang }, 25000).catch(() => ttFallback(near.s.stopId));
      const all = (res.stopTimes || []).filter(x => lineName(x) === g.routeShortName && (x.place.departure || x.place.scheduledDeparture) && depT(x) > Date.now() - 30000);
      const m = all.filter(x => x.headsign === d.last || (x.tripTo?.name || '') === d.last);
      const deps = (m.length ? m : all).sort((a, b) => depT(a) - depT(b)).slice(0, 4);
      out.push({ dir: d, stop: near.s, dist: near.d, walkMin, deps });
    } catch {}
  }
  return out;
}
function nearCard(x, compact) {
  const now = Date.now(), firstOk = x.deps.findIndex(s => (depT(s) - now) / 60000 >= x.walkMin);
  const times = x.deps.map((s, i) => { const t = s.place.departure || s.place.scheduledDeparture, m = Math.round((depT(s) - now) / 60000); return `<span class="${i === firstOk ? 'ok' : i < firstOk || firstOk < 0 ? 'miss' : ''}">${m <= 0 ? T('now') : m < 60 ? m + ' min' : fmt(t, s.place.tz)}${s.realTime ? '<i class="live"></i>' : ''}</span>`; }).join('');
  if (compact) return `<div class="nl"><small>${esc(T('toward', x.dir.last))}</small><div class="nlt">${times || `<span class="miss">-</span>`}</div></div>`;
  return `<div class="nc"><div class="nch"><b>${esc(T('toward', x.dir.last))}</b><small>${esc(T('atStop', x.stop.name, meters(x.dist), x.walkMin))}</small></div>
    ${x.deps.length ? `<div class="nlt big">${times}</div><small class="${firstOk === 0 ? 'okc' : 'late'}">${firstOk === 0 ? T('catchable') : firstOk > 0 ? T('catchNext', Math.round((depT(x.deps[firstOk]) - now) / 60000) + ' min') : T('tooLate')}</small>` : `<p class="muted" style="font-size:14px">${T('noDepLine')}</p>`}</div>`;
}
async function renderLineNear(g) {
  const isMine = myLines().some(x => lineKey(x) === lineKey(g));
  pane.innerHTML = hd(`${badge(g)} ${esc(T('nearTitle', g.routeShortName))}`, `<button class="icb fav ${isMine ? 'on' : ''}" id="myl" aria-label="${T('addMyLine')}">${I.star}</button>`) + `<div id="nearBody"><div class="skel"></div></div>`;
  $('#myl').onclick = () => {
    let l = myLines();
    const on = l.some(x => lineKey(x) === lineKey(g));
    l = on ? l.filter(x => lineKey(x) !== lineKey(g)) : [...l, { routeShortName: g.routeShortName, routeColor: g.routeColor, routeTextColor: g.routeTextColor, mode: g.mode, longName: g.longName, dirs: g.dirs }].slice(-6);
    store.set('mylines', l); $('#myl').classList.toggle('on', !on); toast(on ? T('lineRemoved') : T('lineAdded'));
  };
  vehFocus = sg => sg.name === g.routeShortName;
  const load = async () => {
    try {
      await needLoc();
      const res = await lineNear(g);
      if (view !== 'near') return;
      routeL.clearLayers();
      res.forEach(x => endMark(x.stop, colorOf(g)));
      if (res.length) fitTo(L.latLngBounds([st.loc, ...res.map(x => ll(x.stop))]));
      $('#nearBody').innerHTML = res.length ? res.map(x => nearCard(x)).join('') : `<p class="muted">${T('noDepLine')}</p>`;
    } catch (e) { const b = $('#nearBody'); if (b) b.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  load();
  clearInterval(paneTimer); paneTimer = setInterval(() => view === 'near' && load(), 30000);
}
async function loadMyLines() {
  const el = $('#myLines'); if (!el || !st.loc) return;
  const ls = myLines().slice(0, 4);
  const res = await Promise.all(ls.map(g => lineNear(g).catch(() => [])));
  if (!$('#myLines') || view !== 'home') return;
  el.innerHTML = ls.map((g, i) => `<button class="fs ml" data-ml="${i}"><div class="fsh"><span>${badge(g)}</span>${res[i][0] ? `<small class="muted">${esc(res[i][0].stop.name)}</small>` : ''}${I.chev}</div>${res[i].map(x => nearCard(x, true)).join('')}</button>`).join('');
  el.querySelectorAll('[data-ml]').forEach(b => b.onclick = () => { const g = ls[b.dataset.ml]; st.line = g; nav('near', () => renderLineNear(g)); });
}

/* ---------- v10: oras curent, orase vizitate, harta retelei ---------- */
Object.assign(L10N.ro, {
  youAreIn: 'Te afli in', locating: 'Caut orasul...', citiesT: 'Orasele mele', citiesN: n => `${n} ${n === 1 ? 'oras' : 'orase'}`, countriesN: n => `${n} ${n === 1 ? 'tara' : 'tari'}`,
  firstVisit: d => `prima vizita ${d}`, daysN: n => `${n} ${n === 1 ? 'zi' : 'zile'}`, noCities: 'Orasele apar aici pe masura ce folosesti aplicatia.',
  autoH: 'Inregistrare automata', autoInfo: 'Aplicatiile web nu pot afla locatia cand sunt inchise. Cu o automatizare in aplicatia Scurtaturi, iPhone-ul trimite singur locatia de cateva ori pe zi, iar orasele se adauga chiar daca nu deschizi Peron.',
  autoSteps: '1. Scurtaturi > Automatizare > + > Ora din zi (de exemplu 10:00, zilnic) > Ruleaza imediat.<br>2. Adauga actiunea Obtine locatia curenta.<br>3. Adauga actiunea Obtine continutul URL-ului: lipeste linkul de mai jos, Metoda POST, Corp cerere JSON, campurile lat = Locatia curenta > Latitudine si lon = Locatia curenta > Longitudine.<br>4. Repeta pentru 2-3 ore pe zi, de exemplu 10:00, 15:00 si 21:00.',
  autoLink: 'Copiaza linkul pentru Scurtaturi', autoNote: 'Linkul e personal. Nu-l trimite nimanui.',
  netT: 'Harta retelei', netSub: c => `Linii de transport in ${c}`, netLoading: 'Descarc reteaua orasului...', netSaved: d => `salvata pe telefon ${d}, merge si fara internet`, netPng: 'Salveaza ca imagine', netRefresh: 'Actualizeaza', netDel: 'Sterge de pe telefon', netOfficial: 'Cauta harta oficiala',
  netOther: 'Alte orase descarcate', netNone: 'Nu am gasit linii de transport in zona.', netNeedCity: 'Pentru harta retelei e nevoie de locatia ta.', netDeleted: 'Harta a fost stearsa.', netLines: 'Linii',
  M_rail: 'Tren'
});
Object.assign(L10N.en, {
  youAreIn: 'You are in', locating: 'Finding your city...', citiesT: 'My cities', citiesN: n => `${n} ${n === 1 ? 'city' : 'cities'}`, countriesN: n => `${n} ${n === 1 ? 'country' : 'countries'}`,
  firstVisit: d => `first visit ${d}`, daysN: n => `${n} ${n === 1 ? 'day' : 'days'}`, noCities: 'Cities appear here as you use the app.',
  autoH: 'Automatic tracking', autoInfo: 'Web apps cannot read your location while closed. With an automation in the Shortcuts app, your iPhone sends its location a few times a day, so cities are added even if you do not open Peron.',
  autoSteps: '1. Shortcuts > Automation > + > Time of Day (for example 10:00, daily) > Run Immediately.<br>2. Add the action Get Current Location.<br>3. Add the action Get Contents of URL: paste the link below, Method POST, Request Body JSON, fields lat = Current Location > Latitude and lon = Current Location > Longitude.<br>4. Repeat for 2-3 times a day, for example 10:00, 15:00 and 21:00.',
  autoLink: 'Copy link for Shortcuts', autoNote: 'The link is personal. Do not share it.',
  netT: 'Network map', netSub: c => `Transit lines in ${c}`, netLoading: 'Downloading the city network...', netSaved: d => `saved on the phone ${d}, works offline`, netPng: 'Save as image', netRefresh: 'Update', netDel: 'Delete from phone', netOfficial: 'Find the official map',
  netOther: 'Other downloaded cities', netNone: 'No transit lines found in this area.', netNeedCity: 'The network map needs your location.', netDeleted: 'Map deleted.', netLines: 'Lines',
  M_rail: 'Train'
});
I.netmap = sv('<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6 8l5 8M18 8l-5 8"/>');
I.globe = sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>');
BK_KEYS.push('cities', 'vtoken');

const idb = (() => {
  let p;
  const db = () => p || (p = new Promise((ok, no) => { const r = indexedDB.open('peron', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((ok, no) => { const t = d.transaction('kv', mode); const q = fn(t.objectStore('kv')); t.oncomplete = () => ok(q?.result); t.onerror = () => no(t.error); }); };
  return { get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)), del: k => tx('readwrite', s => s.delete(k)), keys: () => tx('readonly', s => s.getAllKeys()) };
})();

/* oras curent si orase vizitate */
const SUBAREA = /sector|district|dzielnica|arrondissement|bezirk|borough|quartier|\d/i;
async function cityAt(lat, lon) {
  const g = await api('/v1/reverse-geocode', { place: `${lat.toFixed(3)},${lon.toFixed(3)}`, numResults: 1, language: O.lang }, 86400000);
  const areas = g[0]?.areas || [];
  const c = areas.filter(a => a.adminLevel >= 4 && a.adminLevel <= 8 && !SUBAREA.test(a.name)).sort((a, b) => b.adminLevel - a.adminLevel)[0];
  const co = areas.find(a => a.adminLevel === 2);
  return c ? { city: c.name, country: co?.name || '' } : null;
}
const localDay = t => new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
async function trackCity(lat, lon, at = Date.now()) {
  const c = await cityAt(lat, lon).catch(() => null); if (!c) return null;
  const k = c.city + '|' + c.country, all = store.get('cities', {}), day = localDay(at);
  const e = all[k] || { city: c.city, country: c.country, lat: +lat.toFixed(3), lon: +lon.toFixed(3), first: at, last: at, days: [] };
  e.first = Math.min(e.first, at); e.last = Math.max(e.last, at);
  if (!e.days.includes(day)) e.days = [...e.days, day].slice(-500);
  all[k] = e; store.set('cities', all);
  return c;
}
let cityAtPos = null;
async function updateCity(force) {
  if (!st.loc || (!force && cityAtPos && dist(cityAtPos, st.loc) < 2000)) return;
  cityAtPos = st.loc.slice();
  const c = await trackCity(st.loc[0], st.loc[1]);
  if (c) { st.city = c; renderCityRow(); }
}
function renderCityRow() {
  const el = $('#cityRow'); if (!el) return;
  el.innerHTML = `${I.pin}<span>${T('youAreIn')}: <b>${st.city ? esc(st.city.city) : T('locating')}</b>${st.city?.country ? `, ${esc(st.city.country)}` : ''}</span>${I.chev}`;
}
const vToken = () => { let t = store.get('vtoken', null); if (!t) { t = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''); store.set('vtoken', t); } return t; };
async function syncVisits() {
  if (!PUSH || !navigator.onLine) return;
  try {
    const since = store.get('vsince', 0);
    const list = await (await fetch(`${PUSH}/visits?t=${vToken()}&since=${since}`, { cache: 'no-store' })).json();
    if (!Array.isArray(list) || !list.length) return;
    const seen = new Set();
    for (const v of list) {
      const k = `${Math.round(v.lat * 20)},${Math.round(v.lon * 20)},${localDay(v.at)}`;
      if (seen.has(k)) continue; seen.add(k);
      if (seen.size > 40) break;
      await trackCity(v.lat, v.lon, v.at);
    }
    store.set('vsince', Math.max(...list.map(v => v.at)));
  } catch {}
}
function renderCities() {
  const all = Object.values(store.get('cities', {})).sort((a, b) => b.last - a.last);
  const countries = new Set(all.map(c => c.country).filter(Boolean));
  routeL.clearLayers();
  all.forEach(c => L.circleMarker([c.lat, c.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#C9362B', fillOpacity: 1 }).bindTooltip(esc(c.city)).addTo(routeL));
  if (all.length) setTimeout(() => fitTo(routeL.getBounds()), 50);
  const dfmt = t => new Date(t).toLocaleDateString(LOC(), { day: 'numeric', month: 'short', year: 'numeric' });
  const link = PUSH ? `${PUSH}/visit?t=${vToken()}` : '';
  pane.innerHTML = hd(T('citiesT')) + `<div class="stats"><div><b>${all.length}</b><small>${T('citiesN', all.length).replace(/^\d+\s/, '')}</small></div><div><b>${countries.size}</b><small>${T('countriesN', countries.size).replace(/^\d+\s/, '')}</small></div></div>`
    + (all.length ? [...new Set(all.map(c => c.country))].map(co => `<h3>${esc(co || '?')}</h3>` + all.filter(c => c.country === co).map(c => `<div class="row"><span class="ic">${I.pin}</span><span class="tx"><div>${esc(c.city)}</div><small>${T('firstVisit', dfmt(c.first))} &middot; ${T('daysN', c.days.length)}</small></span></div>`).join('')).join('') : `<p class="muted">${T('noCities')}</p>`)
    + (PUSH ? `<h3>${T('autoH')}</h3><p class="muted" style="font-size:14px">${T('autoInfo')}</p><p style="font-size:14px;line-height:1.6">${T('autoSteps')}</p>
      <button class="btn" id="vLink" style="width:100%">${T('autoLink')}</button><p class="muted" style="font-size:12px">${T('autoNote')}</p>` : '');
  $('#vLink')?.addEventListener('click', () => copyText(link, T('linkCopied')));
}

/* harta retelei */
const NETM = { metro: 'metro', train: 'train', tram: 'tram', bus: 'bus' };
const netMode = m => { const k = MK(m); return k === 'ferry' || k === 'cable' ? 'tram' : k; };
async function netFetch() {
  const [la, lo] = st.loc, d = .11, box = [la - d, lo - d * 1.6, la + d, lo + d * 1.6];
  const polys = [], pIdx = new Map(), routes = new Map(), keepStops = new Map(), stopRoutes = {};
  const get = async (b, depth) => {
    const resp = await api('/experimental/map/routes', { zoom: 16, min: `${b[0]},${b[1]}`, max: `${b[2]},${b[3]}`, language: O.lang }, 600000);
    if (resp.zoomFiltered && depth < 2) {
      const mla = (b[0] + b[2]) / 2, mlo = (b[1] + b[3]) / 2;
      for (const q of [[b[0], b[1], mla, mlo], [b[0], mlo, mla, b[3]], [mla, b[1], b[2], mlo], [mla, mlo, b[2], b[3]]]) await get(q, depth + 1);
      return;
    }
    const map2 = (resp.polylines || []).map(p => { const k = p.polyline.points; if (!pIdx.has(k)) { pIdx.set(k, polys.length); polys.push([k, p.polyline.precision]); } return pIdx.get(k); });
    (resp.routes || []).forEach(r => {
      const m = netMode(r.mode), tr = (r.transitRoutes || [])[0] || {}, key = r.routeIdx ?? (m + tr.shortName + JSON.stringify(r.segments?.[0]));
      const cur = routes.get(key) || { m, n: tr.shortName || '', c: hex(tr.color) || MC[m], segs: [] };
      (r.segments || []).forEach(sg => { const gi = map2[sg.polyline]; if (gi != null && !cur.segs.includes(gi)) cur.segs.push(gi); });
      routes.set(key, cur);
      if (m === 'metro' || m === 'train') (r.segments || []).forEach(sg => [sg.from, sg.to].forEach(i => {
        const p = resp.stops?.[i]; if (!p) return;
        if (!keepStops.has(p.name)) keepStops.set(p.name, { n: p.name, lat: p.lat, lon: p.lon, m });
        (stopRoutes[p.name] = stopRoutes[p.name] || new Set()).add(key);
      }));
    });
  };
  await get(box, 0);
  const inBox = (a, b) => a >= box[0] && a <= box[2] && b >= box[1] && b <= box[3];
  const stops = [...keepStops.values()].filter(s => inBox(s.lat, s.lon)).map(s => ({ ...s, w: stopRoutes[s.n]?.size || 1 }));
  return { v: 2, city: st.city?.city || '', country: st.city?.country || '', at: Date.now(), center: st.loc.slice(), box, polys, routes: [...routes.values()], stops };
}
function clipSeg(p, q, box) {
  let t0 = 0, t1 = 1;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  for (const [pp, qq] of [[-dx, p[0] - box[0]], [dx, box[2] - p[0]], [-dy, p[1] - box[1]], [dy, box[3] - p[1]]]) {
    if (pp === 0) { if (qq < 0) return null; continue; }
    const r = qq / pp;
    if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy], t0 > 0, t1 < 1];
}
function clipRuns(pts, box) {
  const runs = []; let cur = [];
  for (let i = 1; i < pts.length; i++) {
    const c = clipSeg(pts[i - 1], pts[i], box);
    if (!c) { if (cur.length > 1) runs.push(cur); cur = []; continue; }
    if (!cur.length || c[2]) { if (cur.length > 1) runs.push(cur); cur = [c[0]]; }
    cur.push(c[1]);
    if (c[3]) { runs.push(cur); cur = []; }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}
const netBox = data => data.box && data.box[0] > -90 ? data.box : data.center ? [data.center[0] - .11, data.center[1] - .176, data.center[0] + .11, data.center[1] + .176] : [-90, -180, 90, 180];
function netLines(data, on) {
  const out = [], drawn = new Set();
  ['bus', 'tram', 'train', 'metro'].filter(m => on.has(m)).forEach(m => data.routes.filter(r => r.m === m).forEach(r => r.segs.forEach(i => {
    if (drawn.has(m + i) || !data.polys[i]) return; drawn.add(m + i);
    clipRuns(decode(data.polys[i][0], data.polys[i][1]), netBox(data)).forEach(p => out.push({ m, c: r.c, p }));
  })));
  return out;
}
let netCur = null;
async function renderNet(key) {
  pane.innerHTML = hd(T('netT')) + `<div id="netBody"><p class="muted">${T('netLoading')}</p><div class="skel"></div></div>`;
  try {
    if (!key) { await needLoc(); if (!st.city) await updateCity(true); if (!st.city) throw new Error(T('netNeedCity')); key = 'net:' + st.city.city + '|' + st.city.country; }
    let data = await idb.get(key).catch(() => null);
    if (data && data.v !== 2 && st.loc && st.city && key === 'net:' + st.city.city + '|' + st.city.country) data = null;
    if (!data) { data = await netFetch(); if (data.routes.length) await idb.set(key, data).catch(() => {}); }
    if (view !== 'net') return;
    netCur = { key, data, modes: st.netModes || null };
    drawNet();
  } catch (e) { const b = $('#netBody'); if (b) b.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}
function drawNet() {
  const { data, key } = netCur;
  if (!data.routes.length) { $('#netBody').innerHTML = `<p class="muted">${T('netNone')}</p>`; return; }
  const counts = {}; data.routes.forEach(r => counts[r.m] = (counts[r.m] || 0) + 1);
  const avail = ['metro', 'train', 'tram', 'bus'].filter(m => counts[m]);
  if (!netCur.modes) netCur.modes = avail.filter(m => m !== 'bus').length ? avail.filter(m => m !== 'bus') : avail;
  const on = new Set(netCur.modes);
  routeL.clearLayers(); stopsL.clearLayers();
  const W = { metro: 7, train: 5, tram: 4, bus: 2.5 };
  netLines(data, on).forEach(l => L.polyline(l.p, { color: l.c, weight: W[l.m], opacity: l.m === 'bus' ? .65 : .95, interactive: false }).addTo(routeL));
  const bx = netBox(data);
  data.stops.filter(s => on.has(s.m) && s.lat >= bx[0] && s.lat <= bx[2] && s.lon >= bx[1] && s.lon <= bx[3]).forEach(s => L.circleMarker([s.lat, s.lon], { radius: 4, color: '#14213D', weight: 2, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(esc(s.n), { direction: 'top' }).addTo(routeL));
  if (routeL.getLayers().length) fitTo(routeL.getBounds());
  const lines = [...new Map(data.routes.filter(r => on.has(r.m) && r.n).map(r => [r.m + r.n, r])).values()].sort((a, b) => ['metro', 'train', 'tram', 'bus'].indexOf(a.m) - ['metro', 'train', 'tram', 'bus'].indexOf(b.m) || a.n.localeCompare(b.n, undefined, { numeric: true }));
  const when = new Date(data.at).toLocaleDateString(LOC(), { day: 'numeric', month: 'short' });
  const q = encodeURIComponent(`${data.city} ${O.lang === 'en' ? 'public transport map pdf' : 'harta transport public pdf'}`);
  $('#netBody').innerHTML = `<div class="muted" style="font-size:14px;margin:-6px 0 8px">${esc(T('netSub', data.city))}<br><small>${T('netSaved', when)}</small></div>
    <div class="chk">${avail.map(m => `<button data-nm="${m}" class="${on.has(m) ? 'on' : ''}">${I[m] || I.bus}${T('M_' + m)} <small class="muted">${counts[m]}</small></button>`).join('')}</div>
    <div class="btns" style="flex-wrap:wrap"><button class="btn" id="netPng">${T('netPng')}</button><a class="btn ghost" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener" style="text-decoration:none;text-align:center">${T('netOfficial')}</a></div>
    <h3>${T('netLines')}</h3><div class="netl">${lines.slice(0, 300).map((r, i) => `<button data-nl="${esc(r.n)}">${badge({ mode: { metro: 'SUBWAY', train: 'RAIL', tram: 'TRAM', bus: 'BUS' }[r.m], routeShortName: r.n, routeColor: r.c.replace('#', '') })}</button>`).join('')}</div>
    <div class="btns"><button class="btn ghost" id="netRef">${T('netRefresh')}</button><button class="btn ghost" id="netDel">${T('netDel')}</button></div>
    <div id="netOther"></div>`;
  $('#netBody').querySelectorAll('[data-nm]').forEach(b => b.onclick = () => { const m = b.dataset.nm; netCur.modes = on.has(m) ? netCur.modes.filter(x => x !== m) : [...netCur.modes, m]; if (!netCur.modes.length) netCur.modes = [m]; st.netModes = netCur.modes; drawNet(); });
  $('#netBody').querySelectorAll('[data-nl]').forEach(b => b.onclick = async () => { try { const g = (await findLines(b.dataset.nl))[0]; if (g) openLine(g); } catch {} });
  $('#netPng').onclick = () => netPng(data, on);
  $('#netRef').onclick = async () => { $('#netBody').innerHTML = `<p class="muted">${T('netLoading')}</p>`; try { const d = await netFetch(); await idb.set(key, d); netCur.data = d; drawNet(); } catch (e) { toast(e.message); drawNet(); } };
  $('#netDel').onclick = async () => { await idb.del(key).catch(() => {}); toast(T('netDeleted')); back(); };
  idb.keys().then(ks => {
    const other = (ks || []).filter(k => String(k).startsWith('net:') && k !== key);
    const el = $('#netOther'); if (!el || !other.length) return;
    el.innerHTML = `<h3>${T('netOther')}</h3>` + other.map(k => `<button class="row" data-ok="${esc(k)}"><span class="ic">${I.netmap}</span><span class="tx"><div>${esc(String(k).slice(4).replace('|', ', '))}</div></span>${I.chev}</button>`).join('');
    el.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => { st.netModes = null; renderNet(b.dataset.ok); });
  }).catch(() => {});
}
async function netPng(data, on) {
  const W = { metro: 10, train: 7, tram: 5, bus: 3 }, lines = netLines(data, on);
  if (!lines.length) return;
  const my = la => Math.log(Math.tan(Math.PI / 4 + la * Math.PI / 360));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  lines.forEach(l => l.p.forEach(([la, lo]) => { x0 = Math.min(x0, lo); x1 = Math.max(x1, lo); y0 = Math.min(y0, my(la)); y1 = Math.max(y1, my(la)); }));
  const sx = (x1 - x0) * Math.PI / 180, sy = y1 - y0, S = 2800, pad = 120;
  const w = sx >= sy ? S : Math.round(S * sx / sy), h = sx >= sy ? Math.round(S * sy / sx) : S;
  const ox = Math.max(0, 1500 - w) / 2, cv = document.createElement('canvas'); cv.width = w + pad * 2 + ox * 2; cv.height = h + pad * 2 + 80;
  const g = cv.getContext('2d'), X = lo => pad + ox + (lo - x0) / (x1 - x0 || 1) * w, Y = la => pad + (y1 - my(la)) / (sy || 1) * h;
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, cv.width, cv.height); g.lineCap = 'round'; g.lineJoin = 'round';
  ['bus', 'tram', 'train', 'metro'].forEach(m => lines.filter(l => l.m === m).forEach(l => { g.strokeStyle = l.c; g.globalAlpha = m === 'bus' ? .55 : 1; g.lineWidth = W[m]; g.beginPath(); l.p.forEach(([la, lo], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.stroke(); }));
  g.globalAlpha = 1;
  const stops = data.stops.filter(s => on.has(s.m) && X(s.lon) >= pad + ox - 5 && X(s.lon) <= pad + ox + w + 5 && Y(s.lat) >= pad - 5 && Y(s.lat) <= pad + h + 5).sort((a, b) => (b.m === 'metro') - (a.m === 'metro') || b.w - a.w);
  const boxes = stops.map(s => [X(s.lon) - 10, Y(s.lat) - 10, X(s.lon) + 10, Y(s.lat) + 10]);
  const hit = (b, list) => list.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  stops.forEach(s => { g.fillStyle = '#fff'; g.strokeStyle = '#14213D'; g.lineWidth = s.w > 1 ? 5 : 4; g.beginPath(); g.arc(X(s.lon), Y(s.lat), s.w > 1 ? 11 : 8, 0, 7); g.fill(); g.stroke(); });
  const placed = [];
  stops.forEach(s => {
    const fs = s.w > 1 ? 30 : 24;
    g.font = `700 ${fs}px "Atkinson Hyperlegible", sans-serif`;
    const tw = g.measureText(s.n).width, x = X(s.lon), y = Y(s.lat);
    const cands = [[x + 16, y + fs * .35], [x - 16 - tw, y + fs * .35], [x - tw / 2, y - 18], [x - tw / 2, y + fs + 14]];
    for (const [tx, ty] of cands) {
      const b = [tx - 4, ty - fs, tx + tw + 4, ty + 6];
      if (b[0] < 4 || b[2] > cv.width - 4 || b[1] < 4 || b[3] > cv.height - 90) continue;
      if (hit(b, placed) || hit(b, boxes.filter(o => !(o[0] === x - 10 && o[1] === y - 10)))) continue;
      placed.push(b);
      g.lineWidth = 6; g.strokeStyle = '#fff'; g.strokeText(s.n, tx, ty); g.fillStyle = '#14213D'; g.fillText(s.n, tx, ty);
      break;
    }
  });
  g.fillStyle = '#14213D'; g.font = '700 48px "Atkinson Hyperlegible", sans-serif'; g.fillText(`${data.city}${data.country ? ', ' + data.country : ''}`, pad, cv.height - 70);
  g.font = '400 24px "Atkinson Hyperlegible", sans-serif'; g.fillStyle = '#5E6E85'; g.fillText(`Peron - ${new Date(data.at).toLocaleDateString(LOC())} - Transitous / OpenStreetMap`, pad, cv.height - 30);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], `peron-${(data.city || 'harta').replace(/[^\w-]+/g, '_')}.png`, { type: 'image/png' });
  try { if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file] }); } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- versiune noua ---------- */
Object.assign(L10N.ro, { updAvail: 'Versiune noua disponibila. Atinge pentru actualizare.' });
Object.assign(L10N.en, { updAvail: 'New version available. Tap to update.' });
let updPending = false;
async function checkVersion() {
  try {
    const j = await (await fetch('version.json?t=' + Date.now(), { cache: 'no-store' })).json();
    if (j.v && j.v !== APP_V) { updPending = true; showUpdate(); }
  } catch {}
}
function showUpdate() {
  const b = $('#upd'); if (!b || !updPending || live) return;
  b.textContent = T('updAvail'); b.hidden = false;
  b.onclick = async () => {
    b.textContent = T('loading');
    try { const r = await navigator.serviceWorker?.getRegistration(); await r?.update(); for (const k of await caches.keys()) await caches.delete(k); } catch {}
    location.reload();
  };
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
setInterval(checkVersion, 30 * 60000);
setTimeout(checkVersion, 5000);
setTimeout(syncVisits, 3000);
setInterval(() => { updateCity(); }, 10 * 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncVisits(); updateCity(); } });

/* ---------- pornire ---------- */
applyLook();
applyStatic();
setOffline(navigator.onLine ? null : 0);
setSheet('half', true);
renderHome();
loadMapStops(); loadVehicles(); loadRentals();
startWatch();
if (st.loc) drawMe();
loadWeather();
setTimeout(prefetchTT, 4000);
setTimeout(() => { const b = bkState(); if (PUSH && (!b || Date.now() - b.at > 86400000)) bkUpload(); }, 6000);
handleUrl();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
