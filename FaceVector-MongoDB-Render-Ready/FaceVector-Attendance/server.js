'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const Core = require('./lib/attendance-core');

const app = express();
const server = http.createServer(app);
const configuredOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map(v => v.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
  throw new Error('CLIENT_ORIGIN is required in production. Set it to the exact HTTPS website origin.');
}
const localDevOrigins = process.env.NODE_ENV === 'production' ? [] : [
  'http://localhost:5500', 'http://127.0.0.1:5500',
  'http://localhost:5501', 'http://127.0.0.1:5501',
  'http://localhost:5173', 'http://127.0.0.1:5173'
];
const allowedOrigins = [...new Set([...configuredOrigins, ...localDevOrigins])];
const io = new Server(server, { cors: { origin: allowedOrigins.length ? allowedOrigins : false } });
const csp = {
  defaultSrc: ["'none'"], scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
  styleSrc: ["'self'", 'https://fonts.googleapis.com', 'https://unpkg.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
  connectSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://*.tile.openstreetmap.org', 'ws:', 'wss:'],
  mediaSrc: ["'self'", 'blob:'], workerSrc: ["'self'", 'blob:'], baseUri: ["'none'"], formAction: ["'self'"], objectSrc: ["'none'"]
};
app.use(helmet({ contentSecurityPolicy: { directives: csp }, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin(origin, callback) {
  if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin is not allowed'));
} }));
app.use(express.json({ limit: '1mb', strict: true }));
// Serve only the website files. Never expose server.js, package.json, tests, scripts, docs, or lib/.
const staticOptions = { extensions: ['html'], index: 'index.html', dotfiles: 'deny' };
app.get(/^\/[\w-]*(\.html)?$/, (req, res, next) => {
  const name = req.path === '/' ? 'index.html' : (req.path.endsWith('.html') ? req.path.slice(1) : `${req.path.slice(1)}.html`);
  res.sendFile(name, { root: __dirname, dotfiles: 'deny' }, err => { if (err) next(); });
});
for (const dir of ['css', 'js', 'public']) app.use(`/${dir}`, express.static(path.join(__dirname, dir), staticOptions));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/attendance', rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));

const { Schema } = mongoose;
const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'teacher', 'guard'], required: true },
  active: { type: Boolean, default: true }, classes: { type: [String], default: [] }
}, { timestamps: true });
const studentSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 }, roll: { type: String, required: true, unique: true, trim: true, maxlength: 30 },
  registrationNo: String, department: String, semester: String, batch: String, className: { type: String, trim: true, maxlength: 40 },
  email: String, phone: String, active: { type: Boolean, default: true },
  faceTemplates: { type: [[Number]], default: [], select: false }
}, { timestamps: true });
const sessionSchema = new Schema({
  className: { type: String, required: true, trim: true, maxlength: 40 }, label: { type: String, trim: true, maxlength: 80 },
  teacher: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' }, startedAt: Date, endedAt: Date
}, { timestamps: true });
const attendanceSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true }, session: { type: Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
  date: { type: String, required: true }, checkIn: Date, checkOut: Date, recognitionStatus: String,
  gps: { lat: Number, lng: Number, accuracy: Number, insideGeofence: Boolean, distanceM: Number },
  verificationMethod: { type: String, default: 'face-server' }, recognitionDistance: Number,
  manualCorrection: { reason: String, by: Schema.Types.ObjectId, at: Date }
}, { timestamps: true });
attendanceSchema.index({ student: 1, session: 1 }, { unique: true });
const alertSchema = new Schema({
  category: { type: String, required: true, maxlength: 60 }, locationName: { type: String, maxlength: 100 }, coordinates: { lat: Number, lng: Number },
  description: { type: String, required: true, maxlength: 500 }, priority: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
  status: { type: String, enum: ['new', 'acknowledged', 'resolved'], default: 'new' }, assignedGuard: { type: Schema.Types.ObjectId, ref: 'User' },
  responseNotes: { type: String, maxlength: 500 }, createdBy: String
}, { timestamps: true });
const auditSchema = new Schema({ actor: Schema.Types.ObjectId, action: String, target: String, details: Schema.Types.Mixed, ip: String }, { timestamps: true });
const settingsSchema = new Schema({ _id: { type: String, default: 'campus' }, geofence: { lat: Number, lng: Number, radiusM: Number, name: String } }, { timestamps: true });
const bootstrapSchema = new Schema({ _id: { type: String, default: 'admin' }, status: { type: String, enum: ['available', 'claimed', 'complete'], default: 'available' } }, { timestamps: true });
const User = mongoose.model('User', userSchema);
const Student = mongoose.model('Student', studentSchema);
const Session = mongoose.model('AttendanceSession', sessionSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Alert = mongoose.model('SecurityAlert', alertSchema);
const Audit = mongoose.model('AuditLog', auditSchema);
const Settings = mongoose.model('AppSettings', settingsSchema);
const Bootstrap = mongoose.model('BootstrapState', bootstrapSchema);

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const jwtSecret = () => process.env.JWT_SECRET || '';
function auth(req, res, next) {
  Promise.resolve().then(async () => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ') || jwtSecret().length < 32) throw new Error('Invalid token');
    const payload = jwt.verify(header.slice(7), jwtSecret(), { issuer: 'facevector' });
    const account = await User.findOne({ _id: payload.sub, active: true });
    if (!account || account.role !== payload.role) throw new Error('Inactive account');
    req.user = { ...payload, name: account.name, classes: account.classes || [] };
    next();
  }).catch(() => res.status(401).json({ error: 'Authentication required' }));
}
// Teachers sign in once per device (long-lived token, refreshed while in use); admin/guard sessions stay short.
function signToken(user) {
  const expiresIn = user.role === 'teacher' ? (process.env.TEACHER_JWT_EXPIRES_IN || '30d') : (process.env.JWT_EXPIRES_IN || '8h');
  return jwt.sign({ sub: user.id, role: user.role, name: user.name, classes: user.classes || [] }, jwtSecret(), { expiresIn, issuer: 'facevector' });
}
const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Insufficient permissions' });
async function audit(req, action, target, details = {}) {
  await Audit.create({ actor: req.user?.sub, action, target: String(target || '').slice(0, 100), details, ip: req.ip });
}
const safeUser = user => ({ id: String(user._id || user.id), name: user.name, email: user.email, role: user.role, classes: user.classes || [], active: user.active !== false });
const validRoleClass = (user, className) => user.role !== 'teacher' || (user.classes || []).includes(className);
const numberSetting = (name, fallback, min, max) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
};
const geofenceEnv = () => {
  const lat = Number(process.env.CAMPUS_LAT), lng = Number(process.env.CAMPUS_LNG), radiusM = Number(process.env.CAMPUS_RADIUS_M);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180 && Number.isFinite(radiusM) && radiusM > 0 && radiusM <= 50000
    ? { lat, lng, radiusM, name: Core.cleanText(process.env.CAMPUS_NAME || 'Campus', 100) } : null;
};
async function currentGeofence() {
  const saved = await Settings.findById('campus').lean();
  return saved?.geofence || geofenceEnv();
}
function normalizeGps(input) {
  if (!Core.validCoordinates(input)) return null;
  return { lat: input.lat, lng: input.lng, accuracy: input.accuracy };
}
async function attendanceGps(input) {
  const coordinates = normalizeGps(input);
  const zone = await currentGeofence();
  const check = Core.checkGeofence(coordinates, zone, numberSetting('GPS_MAX_ACCURACY_M', 100, 1, 1000));
  if (process.env.REQUIRE_GEOFENCE === 'true' && check.status !== 'inside') {
    const message = !zone ? 'Campus geofence is not configured' : check.status === 'outside' ? 'Location is outside the campus area' : 'A precise GPS fix inside campus is required';
    return { error: message, status: check.status };
  }
  if (!coordinates && input) return { error: 'Invalid GPS coordinates', status: check.status };
  return { gps: coordinates ? { ...coordinates, insideGeofence: check.inside, distanceM: check.distanceM ?? undefined } : undefined, check };
}
async function loadSessionForUser(id, user, requireOpen = false) {
  if (!mongoose.isValidObjectId(id)) return null;
  const session = await Session.findById(id);
  if (!session || (requireOpen && session.status !== 'open')) return null;
  if (user.role === 'teacher' && (String(session.teacher) !== user.sub || !validRoleClass(user, session.className))) return null;
  return session;
}
function sendSocketAlert(alert) {
  io.to('guards').emit('security:alert', alert);
  io.to('admins').emit('security:alert', alert);
  io.to('teachers').emit('security:alert', alert);
}
async function reviewUnknownFace(req, session, coordinates, category = 'Unverified face requires review', detail = 'Attendance scan could not verify a face') {
  const now = Date.now(), key = String(session._id);
  if (now - (unknownReviewSent.get(key) || 0) < 60_000) return;
  unknownReviewSent.set(key, now);
  for (const [k, at] of unknownReviewSent) if (now - at > 10 * 60_000) unknownReviewSent.delete(k);
  const alert = await Alert.create({ category, description: `${detail} in ${session.className}${session.label ? ` · ${session.label}` : ''}. Please review in person.`, priority: 'Medium', coordinates: coordinates ? { lat: coordinates.lat, lng: coordinates.lng } : undefined, createdBy: req.user.sub });
  sendSocketAlert(alert);
  await audit(req, 'alert.face_review', alert.id, { session: String(session._id) });
}
const unknownReviewSent = new Map();

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'FaceVector API', time: new Date().toISOString(), database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password, role } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !['admin', 'teacher', 'guard'].includes(role)) return res.status(400).json({ error: 'Email, password and role are required' });
  if (email.length > 254 || password.length > 200) return res.status(400).json({ error: 'Invalid credentials' });
  const user = await User.findOne({ email: email.trim().toLowerCase(), role, active: true }).select('+passwordHash');
  if (!user || !await bcrypt.compare(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });
  if (jwtSecret().length < 32) return res.status(503).json({ error: 'Server authentication is not configured' });
  const token = signToken(user);
  await Audit.create({ actor: user._id, action: 'login', target: user.role, ip: req.ip });
  res.json({ token, user: safeUser(user) });
}));
// Teachers can register themselves (set ALLOW_TEACHER_SIGNUP=false to turn off, TEACHER_SIGNUP_CODE to require a school code).
app.post('/api/auth/register-teacher', asyncRoute(async (req, res) => {
  if (process.env.ALLOW_TEACHER_SIGNUP === 'false') return res.status(403).json({ error: 'Teacher registration is turned off. Ask your administrator for an account.' });
  const required = process.env.TEACHER_SIGNUP_CODE || '';
  if (required && String(req.body?.code || '') !== required) return res.status(403).json({ error: 'The school access code is not correct.' });
  const { name, email, password } = req.body || {};
  const cleanName = Core.cleanText(name, 80), cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const rawClasses = Array.isArray(req.body?.classes) ? req.body.classes : String(req.body?.classes || '').split(',');
  const classes = [...new Set(rawClasses.map(value => Core.cleanText(value, 40)).filter(Boolean))].slice(0, 20);
  if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || typeof password !== 'string' || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Enter your name, a valid email and a password of at least 8 characters.' });
  if (!classes.length) return res.status(400).json({ error: 'Enter at least one class you teach, e.g. 10-A.' });
  if (jwtSecret().length < 32) return res.status(503).json({ error: 'Server authentication is not configured' });
  try {
    const user = await User.create({ name: cleanName, email: cleanEmail, passwordHash: await bcrypt.hash(password, 12), role: 'teacher', classes });
    await Audit.create({ actor: user._id, action: 'teacher.register', target: 'teacher', ip: req.ip });
    res.status(201).json({ token: signToken(user), user: safeUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    throw error;
  }
}));
// Keeps a device signed in: swaps a still-valid token for a fresh one (account must still be active).
app.post('/api/auth/refresh', auth, asyncRoute(async (req, res) => {
  const user = await User.findOne({ _id: req.user.sub, active: true });
  if (!user) return res.status(401).json({ error: 'Account is inactive' });
  res.json({ token: signToken(user), user: safeUser(user) });
}));
app.post('/api/auth/bootstrap-admin', asyncRoute(async (req, res) => {
  if (process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true') return res.status(403).json({ error: 'Bootstrap disabled' });
  const { name, email, password, bootstrapKey } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 12 || password.length > 200) return res.status(400).json({ error: 'Name, valid email, and a password of at least 12 characters are required' });
  const configuredKey = process.env.BOOTSTRAP_KEY || '';
  if (configuredKey.length < 32 || /replace|example|change.?me/i.test(configuredKey)) return res.status(503).json({ error: 'Set a strong one-time BOOTSTRAP_KEY before enabling setup' });
  if (String(bootstrapKey || '') !== configuredKey) return res.status(403).json({ error: 'Invalid bootstrap key' });
  const exists = await User.exists({ role: 'admin' });
  if (exists) return res.status(409).json({ error: 'Initial admin has already been created' });
  let claimed;
  try {
    let bootstrapState = await Bootstrap.findById('admin');
    if (!bootstrapState) {
      try { bootstrapState = await Bootstrap.create({ _id: 'admin', status: 'available' }); }
      catch (error) { if (error.code !== 11000) throw error; bootstrapState = await Bootstrap.findById('admin'); }
    }
    claimed = await Bootstrap.findOneAndUpdate({ _id: 'admin', status: 'available' }, { $set: { status: 'claimed' } }, { new: true });
    if (!claimed || claimed.status !== 'claimed') return res.status(409).json({ error: 'Initial admin setup is already in progress or complete' });
    const user = await User.create({ name: Core.cleanText(name, 80), email: email.trim().toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
    await Bootstrap.findByIdAndUpdate('admin', { $set: { status: 'complete' } });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (error) {
    if (claimed) await Bootstrap.findByIdAndUpdate('admin', { $set: { status: 'available' } }).catch(() => {});
    if (error.code === 11000) return res.status(409).json({ error: 'Initial admin is already set up or the account already exists' });
    throw error;
  }
}));
app.get('/api/me', auth, asyncRoute(async (req, res) => {
  const user = await User.findById(req.user.sub);
  if (!user || !user.active) return res.status(401).json({ error: 'Account is inactive' });
  res.json({ user: safeUser(user) });
}));

app.get('/api/users', auth, allow('admin'), asyncRoute(async (req, res) => {
  const users = await User.find().select('name email role active classes createdAt').sort({ role: 1, name: 1 });
  res.json(users.map(safeUser));
}));
app.post('/api/users', auth, allow('admin'), asyncRoute(async (req, res) => {
  const { name, email, password, role, classes = [] } = req.body || {};
  const cleanName = Core.cleanText(name, 80), cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || !['teacher', 'guard'].includes(role) || typeof password !== 'string' || password.length < 12 || password.length > 200 || !Array.isArray(classes)) return res.status(400).json({ error: 'Provide a valid name, email, teacher/guard role and password (12+ characters)' });
  const classList = [...new Set(classes.map(value => Core.cleanText(value, 40)).filter(Boolean))].slice(0, 50);
  if (role === 'guard' && classList.length) return res.status(400).json({ error: 'Guard accounts do not have class assignments' });
  try {
    const user = await User.create({ name: cleanName, email: cleanEmail, passwordHash: await bcrypt.hash(password, 12), role, classes: classList });
    await audit(req, 'user.create', user.id, { role });
    res.status(201).json(safeUser(user));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account already uses that email' });
    throw error;
  }
}));
app.patch('/api/users/:id', auth, allow('admin'), asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'User not found' });
  const user = await User.findById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'User not found' });
  if (typeof req.body?.active === 'boolean') user.active = req.body.active;
  if (req.body?.classes !== undefined) {
    if (user.role !== 'teacher' || !Array.isArray(req.body.classes)) return res.status(400).json({ error: 'Invalid class assignments' });
    user.classes = [...new Set(req.body.classes.map(value => Core.cleanText(value, 40)).filter(Boolean))].slice(0, 50);
  }
  await user.save();
  await audit(req, user.active ? 'user.update' : 'user.deactivate', user.id, { role: user.role });
  io.in(`user:${user.id}`).disconnectSockets(true);
  res.json(safeUser(user));
}));

app.get('/api/students', auth, allow('admin', 'teacher'), asyncRoute(async (req, res) => {
  const filter = { active: true };
  if (req.user.role === 'teacher') {
    const classes = req.user.classes || [];
    if (req.query.className && !classes.includes(String(req.query.className))) return res.status(403).json({ error: 'Class not assigned' });
    filter.className = req.query.className ? String(req.query.className) : { $in: classes };
  } else if (req.query.className) filter.className = String(req.query.className);
  if (req.query.roll) filter.roll = String(req.query.roll).slice(0, 30);
  const students = await Student.find(filter).select('-faceTemplates').sort('roll').limit(1000);
  res.json(students);
}));
app.post('/api/students/deactivate-all', auth, allow('admin'), asyncRoute(async (req, res) => {
  const result = await Student.updateMany({ active: true }, { $set: { active: false, faceTemplates: [] } });
  await audit(req, 'student.deactivate_all', 'all-active-students', { count: result.modifiedCount || 0 });
  res.json({ ok: true, deactivated: result.modifiedCount || 0 });
}));
app.post('/api/students', auth, allow('admin'), asyncRoute(async (req, res) => {
  const data = Core.cleanStudentInput(req.body);
  if (!data) return res.status(400).json({ error: 'Provide a valid name and roll number' });
  try {
    const student = await Student.create(data);
    await audit(req, 'student.create', student.id);
    res.status(201).json(student);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Roll number already exists' });
    throw error;
  }
}));
app.patch('/api/students/:id', auth, allow('admin'), asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Student not found' });
  const current = await Student.findById(req.params.id).select('-faceTemplates');
  if (!current) return res.status(404).json({ error: 'Student not found' });
  const safe = {};
  for (const key of ['name', 'roll', 'registrationNo', 'department', 'semester', 'batch', 'className', 'email', 'phone']) if (req.body?.[key] !== undefined) safe[key] = req.body[key];
  const data = Core.cleanStudentInput({ ...current.toObject(), ...safe });
  if (!data) return res.status(400).json({ error: 'Invalid student details' });
  let student;
  try { student = await Student.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true }).select('-faceTemplates'); }
  catch (error) { if (error.code === 11000) return res.status(409).json({ error: 'Roll number already exists' }); throw error; }
  if (!student) return res.status(404).json({ error: 'Student not found' });
  await audit(req, 'student.update', student.id);
  res.json(student);
}));
app.delete('/api/students/:id', auth, allow('admin'), asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Student not found' });
  const student = await Student.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { new: true });
  if (!student) return res.status(404).json({ error: 'Student not found' });
  await audit(req, 'student.deactivate', student.id);
  res.json({ ok: true });
}));
app.post('/api/students/:id/face-templates', auth, allow('admin', 'teacher'), asyncRoute(async (req, res) => {
  const templates = req.body?.templates;
  if (!Array.isArray(templates) || !templates.length || templates.length > 20 || templates.some(template => !Core.isEmbedding(template))) return res.status(400).json({ error: 'Expected 1–20 valid 128-dimensional face embeddings' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Student not found' });
  const student = await Student.findById(req.params.id);
  if (!student || !student.active) return res.status(404).json({ error: 'Student not found' });
  if (req.user.role === 'teacher' && !validRoleClass(req.user, student.className)) return res.status(403).json({ error: 'Student is outside your assigned classes' });
  student.faceTemplates = templates;
  await student.save();
  await audit(req, 'face_templates.update', student.id, { count: templates.length });
  res.json({ ok: true, count: templates.length });
}));
app.delete('/api/students/:id/face-templates', auth, allow('admin'), asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Student not found' });
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  student.faceTemplates = [];
  await student.save();
  await audit(req, 'face_templates.delete', student.id);
  res.json({ ok: true });
}));

app.get('/api/sessions', auth, allow('admin', 'teacher'), asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    if (!['open', 'closed'].includes(String(req.query.status))) return res.status(400).json({ error: 'Invalid session status' });
    filter.status = String(req.query.status);
  }
  if (req.user.role === 'teacher') {
    filter.className = { $in: req.user.classes || [] };
    filter.teacher = req.user.sub;
  } else if (req.query.className) filter.className = String(req.query.className);
  const sessions = await Session.find(filter).sort({ startedAt: -1 }).limit(200).populate('teacher', 'name email');
  res.json(sessions);
}));
app.post('/api/sessions', auth, allow('admin', 'teacher'), asyncRoute(async (req, res) => {
  const className = Core.cleanText(req.body?.className, 40), label = Core.cleanText(req.body?.label, 80);
  if (!className) return res.status(400).json({ error: 'Class is required' });
  if (!validRoleClass(req.user, className)) return res.status(403).json({ error: 'Class not assigned' });
  let teacherId = req.user.sub;
  if (req.user.role === 'admin' && req.body?.teacherId) {
    const teacher = await User.findOne({ _id: req.body.teacherId, role: 'teacher', active: true });
    if (!teacher) return res.status(400).json({ error: 'Active teacher not found' });
    if (!teacher.classes.includes(className)) return res.status(400).json({ error: 'The teacher is not assigned to this class' });
    teacherId = teacher.id;
  }
  const session = await Session.create({ className, label, teacher: teacherId, status: 'open', startedAt: new Date() });
  await audit(req, 'session.start', session.id, { className });
  res.status(201).json(session);
}));
app.patch('/api/sessions/:id/stop', auth, allow('admin', 'teacher'), asyncRoute(async (req, res) => {
  const session = await loadSessionForUser(req.params.id, req.user);
  if (!session) return res.status(404).json({ error: 'Session not found or not assigned to you' });
  if (session.status === 'closed') return res.json(session);
  session.status = 'closed'; session.endedAt = new Date(); await session.save();
  await audit(req, 'session.stop', session.id);
  res.json(session);
}));

async function createAttendance({ req, session, student, gpsResult, verificationMethod, recognitionDistance, recognitionStatus }) {
  const row = await Attendance.create({ student: student._id, session: session._id, date: Core.dateInZone(), checkIn: new Date(),
    recognitionStatus, verificationMethod, recognitionDistance, gps: gpsResult.gps });
  const populated = await Attendance.findById(row._id).populate('student', 'name roll className').populate('session', 'className label teacher');
  const event = { _id: String(populated._id), student: populated.student && { _id: String(populated.student._id), name: populated.student.name, roll: populated.student.roll, className: populated.student.className },
    session: populated.session && { _id: String(populated.session._id), className: populated.session.className, label: populated.session.label, teacher: String(populated.session.teacher) },
    date: populated.date, checkIn: populated.checkIn, verificationMethod: populated.verificationMethod };
  io.to(`teacher:${session.className}`).emit('attendance:new', event);
  io.to('admins').emit('attendance:new', event);
  await audit(req, 'attendance.create', row.id, { method: verificationMethod, session: String(session._id) });
  return populated;
}
app.post('/api/attendance', auth, allow('teacher'), asyncRoute(async (req, res) => {
  const session = await loadSessionForUser(req.body?.sessionId, req.user, true);
  if (!session) return res.status(400).json({ error: 'Open attendance session not found or not assigned to you' });
  if (!mongoose.isValidObjectId(req.body?.studentId)) return res.status(404).json({ error: 'Student not found' });
  const student = await Student.findOne({ _id: req.body.studentId, active: true });
  if (!student || student.className !== session.className || (req.user.role === 'teacher' && !validRoleClass(req.user, student.className))) return res.status(404).json({ error: 'Student not found in this class' });
  const gpsResult = await attendanceGps(req.body?.gps);
  if (gpsResult.error) return res.status(403).json({ error: gpsResult.error, gpsStatus: gpsResult.status });
  try {
    const row = await createAttendance({ req, session, student, gpsResult, verificationMethod: 'manual-verified', recognitionStatus: 'manual-verified' });
    res.status(201).json(row);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Already marked in this session' });
    throw error;
  }
}));
app.post('/api/attendance/recognize', auth, allow('teacher'), asyncRoute(async (req, res) => {
  const { embedding } = req.body || {};
  if (!Core.isEmbedding(embedding)) return res.status(400).json({ error: 'Expected a valid 128-dimensional face embedding' });
  const session = await loadSessionForUser(req.body?.sessionId, req.user, true);
  if (!session) return res.status(400).json({ error: 'Open attendance session not found or not assigned to you' });
  const gpsResult = await attendanceGps(req.body?.gps);
  if (!req.body?.gps || gpsResult.error || (gpsResult.check?.status === 'outside' && await currentGeofence())) {
    const reason = gpsResult.error || (gpsResult.check?.status === 'outside' ? 'device is outside the configured campus boundary' : 'no GPS location was supplied');
    await reviewUnknownFace(req, session, normalizeGps(req.body?.gps), 'Attendance location verification failed', `Attendance was not accepted: ${reason}`);
    return res.status(403).json({ error: reason || 'GPS location is required for server attendance', gpsStatus: gpsResult.status });
  }
  const students = await Student.find({ active: true, className: session.className }).select('+faceTemplates');
  const match = Core.matchEmbedding(embedding, students, numberSetting('FACE_MATCH_THRESHOLD', 0.5, 0.3, 0.8), numberSetting('FACE_MATCH_MARGIN', 0.06, 0, 0.2));
  if (match.status !== 'match') {
    if (match.status === 'unknown') await reviewUnknownFace(req, session, gpsResult.gps);
    else if (match.status === 'ambiguous') await reviewUnknownFace(req, session, gpsResult.gps, 'Ambiguous face match requires review', 'The face matched multiple students and attendance was not marked');
    return res.json({ status: match.status });
  }
  try {
    const row = await createAttendance({ req, session, student: match.best.student, gpsResult, verificationMethod: 'face-server', recognitionStatus: 'verified', recognitionDistance: +match.best.distance.toFixed(4) });
    res.status(201).json({ status: 'marked', attendance: row, student: { id: match.best.student.id, name: match.best.student.name, roll: match.best.student.roll }, distance: +match.best.distance.toFixed(4) });
  } catch (error) {
    if (error.code === 11000) return res.json({ status: 'duplicate', student: { id: match.best.student.id, name: match.best.student.name, roll: match.best.student.roll } });
    throw error;
  }
}));
app.get('/api/attendance', auth, allow('admin', 'teacher'), asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date))) filter.date = String(req.query.date);
  if (req.user.role === 'teacher') {
    const allowedSessions = await Session.find({ teacher: req.user.sub, className: { $in: req.user.classes || [] } }).distinct('_id');
    filter.session = req.query.sessionId && mongoose.isValidObjectId(req.query.sessionId) ? { $in: allowedSessions.filter(id => String(id) === String(req.query.sessionId)) } : { $in: allowedSessions };
  } else if (req.query.sessionId) {
    if (!mongoose.isValidObjectId(req.query.sessionId)) return res.status(400).json({ error: 'Invalid session ID' });
    filter.session = req.query.sessionId;
  }
  const rows = await Attendance.find(filter).populate('student', 'name roll className').populate('session', 'className label teacher').sort({ checkIn: -1 }).limit(2000);
  res.json(rows);
}));

app.get('/api/dashboard', auth, allow('admin', 'teacher', 'guard'), asyncRoute(async (req, res) => {
  if (req.user.role === 'guard') return res.json({ alerts: await Alert.find().sort({ createdAt: -1 }).limit(100) });
  const today = Core.dateInZone();
  const studentFilter = req.user.role === 'teacher' ? { active: true, className: { $in: req.user.classes || [] } } : { active: true };
  const sessionFilter = req.user.role === 'teacher' ? { teacher: req.user.sub, className: { $in: req.user.classes || [] } } : {};
  const [studentIds, sessionIds] = await Promise.all([
    Student.find(studentFilter).distinct('_id'),
    req.user.role === 'teacher' ? Session.find(sessionFilter).distinct('_id') : Promise.resolve(null)
  ]);
  const attendanceFilter = { date: today, student: { $in: studentIds }, ...(sessionIds ? { session: { $in: sessionIds } } : {}) };
  const [students, presentIds, teachers, guards, sessions, alerts] = await Promise.all([
    studentIds.length, Attendance.distinct('student', attendanceFilter), User.countDocuments({ role: 'teacher', active: true }),
    User.countDocuments({ role: 'guard', active: true }), Session.countDocuments(sessionFilter), Alert.countDocuments({ status: 'new' })
  ]);
  const present = presentIds.length;
  res.json({ students, present: Math.min(students, present), absent: Math.max(0, students - present), teachers, guards, sessions, openAlerts: alerts });
}));

app.get('/api/geofence', auth, allow('admin', 'teacher', 'guard'), asyncRoute(async (req, res) => {
  const zone = await currentGeofence();
  res.json({ configured: Boolean(zone), geofence: zone || null, required: process.env.REQUIRE_GEOFENCE === 'true', maxAccuracyM: numberSetting('GPS_MAX_ACCURACY_M', 100, 1, 1000) });
}));
app.put('/api/geofence', auth, allow('admin'), asyncRoute(async (req, res) => {
  const { lat, lng, radiusM, name } = req.body || {};
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || !Number.isFinite(radiusM) || radiusM < 25 || radiusM > 50000) return res.status(400).json({ error: 'Provide valid coordinates and a radius from 25 to 50,000 metres' });
  const geofence = { lat, lng, radiusM, name: Core.cleanText(name || 'Campus', 100) || 'Campus' };
  await Settings.findByIdAndUpdate('campus', { $set: { geofence } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  await audit(req, 'geofence.update', 'campus', { radiusM });
  res.json({ configured: true, geofence, required: process.env.REQUIRE_GEOFENCE === 'true' });
}));
app.post('/api/geofence/check', rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }), auth, allow('admin', 'teacher', 'guard'), asyncRoute(async (req, res) => {
  const coordinates = normalizeGps(req.body?.coordinates);
  if (!coordinates) return res.status(400).json({ error: 'Valid latitude, longitude and GPS accuracy are required' });
  const zone = await currentGeofence();
  res.json({ ...Core.checkGeofence(coordinates, zone, numberSetting('GPS_MAX_ACCURACY_M', 100, 1, 1000)), configured: Boolean(zone), required: process.env.REQUIRE_GEOFENCE === 'true' });
}));
app.get('/api/alerts', auth, allow('admin', 'guard', 'teacher'), asyncRoute(async (req, res) => res.json(await Alert.find().sort({ createdAt: -1 }).limit(300))));
app.post('/api/alerts', auth, allow('admin', 'guard', 'teacher'), asyncRoute(async (req, res) => {
  const data = Core.cleanAlertInput(req.body);
  if (!data) return res.status(400).json({ error: 'Category and description are required' });
  const alert = await Alert.create({ ...data, createdBy: req.user.sub });
  sendSocketAlert(alert);
  await audit(req, 'alert.create', alert.id, { category: alert.category, priority: alert.priority });
  res.status(201).json(alert);
}));
app.patch('/api/alerts/:id', auth, allow('admin', 'guard'), asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Alert not found' });
  const { status, responseNotes } = req.body || {};
  if (!['acknowledged', 'resolved'].includes(status)) return res.status(400).json({ error: 'Invalid alert status' });
  if (responseNotes !== undefined && typeof responseNotes !== 'string') return res.status(400).json({ error: 'Response notes must be text' });
  const update = { status, ...(responseNotes !== undefined ? { responseNotes: Core.cleanText(responseNotes, 500) } : {}) };
  if (req.user.role === 'guard') update.assignedGuard = req.user.sub;
  const alert = await Alert.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  io.to('admins').emit('security:update', alert); io.to('teachers').emit('security:update', alert); io.to('guards').emit('security:update', alert);
  await audit(req, 'alert.update', alert.id, { status });
  res.json(alert);
}));
app.get('/api/audit', auth, allow('admin'), asyncRoute(async (req, res) => {
  const logs = await Audit.find().sort({ createdAt: -1 }).limit(500).populate('actor', 'name email role');
  res.json(logs);
}));

io.use((socket, next) => {
  Promise.resolve().then(async () => {
    const token = socket.handshake.auth?.token;
    if (jwtSecret().length < 32) throw new Error('Invalid token');
    const payload = jwt.verify(token, jwtSecret(), { issuer: 'facevector' });
    if (!['admin', 'teacher', 'guard'].includes(payload.role)) throw new Error('Invalid role');
    const account = await User.findOne({ _id: payload.sub, active: true }).select('_id role classes');
    if (!account || account.role !== payload.role) throw new Error('Inactive account');
    payload.classes = account.classes || [];
    socket.user = payload;
    next();
  }).catch(() => next(new Error('Unauthorized')));
});
io.on('connection', socket => {
  socket.join(`user:${socket.user.sub}`);
  if (Number.isFinite(socket.user.exp)) {
    const remaining = Math.max(0, socket.user.exp * 1000 - Date.now());
    socket.data.expirationTimer = setTimeout(() => socket.disconnect(true), remaining);
    socket.on('disconnect', () => clearTimeout(socket.data.expirationTimer));
  }
  if (socket.user.role === 'guard') socket.join('guards');
  if (socket.user.role === 'admin') socket.join('admins');
  if (socket.user.role === 'teacher') {
    socket.join('teachers');
    for (const className of socket.user.classes || []) socket.join(`teacher:${className}`);
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request body' });
  if (err?.name === 'ValidationError' || err?.name === 'CastError') return res.status(400).json({ error: 'Invalid request data' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in production; configure MongoDB Atlas on your hosting provider.');
  if (jwtSecret().length < 32 || /replace|change.?me|example/i.test(jwtSecret())) throw new Error('Set JWT_SECRET to a random value of at least 32 characters before starting the server.');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/facevector', { serverSelectionTimeoutMS: 10000 });
  const port = Number(process.env.PORT || 3000);
  await new Promise((resolve, reject) => server.once('error', reject).listen(port, resolve));
  console.log(`FaceVector Attendance listening at http://localhost:${port}`);
}

if (require.main === module) start().catch(error => { console.error('FaceVector server could not start:', error.message); process.exitCode = 1; });
module.exports = { app, server, io, start, models: { User, Student, Session, Attendance, Alert, Audit, Settings }, helpers: Core };
