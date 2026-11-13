/* Shared helpers: safe local storage, input validation, navigation, theme panel, toast.
   The original browser-only attendance flow is retained; server sync is explicit and authenticated. */
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));

const DEFAULTS = {
  threshold: 0.5,   // Euclidean distance: lower = same person
  margin: 0.06,     // best match must beat the 2nd person by this much
  session: 'General'
};

/* ---------------- Input validation (never trust typed text, files or stored data) ---------------- */
const Check = {
  text(v, max = 60) { return String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max); },
  name: v => Check.text(v, 60),
  roll(v) { const t = Check.text(v, 30); return /^[A-Za-z0-9][A-Za-z0-9._\-\/ ]*$/.test(t) ? t : ''; },
  cls: v => Check.text(v, 40),
  num(v, lo, hi, d) { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; },
  embedding: e => Array.isArray(e) && e.length === 128 && e.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 10),
  person(p) {
    if (!p || typeof p !== 'object') return null;
    const embeddings = Array.isArray(p.embeddings) ? p.embeddings.filter(Check.embedding).slice(0, 20) : [];
    const name = Check.name(p.name), roll = Check.roll(p.roll), id = Number(p.id);
    if (!embeddings.length || !name || !roll || !Number.isFinite(id)) return null;
    return { id, name, roll, cls: Check.cls(p.cls), embeddings, created: Check.text(p.created, 40) };
  },
  log(l) {
    if (!l || typeof l !== 'object') return null;
    const id = Number(l.id), date = String(l.date || '');
    if (!Number.isFinite(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    return { id, name: Check.name(l.name), roll: Check.text(l.roll, 30), cls: Check.cls(l.cls), session: Check.text(l.session, 40) || 'General',
      date, time: Check.text(l.time, 20), distance: Check.num(l.distance, 0, 10, 0), similarity: Check.num(l.similarity, -1, 1, 0) };
  }
};

const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Could not save: browser storage is full or blocked'); return false; } }
};

const DB = {
  // anything tampered with in the browser storage is dropped instead of crashing or running
  people:   () => { const a = store.get('people', []); return Array.isArray(a) ? a.map(Check.person).filter(Boolean) : []; },
  logs:     () => { const a = store.get('logs', []); return Array.isArray(a) ? a.map(Check.log).filter(Boolean) : []; },
  settings: () => {
    const s = store.get('settings', {}) || {};
    return { threshold: Check.num(s.threshold, 0.3, 0.8, DEFAULTS.threshold), margin: Check.num(s.margin, 0, 0.2, DEFAULTS.margin), session: Check.text(s.session, 40) || DEFAULTS.session };
  },
  save: (k, v) => store.set(k, v),
  today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
};

/* ---------------- Page chrome: header, navigation, theme panel, footer ---------------- */
function renderCollegeDateBanner() {
  if (document.getElementById('fv-date-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'fv-date-banner';
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'position:sticky;top:0;z-index:1000;padding:9px 16px;text-align:center;background:#102b46;color:#fff;font-weight:600;letter-spacing:.2px;box-shadow:0 2px 8px #0002';
  const update = () => {
    const now = new Date();
    banner.textContent = new Intl.DateTimeFormat('en-IN', { timeZone:'Asia/Kolkata', weekday:'long', day:'2-digit', month:'long', year:'numeric' }).format(now) + '  ·  ' + new Intl.DateTimeFormat('en-IN', { timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true }).format(now) + ' IST';
  };
  update(); setInterval(update, 1000);
  document.body.prepend(banner);
}

function renderChrome() {
  renderCollegeDateBanner();
  const primaryPages = [
    ['index.html', 'Home'], ['about.html', 'About'], ['register.html', 'Register face'],
    ['attendance.html', 'Attendance'], ['records.html', 'Records']
  ];
  // Keep every More destination explicit and grouped. These are real pages in this project.
  const extraGroups = [
    ['Staff dashboards', [
      ['staff-dashboards.html', 'Open staff dashboard centre'],
      ['teacher-login.html', 'Teacher sign in'], ['teacher-dashboard.html', 'Teacher dashboard (signed in)'], ['admin-login.html', 'Admin sign in'], ['admin-dashboard.html', 'Admin dashboard (signed in)'], ['guard-login.html', 'Guard sign in'], ['guard-dashboard.html', 'Guard dashboard (signed in)']
    ]],
    ['Attendance & security', [
      ['attendance-security.html', 'Open attendance & security centre'],
      ['records.html', 'Attendance reports'], ['live-monitoring.html', 'Live attendance'],
      ['gps-monitoring.html', 'GPS monitoring'], ['security-alerts.html', 'Security alerts']
    ]],
    ['Management & help', [
      ['admin.html', 'Local admin settings'], ['lab.html', 'Face vector lab'],
      ['contact.html', 'Help & contact'], ['about.html', 'About FaceVector']
    ]]
  ];
  const here = location.pathname.split('/').pop() || 'index.html';
  const nav = $('nav');
  if (nav) {
    nav.innerHTML = '<header><div class="bar"><a class="brand" href="index.html"><i></i><span>FaceVector<small>ATTENDANCE</small></span></a>' +
      '<nav class="page-nav" aria-label="Main navigation">' +
      primaryPages.map(([href, label]) => `<a href="${href}"${href === here ? ' class="on" aria-current="page"' : ''}>${label}</a>`).join('') +
      '<details class="nav-more"><summary>More</summary><div class="nav-more-menu">' +
      extraGroups.map(([group, items]) => { const hub = group === 'Staff dashboards' ? 'staff-dashboards.html' : group === 'Attendance & security' ? 'attendance-security.html' : ''; return `<section><a class="nav-more-group" href="${hub || 'admin.html'}">${group} <span aria-hidden="true">›</span></a>${items.map(([href, label]) => `<a href="${href}"${href === here ? ' class="on" aria-current="page"' : ''}>${label}</a>`).join('')}</section>`; }).join('') +
      '</div></details></nav><div class="themewrap" id="themewrap"></div></div></header>';
    // Native details provides click/touch support; these handlers add predictable dismissal.
    const more = nav.querySelector('.nav-more');
    if (more) {
      more.addEventListener('click', event => {
        if (event.target.closest('.nav-more-menu a')) more.open = false;
      });
      document.addEventListener('click', event => {
        if (!more.contains(event.target)) more.open = false;
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && more.open) {
          more.open = false;
          more.querySelector('summary').focus();
        }
      });
    }
    buildThemePanel();
  }
  const foot = $('foot');
  if (foot) foot.innerHTML = '<footer>FaceVector Attendance &middot; browser-only records stay on this device; optional server attendance requires sign-in and consent &middot; <a href="about.html">How it works</a></footer>';
  if (!$('toast')) { const t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  const s1 = $('s1');
  if (s1) {
    s1.textContent = DB.people().length;
    $('s2').textContent = new Set(DB.logs().filter(l => l.date === DB.today()).map(l => l.id)).size;
    $('s3').textContent = DB.logs().length;
  }
}

function buildThemePanel() {
  const wrap = $('themewrap'); if (!wrap || !window.Theme) return;
  wrap.innerHTML = `<button class="themebtn" id="themebtn" aria-expanded="false" aria-controls="themepanel"><i></i>Colours</button>
    <div class="themepanel" id="themepanel" role="dialog" aria-label="Colour settings" hidden>
      <section><h3>Mode</h3><div class="seg" id="modeseg">
        <button data-mode="auto">Auto</button><button data-mode="light">Light</button><button data-mode="dark">Dark</button></div></section>
      <section><h3>Colour scheme</h3><div class="swatches" id="swatches"></div></section>
      <section><h3>Custom colours</h3>
        <div class="row"><label class="colpick">Buttons &amp; links<input type="color" id="customcol" aria-label="Pick a custom accent colour"></label>
        <label class="colpick">Page background<input type="color" id="paperCol" aria-label="Pick a custom page background colour"></label></div>
        <div class="row"><button class="btn alt small" id="paperClear">Background from scheme</button><button class="btn alt small" id="themereset">Reset all</button></div></section>
    </div>`;
  const btn = $('themebtn'), panel = $('themepanel');
  $('swatches').innerHTML = Object.entries(Theme.PRESETS).map(([k, p]) =>
    `<button class="swatch" data-preset="${k}" title="${esc(p.name)}" aria-label="${esc(p.name)} colour scheme"></button>`).join('');
  document.querySelectorAll('.swatch').forEach(b => { const p = Theme.PRESETS[b.dataset.preset]; b.style.background = 'linear-gradient(135deg,' + p.accent + ' 50%,' + p.paper + ' 50%)'; });

  const sync = () => {
    const t = Theme.get();
    document.querySelectorAll('#modeseg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === t.mode)));
    document.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === t.preset)));
    $('customcol').value = t.preset === 'custom' ? t.custom : Theme.PRESETS[t.preset].accent;
    $('paperCol').value = t.paper || (t.preset === 'custom' ? '#d6efe3' : Theme.PRESETS[t.preset].paper);
  };
  const close = () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.onclick = e => { e.stopPropagation(); panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); };
  panel.onclick = e => e.stopPropagation();
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { close(); btn.focus(); } });
  $('modeseg').onclick = e => { const b = e.target.closest('button'); if (b) Theme.set({ mode: b.dataset.mode }); };
  $('swatches').onclick = e => { const b = e.target.closest('button'); if (b) Theme.set({ preset: b.dataset.preset }); };
  $('customcol').oninput = e => Theme.set({ custom: e.target.value });
  $('paperCol').oninput = e => Theme.set({ paper: e.target.value });
  $('paperClear').onclick = () => Theme.set({ paper: '' });
  $('themereset').onclick = () => Theme.reset();
  window.addEventListener('themechange', sync);
  sync();
}

let toastTimer;
function toast(msg) {
  const t = $('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function setStatus(el, msg, type = '') { if (el) { el.textContent = msg; el.className = 'status ' + type; } }

function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator();
    o.frequency.value = 880; o.connect(a.destination); o.start();
    setTimeout(() => { o.stop(); a.close(); }, 130);
  } catch (e) { /* sound is optional */ }
}

function download(filename, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// quotes the value and blocks spreadsheet formula injection (= + - @ at the start of a cell)
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };

document.addEventListener('DOMContentLoaded', renderChrome);
