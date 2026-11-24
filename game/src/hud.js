// Palmera Bay — HUD and menus (DOM, not WebGL).
// Cash, health, wanted stars, speed, mission objective, a live 2D
// minimap, toasts, and the start / pause / busted / complete screens.

import { CFG } from './config.js';

export class Hud {
  constructor(g) {
    this.g = g;
    this.el = (id) => document.getElementById(id);
    this.cashEl = this.el('cash');
    this.healthFill = this.el('health-fill');
    this.starsEl = this.el('stars');
    this.speedEl = this.el('speed');
    this.objectiveEl = this.el('objective');
    this.toastEl = this.el('toast');
    this.map = this.el('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.toastTimer = null;
    this.lastToast = '';
  }

  setCash(v) {
    this.cashEl.textContent = `$${v.toLocaleString('en-US')}`;
  }

  setHealth(v) {
    this.healthFill.style.width = `${Math.max(0, Math.min(100, v))}%`;
    this.healthFill.style.background = v > 50 ? '#58c96b' : v > 25 ? '#e8b93b' : '#d23b2e';
  }

  setWanted(stars) {
    this.starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(CFG.maxWanted - stars);
    this.starsEl.classList.toggle('hot', stars > 0);
  }

  setSpeed(kmh) {
    this.speedEl.textContent = `${Math.round(Math.abs(kmh))} km/h`;
  }

  setObjective(text) {
    this.objectiveEl.textContent = text;
  }

  toast(text, seconds = 3) {
    if (text === this.lastToast) return;
    this.lastToast = text;
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
      this.lastToast = '';
    }, seconds * 1000);
  }

  showMenu(id) {
    for (const m of ['menu-start', 'menu-pause', 'menu-busted', 'menu-complete']) {
      this.el(m).classList.toggle('hidden', m !== id);
    }
    if (id) this.el('hud').classList.add('dim');
    else this.el('hud').classList.remove('dim');
  }

  hideMenus() {
    this.showMenu(null);
  }

  setCompleteStats(cash, jobs) {
    this.el('complete-stats').textContent = `You finished all four jobs for Rosa and own the bay. Cash earned: $${cash.toLocaleString('en-US')} · Jobs done: ${jobs}/4.`;
  }

  /** Live minimap: roads, sea, player arrow, cars, cops, mission blip. */
  drawMinimap(g) {
    const ctx = this.mapCtx;
    const S = this.map.width;
    const toMap = (x, z) => [
      ((x + CFG.cityHalf + 30) / (CFG.cityHalf * 2 + 60)) * S,
      ((z + CFG.cityHalf + 30) / (CFG.cityHalf * 2 + 60)) * S,
    ];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20262c';
    ctx.fillRect(0, 0, S, S);
    // Sea strip along the bottom (south).
    const [, seaY] = toMap(0, CFG.seaZ);
    ctx.fillStyle = '#1e7f9e';
    ctx.fillRect(0, seaY, S, S - seaY);
    ctx.fillStyle = '#e8d29a';
    const [, beachY] = toMap(0, CFG.beachZ);
    ctx.fillRect(0, beachY, S, seaY - beachY);
    // Roads.
    ctx.strokeStyle = '#565d66';
    ctx.lineWidth = 3;
    for (let c = -CFG.cityHalf; c <= CFG.cityHalf; c += CFG.roadSpacing) {
      const [x] = toMap(c, 0);
      const [, z] = toMap(0, c);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, z);
      ctx.lineTo(S, z);
      ctx.stroke();
    }
    // Mission beacon blip (pulsing gold).
    if (g.beaconTarget) {
      const [bx, bz] = toMap(g.beaconTarget.x, g.beaconTarget.z);
      const r = 5 + Math.sin(g.time * 4) * 2;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(bx, bz, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Traffic dots.
    ctx.fillStyle = '#c9c9c9';
    for (const car of g.trafficCars || []) {
      const [x, z] = toMap(car.pos.x, car.pos.z);
      ctx.fillRect(x - 1.5, z - 1.5, 3, 3);
    }
    // Cop dots (blue-red flash).
    ctx.fillStyle = (Math.floor(g.time * 3) % 2 === 0) ? '#3b6cff' : '#ff3b3b';
    for (const cop of g.cops || []) {
      const [x, z] = toMap(cop.pos.x, cop.pos.z);
      ctx.beginPath();
      ctx.arc(x, z, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow, rotated to face the direction of travel.
    const [px, pz] = toMap(g.player.pos.x, g.player.pos.z);
    const ang = g.inCar ? g.inCar.angle : g.player.angle;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.PI - ang);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
