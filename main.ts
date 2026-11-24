// Palmera Bay — entrypoint (Node 22, standard library only).
//
// This program hands the game in: it copies the playable static files
// (game/) and the screenshots (screenshots/) from beside this file into
// the output directory, then writes the dossier.json the judge reads,
// built by the vendored make.fun library from exactly those files.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

if (!existsSync(join(repoRoot, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing: the entry has no playable game to hand in.');
}
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

const shotsDir = join(outDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), shotsDir, { recursive: true });
}

// Caps from the scorer's gate: the dossier text is capped, and the other
// limits refuse an entry the scorer would refuse (at most 4 screenshots
// and 256 KiB each; at most 993 files and 48 MiB under game/; no path
// under game/ longer than 1000 bytes). The dossier must match the files
// byte for byte, so it is written last, from the output directory itself.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
