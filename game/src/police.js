// Palmera Bay — police and the wanted system.
// One job: wanted stars 1-5, police cars that spawn, chase and ram, wanted
// decay when the player stays hidden, and the busted outcome.
import * as THREE from 'three';
import { CONFIG, clamp, makeRng, pick } from './config.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.wanted = 0;
    this.cleanTimer = 0;   // seconds without a crime
    this.cops = [];
    this.sirenPhase = 0;
    this.rng = makeRng(CONFIG.WORLD_SEED + 99);
  }

  /** Raise the wanted level (capped at 5) and reset the clean timer. */
  addWanted(stars) {
    this.wanted = clamp(this.wanted + stars, 0, CONFIG.WANTED_MAX);
    this.cleanTimer = 0;
  }

  setWanted(stars) {
    this.wanted = clamp(stars, 0, CONFIG.WANTED_MAX);
    this.cleanTimer = 0;
  }

  clearWanted() {
    this.wanted = 0;
    this.cleanTimer = 0;
    this.removeAllCops();
  }

  wantedCount() {
    // One cop per star, up to the cap.
    return Math.min(this.wanted, CONFIG.COP_MAX);
  }

  spawnCopNear(x, z) {
    const angle = this.rng() * Math.PI * 2;
    const sx = x + Math.cos(angle) * CONFIG.COP_SPAWN_DISTANCE;
    const sz = z + Math.sin(angle) * CONFIG.COP_SPAWN_DISTANCE;
    const cx = clamp(sx, -CONFIG.CITY_HALF, CONFIG.BEACH_X);
    const cz = clamp(sz, -CONFIG.CITY_HALF, CONFIG.CITY_HALF);
    const cop = new Car(this.scene, cx, cz, 0, 1, 0xf0f0f0, true);
    cop.parked = false;
    cop.speed = 0;
    this.cops.push(cop);
    return cop;
  }

  removeAllCops() {
    for (const cop of this.cops) this.scene.remove(cop.mesh);
    this.cops = [];
  }

  update(dt, playerPos, playerInCar, onBusted, onRam) {
    this.sirenPhase += dt * 6;
    // Spawn cops to match the wanted level.
    const want = this.wantedCount();
    while (this.cops.length < want) this.spawnCopNear(playerPos.x, playerPos.z);
    while (this.cops.length > want) {
      const cop = this.cops.pop();
      this.scene.remove(cop.mesh);
    }
    // Decay: stay clean and the heat drops one star at a time.
    if (this.wanted > 0) {
      this.cleanTimer += dt;
      if (this.cleanTimer > CONFIG.WANTED_DECAY_SECONDS) {
        this.wanted -= 1;
        this.cleanTimer = 0;
      }
    }
    // Chase: steer toward the player, ram when close.
    for (const cop of this.cops) {
      const dx = playerPos.x - cop.pos.x;
      const dz = playerPos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      const targetAngle = Math.atan2(dx, dz);
      let diff = targetAngle - cop.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
      const speed = dist > 60 ? CONFIG.COP_SPEED : CONFIG.COP_SPEED * 0.85;
      cop.speed = speed;
      const nx = cop.pos.x + Math.sin(cop.angle) * cop.speed * dt;
      const nz = cop.pos.z + Math.cos(cop.angle) * cop.speed * dt;
      if (!this.world.isBlocked(nx, nz, 2.2)) {
        cop.pos.x = nx;
        cop.pos.z = nz;
      } else {
        cop.angle += Math.PI / 2 * dt * 4; // slide along the wall
      }
      cop.syncMesh();
      // Flashing light bar: red on one side, blue on the other, alternating.
      const flashOn = Math.sin(this.sirenPhase) > 0;
      cop.mesh.children.forEach((child) => {
        if (!child.material || !child.material.color) return;
        if (child.position.y > 1.5 && child.geometry.type === 'BoxGeometry') {
          const isRedSide = child.position.z < 0;
          const lit = isRedSide ? flashOn : !flashOn;
          child.material.color.setHex(isRedSide ? (lit ? 0xff2020 : 0x550000) : (lit ? 0x2040ff : 0x000055));
        }
      });
      // Ram: damage + push the player's car; touch an on-foot player = busted.
      if (dist < 3.2) {
        if (playerInCar) {
          if (onRam) onRam(cop);
        } else if (dist < CONFIG.BUST_DISTANCE) {
          if (onBusted) onBusted();
        }
      }
    }
  }
}
