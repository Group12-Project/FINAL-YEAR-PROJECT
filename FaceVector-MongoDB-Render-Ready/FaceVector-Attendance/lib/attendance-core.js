'use strict';

const EARTH_RADIUS_M = 6371008.8;

function isEmbedding(value) {
  return Array.isArray(value) && value.length === 128 && value.every(n => Number.isFinite(n) && Math.abs(n) < 10);
}

function euclidean(a, b) {
  if (!isEmbedding(a) || !isEmbedding(b)) return Infinity;
  let sum = 0;
  for (let i = 0; i < 128; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function rankEmbedding(embedding, students) {
  if (!isEmbedding(embedding)) return [];
  return students.map(student => {
    let distance = Infinity;
    for (const template of student.faceTemplates || []) distance = Math.min(distance, euclidean(embedding, template));
    return { student, distance };
  }).filter(item => Number.isFinite(item.distance)).sort((a, b) => a.distance - b.distance);
}

function matchEmbedding(embedding, students, threshold = 0.5, margin = 0.06) {
  const ranked = rankEmbedding(embedding, students);
  if (!ranked.length) return { status: 'unknown', best: null, second: null };
  const [best, second] = ranked;
  if (best.distance >= threshold) return { status: 'unknown', best, second: second || null };
  if (second && second.distance - best.distance < margin) return { status: 'ambiguous', best, second };
  return { status: 'match', best, second: second || null };
}

function validCoordinates(value) {
  return Boolean(value && Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90 &&
    Number.isFinite(value.lng) && value.lng >= -180 && value.lng <= 180 &&
    Number.isFinite(value.accuracy) && value.accuracy >= 0 && value.accuracy <= 10000);
}

function haversineMeters(a, b) {
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat), dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat), lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, h)));
}

function checkGeofence(coordinates, zone, maxAccuracy = 100) {
  if (!zone || !Number.isFinite(zone.lat) || !Number.isFinite(zone.lng) || !Number.isFinite(zone.radiusM)) {
    return { status: 'not-configured', inside: null, distanceM: null };
  }
  if (!validCoordinates(coordinates)) return { status: 'invalid-location', inside: null, distanceM: null };
  const distanceM = haversineMeters(coordinates, zone);
  if (coordinates.accuracy > maxAccuracy) return { status: 'low-accuracy', inside: null, distanceM: Math.round(distanceM) };
  if (distanceM + coordinates.accuracy <= zone.radiusM) return { status: 'inside', inside: true, distanceM: Math.round(distanceM) };
  if (distanceM - coordinates.accuracy > zone.radiusM) return { status: 'outside', inside: false, distanceM: Math.round(distanceM) };
  return { status: 'uncertain', inside: null, distanceM: Math.round(distanceM) };
}

function dateInZone(date = new Date(), timeZone = 'Asia/Kolkata') {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function cleanText(value, max = 80) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function cleanStudentInput(input = {}) {
  const name = cleanText(input.name, 80);
  const roll = cleanText(input.roll, 30);
  if (!name || !/^[A-Za-z0-9][A-Za-z0-9._\-/ ]*$/.test(roll)) return null;
  const result = { name, roll };
  for (const [key, max] of Object.entries({ registrationNo: 40, department: 80, semester: 30, batch: 30, className: 40, phone: 30 })) {
    const value = cleanText(input[key], max);
    if (value) result[key] = value;
  }
  const email = cleanText(input.email, 254).toLowerCase();
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    result.email = email;
  }
  return result;
}

function cleanAlertInput(input = {}) {
  const category = cleanText(input.category, 60);
  const description = cleanText(input.description, 500);
  if (!category || !description) return null;
  const priority = ['Critical', 'High', 'Medium', 'Low'].includes(input.priority) ? input.priority : 'Medium';
  const result = { category, description, priority };
  const locationName = cleanText(input.locationName, 100);
  if (locationName) result.locationName = locationName;
  if (validCoordinates(input.coordinates)) result.coordinates = { lat: input.coordinates.lat, lng: input.coordinates.lng };
  return result;
}

module.exports = { isEmbedding, euclidean, rankEmbedding, matchEmbedding, validCoordinates, haversineMeters,
  checkGeofence, dateInZone, cleanText, cleanStudentInput, cleanAlertInput };
