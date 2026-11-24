// Palmera Bay — AI traffic.
// Cars cruise the avenues in lanes, wrap around the map edges, and slow
// down when another car is right ahead of them. No pathfinding needed:
// each car owns one straight road and one direction.

import { CFG, PALETTE, clamp, pick } from './config.js';
import { makeCar, MODELS } from './vehicles.js';

export function spawnTraffic(g, rng) {
  const cars = [];
  for (let i = 0; i < CFG.trafficCars; i++) {
    const road = pick(rng, g.roadLines);
    const along = (rng() - 0.5) * (CFG.cityHalf * 2 - 30);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = dir * 2.6;
    const x = road.axis === 'x' ? along : road.at + lane;
    const z = road.axis === 'x' ? road.at + lane : along;
    const angle = road.axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
    // NOTE: our car mesh faces +Z when angle is 0, so an x-road car
    // driving +X needs angle PI/2. The mapping above keeps nose forward.
    const model = pick(rng, MODELS);
    const car = makeCar(g, model, pick(rng, PALETTE.car), x, z, angle, { traffic: true });
    car.speed = 9 + rng() * 7;
    car.road = road;
    car.dir = dir;
    car.lane = lane;
    cars.push(car);
  }
  g.trafficCars = cars;
  return cars;
}

export function updateTraffic(g, dt) {
  for (const car of g.trafficCars) {
    // Slow down if a car is close ahead on the same road.
    let blocked = false;
    for (const other of g.cars) {
      if (other === car || other.parked) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const ahead = Math.sin(car.angle) * dx + Math.cos(car.angle) * dz;
      const side = Math.abs(Math.cos(car.angle) * dx - Math.sin(car.angle) * dz);
      if (ahead > 0 && ahead < 9 && side < 2.2) {
        blocked = true;
        break;
      }
    }
    const target = blocked ? 0 : 9 + (car.id % 5);
    car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
    car.pos.x += Math.sin(car.angle) * car.speed * dt;
    car.pos.z += Math.cos(car.angle) * car.speed * dt;
    // Wrap around the far edge of the map.
    const lim = CFG.cityHalf + 20;
    if (car.pos.x > lim) car.pos.x = -lim;
    if (car.pos.x < -lim) car.pos.x = lim;
    if (car.pos.z > lim) car.pos.z = -lim;
    if (car.pos.z < -lim) car.pos.z = lim;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.angle;
  }
}
