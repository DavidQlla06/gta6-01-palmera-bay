// Palmera Bay — wanted level and police.
// Crimes raise the heat; the heat fades when the player stays clean.
// Cop cars spawn on the roads, chase the player, and ram the player's
// car. A cop that reaches the player on foot ends the run: busted.

import * as THREE from 'three';
import { CFG, clamp, angleDelta } from './config.js';
import { makeCar, MODELS } from './vehicles.js';
import { resolveCollision } from './world.js';

export function addHeat(g, stars, reason) {
  if (g.shotMode) return;
  g.wanted = clamp(g.wanted + stars, 0, CFG.maxWanted);
  g.heatTimer = CFG.wantedDecaySeconds;
  if (stars > 0) {
    g.hud.toast(`WANTED ★${'★'.repeat(g.wanted - 1)} — ${reason}`, 3);
    g.audio.blip(220, 0.15, 0.1);
  }
}

export function setWanted(g, stars) {
  g.wanted = clamp(stars, 0, CFG.maxWanted);
  g.heatTimer = CFG.wantedDecaySeconds;
}

export function spawnCopNear(g, x, z, angle) {
  const car = makeCar(g, MODELS[1], 0xf2f2f2, x, z, angle, { cop: true });
  // Blue doors: repaint the body panels via a second box overlay.
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.04, 0.5, 4.2),
    new THREE.MeshLambertMaterial({ color: 0x1c4fd6 }),
  );
  stripe.position.y = 0.62;
  car.mesh.add(stripe);
  car.speed = 0;
  car.catchTimer = 0;
  g.cops.push(car);
  return car;
}

export function removeAllCops(g) {
  for (const cop of g.cops) {
    g.scene.remove(cop.mesh);
    const i = g.cars.indexOf(cop);
    if (i >= 0) g.cars.splice(i, 1);
  }
  g.cops = [];
}

function nearestRoadPoint(g, x, z) {
  // Snap to the closest road centre-line, for spawning cops on asphalt.
  let best = { x, z, d: Infinity };
  for (const r of g.roadLines) {
    if (r.axis === 'x') {
      const d = Math.abs(z - r.at);
      if (d < best.d) best = { x, z: r.at, d };
    } else {
      const d = Math.abs(x - r.at);
      if (d < best.d) best = { x: r.at, z, d };
    }
  }
  return best;
}

export function updatePolice(g, dt) {
  // Wanted decay: stay clean and the heat fades, one star at a time.
  if (g.wanted > 0 && !g.shotMode) {
    g.heatTimer -= dt;
    if (g.heatTimer <= 0) {
      g.wanted -= 1;
      g.heatTimer = CFG.wantedDecaySeconds;
      if (g.wanted === 0) g.hud.toast('You lost the cops. Heat is off.', 3);
    }
  }
  // Keep the cop count matched to the wanted level.
  const want = g.wanted === 0 ? 0 : 1 + g.wanted;
  while (g.cops.length < want) {
    const p = nearestRoadPoint(g, g.player.pos.x, g.player.pos.z);
    const a = Math.random() * Math.PI * 2;
    spawnCopNear(g, p.x + Math.cos(a) * 34, p.z + Math.sin(a) * 34, a);
  }
  while (g.cops.length > want) {
    const cop = g.cops.pop();
    g.scene.remove(cop.mesh);
    const i = g.cars.indexOf(cop);
    if (i >= 0) g.cars.splice(i, 1);
  }

  const target = g.inCar ? g.inCar.pos : g.player.pos;
  for (const cop of g.cops) {
    const dx = target.x - cop.pos.x;
    const dz = target.z - cop.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantAngle = Math.atan2(dx, dz);
    const turn = clamp(angleDelta(cop.angle, wantAngle), -2.6 * dt, 2.6 * dt);
    cop.angle += turn;
    const targetSpeed = dist > 60 ? CFG.copTopSpeed : CFG.copTopSpeed * 0.86;
    cop.speed += clamp(targetSpeed - cop.speed, -20 * dt, 12 * dt);
    cop.pos.x += Math.sin(cop.angle) * cop.speed * dt;
    cop.pos.z += Math.cos(cop.angle) * cop.speed * dt;
    resolveCollision(cop.pos, 1.6, g.colliders);
    cop.mesh.position.copy(cop.pos);
    cop.mesh.rotation.y = cop.angle;
    // Ram: shove the player's car and shake the camera a little.
    if (g.inCar && dist < 3.4) {
      g.inCar.pos.x += (dx / dist) * -2.2 * dt * 10;
      g.inCar.pos.z += (dz / dist) * -2.2 * dt * 10;
      g.inCar.speed *= 0.94;
      g.shake = Math.max(g.shake, 0.35);
      if (g.audio) g.audio.thud();
    }
    // Busted: a cop catches the player on foot.
    if (!g.inCar && dist < 2.6) {
      cop.catchTimer += dt;
      if (cop.catchTimer > 1.6) {
        g.busted();
        return;
      }
    } else {
      cop.catchTimer = 0;
    }
  }
}
