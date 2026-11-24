// Palmera Bay — pedestrians.
// Small figures strolling the sidewalks between random waypoints. They
// are the city's life, and — if the player punches one — the fastest way
// to earn a wanted star.

import * as THREE from 'three';
import { CFG, clamp, pick } from './config.js';
import { resolveCollision } from './world.js';

const SHIRTS = [0xe86a92, 0x4a90d9, 0x50b27a, 0xe8b93b, 0x8a6fd0, 0xeeeeee, 0x333333];

export function spawnPedestrians(g, rng) {
  const peds = [];
  for (let i = 0; i < CFG.pedestrians; i++) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirt);
    torso.position.y = 1.1;
    group.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xc98d5f }),
    );
    head.position.y = 1.66;
    group.add(head);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2c3550 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.24), legMat);
    legL.position.set(-0.15, 0.36, 0);
    group.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.15;
    group.add(legR);
    const x = (rng() - 0.5) * (CFG.cityHalf * 2 - 40);
    const z = (rng() - 0.5) * (CFG.cityHalf * 2 - 40);
    group.position.set(x, 0, z);
    g.scene.add(group);
    peds.push({
      mesh: group,
      legL,
      legR,
      pos: new THREE.Vector3(x, 0, z),
      angle: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 1.1,
      target: null,
      phase: rng() * 6,
      down: 0, // >0 while knocked down after a punch
    });
  }
  g.peds = peds;
  return peds;
}

function newTarget(ped, rng) {
  // Aim for a nearby sidewalk: just off a road line.
  const road = pick(rng, [
    { axis: 'x', at: -160 }, { axis: 'x', at: -80 }, { axis: 'x', at: 0 },
    { axis: 'x', at: 80 }, { axis: 'x', at: 160 },
    { axis: 'z', at: -160 }, { axis: 'z', at: -80 }, { axis: 'z', at: 0 },
    { axis: 'z', at: 80 }, { axis: 'z', at: 160 },
  ]);
  const along = (rng() - 0.5) * 380;
  const off = (rng() < 0.5 ? -1 : 1) * 10;
  ped.target = road.axis === 'x'
    ? new THREE.Vector3(along, 0, road.at + off)
    : new THREE.Vector3(road.at + off, 0, along);
}

export function updatePedestrians(g, dt, rng) {
  for (const ped of g.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      ped.mesh.rotation.x = -Math.PI / 2 + 0.3;
      if (ped.down <= 0) {
        ped.mesh.rotation.x = 0;
        // Get up somewhere fresh, away from the player.
        ped.pos.x = clamp(ped.pos.x + 40, -200, 200);
        ped.pos.z = clamp(ped.pos.z - 30, -200, 180);
        ped.target = null;
      }
      continue;
    }
    if (!ped.target || ped.pos.distanceTo(ped.target) < 2) newTarget(ped, rng);
    const dx = ped.target.x - ped.pos.x;
    const dz = ped.target.z - ped.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const want = Math.atan2(dx, dz);
    let diff = want - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    ped.pos.x += Math.sin(ped.angle) * ped.speed * dt;
    ped.pos.z += Math.cos(ped.angle) * ped.speed * dt;
    resolveCollision(ped.pos, 0.5, g.colliders);
    ped.phase += dt * ped.speed * 3.4;
    const swing = Math.sin(ped.phase) * 0.5;
    ped.legL.rotation.x = swing;
    ped.legR.rotation.x = -swing;
    ped.mesh.position.copy(ped.pos);
    ped.mesh.rotation.y = ped.angle;
  }
}

/** Knock a pedestrian down. Returns the pedestrian or null. */
export function punchPedestrian(g, fromPos, facingAngle, range = 2.6) {
  let best = null;
  let bestD = range;
  for (const ped of g.peds) {
    if (ped.down > 0) continue;
    const dx = ped.pos.x - fromPos.x;
    const dz = ped.pos.z - fromPos.z;
    const d = Math.hypot(dx, dz);
    if (d >= bestD) continue;
    const dot = Math.sin(facingAngle) * dx + Math.cos(facingAngle) * dz;
    if (dot < 0) continue; // must be in front
    bestD = d;
    best = ped;
  }
  if (best) {
    best.down = 4;
    best.mesh.rotation.x = -Math.PI / 2 + 0.3;
  }
  return best;
}
