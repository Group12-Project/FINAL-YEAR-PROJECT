'use strict';
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/pages.yml'), 'utf8');
const render = fs.readFileSync(path.join(__dirname, '..', 'render.yaml'), 'utf8');
const required = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_ORIGIN'];
for (const key of required) {
  if (!render.includes(`- key: ${key}`)) throw new Error(`Render Blueprint is missing ${key}`);
}
if (!workflow.includes('secrets.FV_SERVER_URL')) throw new Error('GitHub Pages workflow is missing FV_SERVER_URL');
if (pkg.scripts.start !== 'node server.js') throw new Error('Unexpected API start command');
if (!fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8').includes("process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI")) throw new Error('Production MongoDB URI guard is missing');
console.log('API deployment configuration checks passed.');
