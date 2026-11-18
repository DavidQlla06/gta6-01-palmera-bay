// Palmera Bay — melee combat.
// One job: the punch/swing (mouse click or F), its arm animation and its
// knockback on nearby pedestrians and cops. Simple and working.
import * as THREE from 'three';

export class Combat {
  constructor(player) {
    this.player = player;
    this.cooldown = 0;
    this.swingTimer = 0;
    this.SWING_TIME = 0.35;
    this.RANGE = 2.4;
    this.ARC = Math.PI * 0.7;
  }

  get swinging() { return this.swingTimer > 0; }

  /** Start a swing if the cooldown allows. Returns true when it fired. */
  trySwing() {
    if (this.cooldown > 0) return false;
    this.cooldown = 0.45;
    this.swingTimer = this.SWING_TIME;
    return true;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.swingTimer > 0) {
      this.swingTimer -= dt;
      // Swing the right arm across the body.
      const t = 1 - Math.max(0, this.swingTimer) / this.SWING_TIME;
      const swing = Math.sin(t * Math.PI) * 1.6;
      this.player.armR.rotation.x = -swing;
      this.player.armR.rotation.z = -swing * 0.6;
      if (this.swingTimer <= 0) {
        this.player.armR.rotation.x = 0;
        this.player.armR.rotation.z = 0;
      }
    }
  }

  /**
   * Apply the swing to whatever is in front of the player.
   * Returns { hits, wanted } — hits = pedestrians knocked down.
   */
  resolve(pedestrians, cops) {
    const p = this.player;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    let hits = 0;
    for (const ped of pedestrians.peds) {
      if (ped.state === 'down') continue;
      const dx = ped.pos.x - p.pos.x, dz = ped.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > this.RANGE) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < Math.cos(this.ARC / 2)) continue;
      if (ped.knockDown()) {
        // Shove the pedestrian away from the player.
        ped.pos.x += (dx / (d || 1)) * 2.5;
        ped.pos.z += (dz / (d || 1)) * 2.5;
        hits += 1;
      }
    }
    // Shoving a cop is possible but it enrages them (handled by caller via hits).
    let copHit = false;
    for (const cop of cops) {
      const dx = cop.pos.x - p.pos.x, dz = cop.pos.z - p.pos.z;
      if (Math.hypot(dx, dz) < this.RANGE + 1.5) { copHit = true; break; }
    }
    return { hits, copHit };
  }
}
