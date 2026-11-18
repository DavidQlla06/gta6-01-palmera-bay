// Palmera Bay — tuning constants and shared helpers.
// One job: every number the game balances on, plus the tiny math helpers
// every module shares (seeded RNG, clamp, lerp). No scene code here.
import * as THREE from 'three';

export const CONFIG = {
  // World layout (metres). Streets run on a square grid; the beach and the
  // ocean sit on the east edge, downtown in the middle.
  CITY_HALF: 196,          // playable city extent in x and z
  ROAD_SPACING: 56,       // distance between parallel road centrelines
  ROAD_WIDTH: 12,
  BLOCK_SIZE: 44,         // ROAD_SPACING - ROAD_WIDTH
  BEACH_X: 208,           // sand starts here
  OCEAN_X: 238,           // water starts here
  WORLD_SEED: 1337,

  // Player on foot
  WALK_SPEED: 6,
  RUN_SPEED: 11,
  PLAYER_RADIUS: 0.6,
  PLAYER_HEALTH_MAX: 100,

  // Driving
  CAR_ACCEL: 22,
  CAR_BRAKE: 34,
  CAR_MAX_SPEED: 34,
  CAR_REVERSE_MAX: 10,
  CAR_TURN: 1.9,
  CAR_DRAG: 0.6,

  // Traffic and pedestrians
  TRAFFIC_COUNT: 14,
  TRAFFIC_SPEED: 9,
  PED_COUNT: 26,
  PED_SPEED: 1.6,

  // Police / wanted
  WANTED_MAX: 5,
  WANTED_DECAY_SECONDS: 22,   // clean time before one star drops
  COP_SPAWN_DISTANCE: 55,
  COP_MAX: 6,
  COP_SPEED: 30,
  COP_RAM_DAMAGE: 6,
  BUST_DISTANCE: 2.4,
  BUST_CASH_LOSS: 120,

  // Missions
  MISSION_REWARDS: [500, 800, 1000, 600],
  TIMED_MISSION_SECONDS: 75,
  MISSION_RADIUS: 7,

  // Camera
  CAM_DISTANCE: 9,
  CAM_HEIGHT: 4.2,
  CAM_CAR_DISTANCE: 11,
  CAM_CAR_HEIGHT: 5,

  // Economy
  START_CASH: 250,
  STEAL_WANTED: 1,
  HIT_PED_WANTED: 2,
  CRASH_WANTED: 1,
};

/** Deterministic RNG (mulberry32) so the city and the staged screenshots are stable. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

/** Shared three.js scratch objects so hot loops allocate nothing. */
export const V3 = {
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  c: new THREE.Vector3(),
};
