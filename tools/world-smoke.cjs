'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
require(path.join(__dirname, '..', 'src', 'world.js'));
const CityWorld = globalThis.CityWorld;
const checks = [];
function test(name, run) {
  run();
  checks.push(name);
}
function simulate(world, seconds, input, hz = 60) {
  for (let i = 0; i < Math.round(seconds * hz); i++) world.update(1 / hz, input);
}
function place(world, x, y, z, yaw = 0) {
  Object.assign(world.player, { x, y, z, yaw, pitch: 0, vx: 0, vy: 0, vz: 0 });
}
const eye = CityWorld.EYE_HEIGHT;
test('Procedural blocks are deterministic and preserve negative coordinate geometry', () => {
  for (let bx = -8; bx <= 8; bx++) for (let bz = -8; bz <= 8; bz++) {
    for (let id = 0; id < 4; id++) {
      const b = CityWorld.building(bx, bz, id);
      assert.deepEqual(b, CityWorld.building(bx, bz, id));
      assert.ok(b.minX >= bx * 48 && b.maxX < (bx + 1) * 48);
      assert.ok(b.minZ >= bz * 48 && b.maxZ < (bz + 1) * 48);
      assert.ok(b.height >= 12 && b.height <= 80);
    }
  }
  assert.equal(CityWorld.districtAt(-0.01, -0.01).key, '-1,-1');
  assert.equal(CityWorld.districtAt(0, 0).key, '0,0');
});
test('Walking collides with building walls in positive and negative blocks', () => {
  for (const cell of [0, -1, -15, 15]) {
    const w = new CityWorld();
    const b = CityWorld.building(cell, cell, 0);
    place(w, (b.minX + b.maxX) / 2, eye, b.minZ - 4);
    simulate(w, 3, { forward: 1, boost: true });
    assert.ok(w.player.z < b.minZ && w.player.z > b.minZ - 1, JSON.stringify(w.inspect()));
    assert.equal(w.player.y, eye);
    assert.ok(w.grounded);
  }
});
test('Flying collides below roofs and crosses above roofs, then lands safely', () => {
  const w = new CityWorld();
  const b = CityWorld.building(0, 0, 0);
  w.toggleFlight();
  place(w, 16, b.height * 0.5, b.minZ - 4);
  simulate(w, 2, { forward: 1, boost: true });
  assert.ok(w.player.z < b.minZ);
  place(w, 16, b.height + eye + 6, b.minZ - 4);
  simulate(w, 0.5, { forward: 1 });
  assert.ok(w.player.z > b.minZ && w.player.z < b.maxZ);
  w.player.vz = 0;
  w.toggleFlight();
  simulate(w, 4, {});
  const landedSurface = w.groundAt(w.player.x, w.player.z);
  assert.equal(landedSurface, b.height + (b.height > 40 ? 3 : 0));
  assert.ok(Math.abs(w.player.y - landedSurface - eye) < 0.01);
  assert.ok(w.grounded);
});
test('Rooftop equipment matches visible height and blocks walking at its side', () => {
  const w = new CityWorld();
  const b = CityWorld.building(0, 0, 0);
  assert.ok(b.height > 40, 'Test fixture must include rooftop equipment.');
  assert.equal(w.groundAt(16, 16), b.height + 3);
  assert.equal(w.groundAt(11, 11), b.height);
  place(w, 16, b.height + eye, 11);
  simulate(w, 2, { forward: 1 });
  assert.ok(w.player.z < 13 && w.player.z > 12);
  assert.ok(Math.abs(w.player.y - b.height - eye) < 0.01);
});
test('Diagonal normalization and frame-rate independence keep speed stable', () => {
  const distances = [];
  for (const hz of [30, 60, 144]) {
    const w = new CityWorld();
    place(w, 0, 160, 0);
    w.toggleFlight();
    simulate(w, 4, { forward: 1, strafe: 1 }, hz);
    assert.ok(Math.abs(Math.hypot(w.player.vx, w.player.vz) - 24) < 0.01);
    distances.push(w.distance);
  }
  assert.ok(Math.max(...distances) - Math.min(...distances) < 0.2, distances.join(', '));
});
test('Flight altitude stays bounded and movement can cross new districts', () => {
  const w = new CityWorld();
  w.toggleFlight();
  simulate(w, 30, { lift: 1, boost: true });
  assert.ok(w.player.y <= 180);
  simulate(w, 20, { forward: 1, boost: true });
  assert.ok(w.stats.districts >= 4);
  assert.ok(w.stats.blocks >= 20);
  assert.ok(w.stats.distance > 900);
  simulate(w, 30, { lift: -1, boost: true });
  assert.ok(w.player.y >= eye);
});
test('Jump is edge-triggered and world cycles progress without invalid states', () => {
  const w = new CityWorld();
  simulate(w, 0.12, { lift: 1 });
  assert.ok(w.player.y > eye);
  simulate(w, 4, { lift: 1 });
  assert.equal(w.player.y, eye);
  simulate(w, 0.1, {});
  simulate(w, 0.12, { lift: 1 });
  assert.ok(w.player.y > eye);
  simulate(w, 80, {});
  assert.notEqual(w.weather, 'rain');
  const manualWeather = w.cycleWeather();
  simulate(w, 80, {});
  assert.equal(w.weather, manualWeather);
  assert.ok(w.hour >= 0 && w.hour < 24);
  w.update(NaN, { forward: Infinity, turn: NaN });
  w.update(-1);
  for (const value of Object.values(w.player)) assert.ok(Number.isFinite(value));
});
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
