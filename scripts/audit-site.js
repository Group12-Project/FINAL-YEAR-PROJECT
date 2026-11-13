#!/usr/bin/env node
'use strict';
// Dependency-free static audit across every top-level HTML page.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pages = fs.readdirSync(root).filter(name => name.endsWith('.html')).sort();
const errors = [];
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const ids = new Set();
  const duplicateIds = new Set();
  for (const match of html.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)) {
    const id = match[2];
    if (ids.has(id)) duplicateIds.add(id);
    ids.add(id);
  }
  for (const id of duplicateIds) errors.push(`${page}: duplicate id="${id}"`);
  for (const match of html.matchAll(/\b(href|src|action)\s*=\s*(["'])(.*?)\2/gi)) {
    const [, attr, , value] = match;
    if (!value || /^(?:https?:|data:|mailto:|tel:|javascript:|#)/i.test(value)) continue;
    const local = value.split(/[?#]/, 1)[0];
    if (local && !fs.existsSync(path.resolve(root, local))) errors.push(`${page}: missing local ${attr}=${value}`);
  }
  for (const match of html.matchAll(/\bhref\s*=\s*(["'])#([^"']+)\1/gi)) {
    if (!ids.has(match[2])) errors.push(`${page}: broken in-page anchor #${match[2]}`);
  }
}
if (errors.length) {
  console.error(`Site audit failed (${errors.length} issue(s)):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Site audit passed: ${pages.length} HTML pages; local assets/links, duplicate IDs, and in-page anchors checked.`);
