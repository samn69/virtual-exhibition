// Visitor log for the Virtual Exhibition.
//
// Setup (once): make a new Google Sheet, open Extensions → Apps Script, replace the code there
// with this file, then Deploy → New deployment → Web app, "Execute as: Me", "Who has access:
// Anyone". Copy the web app URL into visitsUrl in js/config.js.
//
// The gallery sends one row per device per day: the time, a random device id, the name the
// visitor typed (optional) and the kind of device. Only the gallery's owner can read the
// numbers back: the gallery sends the owner's Google sign-in, and this script checks that it
// can edit the exhibition file in Drive.

const MANIFEST_ID = '10TAbpOPwnV1aBR5Z_H2QmlGwwBalKiL9'; // the exhibition file (GOOGLE.manifestId)
const SHEET_NAME = 'Visits';
const DEVICES = ['phone', 'tablet', 'computer'];

function doPost(e) {
  let data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return reply({ error: 'bad request' }); }
  if (data.action === 'stats') return reply(stats(data.token));
  return reply(logVisit(data));
}

function reply(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}

function sheet() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let page = book.getSheetByName(SHEET_NAME);
  if (!page) {
    page = book.insertSheet(SHEET_NAME);
    page.appendRow(['Time', 'Visitor', 'Name', 'Device']);
    page.setFrozenRows(1);
  }
  return page;
}

function clean(value, length) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, length);
}

function today(time) {
  return Utilities.formatDate(time, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function logVisit(data) {
  const visitor = clean(data.visitor, 40);
  if (!/^[a-z0-9-]{8,40}$/i.test(visitor)) return { ok: false };
  const now = new Date();
  // the gallery already sends one visit per device per day; this catches double sends
  const cache = CacheService.getScriptCache(), key = today(now) + visitor;
  if (cache.get(key)) return { ok: true };
  cache.put(key, '1', 21600);
  let name = clean(data.name, 60);
  if (/^[=+\-@]/.test(name)) name = "'" + name; // keep it as text, never a formula
  const device = DEVICES.indexOf(data.device) >= 0 ? data.device : '';
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { sheet().appendRow([now, visitor, name, device]); } finally { lock.releaseLock(); }
  return { ok: true };
}

// the owner's sign-in token works on the exhibition file only if it belongs to its owner
function isOwner(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return false;
  const response = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + MANIFEST_ID + '?fields=capabilities%2FcanEdit',
    { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return false;
  const capabilities = JSON.parse(response.getContentText()).capabilities || {};
  return capabilities.canEdit === true;
}

function stats(token) {
  if (!isOwner(token)) return { error: 'not allowed' };
  const rows = sheet().getDataRange().getValues().slice(1);
  const days = {}, months = {}, years = {}, everyone = {}, names = [];
  const add = (table, key, visitor) => {
    const entry = table[key] || (table[key] = { visits: 0, people: {} });
    entry.visits++;
    entry.people[visitor] = 1;
  };
  rows.forEach(row => {
    const time = row[0] instanceof Date ? row[0] : new Date(row[0]);
    if (isNaN(time)) return;
    const day = today(time), visitor = String(row[1]);
    add(days, day, visitor);
    add(months, day.slice(0, 7), visitor);
    add(years, day.slice(0, 4), visitor);
    everyone[visitor] = 1;
    if (row[2]) names.push({ day: day, name: String(row[2]).replace(/^'/, ''), device: String(row[3] || '') });
  });
  const count = table => {
    const out = {};
    Object.keys(table).forEach(key => { out[key] = { visits: table[key].visits, people: Object.keys(table[key].people).length }; });
    return out;
  };
  return {
    today: today(new Date()),
    total: { visits: rows.length, people: Object.keys(everyone).length },
    days: count(days), months: count(months), years: count(years),
    names: names.reverse().slice(0, 300),
  };
}
