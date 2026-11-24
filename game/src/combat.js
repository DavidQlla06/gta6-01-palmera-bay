// Palmera Bay — melee combat.
// One button, one punch. On foot the player can swing at whatever is in
// front of them: a pedestrian goes down (and the law notices), a car
// takes a dent and its alarm draws heat. A short cooldown keeps it honest.

import { punchPedestrian } from './pedestrians.js';
import { addHeat } from './police.js';

export function initCombat(g) {
  g.punchCooldown = 0;
  g.punchAnim = 0;
  return g;
}

export function tryPunch(g) {
  if (g.mode !== 'playing' || g.inCar || g.punchCooldown > 0) return;
  g.punchCooldown = 0.45;
  g.punchAnim = 0.28;
  g.audio.thud();
  const from = g.player.pos;
  const hit = punchPedestrian(g, from, g.player.angle);
  if (hit) {
    addHeat(g, 1, 'assault on a pedestrian');
    g.hud.toast('You decked a pedestrian! The cops saw that.', 3);
    return;
  }
  // Swinging at a car dents it and sets off its alarm.
  for (const car of g.cars) {
    if (car.traffic || car.cop) continue;
    const d = Math.hypot(car.pos.x - from.x, car.pos.z - from.z);
    if (d < 3.0) {
      car.mesh.position.y = 0.12;
      setTimeout(() => {
        car.mesh.position.y = 0;
      }, 120);
      addHeat(g, 1, 'car alarm going off');
      g.hud.toast('Car alarm! Someone called the cops.', 3);
      g.audio.blip(1200, 0.2, 0.1);
      return;
    }
  }
}

export function updateCombat(g, dt) {
  if (g.punchCooldown > 0) g.punchCooldown -= dt;
  if (g.punchAnim > 0) {
    g.punchAnim -= dt;
    // Punch swing: right arm snaps forward, then relaxes.
    const t = Math.max(0, g.punchAnim / 0.28);
    g.player.parts.armR.rotation.x = -1.5 * t;
  } else {
    g.player.parts.armR.rotation.x = 0;
  }
}
