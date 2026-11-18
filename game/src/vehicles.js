// Palmera Bay — vehicles.
// One job: build car meshes (several models and colours from boxes) and own
// player driving: entering/exiting with E, arcade WASD driving, camera
// follow, and AABB collision with buildings.
import * as THREE from 'three';
import { CONFIG, clamp, makeRng, pick, randRange } from './config.js';

export const CAR_MODELS = [
  { name: 'Comet', body: [4.4, 0.62, 1.9], cabin: [2.2, 0.55, 1.7], sporty: true },
  { name: 'Sunrise', body: [4.6, 0.72, 2.0], cabin: [2.6, 0.6, 1.8], sporty: false },
  { name: 'Hauler', body: [5.2, 0.9, 2.1], cabin: [2.4, 0.7, 1.9], sporty: false },
  { name: 'Breeze', body: [3.9, 0.6, 1.8], cabin: [2.0, 0.55, 1.6], sporty: true },
];
export const CAR_COLORS = [0xd23c2e, 0x2e6fd2, 0xf2c230, 0x2ed27a, 0xe8e8e8, 0x222226, 0x8a4fd2, 0xe87a2e];

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2f42 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });

/** Build a car mesh. Returns { group, wheels[], model }. */
export function buildCarMesh(modelIndex, color, isPolice = false) {
  const model = CAR_MODELS[modelIndex % CAR_MODELS.length];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf0f0f0 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(...model.body), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(...model.cabin), glassMat);
  cabin.position.set(model.sporty ? -0.2 : 0, 1.05, 0);
  g.add(cabin);
  // Headlights and taillights
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.4), lightMat);
    head.position.set(model.body[0] / 2, 0.6, s * 0.6);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xd21f1f }));
    tail.position.set(-model.body[0] / 2, 0.6, s * 0.6);
    g.add(tail);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.42, 0);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.45),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(0, 1.55, -0.28);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.45),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0, 1.55, 0.28);
    g.add(blue);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    door.position.set(0, 0.62, model.body[2] / 2 + 0.01);
    g.add(door);
  }
  const wheels = [];
  const hw = model.body[0] / 2 - 0.7, hz = model.body[2] / 2 - 0.05;
  for (const [wx, wz] of [[hw, hz], [hw, -hz], [-hw, hz], [-hw, -hz]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  return { group: g, wheels, model };
}

export class Car {
  constructor(scene, x, z, angle, modelIndex, color, isPolice = false) {
    const built = buildCarMesh(modelIndex, color, isPolice);
    this.mesh = built.group;
    this.wheels = built.wheels;
    this.modelName = built.model.name;
    this.pos = new THREE.Vector3(x, 0, z);
    this.angle = angle;
    this.speed = 0;
    this.steer = 0;
    this.isPolice = isPolice;
    this.stolen = false;
    this.parked = !isPolice;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.angle;
    scene.add(this.mesh);
  }

  get forwardX() { return Math.sin(this.angle); }
  get forwardZ() { return Math.cos(this.angle); }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.angle;
    for (const w of this.wheels) w.rotation.z -= this.speed * 0.02;
  }
}

/** Parked cars the player can steal, placed along roads. */
export function spawnParkedCars(scene, world, count = 16) {
  const rng = makeRng(CONFIG.WORLD_SEED + 77);
  const cars = [];
  const roads = world.roadCentres;
  for (let i = 0; i < count; i += 1) {
    const along = pick(rng, roads);
    const cross = pick(rng, roads);
    const vertical = rng() > 0.5;
    const x = vertical ? along + (rng() > 0.5 ? 4 : -4) : cross + randRange(rng, -140, 140);
    const z = vertical ? cross + randRange(rng, -140, 140) : along + (rng() > 0.5 ? 4 : -4);
    if (world.isBlocked(x, z, 2.5)) continue;
    const angle = vertical ? 0 : Math.PI / 2;
    cars.push(new Car(scene, x, z, angle, Math.floor(rng() * CAR_MODELS.length),
      pick(rng, CAR_COLORS)));
  }
  return cars;
}

/** Player driving physics for the car the player is in. */
export function driveCar(car, dt, keys, world, onCrash) {
  const accel = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const steerInput = (keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0);
  if (accel > 0) car.speed += CONFIG.CAR_ACCEL * dt;
  else if (accel < 0) car.speed -= (car.speed > 0.5 ? CONFIG.CAR_BRAKE : CONFIG.CAR_ACCEL * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * CONFIG.CAR_DRAG * 4 * dt;
  if (Math.abs(car.speed) < 0.05 && accel === 0) car.speed = 0;
  car.speed = clamp(car.speed, -CONFIG.CAR_REVERSE_MAX, CONFIG.CAR_MAX_SPEED);
  const dir = car.speed >= 0 ? 1 : -1;
  car.steer = steerInput * CONFIG.CAR_TURN * clamp(Math.abs(car.speed) / 12, 0, 1);
  car.angle += car.steer * dir * dt;
  const nx = car.pos.x + Math.sin(car.angle) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.angle) * car.speed * dt;
  const crashed = world.isBlocked(nx, nz, 2.2);
  if (crashed) {
    if (Math.abs(car.speed) > 8 && onCrash) onCrash(Math.abs(car.speed));
    car.speed *= -0.25; // bounce off the wall
  } else {
    car.pos.x = nx;
    car.pos.z = nz;
  }
  car.syncMesh();
  return crashed;
}

/** Camera behind a driven car. */
export function carCameraPosition(car, out) {
  const d = CONFIG.CAM_CAR_DISTANCE;
  out.set(
    car.pos.x - Math.sin(car.angle) * d,
    CONFIG.CAM_CAR_HEIGHT,
    car.pos.z - Math.cos(car.angle) * d,
  );
  return out;
}

export function carCameraLookAt(car, out) {
  out.set(car.pos.x + Math.sin(car.angle) * 6, 1.5, car.pos.z + Math.cos(car.angle) * 6);
  return out;
}
