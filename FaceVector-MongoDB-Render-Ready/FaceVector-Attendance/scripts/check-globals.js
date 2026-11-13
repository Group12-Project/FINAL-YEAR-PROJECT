'use strict';
// Fails if two local scripts on the same page declare the same top-level name
// (a duplicate const/let/class/function is a SyntaxError that stops the whole script).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let bad = 0;
for (const page of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  const seen = new Map();
  for (const src of srcs) {
    const file = path.join(root, src);
    if (!fs.existsSync(file)) continue;
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/^(?:async\s+)?(const|let|class|function|var)\s+([A-Za-z_$][\w$]*)/gm)) {
      const [, kind, name] = m;
      if (seen.has(name) && (kind !== 'var' || seen.get(name).kind !== 'var') && !(kind === 'function' && seen.get(name).kind === 'function')) {
        console.error(`DUPLICATE in ${page}: "${name}" declared in ${seen.get(name).src} and ${src}`); bad++;
      }
      seen.set(name, { kind, src });
    }
  }
}
if (bad) process.exit(1);
console.log('Global-declaration check passed: no conflicting top-level names across page scripts.');
