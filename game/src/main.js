// Palmera Bay — bootstrap and game loop.
// Wires the modules together: input, camera, modes, the per-frame update
// and the deterministic ?shot= scenes. Nothing here knows how a building
// is drawn or how a mission pays — that lives in the other modules.

import * as THREE from 'three';
import { CFG, clamp, angleDelta, mulberry32 } from './config.js';
import { buildWorld } from './world.js';
import { SoundBank } from './audio.js';
import { makePlayerMesh, movePlayer, nearestStealableCar } from './player.js';
import { spawnParkedCars, drivePlayerCar, makeCar, MODELS } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { addHeat, setWanted, spawnCopNear, removeAllCops, updatePolice } from './police.js';
import { initMissions, startMission, updateMissions, MISSION_DEFS } from './missions.js';
import { initCombat, tryPunch, updateCombat } from './combat.js';
import { Hud } from './hud.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { stageShot, SHOT_NAMES } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '7', 10) || 7;
const shotName = params.get('shot');

const rng = mulberry32(seed);

const g = {
  seed,
  scene: new THREE.Scene(),
  camera: null,
  renderer: null,
  clock: new THREE.Clock(),
  time: 0,
  mode: 'menu',
  cash: 0,
  health: 100,
  wanted: 0,
  heatTimer: CFG.wantedDecaySeconds,
  keys: {},
  cars: [],
  cops: [],
  trafficCars: [],
  peds: [],
  colliders: [],
  roadLines: [],
  nextCarId: 1,
  player: null,
  inCar: null,
  camYaw: Math.PI,
  camPitch: 0.32,
  mouseTimer: 0,
  shake: 0,
  shotMode: false,
  shotAutopilot: false,
  shotFrames: 0,
  missionIndex: 0,
  mission: null,
  beacon: null,
  beaconTarget: null,
  jobCar: null,
  rng,
};

// Renderer and camera.
g.renderer = new THREE.WebGLRenderer({ antialias: true });
g.renderer.setSize(window.innerWidth, window.innerHeight);
g.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game').appendChild(g.renderer.domElement);
g.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
window.addEventListener('resize', () => {
  g.camera.aspect = window.innerWidth / window.innerHeight;
  g.camera.updateProjectionMatrix();
  g.renderer.setSize(window.innerWidth, window.innerHeight);
});

// Subsystems.
g.audio = new SoundBank();
g.hud = new Hud(g);
buildWorld(g);
spawnParkedCars(g, rng);
spawnTraffic(g, rng);
spawnPedestrians(g, rng);
initMissions(g);
initCombat(g);
g.policeApi = { setWanted, spawnCopNear, removeAllCops };
g.startMission = (i) => startMission(g, i);

// The red Comet on Coral Ave is the first job's mark: make sure one
// exists, parked where the mission expects it.
{
  let comet = null;
  for (const car of g.cars) {
    if (car.parked && car.model.name === 'Comet' && car.color === 0xd23b2e) comet = car;
  }
  if (!comet) {
    comet = makeCar(g, MODELS[0], 0xd23b2e, 0, -40, Math.PI / 2, { parked: true });
    comet.parkedSpot = { x: 0, z: -40, angle: Math.PI / 2 };
  }
  g.jobCar = comet;
}

// Player figure, starting on the ferry plaza at the south end.
const parts = makePlayerMesh(g);
g.player = {
  parts,
  mesh: parts.mesh,
  pos: new THREE.Vector3(0, 0, -150),
  angle: 0,
  walkPhase: 0,
};

// Modes.
g.setMode = (mode) => {
  g.mode = mode;
  if (mode === 'playing') g.hud.hideMenus();
};

g.busted = () => {
  if (g.shotMode || g.mode !== 'playing') return;
  g.setMode('busted');
  g.audio.blip(160, 0.4, 0.12);
  document.exitPointerLock?.();
  g.hud.showMenu('menu-busted');
  g.saveGame();
};

g.completeGame = () => {
  if (g.mode !== 'playing') return;
  g.setMode('complete');
  g.hud.setCompleteStats(g.cash, MISSION_DEFS.length);
  g.hud.showMenu('menu-complete');
  g.saveGame();
};

g.saveGame = () => writeSave(g);

/** Seat the player in a given car, moved to (x, z) facing angle. */
g.seatPlayerIn = (car, x, z, angle) => {
  car.pos.set(x, 0, z);
  car.angle = angle;
  car.speed = 0;
  car.parked = false;
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = angle;
  g.inCar = car;
  g.player.mesh.visible = false;
  g.camYaw = angle + Math.PI;
  return car;
};

/** Put the player into the nearest parked car to (x, z), moved there. */
g.putPlayerInCar = (x, z, angle) => {
  let best = null;
  let bestD = Infinity;
  for (const car of g.cars) {
    if (!car.parked || car.cop || car.traffic) continue;
    const d = Math.hypot(car.pos.x - x, car.pos.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return null;
  return g.seatPlayerIn(best, x, z, angle);
};

function enterCar() {
  if (g.inCar || g.mode !== 'playing') return;
  const car = nearestStealableCar(g);
  if (!car) {
    g.hud.toast('No car close enough to steal.', 2);
    return;
  }
  car.parked = false;
  g.inCar = car;
  g.player.mesh.visible = false;
  g.camYaw = car.angle + Math.PI;
  addHeat(g, 1, 'grand theft auto');
  g.audio.blip(520, 0.12, 0.09);
  g.hud.toast(`You stole the ${car.model.name}. Lose the heat!`, 3);
  // If this is the job car, the mission notices on its next update.
}

function exitCar() {
  if (!g.inCar) return;
  const car = g.inCar;
  g.inCar = null;
  const side = car.angle + Math.PI / 2;
  g.player.pos.set(
    car.pos.x + Math.sin(side) * 2.2,
    0,
    car.pos.z + Math.cos(side) * 2.2,
  );
  g.player.angle = car.angle;
  g.player.mesh.visible = true;
  g.player.mesh.position.copy(g.player.pos);
  g.camYaw = car.angle + Math.PI;
}

// Input.
const canvas = g.renderer.domElement;
window.addEventListener('keydown', (e) => {
  g.keys[e.code] = true;
  g.audio.ensure();
  if (e.code === 'KeyM') {
    g.audio.setMuted(!g.audio.muted);
    g.hud.toast(g.audio.muted ? 'Sound muted.' : 'Sound on.', 2);
  }
  if (e.code === 'KeyP' && g.mode === 'playing') {
    g.setMode('paused');
    g.hud.showMenu('menu-pause');
    document.exitPointerLock?.();
  } else if (e.code === 'KeyP' && g.mode === 'paused') {
    g.setMode('playing');
  }
  if (e.code === 'KeyE' && g.mode === 'playing') {
    if (g.inCar) exitCar();
    else enterCar();
  }
  if (e.code === 'KeyF' && g.mode === 'playing') tryPunch(g);
});
window.addEventListener('keyup', (e) => {
  g.keys[e.code] = false;
});
canvas.addEventListener('click', () => {
  g.audio.ensure();
  if (g.mode === 'playing') {
    canvas.requestPointerLock?.();
    tryPunch(g);
  }
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  g.camYaw -= e.movementX * 0.0024;
  g.camPitch = clamp(g.camPitch + e.movementY * 0.0018, -0.05, 0.85);
  g.mouseTimer = 1.6;
});

// Menu buttons.
function wireButton(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => {
    g.audio.ensure();
    g.audio.blip(700, 0.08, 0.08);
    fn();
  });
}
wireButton('btn-new', () => {
  clearSave();
  g.cash = 0;
  g.missionIndex = 0;
  g.health = 100;
  g.wanted = 0;
  startNewRun();
});
wireButton('btn-continue', () => {
  const save = loadSave();
  if (save) {
    g.cash = save.cash;
    g.player.pos.set(save.x, 0, save.z);
  }
  startNewRun(save ? save.missionIndex : 0);
});
wireButton('btn-resume', () => g.setMode('playing'));
wireButton('btn-restart', () => {
  g.health = 100;
  g.wanted = 0;
  g.player.pos.set(0, 0, -150);
  if (g.inCar) {
    g.inCar = null;
    g.player.mesh.visible = true;
  }
  g.setMode('playing');
});
wireButton('btn-again', () => {
  clearSave();
  g.cash = 0;
  g.missionIndex = 0;
  g.health = 100;
  g.wanted = 0;
  startNewRun();
});
wireButton('btn-menu', () => {
  g.setMode('menu');
  g.hud.showMenu('menu-start');
});

function startNewRun(missionIndex = 0) {
  g.health = 100;
  g.wanted = 0;
  g.heatTimer = CFG.wantedDecaySeconds;
  if (g.inCar) {
    g.inCar = null;
    g.player.mesh.visible = true;
  }
  g.player.mesh.position.copy(g.player.pos);
  g.setMode('playing');
  g.hud.setCash(g.cash);
  g.hud.setHealth(g.health);
  g.hud.setWanted(0);
  startMission(g, missionIndex);
}

// Continue button only when a save exists.
if (!loadSave()) {
  const btn = document.getElementById('btn-continue');
  if (btn) btn.classList.add('hidden');
}

// Camera follow: third person behind the player or the car.
function updateCamera(dt) {
  const target = g.inCar ? g.inCar.pos : g.player.pos;
  const heading = g.inCar ? g.inCar.angle : null;
  if (heading !== null) {
    g.mouseTimer -= dt;
    if (g.mouseTimer <= 0) {
      const want = heading + Math.PI;
      g.camYaw += angleDelta(g.camYaw, want) * Math.min(1, dt * 1.4);
    }
  }
  const dist = g.inCar ? 11 : 7.5;
  const height = g.inCar ? 3.4 : 3.0;
  const cosP = Math.cos(g.camPitch);
  const cx = target.x + Math.sin(g.camYaw) * cosP * dist;
  const cz = target.z + Math.cos(g.camYaw) * cosP * dist;
  const cy = height + Math.sin(g.camPitch) * dist;
  let sx = 0;
  let sz = 0;
  if (g.shake > 0) {
    sx = (Math.random() - 0.5) * g.shake;
    sz = (Math.random() - 0.5) * g.shake;
    g.shake = Math.max(0, g.shake - dt * 1.4);
  }
  g.camera.position.set(cx + sx, cy, cz + sz);
  g.camera.lookAt(target.x - Math.sin(g.camYaw) * 2, target.y + 1.7, target.z - Math.cos(g.camYaw) * 2);
}

// Main loop.
function readInput() {
  const k = g.keys;
  return {
    forward: !!(k.KeyW || k.ArrowUp),
    back: !!(k.KeyS || k.ArrowDown),
    left: !!(k.KeyA || k.ArrowLeft),
    right: !!(k.KeyD || k.ArrowRight),
    run: !!(k.ShiftLeft || k.ShiftRight),
  };
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, g.clock.getDelta());
  g.time += dt;
  const input = readInput();
  if (g.shotMode && g.shotAutopilot) input.forward = true;

  if (g.mode === 'playing') {
    let speed = 0;
    if (g.inCar) {
      const crashed = drivePlayerCar(g, g.inCar, input, dt);
      speed = g.inCar.speed;
      if (crashed) {
        g.health = Math.max(0, g.health - 8);
        g.audio.thud();
        g.shake = 0.5;
        addHeat(g, 1, 'reckless crash');
        if (g.health <= 0) g.busted();
      }
    } else {
      speed = movePlayer(g, input, dt);
    }
    updateTraffic(g, dt);
    updatePedestrians(g, dt, rng);
    updatePolice(g, dt);
    updateMissions(g, dt);
    updateCombat(g, dt);
    g.audio.update(speed, g.wanted, dt);
    // Slow health regen when calm.
    if (g.wanted === 0 && g.health < 100) g.health = Math.min(100, g.health + dt * 1.5);
    g.hud.setCash(g.cash);
    g.hud.setHealth(g.health);
    g.hud.setWanted(g.wanted);
    g.hud.setSpeed(g.inCar ? g.inCar.speed * 3.6 : speed * 3.6);
    g.hud.drawMinimap(g);
  } else if (g.mode === 'menu' && !g.shotMode) {
    // Gentle orbit over the city behind the start menu. In shot mode the
    // staged camera plan owns the frame instead.
    g.camYaw += dt * 0.05;
    g.camera.position.set(Math.sin(g.camYaw) * 180, 90, Math.cos(g.camYaw) * 180);
    g.camera.lookAt(0, 0, 0);
    updateTraffic(g, dt);
  }

  if (g.shotMode) {
    g.shotFrames += 1;
    if (g.shotFrames >= CFG.shotWaitFrames) window.__shotReady = true;
  }
  if (g.mode !== 'menu' || g.shotMode) updateCamera(dt);
  g.renderer.render(g.scene, g.camera);
}

// Shot scenes stage before the loop starts.
if (shotName && SHOT_NAMES.includes(shotName)) {
  const plan = stageShot(g, shotName);
  g.shotPlan = plan;
  // Fixed-camera shots override the follow camera every frame.
  const baseUpdateCamera = updateCamera;
  updateCamera = function fixedOrFollow(dt) {
    if (g.shotPlan && g.shotPlan.mode === 'fixed') {
      g.camera.position.set(g.shotPlan.pos[0], g.shotPlan.pos[1], g.shotPlan.pos[2]);
      g.camera.lookAt(g.shotPlan.look[0], g.shotPlan.look[1], g.shotPlan.look[2]);
      return;
    }
    baseUpdateCamera(dt);
  };
} else {
  g.hud.showMenu('menu-start');
  g.hud.setCash(g.cash);
  g.hud.setHealth(g.health);
  g.hud.setWanted(0);
}

tick();
