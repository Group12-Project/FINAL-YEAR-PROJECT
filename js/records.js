/* Server-backed attendance records and CSV export. */
'use strict';
document.addEventListener('DOMContentLoaded', () => loadServerRecords().catch(error => {
  const target = $('logs'); if (target) target.innerHTML = `<tr><td colspan="5">${esc(error.message || 'Could not load attendance records.')}</td></tr>`;
}));

let serverRecords = [];
let serverStudents = [];
async function loadServerRecords() {
  if (!await requireRole(['admin', 'teacher'])) return;
  const [records, students] = await Promise.all([api('/attendance'), api('/students')]);
  serverRecords = records;
  serverStudents = students;
  const sessions = [...new Set(records.map(row => `${row.session?.className || ''}${row.session?.label ? ` · ${row.session.label}` : ''}`.trim()).filter(Boolean))].sort();
  $('fsession').innerHTML = '<option value="">All sessions</option>' + sessions.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
  $('fdate').value = appTodayKolkata();
  ['fdate', 'fsearch', 'fsession'].forEach(id => $(id).addEventListener('input', renderServerRecords));
  $('fclear').onclick = () => { $('fdate').value = ''; $('fsearch').value = ''; $('fsession').value = ''; renderServerRecords(); };
  $('csv').onclick = exportServerRecords;
  renderServerRecords();
  connectSocket(row => {
    if (row?._id && !serverRecords.some(item => String(item._id) === String(row._id))) serverRecords.unshift(row);
    renderServerRecords();
  });
}
function selectedServerRecords() {
  const date = $('fdate').value, session = $('fsession').value, query = $('fsearch').value.trim().toLowerCase();
  return serverRecords.filter(row => {
    const label = `${row.session?.className || ''}${row.session?.label ? ` · ${row.session.label}` : ''}`.trim();
    const person = `${row.student?.name || ''} ${row.student?.roll || ''}`.toLowerCase();
    return (!date || row.date === date) && (!session || label === session) && (!query || person.includes(query));
  });
}
function renderServerRecords() {
  const rows = selectedServerRecords();
  $('logs').innerHTML = rows.length ? rows.map(row => `<tr><td>${esc(row.student?.name || 'Student')}</td><td>${esc(row.student?.roll || '')}</td><td>${esc(row.session?.className || '')}${row.session?.label ? ` · ${esc(row.session.label)}` : ''}</td><td>${esc(row.date || '')}</td><td>${esc(row.checkIn ? new Date(row.checkIn).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '')}</td></tr>`).join('') : '<tr><td colspan="5">No server attendance records match these filters.</td></tr>';
  const session = $('fsession').value;
  const eligible = serverRecords.filter(row => !session || `${row.session?.className || ''}${row.session?.label ? ` · ${row.session.label}` : ''}`.trim() === session);
  const dayCount = new Set(eligible.map(row => row.date)).size;
  $('summary').innerHTML = serverStudents.length ? serverStudents.map(student => {
    const present = new Set(eligible.filter(row => String(row.student?._id) === String(student._id)).map(row => row.date)).size;
    const pct = dayCount ? Math.min(100, Math.round(present / dayCount * 100)) : 0;
    return `<tr><td>${esc(student.name)}</td><td>${esc(student.roll)}</td><td>${present} / ${dayCount}</td><td><div class="meter ${pct < 75 ? 'low' : ''}"><i data-w="${pct}"></i></div></td><td>${pct}%</td></tr>`;
  }).join('') : '<tr><td colspan="5">No active students.</td></tr>';
  document.querySelectorAll('#summary [data-w]').forEach(node => { node.style.width = `${node.dataset.w}%`; });
  $('k1').textContent = serverRecords.length;
  $('k2').textContent = new Set(serverRecords.map(row => row.date)).size;
  $('k3').textContent = serverStudents.length;
  $('k4').textContent = new Set(serverRecords.filter(row => row.date === appTodayKolkata()).map(row => String(row.student?._id))).size;
}
function exportServerRecords() {
  const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const head = ['Name', 'Roll', 'Class', 'Session', 'Date', 'Time', 'Verification'];
  const rows = selectedServerRecords().map(row => [row.student?.name, row.student?.roll, row.session?.className, row.session?.label, row.date, row.checkIn ? new Date(row.checkIn).toISOString() : '', row.verificationMethod]);
  download(`facevector-attendance-${appTodayKolkata()}.csv`, '\ufeff' + [head, ...rows].map(row => row.map(quote).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
