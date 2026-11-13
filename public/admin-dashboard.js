'use strict';
document.addEventListener('DOMContentLoaded', () => {
  setupAdminTabs();
  el('checkSystemStatus')?.addEventListener('click', checkSystemStatus);
  loadAdminDashboard();
});

function setupAdminTabs() {
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  function activate(name, updateHash = true) {
    const target = tabs.some(tab => tab.dataset.tab === name) ? name : 'overview';
    tabs.forEach(tab => {
      const active = tab.dataset.tab === target;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.panel !== target; });
    if (updateHash) history.replaceState(null, '', `#${target}`);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.dataset.tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
        (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus(); activate(tabs[next].dataset.tab);
    });
  });
  activate(location.hash.slice(1), false);
}

async function checkSystemStatus() {
  const output = el('systemStatus');
  const button = el('checkSystemStatus');
  if (!output) return;
  output.textContent = 'Checking API and database…';
  if (button) button.disabled = true;
  try {
    const response = await fetch('/api/health', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
    const data = await response.json();
    output.textContent = `API: Online · Database: ${data.database || 'status unavailable'} · Checked: ${new Date(data.time || Date.now()).toLocaleString()}`;
  } catch (error) {
    output.textContent = `Connection check failed: ${error.message}`;
  } finally { if (button) button.disabled = false; }
}

async function loadAdminDashboard() {
  if (!await requireRole(['admin'])) return;
  try {
    const [stats, students, users, geofence, audit, attendance] = await Promise.all([
      api('/dashboard'), api('/students'), api('/users'), api('/geofence'), api('/audit'), api(`/attendance?date=${encodeURIComponent(appTodayKolkata())}`)
    ]);
    const statsNode = el('stats');
    if (statsNode) statsNode.innerHTML = Object.entries(stats).map(([key, value]) => `<article class="card"><small>${esc(key.replace(/[A-Z]/g, ' $&'))}</small><h2>${esc(value)}</h2></article>`).join('');
    renderRoster(students); renderUsers(users); renderGeofence(geofence); renderAudit(audit); renderAttendanceRows('attendanceRows', attendance);
    el('studentForm').addEventListener('submit', createStudent);
    el('userForm').addEventListener('submit', createUser);
    el('geofenceForm').addEventListener('submit', saveGeofence);
    el('refreshAdmin')?.addEventListener('click', loadAdminDashboard);
    el('exportRoster')?.addEventListener('click', exportRosterCsv);
    el('deactivateAllStudents')?.addEventListener('click', deactivateAllStudents);
    connectSocket(row => { addRealtimeAttendance('attendanceRows', row); refreshAdminStats(); });
  } catch (error) { notice(error.message); }
}

async function refreshAdminStats() {
  try {
    const stats = await api('/dashboard');
    el('stats').innerHTML = Object.entries(stats).map(([key, value]) => `<article class="card"><small>${esc(key.replace(/[A-Z]/g, ' $&'))}</small><h2>${esc(value)}</h2></article>`).join('');
  } catch (error) { notice(error.message); }
}

function renderRoster(students) {
  const root = el('roster');
  root.innerHTML = students.map(student => `<tr><td>${esc(student.name)}</td><td>${esc(student.roll)}</td><td>${esc(student.className || '')}</td><td><button data-deactivate-student="${esc(student._id)}">Deactivate</button> <button data-clear-template="${esc(student._id)}">Remove face template</button></td></tr>`).join('') || '<tr><td colspan="4">No active students.</td></tr>';
  root.querySelectorAll('[data-deactivate-student]').forEach(button => { button.onclick = async () => {
    if (!confirm('Deactivate this student? Past attendance remains available in reports.')) return;
    try { await api(`/students/${encodeURIComponent(button.dataset.deactivateStudent)}`, { method: 'DELETE' }); notice('Student deactivated.'); renderRoster(await api('/students')); }
    catch (error) { notice(error.message); }
  }; });
  root.querySelectorAll('[data-clear-template]').forEach(button => { button.onclick = async () => {
    if (!confirm('Permanently remove this student’s server face vectors? Past attendance remains available.')) return;
    try { await api(`/students/${encodeURIComponent(button.dataset.clearTemplate)}/face-templates`, { method: 'DELETE' }); notice('Server face vectors removed.'); }
    catch (error) { notice(error.message); }
  }; });
}

function renderUsers(users) {
  const root = el('users');
  root.innerHTML = users.map(user => `<tr><td>${esc(user.name)}</td><td>${esc(user.email)}</td><td>${esc(user.role)}</td><td>${esc((user.classes || []).join(', '))}</td><td>${user.active ? 'Active' : 'Disabled'}</td><td>${user.role === 'admin' ? '' : `<button data-user-id="${esc(user.id)}" data-active="${user.active ? 'false' : 'true'}">${user.active ? 'Disable' : 'Enable'}</button>`}</td></tr>`).join('') || '<tr><td colspan="6">No staff accounts.</td></tr>';
  root.querySelectorAll('[data-user-id]').forEach(button => { button.onclick = async () => {
    try { await api(`/users/${encodeURIComponent(button.dataset.userId)}`, { method: 'PATCH', body: JSON.stringify({ active: button.dataset.active === 'true' }) }); renderUsers(await api('/users')); notice('Account status updated.'); }
    catch (error) { notice(error.message); }
  }; });
}

function renderGeofence(data) {
  const state = el('geofenceState');
  const form = el('geofenceForm');
  if (!data.configured) { state.textContent = `No campus boundary saved. GPS checks are informational${data.required ? ' (attendance is currently required to be inside campus)' : ''}.`; return; }
  const zone = data.geofence;
  state.textContent = `${zone.name || 'Campus'} · radius ${zone.radiusM} m${data.required ? ' · required for server attendance' : ''}`;
  for (const [key, value] of Object.entries(zone)) if (form.elements[key]) form.elements[key].value = value;
}

function renderAudit(items) {
  const root = el('audit');
  root.innerHTML = items.map(entry => `<tr><td>${esc(new Date(entry.createdAt).toLocaleString())}</td><td>${esc(entry.actor?.name || entry.actor?.email || 'System')}</td><td>${esc(entry.action)}</td><td>${esc(entry.target)}</td></tr>`).join('') || '<tr><td colspan="4">No audit events.</td></tr>';
}

async function createStudent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  try { await api('/students', { method: 'POST', body: JSON.stringify(body) }); form.reset(); notice('Student added to the server roster.'); renderRoster(await api('/students')); }
  catch (error) { notice(error.message); }
}

async function createUser(event) {
  event.preventDefault();
  const form = event.currentTarget, values = Object.fromEntries(new FormData(form).entries());
  const body = { ...values, classes: values.classes.split(',').map(value => value.trim()).filter(Boolean) };
  if (body.role === 'guard') body.classes = [];
  try { await api('/users', { method: 'POST', body: JSON.stringify(body) }); form.reset(); notice('Staff account created. Share the temporary password securely.'); renderUsers(await api('/users')); }
  catch (error) { notice(error.message); }
}

async function saveGeofence(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  const body = { name: values.name, lat: Number(values.lat), lng: Number(values.lng), radiusM: Number(values.radiusM) };
  try { const result = await api('/geofence', { method: 'PUT', body: JSON.stringify(body) }); renderGeofence(result); notice('Campus boundary saved.'); }
  catch (error) { notice(error.message); }
}


async function deactivateAllStudents() {
  const confirmed = confirm('This will deactivate EVERY active registered student and remove all saved face templates. Historical attendance and audit records will remain. Continue?');
  if (!confirmed) return;
  const typed = prompt('Type CLEAR STUDENTS to confirm this action:');
  if (typed !== 'CLEAR STUDENTS') { notice('Bulk clear cancelled.'); return; }
  const button = el('deactivateAllStudents');
  if (button) button.disabled = true;
  try {
    const result = await api('/students/deactivate-all', { method: 'POST', body: '{}' });
    notice(`${result.deactivated} student registration(s) deactivated. Historical attendance retained.`);
    const [students, stats, audit] = await Promise.all([api('/students'), api('/dashboard'), api('/audit')]);
    renderRoster(students);
    el('stats').innerHTML = Object.entries(stats).map(([key, value]) => `<article class="card"><small>${esc(key.replace(/[A-Z]/g, ' $&'))}</small><h2>${esc(value)}</h2></article>`).join('');
    renderAudit(audit);
  } catch (error) { notice(error.message); }
  finally { if (button) button.disabled = false; }
}

async function exportRosterCsv() {
  try {
    const rows = await api('/students');
    const fields = ['name','roll','className','department','semester','batch','email'];
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [fields.join(','), ...rows.map(row => fields.map(field => quote(row[field])).join(','))].join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `facevector-student-roster-${appTodayKolkata()}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    notice(`Exported ${rows.length} active student record(s).`);
  } catch (error) { notice(error.message); }
}
