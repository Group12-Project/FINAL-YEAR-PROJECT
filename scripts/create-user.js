#!/usr/bin/env node
'use strict';
// Creates the first Admin (or any Admin/Teacher/Guard) directly in MongoDB.
//   npm run create-user                      -> asks for each value
//   npm run create-user -- --role teacher --name "A. Sharma" --email a@school.edu --classes "10-A,10-B"
// The password is always asked for here and never accepted on the command line (it would stay in shell history).
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const readline = require('node:readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { models } = require('../server');

const args = Object.fromEntries(process.argv.slice(2).flatMap((value, index, all) => value.startsWith('--') ? [[value.slice(2), all[index + 1]]] : []));
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const ask = (question, { hidden = false } = {}) => new Promise(resolve => {
  if (hidden) rl._writeToOutput = text => { if (text.includes(question)) process.stdout.write(question); };
  rl.question(question, answer => { if (hidden) { rl._writeToOutput = text => process.stdout.write(text); process.stdout.write('\n'); } resolve(answer.trim()); });
});

(async () => {
  const role = (args.role || await ask('Role (admin / teacher / guard) [admin]: ') || 'admin').toLowerCase();
  if (!['admin', 'teacher', 'guard'].includes(role)) throw new Error('Role must be admin, teacher or guard.');
  const name = args.name || await ask('Full name: ');
  const email = (args.email || await ask('Email: ')).toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A name and a valid email are required.');
  const classes = role === 'teacher' ? (args.classes ?? await ask('Assigned classes, comma separated (e.g. 10-A,10-B): ')).split(',').map(v => v.trim()).filter(Boolean) : [];
  const password = await ask('Password (12+ characters, hidden): ', { hidden: true });
  if (password.length < 12 || password.length > 200) throw new Error('Password must be 12 to 200 characters.');
  if (password !== await ask('Repeat password: ', { hidden: true })) throw new Error('Passwords did not match.');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/facevector', { serverSelectionTimeoutMS: 10000 });
  if (role === 'admin' && await models.User.exists({ role: 'admin' }) && args.force !== 'true') throw new Error('An admin already exists. Sign in as admin and create further accounts in the Admin dashboard (or pass --force true).');
  const user = await models.User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role, classes });
  console.log(`\nCreated ${role} account for ${user.email}${classes.length ? ` with classes: ${classes.join(', ')}` : ''}.`);
})().catch(error => { console.error(`\n${error.code === 11000 ? 'An account with that email already exists.' : error.message}`); process.exitCode = 1; })
  .finally(async () => { rl.close(); await mongoose.disconnect().catch(() => {}); process.exit(process.exitCode || 0); });
