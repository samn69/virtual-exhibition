// Counting visitors: one visit per device per day goes to the owner's Google Sheet (see
// apps-script/visits.gs). On the first visit a small card asks for a name, which can be left
// empty. The owner's own devices, tests and previews are never counted.
// The owner reads the numbers in the Visitors panel, from the edit bar.
import { GOOGLE } from './config.js';

const $ = id => document.getElementById(id);
const URL_ = GOOGLE.visitsUrl || '';
const params = new URLSearchParams(location.search);
const NAME_KEY = 've-name', ID_KEY = 've-visitor', DAY_KEY = 've-visit-day', ASKED_KEY = 've-asked';

const store = {
  get: key => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
};
const isOwner = () => store.get('ve-owner') === '1' || params.has('edit');
const isTest = () => navigator.webdriver || ['debug', 'mockdrive', 'exhibition', 'welcome'].some(p => params.has(p));
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function visitorId() {
  let id = store.get(ID_KEY);
  if (!id) {
    id = crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    store.set(ID_KEY, id);
  }
  return id;
}
function device() {
  if (!matchMedia('(pointer: coarse)').matches) return 'computer';
  return Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet';
}

function send() {
  if (!URL_ || isOwner() || isTest() || store.get(DAY_KEY) === localDay()) return;
  const body = JSON.stringify({ visitor: visitorId(), name: store.get(NAME_KEY) || '', device: device() });
  // text/plain and no-cors: a simple request Google's script server takes without a preflight
  fetch(URL_, { method: 'POST', body, mode: 'no-cors', keepalive: true })
    .then(() => store.set(DAY_KEY, localDay()), () => { /* offline: try again next time */ });
}

// ── the welcome card, once per device ──
export function welcome() {
  const preview = params.has('welcome');
  if (!preview && (!URL_ || isOwner() || isTest() || store.get(ASKED_KEY))) { send(); return; }
  const dialog = $('welcomeDialog'), input = $('welcomeName');
  input.value = store.get(NAME_KEY) || '';
  const enter = () => {
    const name = input.value.trim().slice(0, 60);
    if (!preview) {
      if (name) store.set(NAME_KEY, name);
      store.set(ASKED_KEY, '1');
    }
    if (dialog.open) dialog.close();
    send();
  };
  $('welcomeForm').onsubmit = e => { e.preventDefault(); enter(); };
  dialog.addEventListener('cancel', e => { e.preventDefault(); enter(); }); // Esc enters without a name
  dialog.showModal();
}

// ── the owner's Visitors panel ──
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEVICE_LABEL = { phone: 'phone', tablet: 'tablet', computer: 'computer' };
let data = null, view = 'days';

function shiftDay(day, by) {
  const [y, m, d] = day.split('-').map(Number), t = new Date(Date.UTC(y, m - 1, d + by));
  return t.toISOString().slice(0, 10);
}
function shiftMonth(month, by) {
  const [y, m] = month.split('-').map(Number), t = new Date(Date.UTC(y, m - 1 + by, 1));
  return t.toISOString().slice(0, 7);
}
const niceDay = day => { const [y, m, d] = day.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const niceMonth = month => { const [y, m] = month.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const people = n => `${n} ${n === 1 ? 'person' : 'people'}`;

function series() {
  const today = data.today;
  if (view === 'days') return Array.from({ length: 30 }, (_, i) => shiftDay(today, i - 29))
    .map(key => ({ key, label: niceDay(key), short: String(Number(key.slice(8))), ...(data.days[key] || { visits: 0, people: 0 }) }));
  if (view === 'months') return Array.from({ length: 12 }, (_, i) => shiftMonth(today.slice(0, 7), i - 11))
    .map(key => ({ key, label: niceMonth(key), short: MONTHS[Number(key.slice(5)) - 1], ...(data.months[key] || { visits: 0, people: 0 }) }));
  const first = Math.min(Number(today.slice(0, 4)) - 4, ...Object.keys(data.years).map(Number));
  return Array.from({ length: Number(today.slice(0, 4)) - first + 1 }, (_, i) => String(first + i))
    .map(key => ({ key, label: key, short: key, ...(data.years[key] || { visits: 0, people: 0 }) }));
}

function tile(label, entry) {
  const { visits = 0, people: count = 0 } = entry || {};
  return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${visits}</div><div class="stat-sub">${people(count)}</div></div>`;
}

function render() {
  const body = $('visitorsBody');
  const today = data.today;
  body.innerHTML = `
    <div class="stats">${tile('Today', data.days[today])}${tile('This month', data.months[today.slice(0, 7)])}${tile('This year', data.years[today.slice(0, 4)])}${tile('All time', data.total)}</div>
    <div class="seg" role="tablist">${['days', 'months', 'years'].map(v => `<button type="button" role="tab" data-view="${v}" aria-selected="${v === view}">${v === 'days' ? 'Last 30 days' : v === 'months' ? 'Last 12 months' : 'Years'}</button>`).join('')}</div>
    <div class="chart" id="visitorsChart"></div>
    <div class="chart-tip" id="visitorsTip" hidden></div>
    <h3>Names left by visitors</h3>
    <div class="names">${data.names.length ? data.names.map(n => `<div><span>${escape(n.name)}</span><span class="when">${niceDay(n.day)}${n.device ? ' · ' + DEVICE_LABEL[n.device] : ''}</span></div>`).join('') : '<p class="note">No names yet. Visitors can leave the box empty.</p>'}</div>`;
  body.querySelectorAll('.seg button').forEach(b => { b.onclick = () => { view = b.dataset.view; render(); }; });

  const points = series(), max = Math.max(1, ...points.map(p => p.visits));
  const chart = $('visitorsChart'), tip = $('visitorsTip');
  const every = points.length > 14 ? 5 : 1; // label every 5th day so the dates don't collide
  chart.innerHTML = `<div class="chart-max">${max}</div>` + points.map((p, i) => `
    <div class="col" tabindex="0" data-i="${i}" aria-label="${p.label}: ${plural(p.visits, 'visit')}">
      <div class="bar-area"><div class="bar" style="height:${p.visits ? Math.max(2, p.visits / max * 100) : 0}%"></div></div>
      <div class="tick">${(points.length - 1 - i) % every === 0 ? p.short : ''}</div>
    </div>`).join('');
  const show = col => {
    const p = points[col.dataset.i];
    tip.innerHTML = `<b>${p.label}</b><br>${plural(p.visits, 'visit')} · ${people(p.people)}`;
    tip.hidden = false;
    const box = col.getBoundingClientRect(), panel = $('visitorsDialog').getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(box.left + box.width / 2 - panel.left, 70), panel.width - 70)}px`;
    tip.style.top = `${box.top - panel.top + $('visitorsDialog').scrollTop - 6}px`;
  };
  chart.querySelectorAll('.col').forEach(col => {
    col.onpointerenter = col.onfocus = () => show(col);
    col.onpointerleave = col.onblur = () => { tip.hidden = true; };
  });
}

function escape(text) { return text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`); }

// token: the owner's Google sign-in, so the script knows it's the owner asking
export async function openVisitors(token) {
  const dialog = $('visitorsDialog'), body = $('visitorsBody');
  dialog.showModal();
  if (window.mockVisits) { data = window.mockVisits; render(); return; } // previews
  if (!URL_) { body.innerHTML = '<p>Visitor counting isn’t switched on yet: the Google Sheet’s web app address still has to be added to the website.</p>'; return; }
  body.innerHTML = '<p class="note">Loading…</p>';
  try {
    const response = await fetch(URL_, { method: 'POST', body: JSON.stringify({ action: 'stats', token }) });
    const result = await response.json();
    if (result.error) throw new Error(result.error === 'not allowed' ? 'Only the gallery’s owner can see the visitors. Sign in again from Edit.' : result.error);
    data = result;
    render();
  } catch (error) {
    body.innerHTML = `<p class="error-text">Couldn’t load the visitors: ${escape(error.message)}</p>`;
  }
}
