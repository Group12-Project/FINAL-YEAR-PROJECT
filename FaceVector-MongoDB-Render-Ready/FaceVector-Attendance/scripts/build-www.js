'use strict';
// Build the static website. GitHub Actions deployment requires a separately hosted API.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
const url = (process.env.FV_SERVER_URL || '').trim().replace(/\/+$/, '');
if (process.env.GITHUB_ACTIONS === 'true' && !url) {
  console.error('\nERROR: GitHub Pages cannot host the FaceVector Node API.');
  console.error('Deploy server.js to a Node.js host, then add its HTTPS base URL as repository Actions secret FV_SERVER_URL.');
  console.error('Also set CLIENT_ORIGIN on the API host to your exact https://<username>.github.io origin.\n');
  process.exit(1);
}
if (url && !/^https:\/\/[^\s'"]+$/.test(url)) { console.error('FV_SERVER_URL must be an https:// URL'); process.exit(1); }
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(root)) if (f.endsWith('.html')) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of ['css', 'js', 'public']) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
const config = `/* Generated at build time. */\nwindow.FV_SERVER_URL = ${JSON.stringify(url)};\nwindow.FV_SERVER_CONFIG_ERROR = ${JSON.stringify(!url ? 'The FaceVector API URL is not configured. Deploy server.js to a Node.js host, set the GitHub Actions secret FV_SERVER_URL to its HTTPS URL, configure CLIENT_ORIGIN on the API host, and redeploy.' : '')};\n`;
fs.writeFileSync(path.join(out, 'js', 'config.js'), config);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('Built www/' + (url ? ' with API ' + url : ' without API (local/static preview only)'));
