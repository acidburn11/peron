'use strict';
const API = 'https://api.transitous.org/api';
const PUSH = (window.PERON_PUSH || '').replace(/\/$/, '');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const DEF = { lang: (navigator.language || '').toLowerCase().startsWith('ro') ? 'ro' : 'en', modes: { BUS: true, TRAM: true, SUBWAY: true, RAIL: true, FERRY: true }, transfers: 'any', walk: 15, speed: 'normal', wheelchair: false, alertStops: 2, sound: true, home: null, work: null, vehicles: true, rentals: false, useRental: false, lastAlert: false };
const saved = store.get('opts', {});
const O = { ...DEF, ...saved, modes: { ...DEF.modes, ...(saved.modes || {}) } };
const saveOpts = () => store.set('opts', O);
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
    pushBoard: (l, h) => `${l} spre ${h} soseste in 2 min`, pushPre: (n, s) => `Pregateste-te: cobori peste ${pl(n, 'statie', 'statii')}, la ${s}`, pushOff: s => `Coboara la urmatoarea: ${s}`, pushArrive: s => `Ai ajuns la ${s}`,
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
    pushBoard: (l, h) => `${l} to ${h} arrives in 2 min`, pushPre: (n, s) => `Get ready: ${n} ${n === 1 ? 'stop' : 'stops'} to go, getting off at ${s}`, pushOff: s => `Get off at the next stop: ${s}`, pushArrive: s => `You have arrived at ${s}`,
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
  catch { throw new Error(T('netErr')); }
  finally { clearTimeout(to); }
  if (!r.ok) throw new Error(r.status === 429 ? T('tooMany') : T('srvErr', r.status));
  const d = await r.json();
  if (cache.size > 300) cache.clear();
  cache.set(url, { t: Date.now(), d });
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
  pane.innerHTML = `<div class="quick">${placeBtn('home')}${placeBtn('work')}</div>
    <div id="lastHome"></div>
    <button class="row tool" id="reachB"><span class="ic">${I.reach}</span><span class="tx"><div>${T('reach')}</div><small>${T('reachSub')}</small></span>${I.chev}</button>
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
  lastHome();
  clearInterval(paneTimer);
  paneTimer = setInterval(() => { if (view === 'home') { if (fst.length) loadFavStops(); lastHome(); } }, 30000);
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
  const res = await Promise.all(fst.map(p => api('/v6/stoptimes', { stopId: p.stopId, n: 10, language: O.lang }, 25000).catch(() => null)));
  const el = $('#favStops'); if (!el || view !== 'home') return;
  el.innerHTML = fst.map((p, i) => {
    const deps = (res[i]?.stopTimes || []).filter(s => s.place.departure || s.place.scheduledDeparture).sort((a, b) => depT(a) - depT(b)).slice(0, 3);
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
    <h3>${T('placesH')}</h3>
    ${['home', 'work'].map(k => opt(T(k), O[k] ? esc(O[k].name) : T('unset'), `<button class="btn ghost" data-p="${k}">${O[k] ? T('change') : T('set')}</button>`)).join('')}
    ${opt(T('history'), '', `<button class="btn ghost" id="clr">${T('delete')}</button>`)}
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
    renderOpts();
  });
  $('#opts').querySelectorAll('[data-t]').forEach(b => b.onclick = async () => {
    const k = b.dataset.t; O[k] = !O[k]; saveOpts(); renderOpts();
    vehKey = rentKey = ''; loadVehicles(); loadRentals();
    if (k === 'lastAlert') { if (O.lastAlert) { try { await pushSubscribe(); schedLastPush(); } catch (e) { toast(e.message); } } else pushCancel('last'); }
  });
  $('#pushTest')?.addEventListener('click', async () => {
    try { await pushSchedule('test', [{ id: 'test', at: Date.now() + 5000, title: 'Peron', body: T('pushTestBody') }]); toast('OK'); } catch (e) { toast(e.message); }
  });
  $('#opts').querySelectorAll('[data-p]').forEach(b => b.onclick = () => openSearch('to', p => { O[b.dataset.p] = p; saveOpts(); renderOpts(); if (view === 'home') renderHome(); }, T(b.dataset.p + 'Addr')));
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
  ({ home: renderHome, results: renderResults, route: () => renderRoute(st.cur), stop: () => renderStop(st.stop), line: () => renderLine(st.line, st.lineDir), reach: renderReach })[view]?.();
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
  pane.innerHTML = hd(esc(p.name), `<button class="icb fav ${isF ? 'on' : ''}" id="fstop" aria-label="${T('favStop')}">${I.star}</button>`)
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
  $('#stopTabs').querySelectorAll('button').forEach(b => b.onclick = () => { st.stopTab = b.dataset.v; renderStop(p); });
  clearInterval(paneTimer);
  if (st.stopTab === 'tt') return loadTimetable(p);
  const load = async () => {
    try {
      const r = await api('/v6/stoptimes', { stopId: p.stopId, n: 40, language: O.lang, withAlerts: true }, 25000);
      const el = $('#deps'); if (!el || view !== 'stop' || st.stopTab !== 'dep') return;
      const al = alertsOf([{ from: r.place || {}, to: {} }, ...(r.stopTimes || []).map(x => ({ from: x.place, to: {} }))]);
      $('#stopAl').innerHTML = al.map((a, i) => alertBox(a, 's' + i)).join(''); toggles($('#stopAl'));
      const groups = new Map();
      (r.stopTimes || []).forEach(s => {
        if (s.place.departure == null && s.place.scheduledDeparture == null) return;
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
  pane.innerHTML = hd(`${badge(g)} ${esc(modeName(g.mode))}`) + (g.longName ? `<div class="muted" style="font-size:14px;margin:-6px 0 8px">${esc(g.longName)}</div>` : '')
    + `<h3>${T('directions')}</h3><div class="ttl">${g.dirs.map((d, i) => `<button data-d="${i}" class="${i === di ? 'on' : ''}"><small>${T('towards')}</small> ${esc(d.last)}</button>`).join('')}</div><div id="lineBody"><div class="skel"></div></div>`;
  pane.querySelectorAll('[data-d]').forEach(b => b.onclick = () => renderLine(g, +b.dataset.d));
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
    if (last >= 1) { const s = stops[last - 1]; out.push({ id: `o${i}`, at: tAt(s, 'dep', l), title: nm, body: T('pushOff', l.to.name), trip: tr(s, 'dep', 0) }); }
  });
  const end = it.legs.at(-1);
  out.push({ id: 'end', at: +new Date(end.endTime), title: 'Peron', body: T('pushArrive', st.to?.name || end.to.name), trip: !isStreet(end) && end.tripId && end.to.stopId ? { tripId: end.tripId, stopId: end.to.stopId, kind: 'arr', offset: 0 } : null });
  return out.filter(a => a.at > Date.now() - 30000);
}

/* ---------- traseu live ---------- */
async function startLive(it) {
  live = { it, i: 0, idx: 0, alerted: {}, banner: null };
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
  pane.innerHTML = (live.banner ? `<div class="alert">${I.bell}<span>${esc(live.banner)}</span></div>` : '') + lal.map((a, i) => alertBox(a, 'l' + i)).join('') + body
    + (nextLegs.length && !live.done ? `<h3>${T('next')}</h3>${nextLegs.map(x => `<div class="row"><span class="ic">${I[MK(x.mode)]}</span><span class="tx"><div>${badge(x)} ${esc(x.from.name)}</div><small>${fmt(x.startTime, x.from.tz)} ${liveTag(x)}</small></span></div>`).join('')}` : '')
    + `<div class="lnav"><button class="btn ghost" id="lPrev" ${live.i === 0 ? 'disabled' : ''}>${T('prevLeg')}</button><button class="btn ghost" id="lNext">${live.i < legs.length - 1 ? T('nextLeg') : T('iArrived')}</button></div>
       <div class="lnav"><button class="btn ghost" id="lShare">${I.share.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px"')} ${T('shareEta')}</button><button class="btn stop" id="lStop">${T('stopLive')}</button></div>
       ${pos ? '' : `<p class="muted" style="font-size:13px">${T('noGps')}</p>`}`;
  $('#lPrev').onclick = () => setLeg(live.i - 1);
  $('#lNext').onclick = () => live.i < legs.length - 1 ? setLeg(live.i + 1) : (live.done = true, liveTick());
  $('#lStop').onclick = stopLive;
  $('#lShare').onclick = () => shareEta(live.it);
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

/* ---------- pornire ---------- */
applyStatic();
setSheet('half', true);
renderHome();
loadMapStops(); loadVehicles(); loadRentals();
startWatch();
if (st.loc) drawMe();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
