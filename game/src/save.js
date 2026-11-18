// Palmera Bay — save / load.
// One job: persist cash, jobs completed and the player's position in
// localStorage, and restore them. Nothing else touches storage.
const SAVE_KEY = 'palmera-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      cash: Math.floor(state.cash),
      missionsCompleted: state.missions ? state.missions.completed.slice() : [false, false, false, false],
      missionIndex: state.missions ? state.missions.index : 0,
      x: state.player.pos.x,
      z: state.player.pos.z,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try { return localStorage.getItem(SAVE_KEY) !== null; } catch (e) { return false; }
}
