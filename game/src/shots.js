// Palmera Bay — deterministic screenshot scenes for ?shot=.
// Each scene stages a fixed, readable frame from a fresh world so the
// same URL always renders the same shot. No user input is needed: the
// game runs itself in shot mode, and main.js raises window.__shotReady
// once enough frames have rendered.

import * as THREE from 'three';

export const SHOT_NAMES = ['start', 'play', 'chase', 'mission'];

/** Stage a scene on the live game. Returns the camera plan the main
 *  loop follows: { mode: 'fixed'|'follow', pos, look } for fixed shots. */
export function stageShot(g, name) {
  g.shotMode = true;
  g.shotAutopilot = false;
  if (name === 'start') {
    g.setMode('menu');
    g.hud.showMenu('menu-start');
    return {
      mode: 'fixed',
      pos: [-80, 52, 170],
      look: [60, 6, -60],
    };
  }
  // Every other shot plays the real game with the HUD up.
  g.setMode('playing');
  g.hud.hideMenus();

  if (name === 'chase') {
    // Player driving up Coral Ave at speed, three stars, patrol cars
    // closing in from ahead so they are in frame, lights flashing.
    g.putPlayerInCar(3, -60, 0);
    g.inCar.speed = 30;
    const { setWanted } = g.policeApi;
    setWanted(g, 3);
    const { removeAllCops, spawnCopNear } = g.policeApi;
    removeAllCops(g);
    const spots = [[-3, -20], [3, -42], [-3, -58]];
    for (const [x, z] of spots) {
      const cop = spawnCopNear(g, x, z, Math.PI);
      cop.speed = 26;
    }
    g.shotAutopilot = true;
    g.hud.setObjective('WANTED ★★★ — lose the cops! Stay clean until the heat fades.');
    g.hud.toast('WANTED ★★★ — lose the cops!', 10);
    return { mode: 'follow' };
  }
  if (name === 'mission') {
    // Job 1 in progress: the stolen red Comet by the marina, facing the
    // golden drop-off beacon ~38 m ahead, HUD objective on screen.
    // Angle 0.9 rad points the car at the beacon (226, -60) from (196, -84).
    g.seatPlayerIn(g.jobCar, 196, -84, 0.9);
    g.inCar.speed = 0;
    g.startMission(0);
    // Job stage 1: the Comet is ours — point the beacon at the marina
    // drop-off so the shot reads as a delivery in progress.
    g.mission.stage = 1;
    g.beacon.position.set(226, 0, -60);
    g.beaconTarget = new THREE.Vector3(226, 0, -60);
    g.beacon.visible = true;
    g.hud.setObjective('JOB 1: HOT WHEELS — deliver the Comet to the marina docks.');
    g.hud.toast('JOB 1: HOT WHEELS — deliver the car to the marina', 10);
    return { mode: 'follow' };
  }
  // play: cruising the avenue in a stolen Comet, traffic and palms around.
  g.putPlayerInCar(3, -100, 0);
  g.inCar.speed = 22;
  g.startMission(0);
  g.shotAutopilot = true;
  return { mode: 'follow' };
}
