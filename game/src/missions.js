// Palmera Bay — story missions.
// One job: the four story jobs, their objective text, the 3D beacon and
// minimap blip, completion checks and cash rewards. The HUD reads the
// current objective from here; main.js applies the rewards.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'Hot Wheels',
    giver: 'Rosa at the marina',
    text: 'Steal any parked car and deliver it to the marina drop-off.',
    reward: CONFIG.MISSION_REWARDS[0],
  },
  {
    id: 2,
    title: 'Bay Run',
    giver: 'Rosa at the marina',
    text: 'Drive to the downtown tower before the timer runs out.',
    reward: CONFIG.MISSION_REWARDS[1],
  },
  {
    id: 3,
    title: 'Heat Wave',
    giver: 'Marco on the boardwalk',
    text: 'The cops are onto you. Lose the 3-star wanted level.',
    reward: CONFIG.MISSION_REWARDS[2],
  },
  {
    id: 4,
    title: 'Last Package',
    giver: 'Marco on the boardwalk',
    text: 'Deliver the package to the beach house on the east shore.',
    reward: CONFIG.MISSION_REWARDS[3],
  },
];

// Drop-off points: marina beach, downtown tower, boardwalk, beach house.
// All targets sit on walkable ground (x <= 210, the beach wall).
const TARGETS = [
  new THREE.Vector3(204, 0, -140),
  new THREE.Vector3(28, 0, 28),
  new THREE.Vector3(200, 0, 40),
  new THREE.Vector3(200, 0, 120),
];

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;             // current mission (0..3), 4 = all done
    this.active = false;
    this.timer = 0;
    this.completed = [false, false, false, false];
    this.message = '';
    // 3D beacon: a glowing pillar of light at the target.
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 40, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffc23c, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.visible = false;
    scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(4, 6, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc23c, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
  }

  current() { return this.index < MISSIONS.length ? MISSIONS[this.index] : null; }
  target() { return this.index < TARGETS.length ? TARGETS[this.index] : null; }
  isDone() { return this.index >= MISSIONS.length; }

  start(index) {
    this.index = index;
    this.active = true;
    const t = this.target();
    if (t) {
      this.beacon.position.set(t.x, 20, t.z);
      this.beacon.visible = true;
      this.ring.position.set(t.x, 0.3, t.z);
      this.ring.visible = true;
    }
    if (this.index === 1) this.timer = CONFIG.TIMED_MISSION_SECONDS;
    if (this.index === 2) this.timer = 0;
    this.message = '';
  }

  stop() {
    this.active = false;
    this.beacon.visible = false;
    this.ring.visible = false;
  }

  /** Objective line for the HUD. */
  objectiveText() {
    const m = this.current();
    if (!m) return 'All jobs done — Palmera Bay is yours. Free roam!';
    let line = `Job ${m.id}: ${m.title} — ${m.text}`;
    if (this.index === 1 && this.active) line += ` (${Math.max(0, Math.ceil(this.timer))}s left)`;
    if (this.index === 2 && this.active) line += ' (stay hidden until the heat drops)';
    return line;
  }

  /**
   * Check completion each frame. Returns { done, failed, reward } or null.
   * ctx: { playerPos, inCar, wanted, dt }
   */
  update(dt, ctx) {
    if (!this.active || this.isDone()) return null;
    const t = this.target();
    const dist = Math.hypot(ctx.playerPos.x - t.x, ctx.playerPos.z - t.z);
    if (this.index === 1) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.stop();
        this.message = 'Too slow — the buyer walked away. Try again from the menu.';
        return { done: false, failed: true, reward: 0 };
      }
    }
    if (this.index === 0) {
      // Mission 1 needs the player IN a car at the drop-off.
      if (dist < CONFIG.MISSION_RADIUS && ctx.inCar) return this.complete();
    } else if (this.index === 1) {
      if (dist < CONFIG.MISSION_RADIUS) return this.complete();
    } else if (this.index === 2) {
      // Mission 3 completes when the wanted level hits zero.
      if (ctx.wanted === 0) return this.complete();
    } else if (this.index === 3) {
      if (dist < CONFIG.MISSION_RADIUS) return this.complete();
    }
    return null;
  }

  complete() {
    const m = this.current();
    this.completed[this.index] = true;
    this.index += 1;
    this.stop();
    const reward = m.reward;
    this.message = `Job complete: ${m.title} — +$${reward}`;
    if (!this.isDone()) {
      // Queue the next job; main.js starts it after a short beat.
      this.pendingNext = true;
    }
    return { done: true, failed: false, reward };
  }
}
