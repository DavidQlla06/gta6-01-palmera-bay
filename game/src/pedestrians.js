// Palmera Bay — pedestrians.
// One job: people wandering the sidewalks on their own business, who flee
// when a car bears down on them and can be knocked down (a crime).
import * as THREE from 'three';
import { CONFIG, makeRng, randRange, pick } from './config.js';

const SHIRTS = [0xe8e8e8, 0x3a6fd2, 0xd23c8a, 0x2e8f6e, 0xf2c230, 0x8a4fd2, 0xe87a2e, 0x444444];
const PANTS = [0x2a3550, 0x5a4a3a, 0x333333, 0x6a2a2a];

export class Pedestrian {
  constructor(scene, x, z, rng) {
    this.pos = new THREE.Vector3(x, 0, z);
    this.angle = rng() * Math.PI * 2;
    this.speed = CONFIG.PED_SPEED * (0.7 + rng() * 0.6);
    this.state = 'walk';   // walk | flee | down
    this.downTimer = 0;
    this.target = this.pickTarget(rng);
    this.rng = rng;

    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
    const pants = new THREE.MeshLambertMaterial({ color: pick(rng, PANTS) });
    const skin = new THREE.MeshLambertMaterial({ color: pick(rng, [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6a4a2a]) });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), shirt);
    body.position.y = 1.1;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
    head.position.y = 1.7;
    g.add(head);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.26), pants);
    this.legL.position.set(-0.15, 0.35, 0);
    g.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.26), pants);
    this.legR.position.set(0.15, 0.35, 0);
    g.add(this.legR);
    this.mesh = g;
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
    this.phase = rng() * 6;
  }

  pickTarget(rng) {
    const r = rng || this.rng;
    const roads = [-168, -112, -56, 0, 56, 112, 168];
    const road = pick(r, roads);
    const side = r() > 0.5 ? 8.5 : -8.5;
    const along = (r() * 2 - 1) * 170;
    if (r() > 0.5) return new THREE.Vector3(road + side, 0, along);
    return new THREE.Vector3(along, 0, road + side);
  }

  /** Knock this pedestrian down (melee or car hit). */
  knockDown() {
    if (this.state === 'down') return false;
    this.state = 'down';
    this.downTimer = 6;
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.y = 0.3;
    return true;
  }

  update(dt, threats) {
    if (this.state === 'down') {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        this.state = 'walk';
        this.mesh.rotation.x = 0;
        this.mesh.position.y = 0;
      }
      return;
    }
    // Flee from the nearest fast-moving threat (player car or player).
    let flee = null;
    for (const t of threats) {
      const d = Math.hypot(t.x - this.pos.x, t.z - this.pos.z);
      if (d < 12) { flee = t; break; }
    }
    let tx, tz, speed = this.speed;
    if (flee) {
      this.state = 'flee';
      const dx = this.pos.x - flee.x, dz = this.pos.z - flee.z;
      const l = Math.hypot(dx, dz) || 1;
      tx = this.pos.x + (dx / l) * 20;
      tz = this.pos.z + (dz / l) * 20;
      speed = this.speed * 2.6;
    } else {
      this.state = 'walk';
      tx = this.target.x; tz = this.target.z;
    }
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      if (!flee) this.target = this.pickTarget();
      return;
    }
    this.angle = Math.atan2(dx, dz);
    this.pos.x += (dx / dist) * speed * dt;
    this.pos.z += (dz / dist) * speed * dt;
    this.phase += dt * speed * 3;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.angle;
    const swing = Math.sin(this.phase) * 0.45;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
  }
}

export class Pedestrians {
  constructor(scene, world) {
    this.peds = [];
    const rng = makeRng(CONFIG.WORLD_SEED + 55);
    const roads = world.roadCentres;
    for (let i = 0; i < CONFIG.PED_COUNT; i += 1) {
      const road = pick(rng, roads);
      const side = rng() > 0.5 ? 8.5 : -8.5;
      const along = (rng() * 2 - 1) * 170;
      const x = rng() > 0.5 ? road + side : along;
      const z = rng() > 0.5 ? along : road + side;
      this.peds.push(new Pedestrian(scene, x, z, rng));
    }
  }

  update(dt, threats) {
    for (const p of this.peds) p.update(dt, threats);
  }

  /** Pedestrians within radius of (x, z) that are still standing. */
  near(x, z, radius) {
    const out = [];
    for (const p of this.peds) {
      if (p.state !== 'down' && Math.hypot(p.pos.x - x, p.pos.z - z) < radius) out.push(p);
    }
    return out;
  }
}
