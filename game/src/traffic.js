// Palmera Bay — traffic.
// One job: AI cars that cruise the road grid in loops, stop for nothing,
// and swerve around nothing — simple, readable, always moving.
import * as THREE from 'three';
import { CONFIG, makeRng, pick } from './config.js';
import { Car, CAR_COLORS } from './vehicles.js';

export class Traffic {
  constructor(scene, world) {
    this.world = world;
    this.cars = [];
    const rng = makeRng(CONFIG.WORLD_SEED + 21);
    const roads = world.roadCentres;
    for (let i = 0; i < CONFIG.TRAFFIC_COUNT; i += 1) {
      const vertical = rng() > 0.5;
      const road = pick(rng, roads);
      const lane = (rng() > 0.5 ? 3 : -3);
      const along = (rng() * 2 - 1) * 160;
      const x = vertical ? road + lane : along;
      const z = vertical ? along : road + lane;
      const angle = vertical ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2);
      const car = new Car(scene, x, z, angle, Math.floor(rng() * 4), pick(rng, CAR_COLORS));
      car.parked = false;
      car.speed = CONFIG.TRAFFIC_SPEED * (0.8 + rng() * 0.4);
      car.vertical = vertical;
      car.lane = lane;
      car.road = road;
      car.along = along;
      this.cars.push(car);
    }
  }

  update(dt) {
    for (const car of this.cars) {
      car.along += car.speed * dt * (car.lane > 0 ? 1 : -1) * (car.vertical ? 1 : 1);
      // Loop around the city edge.
      if (car.along > 190) car.along = -190;
      if (car.along < -190) car.along = 190;
      if (car.vertical) {
        car.pos.x = car.road + car.lane;
        car.pos.z = car.along;
        car.angle = car.lane > 0 ? 0 : Math.PI;
      } else {
        car.pos.x = car.along;
        car.pos.z = car.road + car.lane;
        car.angle = car.lane > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      car.syncMesh();
    }
  }

  /** All moving cars, for the minimap and for collision checks. */
  allCars() { return this.cars; }
}
