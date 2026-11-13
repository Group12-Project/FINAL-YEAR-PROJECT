'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../lib/attendance-core');

const vector = value => Array(128).fill(value);

test('face embeddings require 128 finite bounded numbers', () => {
  assert.equal(Core.isEmbedding(vector(0.1)), true);
  assert.equal(Core.isEmbedding(Array(127).fill(0)), false);
  assert.equal(Core.isEmbedding([...vector(0), Infinity]), false);
  assert.equal(Core.isEmbedding(vector(11)), false);
});

test('server face matcher verifies close templates and rejects unknown faces', () => {
  const students = [{ name: 'A', faceTemplates: [vector(0)] }, { name: 'B', faceTemplates: [vector(1)] }];
  assert.equal(Core.matchEmbedding(vector(0.01), students).status, 'match');
  assert.equal(Core.matchEmbedding(vector(0.8), students).status, 'unknown');
  assert.equal(Core.matchEmbedding(vector(0.01), []).status, 'unknown');
});

test('near-tied identities are reported as ambiguous', () => {
  const students = [{ name: 'A', faceTemplates: [vector(0)] }, { name: 'B', faceTemplates: [vector(0.002)] }];
  assert.equal(Core.matchEmbedding(vector(0.001), students).status, 'ambiguous');
});

test('GPS coordinate and accuracy validation rejects malformed fixes', () => {
  assert.equal(Core.validCoordinates({ lat: 22.5, lng: 88.3, accuracy: 10 }), true);
  assert.equal(Core.validCoordinates({ lat: 91, lng: 88.3, accuracy: 10 }), false);
  assert.equal(Core.validCoordinates({ lat: 22.5, lng: 88.3 }), false);
  assert.equal(Core.validCoordinates({ lat: 22.5, lng: 88.3, accuracy: -1 }), false);
});

test('geofence uses GPS accuracy bounds and haversine distance', () => {
  const campus = { lat: 0, lng: 0, radiusM: 1000 };
  assert.equal(Core.checkGeofence({ lat: 0, lng: 0, accuracy: 5 }, campus).status, 'inside');
  assert.equal(Core.checkGeofence({ lat: 0, lng: 0.02, accuracy: 5 }, campus).status, 'outside');
  assert.equal(Core.checkGeofence({ lat: 0, lng: 0.009, accuracy: 80 }, campus).status, 'uncertain');
  assert.equal(Core.checkGeofence({ lat: 0, lng: 0, accuracy: 200 }, campus, 100).status, 'low-accuracy');
  assert.equal(Core.checkGeofence({ lat: 0, lng: 0, accuracy: 5 }, null).status, 'not-configured');
  assert.ok(Math.abs(Core.haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111195) < 100);
});

test('student input allowlists fields and validates identifiers', () => {
  const data = Core.cleanStudentInput({ name: ' <Sam> Rao ', roll: ' R-4 ', className: ' 10 A ', active: false, faceTemplates: [vector(0)] });
  assert.deepEqual(data, { name: 'Sam Rao', roll: 'R-4', className: '10 A' });
  assert.equal(Core.cleanStudentInput({ name: 'Sam', roll: '<script>' }).roll, 'script');
});

test('security alert input is bounded and does not accept lifecycle fields', () => {
  const alert = Core.cleanAlertInput({ category: 'Unknown face', description: 'Review needed', priority: 'Critical', status: 'resolved', createdBy: 'spoofed' });
  assert.deepEqual(alert, { category: 'Unknown face', description: 'Review needed', priority: 'Critical' });
  assert.equal(Core.cleanAlertInput({ category: '', description: 'x' }), null);
});

test('attendance date uses the configured India timezone near midnight UTC', () => {
  assert.equal(Core.dateInZone(new Date('2026-11-07T19:00:00.000Z')), '2026-11-08');
});
