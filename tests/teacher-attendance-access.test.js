const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const attendance = fs.readFileSync('js/attendance.js', 'utf8');
const server = fs.readFileSync('server.js', 'utf8');
test('attendance camera requires an authenticated teacher and an open session', () => {
  assert.match(attendance, /meResponse\.user\?\.role !== 'teacher'/);
  assert.match(attendance, /!teacherReady \|\| serverUser\?\.role !== 'teacher'/);
  assert.match(attendance, /if \(!serverSessionId\(\)\)/);
});
test('camera scans all faces in a frame for batch attendance', () => {
  assert.match(attendance, /detectAllFaces\(video/);
  assert.match(attendance, /for \(let index = 0; index < detections\.length; index\+\+\)/);
});
test('server attendance write endpoints accept teachers only', () => {
  assert.match(server, /app\.post\('\/api\/attendance', auth, allow\('teacher'\)/);
  assert.match(server, /app\.post\('\/api\/attendance\/recognize', auth, allow\('teacher'\)/);
});

const app = fs.readFileSync('public/app.js', 'utf8');
test('demo mode is fully removed', () => {
  for (const file of ['demo-login.html', 'demo-dashboard.html', 'public/demo.js']) assert.equal(fs.existsSync(file), false, file);
  for (const file of ['public/app.js', 'teacher-login.html', 'admin-login.html', 'index.html', 'js/main.js', 'staff-dashboards.html']) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /demo/i, file);
});
test('teacher signs in once: long-lived token, refresh endpoint and auto-resume', () => {
  assert.match(server, /TEACHER_JWT_EXPIRES_IN \|\| '30d'/);
  assert.match(server, /app\.post\('\/api\/auth\/refresh', auth/);
  assert.match(app, /refreshTokenIfNeeded/);
  assert.match(app, /async function resumeSession/);
});
test('attendance page asks for camera and GPS together and lets the teacher start a session', () => {
  assert.match(attendance, /startAttendanceGps\(\); \/\/ asks for location permission together with the camera/);
  assert.match(attendance, /api\('\/sessions', \{ method: 'POST'/);
});

test('teachers can register themselves from the teacher login page', () => {
  assert.match(server, /app\.post\('\/api\/auth\/register-teacher'/);
  assert.match(fs.readFileSync('teacher-login.html', 'utf8'), /id="registerForm"/);
  assert.match(app, /async function registerTeacher/);
});

test('teacher registration validates matching passwords before API submission and exposes password visibility', () => {
  const page = fs.readFileSync('teacher-login.html', 'utf8');
  assert.match(page, /id="regPasswordConfirm"/);
  assert.match(page, /id="toggleRegPassword"/);
  assert.match(app, /password !== confirmation/);
  assert.match(app, /toggleRegPassword/);
  assert.match(app, /An account with this email already exists/);
});


test('local static preview sends auth requests to the Node API on port 3000', () => {
  const vm = require('node:vm');
  const config = fs.readFileSync('js/config.js', 'utf8');
  const previewWindow = { location: { hostname: '127.0.0.1', port: '5500' } };
  vm.runInNewContext(config, { window: previewWindow });
  assert.equal(previewWindow.FV_SERVER_URL, 'http://127.0.0.1:3000');
  const nodeWindow = { location: { hostname: 'localhost', port: '3000' } };
  vm.runInNewContext(config, { window: nodeWindow });
  assert.equal(nodeWindow.FV_SERVER_URL, '');
});

test('local preview origins are allowed for the development API', () => {
  assert.ok(server.includes("'http://localhost:5500'"));
  assert.ok(server.includes("'http://127.0.0.1:5500'"));
});
