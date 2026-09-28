/* =========================================================================
 * Hisab — a calm, offline-first khata (ledger) book.
 *
 * Pure static app: HTML + CSS + vanilla JS, zero external dependencies.
 * All data lives in this browser's localStorage, namespaced under
 * "hisab.v1.*". Each device keeps its own records — nothing is synced.
 *
 * SECURITY NOTE (device-local, family use):
 * User logins are stored on this device only. Passwords are salted and
 * hashed with SHA-256 (WebCrypto when available, salted fallback hash
 * otherwise). This keeps honest people honest on a shared family phone,
 * but it is NOT bank-grade security — anyone with access to the browser's
 * stored data could read it. Do not use it for secrets.
 * ========================================================================= */
'use strict';

/* ---------------- constants ---------------- */
var TZ = 'Asia/Kathmandu';
var LS_USERS   = 'hisab.v1.users';
var LS_SESSION = 'hisab.v1.session';
var LS_ENTRIES = 'hisab.v1.entries';   // { personal: [...], business: [...] }

/* Entry types. `flow` drives totals and balances:
 *  - cash: money left my hand right now (purchase paid in cash)
 *  - payable+: I now owe more (bought on due / took money)
 *  - payable-: I paid some of what I owed
 *  - receivable+: someone now owes me (I gave/lent money)
 *  - receivable-: someone paid me back                                     */
var TYPES = {
  cash_purchase:  { label: 'Cash purchase',  short: 'Cash',      partyLabel: 'Shop / vendor (optional)', flow: 'cash',        icon: 'cart'    },
  due_purchase:   { label: 'Bought on due',  short: 'On due',    partyLabel: 'Shop / vendor',            flow: 'payable+',    icon: 'receipt' },
  money_given:    { label: 'Gave money',     short: 'Gave',      partyLabel: 'Person',                   flow: 'receivable+', icon: 'up'      },
  money_taken:    { label: 'Took money',     short: 'Took',      partyLabel: 'Person',                   flow: 'payable+',    icon: 'down'    },
  paid_back:      { label: 'I paid back',    short: 'Paid back', partyLabel: 'Person / vendor',          flow: 'payable-',    icon: 'check'   },
  received_back:  { label: 'Got money back', short: 'Got back',  partyLabel: 'Person',                   flow: 'receivable-', icon: 'inbox'   }
};
var TYPE_ORDER = ['cash_purchase', 'due_purchase', 'money_given', 'money_taken', 'paid_back', 'received_back'];

/* ---------------- tiny DOM helpers ---------------- */
function $(s, r) { return (r || document).querySelector(s); }
function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function uid() {
  return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* ---------------- inline SVG icons ---------------- */
var ICONS = {
  home:    '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  list:    '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
  swap:    '<path d="M7 8l-4 4 4 4"/><path d="M3 12h13"/><path d="M17 8l4 4-4 4"/><path d="M21 12H8"/>',
  dots:    '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus:    '<path d="M12 5v14M5 12h14"/>',
  search:  '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  pencil:  '<path d="M17 3l4 4L8 20l-5 1 1-5z"/>',
  trash:   '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
  download:'<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  upload:  '<path d="M12 15V4"/><path d="M7 8l5-5 5 5"/><path d="M4 20h16"/>',
  users:   '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.6c2 .9 3 2.9 3 5.4"/>',
  logout:  '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  x:       '<path d="M6 6l12 12M18 6L6 18"/>',
  check:   '<path d="M4 12.5l5 5L20 6.5"/>',
  cart:    '<path d="M3 4h2l2.4 11.2h10.9L21 8H7"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
  receipt: '<path d="M6 3h12v18l-2-1.6-2 1.6-2-1.6L10 21l-2-1.6L6 21z"/><path d="M9 8h6M9 12h6"/>',
  up:      '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
  down:    '<path d="M12 5v14"/><path d="M5 12l7 7 7-7"/>',
  inbox:   '<path d="M3 13l2.7-7.5h12.6L21 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h6l1.6 2.6h2.8L15 13h6"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  shield:  '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  book:    '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>'
};
function icon(name, cls) {
  return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}

/* ---------------- storage ---------------- */
function loadJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) { return fallback; }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { toast('Could not save — storage is unavailable.'); return false; }
}

/* ---------------- password hashing ----------------
 * Salted SHA-256 via WebCrypto when available (secure contexts:
 * https, localhost, and file:// in modern browsers). On pages where
 * SubtleCrypto is unavailable we fall back to a salted cyrb53 hash —
 * weaker, but the whole login is device-local family convenience,
 * never a security boundary. */
function makeSalt() {
  try {
    if (typeof window !== 'undefined' && window.crypto && typeof crypto.getRandomValues === 'function') {
      var b = new Uint8Array(16);
      crypto.getRandomValues(b);
      return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    }
  } catch (e) {}
  return 's' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function cyrb53(str, seed) {
  var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (var i = 0; i < str.length; i++) {
    var ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}
function hashPassword(password, salt) {
  var input = salt + '::' + password;
  try {
    if (window.crypto && crypto.subtle && window.isSecureContext !== false) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)).then(function (buf) {
        return { algo: 'sha256', hash: Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('') };
      }).catch(function () {
        return { algo: 'cyrb53', hash: cyrb53(input, 7) };
      });
    }
  } catch (e) {}
  return Promise.resolve({ algo: 'cyrb53', hash: cyrb53(input, 7) });
}

/* ---------------- Kathmandu date/time + NPR formatting ---------------- */
var _dtfDate = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
var _dtfTime = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
var _dtfParts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

function tzParts(ts) {
  var o = {};
  _dtfParts.formatToParts(ts).forEach(function (p) { o[p.type] = p.value; });
  return o; // {year, month, day, hour, minute}
}
function dateKey(ts) { var p = tzParts(ts); return p.year + '-' + p.month + '-' + p.day; }
function monthKey(ts) { var p = tzParts(ts); return p.year + '-' + p.month; }
function fmtDate(ts) { return _dtfDate.format(ts); }          // "Sun, 28 Sept 2026"
function fmtTime(ts) { return _dtfTime.format(ts); }          // "3:50 PM"
function fmtDateTime(ts) { return fmtDate(ts) + ' · ' + fmtTime(ts); }
function todayKey() { return dateKey(Date.now()); }
function thisMonthKey() { return monthKey(Date.now()); }

/* Value for <input type="datetime-local"> — Kathmandu wall-clock time. */
function inputNow() {
  var p = tzParts(Date.now());
  return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
}
/* Parse a datetime-local value as Kathmandu wall-clock -> epoch ms. */
function tsFromInput(v) {
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v || '');
  if (!m) return Date.now();
  var Y = +m[1], Mo = +m[2], D = +m[3], H = +m[4], Mi = +m[5];
  var target = Date.UTC(Y, Mo - 1, D, H, Mi);
  var guess = target;
  for (var i = 0; i < 3; i++) {
    var p = tzParts(guess);
    var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    guess += (target - asUtc);
  }
  return guess;
}
/* Nepal uses lakh/crore grouping: 1,25,000 — en-IN matches. */
function fmtRs(n) {
  var v = Math.round(Number(n) || 0);
  return 'Rs ' + v.toLocaleString('en-IN');
}

/* ---------------- app state ---------------- */
var S = {
  user: null,            // logged-in user object
  portal: 'personal',    // 'personal' | 'business'
  tab: 'dashboard',
  entries: { personal: [], business: [] },
  filterQ: '',
  filterType: 'all',
  editingId: null,       // entry id being edited (null = new)
  entryType: 'cash_purchase'
};

function portalEntries() { return S.entries[S.portal] || []; }
function setPortalEntries(list) { S.entries[S.portal] = list; saveJSON(LS_ENTRIES, S.entries); }

function canSee(portal) {
  if (!S.user) return false;
  if (S.user.isAdmin) return true;
  return (S.user.portals || []).indexOf(portal) !== -1;
}
function ensurePortal() {
  if (!canSee(S.portal)) S.portal = canSee('personal') ? 'personal' : 'business';
}

/* ---------------- toast + confirm ---------------- */
var _toastTimer = null;
function toast(msg) {
  var t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
}
var _confirmCb = null;
function confirmDlg(title, text, yesLabel, cb) {
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  $('#confirm-yes').textContent = yesLabel || 'Confirm';
  _confirmCb = cb;
  $('#confirm-modal').hidden = false;
}

/* ---------------- users & session ---------------- */
function getUsers() { return loadJSON(LS_USERS, []); }
function saveUsers(u) { return saveJSON(LS_USERS, u); }
function findUser(id) {
  var users = getUsers();
  for (var i = 0; i < users.length; i++) if (users[i].id === id) return users[i];
  return null;
}

function showView(name) {
  ['setup', 'login', 'main'].forEach(function (v) { $('#view-' + v).hidden = (v !== name); });
  window.scrollTo(0, 0);
}

function boot() {
  // static brand marks + nav icons
  $('#setup-mark').innerHTML = icon('book');
  $('#login-mark').innerHTML = icon('book');
  $('#main-mark').innerHTML = icon('book');
  $('#fab').innerHTML = icon('plus');
  $('#entry-close').innerHTML = icon('x');
  $('#user-close').innerHTML = icon('x');
  var navIcons = { dashboard: 'home', entries: 'list', balances: 'swap', more: 'dots' };
  $all('.nav-btn').forEach(function (b) {
    $('.nav-ico', b).innerHTML = icon(navIcons[b.dataset.tab]);
  });

  var users = getUsers();
  if (!users.length) { showView('setup'); return; }
  var sess = loadJSON(LS_SESSION, null);
  var u = sess && findUser(sess.userId);
  if (u && u.active !== false) { loginAs(u); return; }
  showView('login');
}

function loginAs(user) {
  S.user = user;
  S.entries = loadJSON(LS_ENTRIES, { personal: [], business: [] });
  if (!S.entries.personal) S.entries.personal = [];
  if (!S.entries.business) S.entries.business = [];
  ensurePortal();
  saveJSON(LS_SESSION, { userId: user.id });
  showView('main');
  renderAll();
  toast('Namaste, ' + user.username);
}

function logout() {
  try { localStorage.removeItem(LS_SESSION); } catch (e) {}
  S.user = null;
  $('#login-username').value = '';
  $('#login-password').value = '';
  showView('login');
}

/* ---- first-run admin setup ---- */
function handleSetup(e) {
  e.preventDefault();
  var name = $('#setup-username').value.trim();
  var p1 = $('#setup-password').value, p2 = $('#setup-password2').value;
  if (name.length < 3) { toast('Username needs at least 3 characters.'); return; }
  if (p1.length < 4) { toast('Password needs at least 4 characters.'); return; }
  if (p1 !== p2) { toast('Passwords do not match.'); return; }
  var salt = makeSalt();
  hashPassword(p1, salt).then(function (h) {
    var admin = { id: uid(), username: name, salt: salt, algo: h.algo, passHash: h.hash,
                  isAdmin: true, active: true, portals: ['personal', 'business'], createdAt: Date.now() };
    saveUsers([admin]);
    loginAs(admin);
  });
}

/* ---- login ---- */
function handleLogin(e) {
  e.preventDefault();
  var name = $('#login-username').value.trim().toLowerCase();
  var pw = $('#login-password').value;
  var users = getUsers();
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].username.toLowerCase() === name) { user = users[i]; break; }
  }
  var err = $('#login-error');
  if (!user) { err.textContent = 'No such user on this device.'; err.hidden = false; return; }
  if (user.active === false) { err.textContent = 'This account is paused. Ask the admin.'; err.hidden = false; return; }
  hashPassword(pw, user.salt).then(function (h) {
    if (h.hash === user.passHash) { err.hidden = true; loginAs(user); }
    else { err.textContent = 'Wrong password.'; err.hidden = false; }
  });
}

/* ---- admin: create / pause / remove users ---- */
function adminCreateUser(e) {
  e.preventDefault();
  var name = $('#u-username').value.trim();
  var pw = $('#u-password').value;
  var portals = [];
  if ($('#u-portal-personal').checked) portals.push('personal');
  if ($('#u-portal-business').checked) portals.push('business');
  if (name.length < 3) { toast('Username needs at least 3 characters.'); return; }
  if (pw.length < 4) { toast('Password needs at least 4 characters.'); return; }
  if (!portals.length) { toast('Grant at least one portal.'); return; }
  var users = getUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].username.toLowerCase() === name.toLowerCase()) { toast('That username is taken.'); return; }
  }
  var salt = makeSalt();
  hashPassword(pw, salt).then(function (h) {
    users.push({ id: uid(), username: name, salt: salt, algo: h.algo, passHash: h.hash,
                 isAdmin: false, active: true, portals: portals, createdAt: Date.now() });
    saveUsers(users);
    $('#user-modal').hidden = true;
    $('#user-form').reset();
    $('#u-portal-personal').checked = true;
    renderAll();
    toast('User "' + name + '" created. Share the login with them.');
  });
}
function adminToggleUser(id) {
  var users = getUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].id === id) {
      if (users[i].id === S.user.id) { toast('You cannot pause yourself.'); return; }
      users[i].active = users[i].active === false ? true : false;
      saveUsers(users); renderAll();
      toast(users[i].active ? 'User activated.' : 'User paused.');
      return;
    }
  }
}
function adminDeleteUser(id) {
  var users = getUsers();
  var target = null;
  users.forEach(function (u) { if (u.id === id) target = u; });
  if (!target) return;
  if (target.id === S.user.id) { toast('You cannot delete yourself.'); return; }
  if (target.isAdmin) {
    var admins = users.filter(function (u) { return u.isAdmin; });
    if (admins.length <= 1) { toast('Cannot delete the last admin.'); return; }
  }
  confirmDlg('Delete user?', 'Remove "' + target.username + '" from this device? Their portal data stays.', 'Delete', function () {
    saveUsers(users.filter(function (u) { return u.id !== id; }));
    renderAll();
    toast('User deleted.');
  });
}

/* ---------------- entries ---------------- */
function addEntry(data) {
  var list = portalEntries();
  list.push({
    id: uid(), ts: data.ts, type: data.type,
    desc: data.desc, amount: Math.round(Math.abs(Number(data.amount) || 0)),
    party: (data.party || '').trim(), note: (data.note || '').trim()
  });
  setPortalEntries(list);
}
function updateEntry(id, data) {
  var list = portalEntries();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i].ts = data.ts; list[i].type = data.type;
      list[i].desc = data.desc; list[i].amount = Math.round(Math.abs(Number(data.amount) || 0));
      list[i].party = (data.party || '').trim(); list[i].note = (data.note || '').trim();
      break;
    }
  }
  setPortalEntries(list);
}
function deleteEntry(id) {
  setPortalEntries(portalEntries().filter(function (e) { return e.id !== id; }));
}
function getEntry(id) {
  var list = portalEntries();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

/* ---------------- balances ----------------
 * Per person/vendor: how much I owe them (payable) and how much they owe
 * me (receivable). Only exact name matches are grouped — keep names
 * consistent (e.g. always "Ramesh") for clean totals. */
function computeBalances(list) {
  var map = {};
  list.forEach(function (e) {
    if (!e.party) return;
    var b = map[e.party] || (map[e.party] = { party: e.party, payable: 0, receivable: 0, count: 0 });
    b.count++;
    var f = TYPES[e.type] ? TYPES[e.type].flow : 'cash';
    if (f === 'payable+') b.payable += e.amount;
    else if (f === 'payable-') b.payable -= e.amount;
    else if (f === 'receivable+') b.receivable += e.amount;
    else if (f === 'receivable-') b.receivable -= e.amount;
  });
  return map;
}
function totalsFor(list) {
  var t = { cash: 0, payable: 0, receivable: 0, paidBack: 0, receivedBack: 0, count: list.length, gross: 0 };
  list.forEach(function (e) {
    t.gross += e.amount;
    var f = TYPES[e.type] ? TYPES[e.type].flow : 'cash';
    if (f === 'cash') t.cash += e.amount;
    else if (f === 'payable+') t.payable += e.amount;
    else if (f === 'payable-') t.paidBack += e.amount;
    else if (f === 'receivable+') t.receivable += e.amount;
    else if (f === 'receivable-') t.receivedBack += e.amount;
  });
  return t;
}
function netOutstanding(list) {
  var b = computeBalances(list), owe = 0, owed = 0;
  Object.keys(b).forEach(function (k) { owe += b[k].payable; owed += b[k].receivable; });
  return { owe: owe, owed: owed };
}

/* ---------------- rendering ---------------- */
function renderAll() {
  if (!S.user) return;
  ensurePortal();
  renderHeader();
  $all('.nav-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === S.tab); });
  ['dashboard', 'entries', 'balances', 'more'].forEach(function (t) { $('#tab-' + t).hidden = (t !== S.tab); });
  if (S.tab === 'dashboard') renderDashboard();
  else if (S.tab === 'entries') renderEntries();
  else if (S.tab === 'balances') renderBalances();
  else renderMore();
}

function renderHeader() {
  var pb = $('#portal-personal'), bb = $('#portal-business');
  pb.classList.toggle('active', S.portal === 'personal');
  bb.classList.toggle('active', S.portal === 'business');
  pb.style.display = canSee('personal') ? '' : 'none';
  bb.style.display = canSee('business') ? '' : 'none';
  var chip = $('#user-chip');
  chip.innerHTML = icon('users') + '<span>' + esc(S.user.username) + (S.user.isAdmin ? ' · admin' : '') + '</span>';
}

function statCard(label, value, cls) {
  return '<div class="stat ' + (cls || '') + '"><div class="k">' + esc(label) + '</div><div class="v ' + (cls === 'neg' ? 'neg' : cls === 'pos' ? 'pos' : '') + '">' + value + '</div></div>';
}

function entryRow(e) {
  var t = TYPES[e.type] || TYPES.cash_purchase;
  var f = t.flow;
  var amtCls = (f === 'receivable+' || f === 'receivable-') ? 'in' : (f === 'cash' || f === 'payable+' ? 'out' : '');
  var sign = (f === 'payable-' || f === 'receivable-') ? '− ' : (f === 'cash' || f === 'payable+' || f === 'receivable+') ? '' : '';
  var sub = fmtTime(e.ts) + (e.party ? ' · ' + esc(e.party) : '') + ' · ' + esc(t.short);
  return '<button class="entry-row" data-id="' + e.id + '">' +
    '<span class="e-ico t-' + e.type + '">' + icon(t.icon) + '</span>' +
    '<span class="e-main"><span class="e-desc">' + esc(e.desc) + '</span><br>' +
    '<span class="e-sub">' + sub + '</span></span>' +
    '<span class="e-amt ' + amtCls + '">' + sign + fmtRs(e.amount) + '</span></button>';
}

/* ---- dashboard ---- */
function renderDashboard() {
  var list = portalEntries();
  var tk = todayKey(), mk = thisMonthKey();
  var todayList = list.filter(function (e) { return dateKey(e.ts) === tk; });
  var monthList = list.filter(function (e) { return monthKey(e.ts) === mk; });
  var tt = totalsFor(todayList), mt = totalsFor(monthList);
  var net = netOutstanding(list);
  var portalName = S.portal === 'personal' ? 'Personal' : 'Business';

  var recent = list.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 5);

  $('#tab-dashboard').innerHTML =
    '<div class="greet"><h2>Namaste, ' + esc(S.user.username) + '</h2>' +
    '<p class="muted">' + esc(portalName) + ' khata · ' + esc(fmtDate(Date.now())) + '</p></div>' +
    '<div class="stat-grid">' +
      statCard("Today's cash out", fmtRs(tt.cash)) +
      statCard("Today's new dues", fmtRs(tt.payable)) +
      '<div class="stat"><div class="k">I owe (total)</div><div class="v neg">' + fmtRs(net.owe) + '</div></div>' +
      '<div class="stat"><div class="k">Owed to me (total)</div><div class="v pos">' + fmtRs(net.owed) + '</div></div>' +
    '</div>' +
    '<div class="section-title">This month</div>' +
    '<div class="card menu-card">' +
      '<div class="user-row"><span class="e-ico t-cash_purchase">' + icon('cart') + '</span><div class="e-main"><div class="e-desc">Cash purchases</div></div><div class="bal">' + fmtRs(mt.cash) + '</div></div>' +
      '<div class="user-row"><span class="e-ico t-due_purchase">' + icon('receipt') + '</span><div class="e-main"><div class="e-desc">Bought on due</div></div><div class="bal">' + fmtRs(mt.payable) + '</div></div>' +
      '<div class="user-row"><span class="e-ico t-money_given">' + icon('up') + '</span><div class="e-main"><div class="e-desc">Money given</div></div><div class="bal">' + fmtRs(mt.receivable) + '</div></div>' +
    '</div>' +
    '<div class="section-title">Recent entries</div>' +
    (recent.length
      ? '<div>' + recent.map(entryRow).join('') + '</div>'
      : '<div class="card empty">' + icon('book') + '<p>No entries yet.<br>Tap + to record your first one.</p></div>') +
    '<button class="btn ghost block" id="dash-all">View all entries</button>';

  $('#dash-all').addEventListener('click', function () { S.tab = 'entries'; renderAll(); });
  $all('#tab-dashboard .entry-row').forEach(function (r) {
    r.addEventListener('click', function () { openEntryModal(r.dataset.id); });
  });
}

/* ---- entries list ---- */
function filteredEntries() {
  var q = S.filterQ.trim().toLowerCase();
  return portalEntries().filter(function (e) {
    if (S.filterType !== 'all' && e.type !== S.filterType) return false;
    if (q && (e.desc || '').toLowerCase().indexOf(q) === -1 &&
        (e.party || '').toLowerCase().indexOf(q) === -1 &&
        (e.note || '').toLowerCase().indexOf(q) === -1) return false;
    return true;
  }).sort(function (a, b) { return b.ts - a.ts; });
}

function renderEntries() {
  var list = filteredEntries();
  var t = totalsFor(list);

  var chips = '<button class="chip' + (S.filterType === 'all' ? ' active' : '') + '" data-f="all">All</button>' +
    TYPE_ORDER.map(function (k) {
      return '<button class="chip' + (S.filterType === k ? ' active' : '') + '" data-f="' + k + '">' + esc(TYPES[k].short) + '</button>';
    }).join('');

  var groups = {}, order = [];
  list.forEach(function (e) {
    var k = dateKey(e.ts);
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(e);
  });

  var html = '<div class="toolbar"><div class="search-row"><div class="grow">' +
    '<span class="search-ico">' + icon('search') + '</span>' +
    '<input id="entries-search" type="search" placeholder="Search items, people, notes…" value="' + esc(S.filterQ) + '"></div></div>' +
    '<div class="chip-row">' + chips + '</div></div>' +
    '<div class="summary-line"><span class="muted">' + list.length + ' entr' + (list.length === 1 ? 'y' : 'ies') + '</span>' +
    '<span class="total">Total ' + fmtRs(t.gross) + '</span></div>';

  if (!list.length) {
    html += '<div class="card empty">' + icon('search') + '<p>Nothing found.<br>Try a different search or filter.</p></div>';
  } else {
    order.forEach(function (k) {
      var day = groups[k];
      var dt = totalsFor(day);
      html += '<div class="day-group"><div class="day-head"><span class="d">' + esc(fmtDate(day[0].ts)) + '</span>' +
        '<span class="t">' + fmtRs(dt.gross) + '</span></div>' +
        day.map(entryRow).join('') + '</div>';
    });
  }
  $('#tab-entries').innerHTML = html;

  var search = $('#entries-search');
  // Re-rendering rebuilds the input, so restore focus + caret after each keystroke.
  search.addEventListener('input', function () {
    S.filterQ = search.value;
    var pos = null;
    try { pos = search.selectionStart; } catch (e) {}
    renderEntries();
    var s2 = $('#entries-search');
    s2.focus();
    try { if (pos !== null) s2.setSelectionRange(pos, pos); } catch (e) {}
  });
  $all('#tab-entries .chip').forEach(function (c) {
    c.addEventListener('click', function () { S.filterType = c.dataset.f; renderEntries(); });
  });
  $all('#tab-entries .entry-row').forEach(function (r) {
    r.addEventListener('click', function () { openEntryModal(r.dataset.id); });
  });
}

/* ---- balances ---- */
function renderBalances() {
  var list = portalEntries();
  var b = computeBalances(list);
  var oweList = [], owedList = [];
  Object.keys(b).forEach(function (k) {
    if (b[k].payable > 0) oweList.push(b[k]);
    if (b[k].receivable > 0) owedList.push(b[k]);
  });
  oweList.sort(function (a, c) { return c.payable - a.payable; });
  owedList.sort(function (a, c) { return c.receivable - a.receivable; });
  var totOwe = oweList.reduce(function (s, x) { return s + x.payable; }, 0);
  var totOwed = owedList.reduce(function (s, x) { return s + x.receivable; }, 0);

  function partyCard(p, amount, cls) {
    return '<button class="party-card" data-party="' + esc(p.party) + '">' +
      '<span class="avatar">' + esc(p.party.charAt(0).toUpperCase()) + '</span>' +
      '<span class="e-main"><span class="e-desc">' + esc(p.party) + '</span><br>' +
      '<span class="e-sub">' + p.count + ' entr' + (p.count === 1 ? 'y' : 'ies') + ' · tap to see</span></span>' +
      '<span class="bal ' + cls + '">' + fmtRs(amount) + '</span></button>';
  }

  var html = '<div class="stat-grid">' +
      '<div class="stat"><div class="k">I owe · total</div><div class="v neg">' + fmtRs(totOwe) + '</div></div>' +
      '<div class="stat"><div class="k">Owed to me · total</div><div class="v pos">' + fmtRs(totOwed) + '</div></div>' +
    '</div>' +
    '<div class="section-title">I owe (payables)</div>' +
    (oweList.length ? oweList.map(function (p) { return partyCard(p, p.payable, 'owe'); }).join('')
                   : '<div class="card empty">' + icon('check') + '<p>All clear — nobody to pay.</p></div>') +
    '<div class="section-title">Owed to me (receivables)</div>' +
    (owedList.length ? owedList.map(function (p) { return partyCard(p, p.receivable, 'owed'); }).join('')
                    : '<div class="card empty">' + icon('check') + '<p>Nobody owes you right now.</p></div>');

  $('#tab-balances').innerHTML = html;
  $all('#tab-balances .party-card').forEach(function (c) {
    c.addEventListener('click', function () {
      S.filterQ = c.dataset.party; S.filterType = 'all'; S.tab = 'entries'; renderAll();
    });
  });
}

/* ---- more tab ---- */
function renderMore() {
  var u = S.user;
  var users = getUsers();

  var html = '<div class="section-title">Backup — keeps your data safe</div>' +
    '<div class="card menu-card">' +
      '<button class="menu-item" id="m-export">' + icon('download') + '<span>Export backup<span class="sub">Download all records as a JSON file</span></span></button>' +
      '<button class="menu-item" id="m-import">' + icon('upload') + '<span>Import backup<span class="sub">Restore from a JSON backup file</span></span></button>' +
    '</div>';

  if (u.isAdmin) {
    html += '<div class="section-title">Users on this device</div><div class="card menu-card">' +
      users.map(function (x) {
        var portals = (x.portals || []).map(function (p) { return '<span class="badge portal">' + p + '</span>'; }).join(' ');
        var paused = x.active === false ? ' <span class="badge paused">paused</span>' : '';
        var admin = x.isAdmin ? ' <span class="badge admin">admin</span>' : '';
        var self = x.id === u.id ? ' <span class="badge">you</span>' : '';
        var actions = x.id === u.id ? '' :
          '<button class="btn small ghost" data-act="toggle" data-id="' + x.id + '">' + (x.active === false ? 'Activate' : 'Pause') + '</button> ' +
          '<button class="btn small danger-ghost" data-act="del" data-id="' + x.id + '">Remove</button>';
        return '<div class="user-row"><span class="avatar">' + esc(x.username.charAt(0).toUpperCase()) + '</span>' +
          '<div class="e-main"><div class="e-desc">' + esc(x.username) + paused + admin + self + '</div>' +
          '<div class="e-sub">' + portals + '</div></div>' + actions + '</div>';
      }).join('') +
      '<button class="btn primary block" id="m-adduser" style="margin-top:12px">Add user</button></div>';
  }

  html += '<div class="section-title">Data</div><div class="card menu-card">' +
    '<button class="menu-item" id="m-sample">' + icon('book') + '<span>Load sample entries<span class="sub">Try the app with example data</span></span></button>' +
    '<button class="menu-item danger-item" id="m-clear">' + icon('trash') + '<span>Clear this portal\'s entries<span class="sub">Deletes all ' + (S.portal === 'personal' ? 'Personal' : 'Business') + ' entries on this device</span></span></button>' +
    '</div>' +

    '<div class="section-title">Account</div><div class="card menu-card">' +
    '<button class="menu-item" id="m-logout">' + icon('logout') + '<span>Log out<span class="sub">Logged in as ' + esc(u.username) + '</span></span></button>' +
    '</div>' +

    '<div class="card"><h3>Good to know</h3>' +
    '<p class="fineprint">Records live only in this device\'s browser — they are not synced anywhere. ' +
    'Clearing browser data erases them, so export a backup regularly (above). ' +
    'Logins on this device are family-convenience locks, not bank-grade security.</p></div>';

  $('#tab-more').innerHTML = html;

  $('#m-export').addEventListener('click', exportBackup);
  $('#m-import').addEventListener('click', function () { $('#import-file').click(); });
  $('#m-sample').addEventListener('click', loadSampleData);
  $('#m-clear').addEventListener('click', function () {
    confirmDlg('Clear entries?', 'Delete ALL ' + (S.portal === 'personal' ? 'Personal' : 'Business') +
      ' entries on this device? This cannot be undone — export a backup first.', 'Delete all', function () {
        setPortalEntries([]); renderAll(); toast('Entries cleared.');
      });
  });
  $('#m-logout').addEventListener('click', logout);
  var addBtn = $('#m-adduser');
  if (addBtn) addBtn.addEventListener('click', function () { $('#user-modal').hidden = false; });
  $all('#tab-more [data-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.act === 'toggle') adminToggleUser(b.dataset.id);
      else adminDeleteUser(b.dataset.id);
    });
  });
}

/* ---------------- JSON backup: export / import ---------------- */
function exportBackup() {
  var payload = {
    app: 'hisab', version: 1, exportedAt: new Date().toISOString(),
    exportedBy: S.user ? S.user.username : 'unknown',
    users: getUsers(),
    entries: loadJSON(LS_ENTRIES, { personal: [], business: [] })
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hisab-backup-' + dateKey(Date.now()) + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('Backup downloaded. Keep it somewhere safe.');
}

function importBackup(file) {
  var reader = new FileReader();
  reader.onload = function () {
    var data;
    try { data = JSON.parse(reader.result); }
    catch (e) { toast('That file is not valid JSON.'); return; }
    if (!data || data.app !== 'hisab' || !data.entries) { toast('Not a Hisab backup file.'); return; }
    confirmDlg('Import backup?', 'Replace ALL data on this device with the backup from ' +
      (data.exportedAt ? fmtDateTime(Date.parse(data.exportedAt)) : 'unknown date') + '?', 'Import', function () {
        if (Array.isArray(data.users) && data.users.length) saveUsers(data.users);
        var entries = { personal: [], business: [] };
        if (Array.isArray(data.entries.personal)) entries.personal = data.entries.personal;
        if (Array.isArray(data.entries.business)) entries.business = data.entries.business;
        saveJSON(LS_ENTRIES, entries);
        try { localStorage.removeItem(LS_SESSION); } catch (e) {}
        toast('Backup imported. Please log in again.');
        setTimeout(function () { location.reload(); }, 800);
      });
  };
  reader.readAsText(file);
}

/* ---------------- sample data (for trying the app) ---------------- */
function loadSampleData() {
  confirmDlg('Load samples?', 'Add example entries to the ' +
    (S.portal === 'personal' ? 'Personal' : 'Business') + ' portal so you can explore?', 'Add samples', function () {
      var now = Date.now(), day = 864e5;
      var samples = S.portal === 'personal' ? [
        { d: 'Rice, lentils & oil', a: 2450, p: 'Bhatbhateni', t: 'cash_purchase', off: 0 },
        { d: 'Vegetables', a: 380, p: 'Kalimati vendor', t: 'due_purchase', off: 0 },
        { d: 'Gave Ramesh', a: 5000, p: 'Ramesh', t: 'money_given', off: 1 },
        { d: 'Took from Sita', a: 2000, p: 'Sita', t: 'money_taken', off: 2 },
        { d: 'Paid Kalimati vendor', a: 380, p: 'Kalimati vendor', t: 'paid_back', off: 3 },
        { d: 'Ramesh returned part', a: 1500, p: 'Ramesh', t: 'received_back', off: 4 },
        { d: 'Milk (week)', a: 840, p: 'Dairy', t: 'cash_purchase', off: 5 }
      ] : [
        { d: 'Paracetamol stock', a: 8500, p: 'Sharma Suppliers', t: 'due_purchase', off: 0 },
        { d: 'Counter sale', a: 3200, p: '', t: 'cash_purchase', off: 0 },
        { d: 'Paid Sharma Suppliers', a: 5000, p: 'Sharma Suppliers', t: 'paid_back', off: 1 },
        { d: 'Antibiotics stock', a: 12000, p: 'City Pharma', t: 'due_purchase', off: 2 },
        { d: 'Gave staff advance', a: 10000, p: 'Hari', t: 'money_given', off: 3 }
      ];
      var list = portalEntries();
      samples.forEach(function (s) {
        list.push({ id: uid(), ts: now - s.off * day, type: s.t, desc: s.d,
                    amount: s.a, party: s.p, note: 'sample' });
      });
      setPortalEntries(list);
      renderAll();
      toast('Sample entries added.');
    });
}

/* ---------------- entry modal (add / edit) ---------------- */
function openEntryModal(id) {
  S.editingId = id || null;
  var e = id ? getEntry(id) : null;
  S.entryType = e ? e.type : 'cash_purchase';
  $('#entry-modal-title').textContent = e ? 'Edit entry' : 'New entry';
  $('#entry-delete').hidden = !e;
  renderTypeGrid();
  $('#f-desc').value = e ? e.desc : '';
  $('#f-amount').value = e ? e.amount : '';
  $('#f-when').value = e ? inputValueFromTs(e.ts) : inputNow();
  $('#f-party').value = e ? e.party : '';
  $('#f-note').value = e && e.note !== 'sample' ? e.note : '';
  updatePartyLabel();
  $('#entry-modal').hidden = false;
  setTimeout(function () { $('#f-desc').focus(); }, 60);
}
/* datetime-local value from an epoch ts (Kathmandu wall clock) */
function inputValueFromTs(ts) {
  var p = tzParts(ts);
  return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
}
function renderTypeGrid() {
  $('#type-grid').innerHTML = TYPE_ORDER.map(function (k) {
    var t = TYPES[k];
    return '<button type="button" class="type-btn' + (S.entryType === k ? ' active' : '') + '" data-t="' + k + '">' +
      icon(t.icon) + '<span>' + esc(t.label) + '</span></button>';
  }).join('');
  $all('#type-grid .type-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      S.entryType = b.dataset.t;
      renderTypeGrid();
      updatePartyLabel();
    });
  });
}
function updatePartyLabel() {
  $('#f-party-label').textContent = TYPES[S.entryType].partyLabel;
}
function closeEntryModal() { $('#entry-modal').hidden = true; S.editingId = null; }

function handleEntrySubmit(ev) {
  ev.preventDefault();
  var desc = $('#f-desc').value.trim();
  var amount = Number($('#f-amount').value);
  if (!desc) { toast('Add a short description.'); return; }
  if (!(amount > 0)) { toast('Enter an amount greater than 0.'); return; }
  var data = {
    ts: tsFromInput($('#f-when').value),
    type: S.entryType, desc: desc, amount: amount,
    party: $('#f-party').value.trim(), note: $('#f-note').value.trim()
  };
  if (S.editingId) { updateEntry(S.editingId, data); toast('Entry updated.'); }
  else { addEntry(data); toast('Saved — ' + fmtRs(data.amount) + '.'); }
  closeEntryModal();
  renderAll();
}

/* ---------------- init & wiring ---------------- */
document.addEventListener('DOMContentLoaded', function () {
  $('#setup-form').addEventListener('submit', handleSetup);
  $('#login-form').addEventListener('submit', handleLogin);
  $('#user-form').addEventListener('submit', adminCreateUser);

  $('#portal-personal').addEventListener('click', function () { S.portal = 'personal'; renderAll(); });
  $('#portal-business').addEventListener('click', function () { S.portal = 'business'; renderAll(); });

  $all('.nav-btn').forEach(function (b) {
    b.addEventListener('click', function () { S.tab = b.dataset.tab; renderAll(); });
  });

  $('#fab').addEventListener('click', function () { openEntryModal(null); });
  $('#user-chip').addEventListener('click', function () { S.tab = 'more'; renderAll(); });

  $('#entry-form').addEventListener('submit', handleEntrySubmit);
  $('#entry-close').addEventListener('click', closeEntryModal);
  $('#entry-cancel').addEventListener('click', closeEntryModal);
  $('#entry-delete').addEventListener('click', function () {
    var e = S.editingId ? getEntry(S.editingId) : null;
    if (!e) return;
    confirmDlg('Delete entry?', '"' + e.desc + '" — ' + fmtRs(e.amount) + ' · ' + fmtDateTime(e.ts), 'Delete', function () {
      deleteEntry(e.id);
      closeEntryModal();
      renderAll();
      toast('Entry deleted.');
    });
  });
  $('#entry-modal').addEventListener('click', function (ev) { if (ev.target === this) closeEntryModal(); });

  $('#confirm-no').addEventListener('click', function () { $('#confirm-modal').hidden = true; _confirmCb = null; });
  $('#confirm-yes').addEventListener('click', function () {
    $('#confirm-modal').hidden = true;
    var cb = _confirmCb; _confirmCb = null;
    if (cb) cb();
  });

  $('#user-close').addEventListener('click', function () { $('#user-modal').hidden = true; });
  $('#user-cancel').addEventListener('click', function () { $('#user-modal').hidden = true; });
  $('#user-modal').addEventListener('click', function (ev) { if (ev.target === this) this.hidden = true; });

  $('#import-file').addEventListener('change', function () {
    if (this.files && this.files[0]) importBackup(this.files[0]);
    this.value = '';
  });

  boot();
});
