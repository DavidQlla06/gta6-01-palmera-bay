// Palmera Bay — bootstrap, game loop and state machine.
// One job: wire every module together, own the modes (menu / playing /
// paused / busted / complete), run the frame loop, and hand input to the
// right system. The game itself lives in the other modules.
import * as THREE from 'three';
import { CONFIG, clamp } from './config.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Car, spawnParkedCars, driveCar, carCameraPosition, carCameraLookAt } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { stageShot } from './shots.js';

const SPAWN = new THREE.Vector3(-28, 0, 28);

export class Game {
  constructor() {
    this.mode = 'menu'; // menu | playing | paused | busted | complete
    this.cash = CONFIG.START_CASH;
    this.time = 0;
    this.shotMode = false;
    this.shotAutopilot = false;
    this.shotCamera = null;
    this.keys = {};
    this.inCar = null;
    this.pendingMissionTimer = 0;
    this.crimeCooldown = 0;
    this.crashCooldown = 0;

    // Renderer and scene.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(-60, 40, 120);

    // World and actors.
    this.world = new World(this.scene);
    this.player = new Player(this.scene, this.world);
    this.parkedCars = spawnParkedCars(this.scene, this.world, 16);
    // Guarantee a stealable car near the spawn point for job 1.
    this.parkedCars.push(new Car(this.scene, -22, 18, 0, 0, 0xd23c2e));
    this.traffic = new Traffic(this.scene, this.world);
    this.pedestrians = new Pedestrians(this.scene, this.world);
    this.police = new Police(this.scene, this.world);
    this.missions = new MissionManager(this.scene);
    this.combat = new Combat(this.player);
    this.hud = new HUD();
    this.audio = new AudioEngine();

    this.bindInput();
    this.bindButtons();
    window.addEventListener('resize', () => this.onResize());
    if (!hasSave()) document.getElementById('btn-continue').style.display = 'none';

    // Screenshot staging (?shot=start|play|chase|mission).
    const shot = new URLSearchParams(window.location.search).get('shot');
    if (shot) {
      this.shotCamera = stageShot(shot, this);
    } else {
      this.hud.showMenu();
    }
    window.__palmera = this; // debug handle
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // --- state machine -------------------------------------------------------
  setMode(mode) { this.mode = mode; }

  startGame() {
    this.audio.ensure();
    this.hud.hideMenu();
    this.hud.hidePause();
    this.hud.hideBusted();
    this.hud.hideComplete();
    this.setMode('playing');
    if (this.missions.index === 0 && !this.missions.active && !this.missions.isDone()) {
      this.startMission(0);
    }
    this.hud.toast('Welcome to Palmera Bay — steal a car for Rosa (Job 1).', 5);
    this.lockPointer();
  }

  loadSaveAndStart() {
    const save = loadGame();
    if (!save) { this.startGame(true); return; }
    this.cash = save.cash;
    this.player.pos.set(save.x, 0, save.z);
    this.player.mesh.position.copy(this.player.pos);
    this.missions.completed = save.missionsCompleted || [false, false, false, false];
    this.missions.index = save.missionIndex || 0;
    this.audio.ensure();
    this.hud.hideMenu();
    this.setMode('playing');
    this.startMission(this.missions.index);
    this.hud.toast('Save loaded. Welcome back to Palmera Bay.', 4);
    this.lockPointer();
  }

  startMission(index) {
    if (index >= 4) return;
    this.missions.start(index);
    if (index === 2) this.police.setWanted(3);
    this.hud.toast(`JOB ${index + 1} started — check the mission tracker.`, 4);
  }

  pauseGame() {
    if (this.mode !== 'playing') return;
    this.setMode('paused');
    this.hud.showPause();
    document.exitPointerLock?.();
  }

  resumeGame() {
    this.hud.hidePause();
    this.setMode('playing');
    this.lockPointer();
  }

  busted() {
    const loss = Math.min(this.cash, CONFIG.BUST_CASH_LOSS);
    this.cash -= loss;
    this.police.clearWanted();
    this.inCar = null;
    this.player.mesh.visible = true;
    this.player.pos.copy(SPAWN);
    this.player.health = CONFIG.PLAYER_HEALTH_MAX;
    this.setMode('busted');
    this.audio.bustedSting();
    this.hud.showBusted(`The Palmera Bay police caught you. You lost $${loss} and woke up back at the ferry terminal.`);
    document.exitPointerLock?.();
  }

  // --- car entry -----------------------------------------------------------
  nearestParkedCar(maxDist = 4.5) {
    let best = null, bd = maxDist;
    for (const car of this.parkedCars) {
      const d = Math.hypot(car.pos.x - this.player.pos.x, car.pos.z - this.player.pos.z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  enterCar(car) {
    this.inCar = car;
    car.parked = false;
    this.player.mesh.visible = false;
    if (!car.stolen) {
      car.stolen = true;
      this.police.addWanted(CONFIG.STEAL_WANTED);
      this.hud.toast(`You stole a ${car.modelName}! Wanted level up.`, 3);
      this.audio.pickup();
    }
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    car.speed = 0;
    this.player.pos.set(car.pos.x - Math.sin(car.angle + Math.PI / 2) * 2.5, 0, car.pos.z - Math.cos(car.angle + Math.PI / 2) * 2.5);
    this.player.mesh.visible = true;
    this.player.mesh.position.copy(this.player.pos);
    this.inCar = null;
  }

  /** Used by the screenshot stager: put the player straight into a car. */
  putPlayerInCar(x, z, angle) {
    const car = this.parkedCars[0];
    car.pos.set(x, 0, z);
    car.angle = angle;
    car.speed = 12;
    car.stolen = true;
    car.syncMesh();
    this.player.pos.set(x, 0, z);
    this.player.mesh.visible = false;
    this.inCar = car;
  }

  playerPos() {
    return this.inCar ? this.inCar.pos : this.player.pos;
  }

  // --- input ---------------------------------------------------------------
  lockPointer() {
    if (this.shotMode) return;
    try { this.renderer.domElement.requestPointerLock(); } catch (e) { /* no pointer lock */ }
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') { this.audio.setMuted(!this.audio.muted); this.hud.toast(this.audio.muted ? 'Sound off' : 'Sound on', 1.5); return; }
      this.keys[e.code] = true;
      if (e.code === 'KeyP') {
        if (this.mode === 'playing') this.pauseGame();
        else if (this.mode === 'paused') this.resumeGame();
      }
      if (this.mode !== 'playing') return;
      if (e.code === 'KeyE') {
        if (this.inCar) this.exitCar();
        else {
          const car = this.nearestParkedCar();
          if (car) this.enterCar(car);
        }
      }
      if (e.code === 'KeyF') this.swing();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.renderer.domElement && this.mode === 'playing' && !this.inCar) {
        this.player.look(e.movementX, e.movementY);
      }
    });
    document.addEventListener('mousedown', (e) => {
      if (this.mode === 'playing' && document.pointerLockElement === this.renderer.domElement && !this.inCar) this.swing();
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.renderer.domElement && this.mode === 'playing' && !this.shotMode) {
        this.pauseGame();
      }
    });
    this.renderer.domElement.addEventListener('click', () => {
      if (this.mode === 'playing' && !this.shotMode) this.lockPointer();
    });
  }

  swing() {
    if (!this.combat.trySwing()) return;
    const result = this.combat.resolve(this.pedestrians, this.police.cops);
    if (result.hits > 0) {
      this.raiseCrime(CONFIG.HIT_PED_WANTED);
      this.hud.toast('You knocked someone down! The cops noticed.', 2.5);
    } else if (result.copHit) {
      this.raiseCrime(1);
      this.hud.toast('You shoved a cop. Bad idea.', 2.5);
    }
  }

  raiseCrime(stars) {
    if (this.crimeCooldown > 0) return;
    this.crimeCooldown = 2;
    this.police.addWanted(stars);
  }

  bindButtons() {
    document.getElementById('btn-play').addEventListener('click', () => this.startGame());
    document.getElementById('btn-continue').addEventListener('click', () => this.loadSaveAndStart());
    document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());
    document.getElementById('btn-save').addEventListener('click', () => {
      const ok = saveGame(this);
      this.hud.toast(ok ? 'Game saved.' : 'Save failed (storage unavailable).', 2.5);
    });
    document.getElementById('btn-restart-mission').addEventListener('click', () => {
      this.hud.hidePause();
      this.police.clearWanted();
      this.startMission(this.missions.index);
      this.setMode('playing');
      this.lockPointer();
    });
    document.getElementById('btn-quit-menu').addEventListener('click', () => {
      this.hud.hidePause();
      this.hud.showMenu();
      this.setMode('menu');
    });
    document.getElementById('btn-respawn').addEventListener('click', () => {
      this.hud.hideBusted();
      this.setMode('playing');
      this.hud.toast('Back on the street. Keep it clean — or don\'t.', 3);
      this.lockPointer();
    });
    document.getElementById('btn-free-roam').addEventListener('click', () => {
      this.hud.hideComplete();
      this.setMode('playing');
      this.lockPointer();
    });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // --- frame ----------------------------------------------------------------
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    if (this.crimeCooldown > 0) this.crimeCooldown -= dt;
    if (this.crashCooldown > 0) this.crashCooldown -= dt;

    if (this.mode === 'playing') this.updatePlaying(dt);
    else if (this.mode === 'menu') this.updateMenu(dt);

    // World ambience always moves.
    this.world.update(dt, this.time);
    this.traffic.update(this.mode === 'playing' ? dt : dt * 0.5);
    this.pedestrians.update(dt, this.threats());

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.hud.update(dt, this.hudState());
  }

  threats() {
    const list = [];
    if (this.inCar && Math.abs(this.inCar.speed) > 2) list.push({ x: this.inCar.pos.x, z: this.inCar.pos.z });
    else if (!this.inCar) list.push({ x: this.player.pos.x, z: this.player.pos.z });
    return list;
  }

  updateMenu(dt) {
    // Slow cinematic orbit over downtown and the beach.
    const t = this.time * 0.05;
    this.camera.position.set(Math.sin(t) * 150, 55, Math.cos(t) * 150);
    this.camera.lookAt(40, 5, -20);
  }

  updatePlaying(dt) {
    // Shot autopilot: hold W and steer gently along the road.
    if (this.shotMode && this.shotAutopilot && this.inCar) {
      this.keys['KeyW'] = true;
    }
    if (this.inCar) {
      const crashed = driveCar(this.inCar, dt, this.keys, this.world, (speed) => {
        if (this.crashCooldown <= 0) {
          this.crashCooldown = 3;
          this.raiseCrime(CONFIG.CRASH_WANTED);
          this.player.health = Math.max(0, this.player.health - 4);
          this.hud.toast('You crashed into a building!', 2);
        }
      });
      // Running over pedestrians is a crime.
      if (Math.abs(this.inCar.speed) > 3) {
        const hit = this.pedestrians.near(this.inCar.pos.x, this.inCar.pos.z, 2.4);
        for (const ped of hit) {
          if (ped.knockDown()) {
            this.raiseCrime(CONFIG.HIT_PED_WANTED);
            this.hud.toast('You hit a pedestrian! Wanted level up.', 3);
          }
        }
      }
      // Cop rams slow the car and hurt.
      this.policeRamCheck();
    } else {
      this.player.update(dt, this.keys);
      this.combat.update(dt);
    }

    // Police chase / decay / busted.
    this.police.update(dt, this.playerPos(), !!this.inCar,
      () => this.busted(),
      (cop) => {
        if (this.inCar) {
          this.inCar.speed *= 0.86;
          this.player.health = Math.max(0, this.player.health - CONFIG.COP_RAM_DAMAGE * dt);
        }
      });
    if (this.player.health <= 0 && this.mode === 'playing') this.busted();

    // Missions.
    const result = this.missions.update(dt, {
      playerPos: this.playerPos(),
      inCar: !!this.inCar,
      wanted: this.police.wanted,
      dt,
    });
    if (result) {
      if (result.done) {
        this.cash += result.reward;
        this.audio.missionJingle();
        this.hud.toast(this.missions.message, 5);
        saveGame(this);
        if (this.missions.isDone()) {
          this.hud.showComplete();
          this.setMode('complete');
          document.exitPointerLock?.();
        } else {
          this.pendingMissionTimer = 1.5;
        }
      } else if (result.failed) {
        this.audio.bustedSting();
        this.hud.toast(this.missions.message, 5);
        this.pendingMissionTimer = 1.5;
      }
    }
    if (this.pendingMissionTimer > 0) {
      this.pendingMissionTimer -= dt;
      if (this.pendingMissionTimer <= 0 && !this.missions.isDone()) {
        const next = this.missions.index;
        if (!this.missions.active) this.startMission(next);
      }
    }

    // Engine + siren follow the action.
    this.audio.update(dt, this.inCar ? this.inCar.speed : 0, this.police.wanted);
  }

  policeRamCheck() {
    // Police ramming is handled inside Police.update via onRam; nothing extra here.
  }

  updateCamera(dt) {
    if (this.shotMode && this.shotCamera && this.shotCamera.mode === 'fixed') {
      this.camera.position.set(...this.shotCamera.pos);
      this.camera.lookAt(...this.shotCamera.look);
      return;
    }
    if (this.mode === 'menu') return; // updateMenu already placed the camera
    const target = new THREE.Vector3();
    const look = new THREE.Vector3();
    if (this.inCar) {
      carCameraPosition(this.inCar, target);
      carCameraLookAt(this.inCar, look);
    } else {
      this.player.cameraPosition(target);
      this.player.cameraLookAt(look);
    }
    const k = 1 - Math.exp(-dt * 7);
    this.camera.position.lerp(target, k);
    this.camera.lookAt(look);
  }

  hudState() {
    const p = this.playerPos();
    return {
      cash: this.cash,
      health: this.player.health,
      wanted: this.police.wanted,
      mode: this.mode,
      objective: this.missions.active || !this.missions.isDone() ? this.missions.objectiveText() : 'All jobs done — free roam!',
      inCar: !!this.inCar,
      speed: this.inCar ? this.inCar.speed : 0,
      carName: this.inCar ? this.inCar.modelName : '',
      roads: this.world.roadCentres,
      playerX: p.x,
      playerZ: p.z,
      playerAngle: this.inCar ? this.inCar.angle : this.player.yaw,
      trafficCars: this.traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      cops: this.police.cops.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      missionTarget: this.missions.active ? this.missions.target() : null,
    };
  }
}

function boot() {
  try {
    new Game();
    window.__palmeraReady = true;
  } catch (err) {
    console.error('Palmera Bay failed to start:', err);
    const el = document.createElement('div');
    el.id = 'fatal-error';
    el.textContent = `Palmera Bay failed to start: ${err.message}`;
    document.body.appendChild(el);
    window.__palmeraError = String(err && err.message);
  }
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
else boot();
