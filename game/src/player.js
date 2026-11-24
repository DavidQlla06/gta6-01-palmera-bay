// Palmera Bay — the player on foot.
// A simple stylised figure: torso, head, legs that swing while walking.
// Movement is camera-relative; the figure turns toward its motion.

import * as THREE from 'three';
import { CFG, clamp } from './config.js';
import { resolveCollision } from './world.js';

export function makePlayerMesh(g) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xd26a2e });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c4a6e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), jacket);
  torso.position.y = 1.18;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.78;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.1, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x1c2f4a }),
  );
  cap.position.y = 1.98;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.28), jeans);
  legL.position.set(-0.17, 0.4, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), jacket);
  armL.position.set(-0.42, 1.2, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  g.scene.add(group);
  return { mesh: group, legL, legR, armL, armR };
}

/** On-foot step. Returns horizontal speed for the HUD and audio. */
export function movePlayer(g, input, dt) {
  const p = g.player;
  const run = input.run ? CFG.runSpeed : CFG.walkSpeed;
  let mx = 0;
  let mz = 0;
  if (input.forward) mz -= 1;
  if (input.back) mz += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  let speed = 0;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    // Camera-relative: forward is where the camera looks. The camera sits
    // at target + (sin yaw, cos yaw) * dist, so its view direction is
    // (-sin yaw, -cos yaw); rotate the local input (mx right, mz forward
    // with W giving mz = -1) by yaw around Y to get world movement.
    const yaw = g.camYaw;
    const wx = mx * Math.cos(yaw) + mz * Math.sin(yaw);
    const wz = -mx * Math.sin(yaw) + mz * Math.cos(yaw);
    p.pos.x += wx * run * dt;
    p.pos.z += wz * run * dt;
    p.pos.x = clamp(p.pos.x, -CFG.cityHalf - 20, CFG.cityHalf + 20);
    p.pos.z = clamp(p.pos.z, -CFG.cityHalf - 20, CFG.seaZ + 30);
    resolveCollision(p.pos, 0.55, g.colliders);
    const targetAngle = Math.atan2(wx, wz);
    let d = targetAngle - p.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    p.angle += d * Math.min(1, dt * 10);
    speed = run;
    p.walkPhase += dt * run * 1.6;
  } else {
    p.walkPhase *= 0.9;
  }
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.angle;
  // Walk cycle: legs and arms swing opposite.
  const swing = moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  p.parts.legL.rotation.x = swing;
  p.parts.legR.rotation.x = -swing;
  p.parts.armL.rotation.x = -swing * 0.8;
  p.parts.armR.rotation.x = swing * 0.8;
  return speed;
}

/** Find the nearest stealable parked car within reach of the player. */
export function nearestStealableCar(g, maxDist = 3.4) {
  let best = null;
  let bestD = maxDist;
  for (const car of g.cars) {
    if (!car.parked || car.cop || car.traffic) continue;
    const d = Math.hypot(car.pos.x - g.player.pos.x, car.pos.z - g.player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
