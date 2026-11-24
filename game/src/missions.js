// Palmera Bay — story missions.
// Four jobs from Rosa, the fixer who runs the bay's back rooms. They run
// in order; finishing one starts the next. Each job has a 3D beacon, a
// minimap blip and a HUD objective line, and pays cash on completion.

import * as THREE from 'three';
import { CFG } from './config.js';

export const MISSION_DEFS = [
  {
    id: 'hot-wheels',
    name: 'JOB 1: HOT WHEELS',
    giver: 'Rosa',
    brief: 'Steal the red Comet parked on Coral Ave and deliver it to the marina.',
    payout: CFG.payouts[0],
  },
  {
    id: 'crosstown',
    name: 'JOB 2: CROSSTOWN DASH',
    giver: 'Rosa',
    brief: 'Drive to the beach checkpoint before the timer runs out. 75 seconds.',
    payout: CFG.payouts[1],
  },
  {
    id: 'lose-heat',
    name: 'JOB 3: LOSE THE HEAT',
    giver: 'Marco',
    brief: 'The cops are onto you. Lose the 3-star wanted level to finish the job.',
    payout: CFG.payouts[2],
  },
  {
    id: 'bay-runner',
    name: 'JOB 4: BAY RUNNER',
    giver: 'Rosa',
    brief: 'Pick up the package at the docks, then deliver it to the downtown tower.',
    payout: CFG.payouts[3],
  },
];

function makeBeacon(g) {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.4, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd76a,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  pillar.position.y = 30;
  group.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.28, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd76a }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  group.add(ring);
  const light = new THREE.PointLight(0xffd76a, 30, 40);
  light.position.y = 4;
  group.add(light);
  group.visible = false;
  g.scene.add(group);
  return group;
}

export function initMissions(g) {
  g.missionIndex = 0;
  g.mission = null;
  g.beacon = makeBeacon(g);
  g.beaconTarget = null;
  return g;
}

function setBeacon(g, x, z) {
  g.beacon.visible = true;
  g.beacon.position.set(x, 0, z);
  g.beaconTarget = new THREE.Vector3(x, 0, z);
}

function hideBeacon(g) {
  g.beacon.visible = false;
  g.beaconTarget = null;
}

/** The Comet the first job wants stolen: a red car parked on Coral Ave.
 *  Cached on the game object at boot, because once the player steals it
 *  it is no longer parked and a fresh search would come up empty. */
function jobCar(g) {
  if (g.jobCar) return g.jobCar;
  for (const car of g.cars) {
    if (car.model.name === 'Comet' && car.color === 0xd23b2e) {
      g.jobCar = car;
      return car;
    }
  }
  return null;
}

export function startMission(g, index) {
  const def = MISSION_DEFS[index];
  if (!def) {
    g.completeGame();
    return;
  }
  g.missionIndex = index;
  g.mission = { def, stage: 0, timer: 0, target: null };
  g.hud.setObjective(`${def.name} — ${def.brief}`);
  g.hud.toast(`${def.name} · ${def.giver}: ${def.brief}`, 6);
  if (index === 0) {
    const car = jobCar(g);
    if (car) {
      g.mission.target = car;
      setBeacon(g, car.pos.x, car.pos.z);
    }
  } else if (index === 1) {
    g.mission.timer = 75;
    setBeacon(g, 0, 210);
  } else if (index === 2) {
    g.mission.timer = 0;
    // Raise the heat directly (a police module import here would cycle).
    g.wanted = 3;
    g.heatTimer = CFG.wantedDecaySeconds;
    hideBeacon(g);
  } else if (index === 3) {
    g.mission.stage = 0;
    setBeacon(g, 226, -60);
  }
}

function completeMission(g) {
  const m = g.mission;
  g.cash += m.def.payout;
  g.audio.jingle();
  g.audio.pickup();
  g.hud.toast(`${m.def.name} COMPLETE — +$${m.def.payout}`, 5);
  hideBeacon(g);
  g.mission = null;
  g.saveGame();
  if (g.missionIndex + 1 >= MISSION_DEFS.length) {
    g.completeGame();
  } else {
    setTimeout(() => startMission(g, g.missionIndex + 1), 1200);
  }
}

export function updateMissions(g, dt) {
  const m = g.mission;
  if (!m || g.mode !== 'playing') return;
  const pp = g.inCar ? g.inCar.pos : g.player.pos;
  if (m.def.id === 'hot-wheels') {
    if (m.stage === 0) {
      const car = jobCar(g);
      if (car && g.inCar === car) {
        m.stage = 1;
        setBeacon(g, 226, -60);
        g.hud.setObjective('JOB 1: HOT WHEELS — deliver the Comet to the marina docks.');
        g.hud.toast('Got it. Now take it to the marina — east docks.', 4);
      }
    } else if (pp.distanceTo(new THREE.Vector3(226, 0, -60)) < 9 && g.inCar) {
      completeMission(g);
    }
  } else if (m.def.id === 'crosstown') {
    m.timer -= dt;
    g.hud.setObjective(`JOB 2: CROSSTOWN DASH — reach the beach checkpoint! ${Math.max(0, Math.ceil(m.timer))}s left`);
    if (pp.distanceTo(new THREE.Vector3(0, 0, 210)) < 10) {
      completeMission(g);
    } else if (m.timer <= 0) {
      g.hud.toast('Too slow! The dash is still open — try again.', 4);
      m.timer = 75;
      setBeacon(g, 0, 210);
    }
  } else if (m.def.id === 'lose-heat') {
    g.hud.setObjective(`JOB 3: LOSE THE HEAT — wanted ★${'★'.repeat(g.wanted)}${'☆'.repeat(5 - g.wanted)} — stay clean until it fades.`);
    if (g.wanted === 0) completeMission(g);
  } else if (m.def.id === 'bay-runner') {
    if (m.stage === 0) {
      if (pp.distanceTo(new THREE.Vector3(226, 0, -60)) < 8) {
        m.stage = 1;
        g.audio.pickup();
        setBeacon(g, 0, 0);
        g.hud.setObjective('JOB 4: BAY RUNNER — package collected! Deliver it to the downtown tower.');
        g.hud.toast('Package secured. Downtown tower, go!', 4);
      }
    } else if (pp.distanceTo(new THREE.Vector3(0, 0, 0)) < 9) {
      completeMission(g);
    }
  }
  // Beacon pulse.
  if (g.beacon.visible) {
    const s = 1 + Math.sin(g.time * 3) * 0.12;
    g.beacon.scale.set(s, 1, s);
  }
}
