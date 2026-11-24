// Palmera Bay — cars: meshes, arcade driving, parked cars.
// A car is a THREE.Group of boxes with a small state record; the same
// record drives the player's car, parked cars and (through traffic.js and
// police.js) the AI cars.

import * as THREE from 'three';
import { CFG, PALETTE, clamp, pick } from './config.js';
import { resolveCollision } from './world.js';

const MODELS = [
  { name: 'Comet', len: 4.4, wid: 1.9, h: 0.75, cabin: 0.62, top: 40 },
  { name: 'Sunrunner', len: 4.9, wid: 2.0, h: 0.85, cabin: 0.7, top: 36 },
  { name: 'Bayliner', len: 5.4, wid: 2.1, h: 0.95, cabin: 0.75, top: 33 },
  { name: 'Dune Buggy', len: 4.0, wid: 2.0, h: 0.7, cabin: 0.4, top: 44 },
];

export function makeCarMesh(model, color, isCop = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(model.wid, model.h, model.len), paint);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(model.wid * 0.86, model.cabin, model.len * 0.5), dark);
  cabin.position.set(0, 0.62 + model.h / 2 + model.cabin / 2 - 0.08, -model.len * 0.06);
  group.add(cabin);
  // Headlights and taillights so cars read at dusk.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd21f1f });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lightMat);
    hl.position.set(s * (model.wid / 2 - 0.32), 0.62, model.len / 2 + 0.01);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), tailMat);
    tl.position.set(s * (model.wid / 2 - 0.32), 0.62, -model.len / 2 - 0.01);
    group.add(tl);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x101010 });
  for (const [wx, wz] of [
    [-model.wid / 2, model.len / 2 - 0.9],
    [model.wid / 2, model.len / 2 - 0.9],
    [-model.wid / 2, -model.len / 2 + 0.9],
    [model.wid / 2, -model.len / 2 + 0.9],
  ]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    group.add(w);
  }
  if (isCop) {
    // Split light bar: blue on the left half, red on the right half.
    const barY = 0.62 + model.h / 2 + model.cabin + 0.06;
    const barZ = -model.len * 0.06;
    const barBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    barBlue.position.set(-0.23, barY, barZ);
    group.add(barBlue);
    const barRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    barRed.position.set(0.23, barY, barZ);
    group.add(barRed);
  }
  return group;
}

export function makeCar(g, model, color, x, z, angle, opts = {}) {
  const mesh = makeCarMesh(model, color, !!opts.cop);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  g.scene.add(mesh);
  const car = {
    mesh,
    model,
    color,
    pos: new THREE.Vector3(x, 0, z),
    angle,
    speed: 0,
    steer: 0,
    parked: !!opts.parked,
    cop: !!opts.cop,
    traffic: !!opts.traffic,
    name: model.name,
    id: g.nextCarId++,
  };
  g.cars.push(car);
  return car;
}

/** Spawn the parked, stealable cars along the avenues. */
export function spawnParkedCars(g, rng) {
  const spots = [];
  for (let i = 0; i < CFG.parkedCars; i++) {
    const road = pick(rng, g.roadLines);
    const along = (rng() - 0.5) * (CFG.cityHalf * 2 - 40);
    const side = rng() < 0.5 ? -1 : 1;
    const off = side * (CFG.roadHalf - 1.6);
    const x = road.axis === 'x' ? along : road.at + off;
    const z = road.axis === 'x' ? road.at + off : along;
    const angle = road.axis === 'x' ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2;
    const model = pick(rng, MODELS);
    const car = makeCar(g, model, pick(rng, PALETTE.car), x, z, angle, { parked: true });
    car.parkedSpot = { x, z, angle };
    spots.push(car);
  }
  return spots;
}

export { MODELS };

/** Arcade drive step for the player's car. Returns true on a hard hit. */
export function drivePlayerCar(g, car, input, dt) {
  const forward = input.forward ? 1 : 0;
  const back = input.back ? 1 : 0;
  const steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const top = car.model.top;
  if (forward) car.speed += CFG.carAccel * dt;
  else if (back) car.speed -= (car.speed > 0.5 ? CFG.carBrake : CFG.carAccel * 0.6) * dt;
  else {
    // Coast down.
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CFG.carReverseMax, top);
  const steerTarget = steerIn * CFG.carSteer * clamp(Math.abs(car.speed) / 8, 0, 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.angle += car.steer * (car.speed / top) * dt * 2.4 * Math.sign(car.speed || 1);
  const dx = Math.sin(car.angle) * car.speed * dt;
  const dz = Math.cos(car.angle) * car.speed * dt;
  const before = car.pos.clone();
  car.pos.x += dx;
  car.pos.z += dz;
  // Keep inside the map (sea edge is a wall of sand, not a fall).
  car.pos.x = clamp(car.pos.x, -CFG.cityHalf - 20, CFG.cityHalf + 20);
  car.pos.z = clamp(car.pos.z, -CFG.cityHalf - 20, CFG.seaZ + 30);
  const hitWall = resolveCollision(car.pos, 1.6, g.colliders);
  if (hitWall) {
    const travelled = car.pos.distanceTo(before);
    const expected = Math.abs(car.speed) * dt;
    if (expected - travelled > 0.4 && Math.abs(car.speed) > 9) {
      car.speed *= 0.35;
      return true;
    }
    car.speed *= 0.6;
  }
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.angle;
  // Slight body roll into corners, for feel.
  car.mesh.rotation.z = -car.steer * 0.06 * Math.sign(car.speed || 1);
  return false;
}
