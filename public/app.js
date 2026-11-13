'use strict';
const SERVER = (window.FV_SERVER_URL || location.origin).replace(/\/+$/, '');
const API = `${SERVER}/api`;
let token = localStorage.getItem('fv-token') || '';
let me = null;

async function api(path, opts = {}) {
  if (window.FV_SERVER_CONFIG_ERROR) throw Error(window.FV_SERVER_CONFIG_ERROR);
  let response;
  try {
    response = await fetch(API + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) }
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    const setup = window.FV_SERVER_URL
      ? 'Check that the API server is running, its HTTPS URL is correct, and CLIENT_ORIGIN includes this GitHub Pages website origin.'
      : 'Start the FaceVector server with npm start, then open the website from the server address.';
    throw Error(`FaceVector server is unavailable. ${setup}`);
  }
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) { localStorage.removeItem('fv-token'); token = ''; }
    if (response.status === 404 || !isJson) {
      const setup = window.FV_SERVER_URL
        ? 'Check that the FaceVector Node API is running and FV_SERVER_URL points to it. Also allow this website origin in CLIENT_ORIGIN.'
        : 'Start the FaceVector server with npm start, then open the website from the server address.';
      throw Error(`FaceVector server is unavailable. ${setup}`);
    }
    throw Error(data.error || `The FaceVector API returned HTTP ${response.status}.`);
  }
  return data;
}

function el(id) { return document.getElementById(id); }
// esc() comes from js/main.js, which every portal page loads before this file.
function notice(message) { const node = el('notice'); if (node) node.textContent = message; }

const DASHBOARDS = { admin: 'admin-dashboard.html', guard: 'guard-dashboard.html', teacher: 'teacher-dashboard.html' };
// Only same-site page names such as "attendance.html" are accepted as a post-login destination.
function safeNext() {
  const value = new URLSearchParams(location.search).get('next') || '';
  return /^[a-z0-9-]+\.html$/i.test(value) ? value : '';
}
function afterLogin(role) { location.replace(role === 'teacher' ? (safeNext() || DASHBOARDS.teacher) : DASHBOARDS[role]); }

function tokenIssuedAt(value) {
  try {
    const payload = JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Number(payload.iat) * 1000 || 0;
  } catch { return 0; }
}
// Keeps a signed-in device signed in: a token older than a day is swapped for a fresh one.
async function refreshTokenIfNeeded() {
  if (!token || Date.now() - tokenIssuedAt(token) < 24 * 60 * 60 * 1000) return;
  try {
    const data = await api('/auth/refresh', { method: 'POST', body: '{}' });
    if (data.token) { token = data.token; localStorage.setItem('fv-token', token); }
  } catch { /* the current token is still valid until it expires */ }
}

async function login(role) {
  const email = el('email')?.value?.trim();
  const password = el('password')?.value;
  const button = document.querySelector(`[data-login="${role}"]`);
  const label = `Sign in as ${role === 'admin' ? 'Administrator' : role === 'guard' ? 'Security Guard' : 'Teacher'}`;
  if (!email || !password) { notice('Enter your institutional email and password.'); return; }
  if (button) { button.disabled = true; button.textContent = 'Signing in…'; }
  notice('');
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, role }) });
    if (!data.token || data.user?.role !== role) throw Error('The server returned an invalid sign-in response.');
    token = data.token; me = data.user; localStorage.setItem('fv-token', token);
    afterLogin(role);
  } catch (error) {
    notice(error.message || 'Could not sign in. Please try again.');
    if (button) { button.disabled = false; button.textContent = label; }
  }
}

// On a sign-in page: if this device already holds a valid session, skip the form.
async function registerTeacher() {
  const value = id => el(id)?.value?.trim() || '';
  const button = el('registerSubmit');
  const name = value('regName');
  const email = value('regEmail').toLowerCase();
  const classes = value('regClasses');
  const password = el('regPassword')?.value || '';
  const confirmation = el('regPasswordConfirm')?.value || '';
  if (name.length < 2) { notice('Enter your full name.'); el('regName')?.focus(); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { notice('Enter a valid email address.'); el('regEmail')?.focus(); return; }
  if (!classes.trim()) { notice('Enter at least one class you teach.'); el('regClasses')?.focus(); return; }
  if (password.length < 8) { notice('Your password must contain at least 8 characters.'); el('regPassword')?.focus(); return; }
  if (password !== confirmation) { notice('The passwords do not match.'); el('regPasswordConfirm')?.focus(); return; }
  if (button) { button.disabled = true; button.textContent = 'Creating account…'; }
  notice('');
  try {
    const data = await api('/auth/register-teacher', { method: 'POST', body: JSON.stringify({ name, email, classes, password, code: value('regCode') }) });
    if (!data.token || data.user?.role !== 'teacher') throw Error('The server returned an invalid registration response.');
    token = data.token; me = data.user; localStorage.setItem('fv-token', token);
    afterLogin('teacher');
  } catch (error) {
    const message = error.message || 'Could not register. Please try again.';
    notice(/already exists|duplicate/i.test(message)
      ? 'An account with this email already exists. Please sign in.'
      : message);
    if (/access code/i.test(message) && el('codeBox')) el('codeBox').hidden = false;
    if (button) { button.disabled = false; button.textContent = 'Register and sign in'; }
  }
}
function showTeacherForm(register) {
  if (el('loginForm')) el('loginForm').hidden = register;
  if (el('registerForm')) el('registerForm').hidden = !register;
  notice('');
}

async function resumeSession() {
  const button = document.querySelector('[data-login]');
  if (!token || !button) return;
  const role = button.dataset.login;
  try {
    me = (await api('/me')).user;
    if (me.role === role) { notice('You are already signed in. Opening…'); afterLogin(role); }
  } catch { /* expired or unreachable: show the normal form */ }
}

async function requireRole(roles) {
  if (!token) { location.replace(`${roles[0]}-login.html${location.pathname.endsWith('attendance.html') ? '?next=attendance.html' : ''}`); return false; }
  try {
    me = (await api('/me')).user;
    if (!roles.includes(me.role)) throw Error('This account is not authorized for this page.');
    await refreshTokenIfNeeded();
    return true;
  } catch (error) {
    // api() already discards the token on a 401; a network failure keeps the user signed in.
    notice(error.message);
    if (!token && location.pathname.endsWith('-dashboard.html')) location.replace(`${roles[0]}-login.html`);
    return false;
  }
}

function logout() { localStorage.removeItem('fv-token'); token = ''; location.href = 'index.html'; }
function clock() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  if (el('clock')) el('clock').textContent = `${date.format(now)} · ${time.format(now)} IST`;
}
setInterval(clock, 1000);
document.addEventListener('DOMContentLoaded', () => {
  clock();
  resumeSession();
  if (el('registerForm')) {
    el('showLogin').onclick = () => showTeacherForm(false);
    el('showRegister').onclick = () => showTeacherForm(true);
    el('registerForm').addEventListener('submit', event => { event.preventDefault(); registerTeacher(); });
    if (new URLSearchParams(location.search).get('register')) showTeacherForm(true);
  }
  document.querySelectorAll('[data-login]').forEach(button => { if (!button.closest('form')) button.onclick = () => login(button.dataset.login); });
  const loginForm = el('loginForm');
  if (loginForm) loginForm.addEventListener('submit', event => { event.preventDefault(); const button = loginForm.querySelector('[data-login]'); if (button) login(button.dataset.login); });
  for (const [toggleId, fieldId] of [['togglePassword', 'password'], ['toggleRegPassword', 'regPassword']]) {
    const toggle = el(toggleId);
    if (!toggle) continue;
    toggle.addEventListener('click', () => {
      const field = el(fieldId);
      if (!field) return;
      const show = field.type === 'password';
      field.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      toggle.setAttribute('title', show ? 'Hide password' : 'Show password');
      toggle.setAttribute('aria-pressed', String(show));
      const showIcon = toggle.querySelector('.password-icon-show');
      const hideIcon = toggle.querySelector('.password-icon-hide');
      if (showIcon) showIcon.hidden = show;
      if (hideIcon) hideIcon.hidden = !show;
    });
  }
  document.querySelectorAll('[data-logout]').forEach(button => { button.onclick = logout; });
  if (el('createSession')) el('createSession').onclick = createSession;
  if (el('recordAttendance')) el('recordAttendance').onclick = recordAttendance;
  if (el('notifyPermission')) el('notifyPermission').onclick = requestNotificationPermission;
});

async function dashboard(role) {
  if (!await requireRole([role])) return;
  const data = await api('/dashboard');
  if (role === 'guard') { renderAlerts(data.alerts || []); connectSocket(); return; }
  const stats = el('stats');
  if (stats) stats.innerHTML = Object.entries(data).map(([key, value]) => `<article class="card"><small>${esc(key.replace(/[A-Z]/g, ' $&'))}</small><h2>${esc(value)}</h2></article>`).join('');
  if (role === 'teacher') {
    const rows = await api('/students');
    if (el('students')) el('students').innerHTML = rows.map(student => `<tr><td>${esc(student.name)}</td><td>${esc(student.roll)}</td><td>${esc(student.className || '')}</td></tr>`).join('') || '<tr><td colspan="3">No students assigned yet.</td></tr>';
    if (el('studentId')) el('studentId').innerHTML = rows.map(student => `<option value="${esc(student._id)}">${esc(student.name)} · ${esc(student.roll)}</option>`).join('');
    const recent = await api(`/attendance?date=${encodeURIComponent(appTodayKolkata())}`);
    renderAttendanceRows('attendanceRows', recent);
    await renderSessions();
    connectSocket(row => {
      addRealtimeAttendance('attendanceRows', row);
      if (row.session?.teacher === me?.id || row.session?.teacher?._id === me?.id) notice(`Attendance recorded for ${row.student?.name || 'a student'}.`);
      api('/dashboard').then(data => { if (el('stats')) el('stats').innerHTML = Object.entries(data).map(([key, value]) => `<article class="card"><small>${esc(key.replace(/[A-Z]/g, ' $&'))}</small><h2>${esc(value)}</h2></article>`).join(''); }).catch(() => {});
    });
  }
}

function appTodayKolkata() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function attendanceRowHtml(row) {
  return `<tr data-attendance-id="${esc(row._id)}"><td>${esc(row.student?.name || 'Student')}</td><td>${esc(row.student?.roll || '')}</td><td>${esc(row.session?.className || '')}${row.session?.label ? ` · ${esc(row.session.label)}` : ''}</td><td>${esc(row.checkIn ? new Date(row.checkIn).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '')}</td><td>${esc(row.verificationMethod || '')}</td></tr>`;
}
function renderAttendanceRows(targetId, rows) {
  const root = el(targetId);
  if (root) root.innerHTML = rows.map(attendanceRowHtml).join('') || '<tr><td colspan="5">No server attendance recorded today.</td></tr>';
}
function addRealtimeAttendance(targetId, row) {
  const root = el(targetId);
  if (!root || !row?._id || [...root.querySelectorAll('[data-attendance-id]')].some(item => item.dataset.attendanceId === String(row._id))) return;
  if (root.querySelector('td[colspan]')) root.innerHTML = '';
  root.insertAdjacentHTML('afterbegin', attendanceRowHtml(row));
  while (root.rows.length > 50) root.deleteRow(root.rows.length - 1);
}

async function renderSessions() {
  const node = el('sessions');
  if (!node) return;
  const rows = await api('/sessions?status=open');
  const classSelect = el('className');
  if (classSelect && me?.role === 'teacher') {
    const selectedClass = classSelect.value;
    const classes = [...new Set((me.classes || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    classSelect.innerHTML = '<option value="">Choose an assigned class</option>' + classes.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
    if (classes.includes(selectedClass)) classSelect.value = selectedClass;
    classSelect.disabled = classes.length === 0;
    if (!classes.length) notice('No classes are assigned to this teacher. Ask an administrator to assign a class.');
  }
  const sessionSelect = el('sessionId');
  if (sessionSelect) {
    const selected = sessionSelect.value;
    sessionSelect.innerHTML = rows.map(session => `<option value="${esc(session._id)}">${esc(session.className)} · ${esc(session.label || 'Session')}</option>`).join('');
    if (rows.some(session => session._id === selected)) sessionSelect.value = selected;
  }
  node.innerHTML = rows.map(session => `<article class="card"><b>${esc(session.className)}</b> · ${esc(session.label || 'Attendance session')}<small> Started ${esc(new Date(session.startedAt).toLocaleString())}</small><button data-stop-session="${esc(session._id)}">End session</button></article>`).join('') || '<p>No open sessions.</p>';
  node.querySelectorAll('[data-stop-session]').forEach(button => { button.onclick = async () => {
    try { await api(`/sessions/${encodeURIComponent(button.dataset.stopSession)}/stop`, { method: 'PATCH', body: '{}' }); await renderSessions(); notice('Attendance session ended.'); }
    catch (error) { notice(error.message); }
  }; });
}

async function createSession() {
  try {
    const className = el('className')?.value;
    if (!className) return notice('Choose one of your assigned classes first.');
    const session = await api('/sessions', { method: 'POST', body: JSON.stringify({ className, label: el('label')?.value || '' }) });
    notice(`Session started: ${session._id}`);
    if (el('sessionId')) el('sessionId').value = session._id;
    if (el('className')) el('className').value = '';
    if (el('label')) el('label').value = '';
    await renderSessions();
  } catch (error) { notice(error.message); }
}

function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(Error('Geolocation is not supported by this browser.'));
    navigator.geolocation.getCurrentPosition(position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }),
      error => reject(Error(error.message || 'Could not read your location.')), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  });
}

async function recordAttendance() {
  try {
    const gps = await getGPS();
    const data = await api('/attendance', { method: 'POST', body: JSON.stringify({ studentId: el('studentId').value, sessionId: el('sessionId').value, gps }) });
    notice(`Attendance saved at ${new Date(data.checkIn).toLocaleString()}`);
  } catch (error) { notice(error.message); }
}

function connectSocket(onAttendance) {
  if (!token) return null;
  if (!window.io) { ensureSocketClient().then(loaded => { if (loaded) connectSocket(onAttendance); }).catch(() => {}); return null; }
  if (window.__fvSocket?.connected) return window.__fvSocket;
  const socket = window.io(SERVER, { auth: { token } });
  window.__fvSocket = socket;
  socket.on('connect_error', () => notice('Live connection unavailable. Reload this page to reconnect.'));
  socket.on('security:alert', alert => {
    if (el('alerts')) api('/alerts').then(renderAlerts).catch(error => notice(error.message));
    showBrowserNotification(`GUARDGEN: ${alert.category}`, alert.description);
  });
  socket.on('security:update', alert => {
    if (el('alerts')) api('/alerts').then(renderAlerts).catch(error => notice(error.message));
    showBrowserNotification(`GUARDGEN alert ${alert.status}`, `${alert.category}: ${alert.description}`);
  });
  socket.on('attendance:new', row => { if (onAttendance) onAttendance(row); });
  return socket;
}

let socketClientPromise = null;
function ensureSocketClient() {
  if (window.io) return Promise.resolve(true);
  if (socketClientPromise) return socketClientPromise;
  socketClientPromise = fetch(`${API}/health`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then(response => { if (!response.ok) return false; return new Promise(resolve => {
      const script = document.createElement('script'); script.src = SERVER + '/socket.io/socket.io.js';
      script.onload = () => resolve(Boolean(window.io)); script.onerror = () => resolve(false); document.head.appendChild(script);
    }); }).catch(() => false);
  return socketClientPromise;
}

function showBrowserNotification(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body });
}
async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return notice('Browser notifications are not supported.');
  try { const permission = await Notification.requestPermission(); notice(permission === 'granted' ? 'Browser notifications enabled.' : 'Notification permission was not granted.'); }
  catch { notice('Could not request notification permission.'); }
}

function renderAlerts(items) {
  const list = el('alerts');
  if (!list) return;
  const canRespond = ['admin', 'guard'].includes(me?.role);
  list.innerHTML = items.map(alert => {
    const actions = canRespond && alert.status !== 'resolved' ? `<div class="row"><button data-alert-id="${esc(alert._id)}" data-action="acknowledged" ${alert.status === 'acknowledged' ? 'disabled' : ''}>Acknowledge</button><button data-alert-id="${esc(alert._id)}" data-action="resolved">Resolve</button></div>` : '';
    return `<article class="card"><b>${esc(alert.priority)} · ${esc(alert.category)}</b><p>${esc(alert.description)}</p><small>${esc(new Date(alert.createdAt).toLocaleString())} · ${esc(alert.status)}</small>${alert.responseNotes ? `<p>${esc(alert.responseNotes)}</p>` : ''}${actions}</article>`;
  }).join('') || '<p>No alerts.</p>';
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-alert-id]');
  if (button) updateAlert(button.dataset.alertId, button.dataset.action);
});
async function updateAlert(id, status) {
  try { await api(`/alerts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }); renderAlerts(await api('/alerts')); }
  catch (error) { notice(error.message); }
}
