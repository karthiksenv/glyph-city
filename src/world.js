/* Deterministic city layout and frame-rate-independent first-person movement. */
(function (global) {
  'use strict';

  const CELL = 48;
  const EYE = 2.7;
  const RADIUS = 0.58;
  const HEAD = 0.25;
  const MAX_ALTITUDE = 180;
  const WEATHER = ['rain', 'clear', 'fog'];
  const DISTRICT_NAMES = [
    'Cipher Market', 'Neon Exchange', 'Memory Quarter', 'Signal Heights',
    'Static Gardens', 'Copper Junction', 'Echo Ward', 'Terminal North',
    'Prism Commons', 'Zero Avenue', 'Vector District', 'Lumen Crossing',
    'Analog Harbor', 'Afterimage Row', 'Syntax Square', 'Midnight Grid'
  ];

  function hash(x, z, salt) {
    let h = (Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(salt | 0, 1442695041)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function building(bx, bz, id) {
    const ix = id & 1;
    const iz = (id >> 1) & 1;
    const seed = hash(bx, bz, id + 5);
    const minX = bx * CELL + 9 + ix * 16;
    const minZ = bz * CELL + 9 + iz * 16;
    return { minX, maxX: minX + 14, minZ, maxZ: minZ + 14, height: 12 + seed * seed * 68, seed };
  }

  function districtAt(x, z) {
    const dx = Math.floor(x / (CELL * 4));
    const dz = Math.floor(z / (CELL * 4));
    const index = Math.min(DISTRICT_NAMES.length - 1, Math.floor(hash(dx, dz, 47) * DISTRICT_NAMES.length));
    const code = 'D' + Math.floor(hash(dx, dz, 83) * 899 + 100).toString();
    return { name: DISTRICT_NAMES[index], code, x: dx, z: dz, key: dx + ',' + dz };
  }

  const finite = value => Number.isFinite(value) ? value : 0;
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

  class CityWorld {
    constructor() {
      this.player = { x: 0, y: EYE, z: 0, yaw: 0.2, pitch: 0.07, vx: 0, vy: 0, vz: 0 };
      this.fly = false;
      this.time = 0;
      this.hour = 21.3;
      this.timeAuto = true;
      this.weather = 'rain';
      this.weatherAuto = true;
      this.visited = new Set();
      this.visitedBlocks = new Set();
      this.distance = 0;
      this.grounded = true;
      this._jumpHeld = false;
      this._weatherAt = 75;
      this._nearby = [];
      this._markExplored();
    }

    get district() { return districtAt(this.player.x, this.player.z); }

    get stats() {
      const p = this.player;
      return {
        districts: this.visited.size,
        blocks: this.visitedBlocks.size,
        distance: this.distance,
        speed: Math.hypot(p.vx, p.vy, p.vz),
        altitude: Math.max(0, p.y - EYE),
        grounded: this.grounded,
        flight: this.fly
      };
    }

    inspect() {
      return { player: { ...this.player }, time: this.time, hour: this.hour, weather: this.weather,
        weatherAuto: this.weatherAuto, district: this.district, ...this.stats };
    }

    toggleFlight() {
      this.fly = !this.fly;
      this.player.vy = 0;
      this.grounded = !this.fly && this.player.y <= this.groundAt(this.player.x, this.player.z) + EYE + 0.02;
      return this.fly;
    }

    reset() {
      Object.assign(this.player, { x: 0, y: EYE, z: 0, yaw: 0.2, pitch: 0.07, vx: 0, vy: 0, vz: 0 });
      this.fly = false;
      this.grounded = true;
      this._jumpHeld = false;
      this._markExplored();
    }

    cycleWeather() {
      this.weather = WEATHER[(WEATHER.indexOf(this.weather) + 1) % WEATHER.length];
      this.weatherAuto = false;
      return this.weather;
    }

    cycleTime() {
      const presets = [8.5, 13, 18.5, 21.3];
      const next = presets.find(value => value > this.hour + 0.2);
      this.hour = next === undefined ? presets[0] : next;
      return this.hour;
    }

    groundAt(x, z) {
      const bx = Math.floor(x / CELL);
      const bz = Math.floor(z / CELL);
      let ground = 0;
      for (let id = 0; id < 4; id++) {
        const b = building(bx, bz, id);
        if (x > b.minX - RADIUS && x < b.maxX + RADIUS && z > b.minZ - RADIUS && z < b.maxZ + RADIUS) {
          ground = Math.max(ground, b.height);
          if (b.height > 40 && x > b.minX + 4 - RADIUS && x < b.minX + 10 + RADIUS && z > b.minZ + 4 - RADIUS && z < b.minZ + 10 + RADIUS) ground = b.height + 3;
        }
      }
      return ground;
    }

    _markExplored() {
      this.visited.add(this.district.key);
      this.visitedBlocks.add(Math.floor(this.player.x / CELL) + ',' + Math.floor(this.player.z / CELL));
    }

    _buildNearby() {
      const p = this.player;
      const minX = Math.floor((p.x - 2) / CELL);
      const maxX = Math.floor((p.x + 2) / CELL);
      const minZ = Math.floor((p.z - 2) / CELL);
      const maxZ = Math.floor((p.z + 2) / CELL);
      this._nearby.length = 0;
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          for (let id = 0; id < 4; id++) {
            const b = building(bx, bz, id);
            this._nearby.push(b);
            if (b.height > 40) this._nearby.push({ minX: b.minX + 4, maxX: b.minX + 10, minZ: b.minZ + 4, maxZ: b.minZ + 10, height: b.height + 3 });
          }
        }
      }
    }

    _overlaps(x, z, b) {
      return x > b.minX - RADIUS && x < b.maxX + RADIUS && z > b.minZ - RADIUS && z < b.maxZ + RADIUS;
    }

    _moveHorizontal(axis, dt) {
      const p = this.player;
      const velocity = axis === 'x' ? 'vx' : 'vz';
      const motion = p[velocity] * dt;
      if (!motion) return;
      let next = p[axis] + motion;
      for (const b of this._nearby) {
        if (p.y - EYE >= b.height - 0.003) continue;
        const x = axis === 'x' ? next : p.x;
        const z = axis === 'z' ? next : p.z;
        if (!this._overlaps(x, z, b)) continue;
        const min = axis === 'x' ? b.minX : b.minZ;
        const max = axis === 'x' ? b.maxX : b.maxZ;
        next = motion > 0 ? min - RADIUS : max + RADIUS;
        p[velocity] = 0;
      }
      p[axis] = next;
    }

    _moveVertical(dt) {
      const p = this.player;
      let next = p.y + p.vy * dt;
      let ground = 0;
      for (const b of this._nearby) {
        if (!this._overlaps(p.x, p.z, b)) continue;
        // A descending camera can land on a roof; it never tunnels through it.
        if (p.y - EYE >= b.height - 0.02) ground = Math.max(ground, b.height);
        else if (next + HEAD > 0 && next - EYE < b.height) {
          // Repair penetration caused by an external teleport or coordinate edit.
          if (p.y > b.height * 0.5) ground = Math.max(ground, b.height);
        }
      }
      const floor = ground + EYE;
      this.grounded = next <= floor + 0.002;
      if (next < floor) { next = floor; p.vy = 0; }
      if (next > MAX_ALTITUDE) { next = MAX_ALTITUDE; p.vy = 0; }
      p.y = next;
    }

    update(dt, input = {}) {
      dt = clamp(finite(dt), 0, 0.12);
      if (!dt) return;
      const p = this.player;
      p.yaw += finite(input.turn) * dt;
      p.yaw = Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw));
      p.pitch = clamp(p.pitch + finite(input.look) * dt, -1.42, 1.42);

      let forward = clamp(finite(input.forward), -1, 1);
      let strafe = clamp(finite(input.strafe), -1, 1);
      const length = Math.hypot(forward, strafe);
      if (length > 1) { forward /= length; strafe /= length; }
      const lift = clamp(finite(input.lift), -1, 1);
      const boost = !!input.boost;
      const speed = this.fly ? (boost ? 50 : 24) : (boost ? 21 : 11);
      const sin = Math.sin(p.yaw);
      const cos = Math.cos(p.yaw);
      const targetX = (sin * forward + cos * strafe) * speed;
      const targetZ = (cos * forward - sin * strafe) * speed;
      const jumping = lift > 0.5 && !this._jumpHeld;
      this._jumpHeld = lift > 0.5;
      if (!this.fly && jumping && this.grounded) {
        p.vy = 9.5;
        this.grounded = false;
      }

      const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
      const step = dt / steps;
      const initialX = p.x;
      const initialZ = p.z;
      for (let i = 0; i < steps; i++) {
        const smooth = 1 - Math.exp(-step * (this.fly ? 6 : 11));
        p.vx += (targetX - p.vx) * smooth;
        p.vz += (targetZ - p.vz) * smooth;
        if (this.fly) p.vy += (lift * speed * 0.8 - p.vy) * smooth;
        else p.vy = Math.max(-38, p.vy - 25 * step);
        this._buildNearby();
        this._moveHorizontal('x', step);
        this._moveHorizontal('z', step);
        this._moveVertical(step);
      }
      this.distance += Math.hypot(p.x - initialX, p.z - initialZ);
      this.time += dt;
      if (this.timeAuto) this.hour = (this.hour + dt * 0.04) % 24;
      if (this.weatherAuto && this.time >= this._weatherAt) {
        const phase = Math.floor(this.time / 75);
        this.weather = WEATHER[phase % WEATHER.length];
        this._weatherAt = (phase + 1) * 75;
      }
      this._markExplored();
    }
  }

  CityWorld.hash = hash;
  CityWorld.building = building;
  CityWorld.districtAt = districtAt;
  CityWorld.CELL_SIZE = CELL;
  CityWorld.EYE_HEIGHT = EYE;
  global.CityWorld = CityWorld;
})(typeof window !== 'undefined' ? window : globalThis);
