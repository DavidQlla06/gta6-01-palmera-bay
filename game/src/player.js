// Palmera Bay — the player on foot.
// One job: third-person on-foot movement (WASD relative to camera yaw,
// mouse-look with pointer lock, Shift to run) and the visible character.
import * as THREE from 'three';
import { CONFIG, clamp } from './config.js';

export class Player {
  constructor(scene, world) {
    this.world = world;
    this.pos = new THREE.Vector3(-28, 0, 28);
    this.yaw = Math.PI * 0.75;   // facing down the avenue
    this.camYaw = this.yaw;
    this.camPitch = -0.22;
    this.speed = 0;
    this.health = CONFIG.PLAYER_HEALTH_MAX;
    this.moving = false;

    // Character: simple stylised figure — jacket, head, cap, legs that swing.
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2e8f6e });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
    const cap = new THREE.MeshLambertMaterial({ color: 0xe85d3d });
    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), jacket);
    this.body.position.y = 1.15;
    g.add(this.body);
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skin);
    this.head.position.y = 1.85;
    g.add(this.head);
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.55), cap);
    hat.position.y = 2.1;
    g.add(hat);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), pants);
    this.legL.position.set(-0.18, 0.38, 0);
    g.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), pants);
    this.legR.position.set(0.18, 0.38, 0);
    g.add(this.legR);
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), jacket);
    this.armL.position.set(-0.48, 1.2, 0);
    g.add(this.armL);
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), jacket);
    this.armR.position.set(0.48, 1.2, 0);
    g.add(this.armR);
    this.mesh = g;
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
    this.walkPhase = 0;
  }

  /** Mouse-look deltas (pointer lock). */
  look(dx, dy) {
    this.camYaw -= dx * 0.0026;
    this.camPitch = clamp(this.camPitch - dy * 0.0026, -0.9, 0.55);
  }

  update(dt, keys) {
    const run = keys['ShiftLeft'] || keys['ShiftRight'];
    const target = run ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED;
    let fx = 0, fz = 0;
    if (keys['KeyW']) fz -= 1;
    if (keys['KeyS']) fz += 1;
    if (keys['KeyA']) fx -= 1;
    if (keys['KeyD']) fx += 1;
    const len = Math.hypot(fx, fz);
    this.moving = len > 0;
    if (len > 0) {
      fx /= len; fz /= len;
      // Move relative to camera yaw.
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      const mx = fx * cos - fz * sin;
      const mz = fx * sin + fz * cos;
      this.speed = target;
      const nx = this.pos.x + mx * target * dt;
      const nz = this.pos.z + mz * target * dt;
      if (!this.world.isBlocked(nx, this.pos.z, CONFIG.PLAYER_RADIUS)) this.pos.x = nx;
      if (!this.world.isBlocked(this.pos.x, nz, CONFIG.PLAYER_RADIUS)) this.pos.z = nz;
      this.yaw = Math.atan2(mx, mz);
      this.walkPhase += dt * target * 1.6;
    } else {
      this.speed = 0;
    }
    // Health slowly regenerates when calm.
    if (this.health < CONFIG.PLAYER_HEALTH_MAX) this.health = Math.min(CONFIG.PLAYER_HEALTH_MAX, this.health + dt * 2);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
  }

  /** Third-person camera target behind the player. */
  cameraPosition(out) {
    const d = CONFIG.CAM_DISTANCE;
    const h = CONFIG.CAM_HEIGHT - this.camPitch * 6;
    out.set(
      this.pos.x - Math.sin(this.camYaw) * d,
      h,
      this.pos.z - Math.cos(this.camYaw) * d,
    );
    return out;
  }

  cameraLookAt(out) {
    out.set(this.pos.x, 1.6, this.pos.z);
    return out;
  }
}
