#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const pages = ['index.html', 'about.html', 'register.html', 'attendance.html', 'records.html', 'lab.html', 'admin.html', 'contact.html'];
const portals = ['teacher-login.html', 'teacher-dashboard.html', 'admin-login.html', 'admin-dashboard.html', 'guard-login.html', 'guard-dashboard.html', 'gps-monitoring.html', 'live-monitoring.html', 'security-alerts.html'];
const errors = [];
function fail(message) { errors.push(message); }
for (const page of pages) {
  const file = path.join(root, page);
  if (!fs.existsSync(file)) { fail(`Missing page: ${page}`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  if (!/<h1\b/i.test(html)) fail(`${page}: missing H1`);
  if (page === 'index.html' && !html.includes('href="teacher-login.html"')) fail('index.html: teacher sign-in link missing');
  // The shared navigation/theme and font system must be present on every main page.
  if (!html.includes('id=\"nav\"') || !html.includes('js/main.js') || !html.includes('js/theme.js')) fail(`${page}: shared navigation/theme chrome missing`);
  if (!html.includes('Space+Grotesk')) fail(`${page}: shared font missing`);
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
    const url = match[1];
    if (/^(?:https?:|data:|#|mailto:|tel:|javascript:)/i.test(url)) continue;
    const local = url.split(/[?#]/)[0];
    if (!local) continue;
    if (!fs.existsSync(path.resolve(root, local))) fail(`${page}: broken local reference ${url}`);
  }
}
for (const page of portals) {
  const file = path.join(root, page);
  if (!fs.existsSync(file)) { fail(`Missing portal page: ${page}`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  if (!/<h1\b/i.test(html)) fail(`${page}: missing H1`);
  const connectSrc = (html.match(/\bconnect-src\s+([^;"]+)/i) || [])[1] || '';
  if (!/(?:^|\s)https:(?:\s|$)/.test(connectSrc)) fail(`${page}: CSP blocks requests to a separately hosted HTTPS API`);
  if (!html.includes('id=\"nav\"') || !html.includes('js/main.js') || !html.includes('js/theme.js')) fail(`${page}: shared navigation/theme chrome missing`);
  if (!html.includes('Space+Grotesk')) fail(`${page}: shared font missing`);
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
    const url = match[1];
    if (/^(?:https?:|data:|#|mailto:|tel:|javascript:)/i.test(url)) continue;
    const local = url.split(/[?#]/)[0];
    if (local && !fs.existsSync(path.resolve(root, local))) fail(`${page}: broken local reference ${url}`);
  }
}
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const need of ['css/assistant.css', 'js/assistant-core.js', 'js/assistant.js']) if (!html.includes(need)) fail(`${page}: assistant file not loaded: ${need}`);
}
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
for (const page of pages) if (!main.includes(`'${page}'`) && !main.includes(`"${page}"`)) fail(`Shared navigation missing ${page}`);
for (const page of portals) {
  if (!main.includes(`'${page}'`) && !main.includes(`\"${page}\"`)) fail(`Shared navigation missing ${page}`);
}
for (const dir of ['js', 'public', 'lib', 'scripts']) {
  const jsDir = path.join(root, dir);
  for (const file of fs.readdirSync(jsDir).filter(f => f.endsWith('.js'))) {
    const relative = path.join(dir, file);
    const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], { encoding: 'utf8' });
    if (result.status !== 0) fail(`${relative}: JavaScript syntax check failed\n${result.stderr}`);
  }
}
const backend = spawnSync(process.execPath, ['--check', path.join(root, 'server.js')], { encoding: 'utf8' });
if (backend.status !== 0) fail(`server.js: JavaScript syntax check failed\n${backend.stderr}`);
if (errors.length) {
  console.error(`Project check failed (${errors.length} issue(s)):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Project check passed: ${pages.length} original pages, ${portals.length} portal pages, local references, shared navigation, assistant wiring, server and JavaScript syntax.`);
