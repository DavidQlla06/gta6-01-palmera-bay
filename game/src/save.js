// Palmera Bay — save / load through localStorage.
// Keeps cash, the job number and the player's position, so a run can
// survive a closed tab. A corrupt or missing save just starts fresh.

const SAVE_KEY = 'palmera-bay-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 0,
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      x: typeof data.x === 'number' ? data.x : 0,
      z: typeof data.z === 'number' ? data.z : -150,
    };
  } catch (e) {
    return null;
  }
}

export function writeSave(g) {
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cash: g.cash,
        missionIndex: g.missionIndex,
        x: Math.round(g.player.pos.x),
        z: Math.round(g.player.pos.z),
        savedAt: Date.now(),
      }),
    );
  } catch (e) {
    // Private mode / full storage: the game simply plays unsaved.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // Ignore.
  }
}
