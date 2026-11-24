// Palmera Bay — tuning constants and small shared helpers.
// Every number that shapes how the city feels lives here, so a balance
// pass never has to hunt through the gameplay modules.

export const CFG = {
  // City layout (metres). Roads run on a grid; blocks sit between them.
  roadSpacing: 80,
  roadHalf: 7,
  cityHalf: 240,
  blockSize: 66,
  // Beach and sea, on the south edge of the map.
  beachZ: 196,
  seaZ: 232,
  // On-foot movement.
  walkSpeed: 6.5,
  runSpeed: 11,
  // Arcade driving.
  carAccel: 26,
  carBrake: 42,
  carReverseMax: 12,
  carTopSpeed: 40,
  carSteer: 1.9,
  carGrip: 3.2,
  // Wanted system.
  wantedDecaySeconds: 22,
  maxWanted: 5,
  copTopSpeed: 36,
  // Crowd sizes.
  trafficCars: 14,
  pedestrians: 26,
  parkedCars: 18,
  // Mission payouts (in-game dollars).
  payouts: [500, 750, 600, 900],
  // Screenshot scenes.
  shotWaitFrames: 45,
};

/** Deterministic RNG (mulberry32) so the city and the staged screenshot
 *  scenes are stable for a given seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed angle difference, in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Pick one element of an array with a seeded RNG. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Sun-soaked coastal palette: warm plaster, terracotta roofs, teal sea.
export const PALETTE = {
  sky: 0x8ec9e8,
  sun: 0xffdf9e,
  asphalt: 0x3a3f46,
  sidewalk: 0x9a938a,
  sand: 0xe8d29a,
  sea: 0x1e7f9e,
  grass: 0x6fae5f,
  building: [0xe8dcc8, 0xd9b48f, 0xc98d6b, 0xa8c4c4, 0xe0a899, 0xcfc4a8],
  roof: [0xb5654a, 0x8a6f4d, 0x5f7d8a, 0x9c8a76],
  car: [0xd23b2e, 0x2e6fd2, 0xe8b93b, 0x3aa655, 0xeeeeee, 0x222226, 0x7a4fd0, 0xe07b39],
  palmTrunk: 0x8a6b48,
  palmLeaf: 0x3f9142,
  copWhite: 0xf2f2f2,
  copBlue: 0x1c4fd6,
};
