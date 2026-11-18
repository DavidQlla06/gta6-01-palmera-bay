// Palmera Bay — deterministic screenshot scenes for ?shot=.
// One job: stage a fixed, staged scene (start / play / chase / mission)
// from a fresh world so the same URL always renders the same frame.
// No user input is needed: the game runs itself in shot mode.
export const SHOT_NAMES = ['start', 'play', 'chase', 'mission'];

/**
 * Stage a scene on a live game object. Returns the camera plan the main
 * loop follows: { mode: 'fixed'|'follow', pos, look } for fixed cameras.
 */
export function stageShot(name, game) {
  const g = game;
  g.shotMode = true;
  g.shotAutopilot = false;
  if (name === 'start') {
    g.setMode('menu');
    g.hud.showMenu();
    return {
      mode: 'fixed',
      pos: [-70, 46, 150],
      look: [60, 8, -40],
    };
  }
  // All other shots play the real game with the HUD up.
  g.setMode('playing');
  g.hud.hideMenu();
  g.hud.hidePause();
  g.hud.hideBusted();
  g.hud.hideComplete();

  if (name === 'chase') {
    // Player driving up the main avenue, three stars, patrol cars closing
    // in from ahead so they are in frame, lights flashing.
    g.putPlayerInCar(3, -90, 0);
    g.police.setWanted(3);
    g.police.removeAllCops();
    const spots = [[-3, -30], [3, -55], [-3, -70]];
    for (const [x, z] of spots) {
      const cop = g.police.spawnCopNear(3, -90);
      cop.pos.set(x, 0, z);
      cop.angle = Math.PI; // facing the player, driving at them
      cop.syncMesh();
    }
    g.shotAutopilot = true;
    g.hud.toast('WANTED ★★★ — lose the cops!', 10);
    return { mode: 'follow' };
  }
  if (name === 'mission') {
    // Job 1 in progress: stolen car on the sand by the marina, facing the
    // golden drop-off beacon lit ~28 m ahead, HUD objective on screen.
    // No autopilot: the car stays put so the beacon stays in frame.
    g.putPlayerInCar(208, -112, -3.0);
    g.inCar.speed = 0;
    g.missions.start(0);
    g.hud.toast('JOB 1: HOT WHEELS — deliver the car to the marina', 10);
    return { mode: 'follow' };
  }
  // play: cruising the avenue in a stolen Comet, traffic and palms around.
  g.putPlayerInCar(3, -90, 0);
  g.missions.start(0);
  g.shotAutopilot = true;
  return { mode: 'follow' };
}
