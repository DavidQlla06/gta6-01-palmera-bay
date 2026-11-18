// Palmera Bay — HUD and menus.
// One job: every 2D overlay — cash, wanted stars, health, mission tracker,
// speed, messages, the 2D canvas minimap, and the menu / pause / busted /
// mission-complete screens. No 3D code here.
import { CONFIG } from './config.js';

const MAP_RANGE = 260; // world units shown across the minimap

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.buildDom();
    this.toastTimer = 0;
    this.lastObjective = '';
  }

  buildDom() {
    this.root.innerHTML = `
      <div id="hud-top-left">
        <div id="hud-cash">$0</div>
        <div id="hud-health"><div id="hud-health-fill"></div><span>HEALTH</span></div>
        <div id="hud-stars"></div>
      </div>
      <div id="hud-mission"></div>
      <div id="hud-speed"></div>
      <div id="hud-toast"></div>
      <canvas id="minimap" width="220" height="220"></canvas>
      <div id="hud-help">WASD move &nbsp;·&nbsp; Shift run &nbsp;·&nbsp; E enter / steal car &nbsp;·&nbsp; Click / F punch &nbsp;·&nbsp; P pause &nbsp;·&nbsp; M mute</div>
      <div id="menu" class="overlay">
        <h1>PALMERA BAY</h1>
        <p class="tagline">A sun-soaked open-world crime story. All original — no city you have seen before.</p>
        <p class="story">You are <b>Leo Marlow</b>, a driver fresh off the ferry. Rosa needs a car.
        Marco needs a package moved. The Palmera Bay police need a reason to chase you.
        Steal cars, outrun the law, finish four jobs — and own the bay.</p>
        <button id="btn-play">PLAY</button>
        <button id="btn-continue">CONTINUE (LOAD SAVE)</button>
        <div class="controls">WASD — move / drive &nbsp;·&nbsp; Mouse — look &nbsp;·&nbsp; Shift — run<br>
        E — enter / steal car &nbsp;·&nbsp; Click or F — punch &nbsp;·&nbsp; P — pause &nbsp;·&nbsp; M — mute sound</div>
      </div>
      <div id="pause-menu" class="overlay hidden">
        <h1>PAUSED</h1>
        <p>Palmera Bay waits for no one. Except now.</p>
        <button id="btn-resume">RESUME</button>
        <button id="btn-save">SAVE GAME</button>
        <button id="btn-restart-mission">RESTART CURRENT JOB</button>
        <button id="btn-quit-menu">QUIT TO MENU</button>
      </div>
      <div id="busted" class="overlay hidden">
        <h1>BUSTED</h1>
        <p id="busted-text">The Palmera Bay police caught you. You lost some cash.</p>
        <button id="btn-respawn">BACK ON THE STREET</button>
      </div>
      <div id="complete" class="overlay hidden">
        <h1>ALL JOBS DONE</h1>
        <p>Rosa and Marco owe you big. Palmera Bay is yours — free roam, keep the cash coming.</p>
        <button id="btn-free-roam">FREE ROAM</button>
      </div>`;
    this.cashEl = document.getElementById('hud-cash');
    this.healthFill = document.getElementById('hud-health-fill');
    this.starsEl = document.getElementById('hud-stars');
    this.missionEl = document.getElementById('hud-mission');
    this.speedEl = document.getElementById('hud-speed');
    this.toastEl = document.getElementById('hud-toast');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.menu = document.getElementById('menu');
    this.pauseMenu = document.getElementById('pause-menu');
    this.bustedEl = document.getElementById('busted');
    this.completeEl = document.getElementById('complete');
  }

  showMenu() { this.menu.classList.remove('hidden'); }
  hideMenu() { this.menu.classList.add('hidden'); }
  showPause() { this.pauseMenu.classList.remove('hidden'); }
  hidePause() { this.pauseMenu.classList.add('hidden'); }
  showBusted(text) {
    if (text) document.getElementById('busted-text').textContent = text;
    this.bustedEl.classList.remove('hidden');
  }
  hideBusted() { this.bustedEl.classList.add('hidden'); }
  showComplete() { this.completeEl.classList.remove('hidden'); }
  hideComplete() { this.completeEl.classList.add('hidden'); }

  toast(msg, seconds = 3) {
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = '1';
    this.toastTimer = seconds;
  }

  update(dt, state) {
    this.cashEl.textContent = `$${Math.floor(state.cash).toLocaleString('en-US')}`;
    this.healthFill.style.width = `${Math.max(0, state.health)}%`;
    this.healthFill.style.background = state.health > 50 ? '#37c978' : state.health > 25 ? '#f2c230' : '#e83c2e';
    let stars = '';
    for (let i = 0; i < CONFIG.WANTED_MAX; i += 1) stars += i < state.wanted ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.style.color = state.wanted > 0 ? '#ffd23c' : 'rgba(255,255,255,0.35)';
    this.starsEl.style.textShadow = state.wanted > 0 ? '0 0 8px rgba(255,210,60,0.8)' : 'none';
    const obj = state.objective || '';
    if (obj !== this.lastObjective) {
      this.missionEl.textContent = obj;
      this.lastObjective = obj;
    }
    this.missionEl.style.display = state.mode === 'playing' ? 'block' : 'none';
    this.speedEl.textContent = state.inCar
      ? `${Math.abs(Math.round(state.speed * 2.2))} mph · ${state.carName || ''}`
      : '';
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = '0';
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const W = this.map.width, H = this.map.height;
    const scale = W / (MAP_RANGE * 2);
    const toX = (x) => W / 2 + x * scale;
    const toY = (z) => H / 2 + z * scale;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(12, 26, 34, 0.82)';
    ctx.fillRect(0, 0, W, H);
    // Ocean (east)
    ctx.fillStyle = '#1e6f8e';
    ctx.fillRect(toX(CONFIG.BEACH_X), 0, W - toX(CONFIG.BEACH_X), H);
    // Beach
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(toX(CONFIG.BEACH_X - 14), 0, 14 * scale, H);
    // Roads
    ctx.strokeStyle = '#5a5a60';
    ctx.lineWidth = 5;
    for (const rc of state.roads) {
      ctx.beginPath(); ctx.moveTo(toX(rc), 0); ctx.lineTo(toX(rc), H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toY(rc)); ctx.lineTo(W, toY(rc)); ctx.stroke();
    }
    // Mission marker
    if (state.missionTarget) {
      const mx = toX(state.missionTarget.x), my = toY(state.missionTarget.z);
      ctx.fillStyle = '#ffc23c';
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.stroke();
    }
    // Traffic cars (white dots)
    ctx.fillStyle = '#d8d8d8';
    for (const c of state.trafficCars || []) {
      ctx.fillRect(toX(c.x) - 1.5, toY(c.z) - 1.5, 3, 3);
    }
    // Police (blue/red flashing dots)
    for (const c of state.cops || []) {
      ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#ff4040' : '#4080ff';
      ctx.beginPath(); ctx.arc(toX(c.x), toY(c.z), 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow (centre)
    const px = toX(state.playerX), py = toY(state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.playerAngle || 0);
    ctx.fillStyle = '#37c978';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North tick
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', W - 14, 14);
  }
}
