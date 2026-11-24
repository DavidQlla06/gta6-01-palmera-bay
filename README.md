# Palmera Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/DavidQlla06/gta6-01-palmera-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/DavidQlla06/gta6-01-palmera-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An entry for make.fun's [Make GTA 6](https://make.fun/bounty/gta6-01) bounty — $1,666 in USDC.

## The game

Palmera Bay is a sun-drenched coastal open-world crime game, rendered with
three.js. Every street, character, vehicle, story beat, piece of art and
sound was made for this game alone; nothing comes from any commercial title.

You step off the ferry as **Leo Marlow**, a wheelman new to town. Rosa, the
fixer who runs the bay's back rooms, has four jobs lined up for you — and the
Palmera Bay police are not going to make any of them easy. Lift cars, shake
the law, make the deliveries, and take the bay for yourself.

## What is in the world

- A procedural coastal city: a street grid, a downtown of high-rises, a
  beach, the ocean, a marina with boats, palm trees and streetlights under a
  warm late-afternoon sun
- Third-person on-foot movement plus arcade car driving, with four car models
  to find on the streets
- Traffic AI cruising the roads and pedestrians wandering the sidewalks
- Cars you can steal — taking one raises the heat
- A wanted system from 1 to 5 stars: stealing, crashes and hitting
  pedestrians draw the police, patrol cars chase and ram you, and getting
  caught on foot means you are busted; lie low and the heat fades
- Four story missions with a HUD tracker, a 3D beacon and a minimap blip,
  each paying cash when the job is done
- Melee combat with knockback
- A live HUD: cash, health, wanted stars, speed, the current objective and a
  2D minimap that follows the action
- Sound made entirely with synthesised WebAudio — engine hum, sirens, pickup
  blips and a mission jingle — with no audio files at all
- Save and load through localStorage (cash, jobs finished, position)

## How to play

Serve the `game/` folder with any static file server and open `index.html`
in desktop Chrome, for example:

```sh
cd game && python3 -m http.server 8000
```

The game makes no network requests while it runs; everything it needs,
three.js included, is vendored inside `game/`.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move on foot / drive |
| Mouse | Look around (pointer lock) |
| Shift | Run |
| E | Enter / steal a car, exit a car |
| F or Click | Punch |
| P | Pause |
| M | Mute sound |

## Screenshots

- `screenshots/1-start.jpg` — the main menu over the city
- `screenshots/2-play.jpg` — driving through traffic with the HUD up
- `screenshots/3-chase.jpg` — a 3-star police chase
- `screenshots/4-mission.jpg` — the mission beacon at the marina

## Layout

- `game/index.html` — page shell, import map, HUD styles
- `game/src/main.js` — bootstrap, game loop, state machine
- `game/src/config.js` — tuning constants and helpers
- `game/src/world.js` — the procedural city
- `game/src/player.js` — on-foot controls and character
- `game/src/vehicles.js` — car meshes and player driving
- `game/src/traffic.js` — AI traffic
- `game/src/pedestrians.js` — pedestrians
- `game/src/police.js` — wanted system and police AI
- `game/src/missions.js` — story missions
- `game/src/combat.js` — melee combat
- `game/src/hud.js` — HUD, minimap and menus
- `game/src/audio.js` — synthesised sound
- `game/src/save.js` — save / load
- `game/src/shots.js` — deterministic screenshot scenes
- `game/vendor/three.module.min.js` — three.js r160 (MIT)
- `main.ts` — entrypoint: hands the game and screenshots in
- `screenshots/` — the four entry screenshots

## License

MIT — see `LICENSE`.
