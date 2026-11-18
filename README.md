# Palmera Bay

An original sun-soaked coastal open-world crime game, built with three.js.
No assets from any commercial game — the city, characters, story, art and
sounds are all our own.

You are **Leo Marlow**, a driver fresh off the ferry in Palmera Bay. Rosa
needs a car, Marco needs a package moved, and the Palmera Bay police need a
reason to chase you. Steal cars, outrun the law, finish four story jobs —
and own the bay.

## How to play

Serve `game/` with any static file server and open `index.html` in desktop
Chrome, e.g.:

```
cd game && python3 -m http.server 8000
```

No network requests at runtime; everything (including three.js) is vendored
under `game/`.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move on foot / drive |
| Mouse | Look around (pointer lock) |
| Shift | Run |
| E | Enter / steal a car, exit a car |
| Click / F | Punch |
| P | Pause |
| M | Mute sound |

## Features

- Procedural coastal city: street grid, downtown high-rises, beach, ocean,
  marina with boats, palm trees, streetlights, warm late-afternoon sun
- On-foot third-person controls and arcade car driving (4 car models)
- Traffic AI cruising the roads and pedestrians wandering the sidewalks
- Wanted system (1–5 stars): stealing, hitting pedestrians and crashing
  raise the heat; police cars chase and ram; hide to cool off — get caught
  on foot and you are busted
- 4 story missions with HUD tracker, 3D beacon and minimap blip:
  steal-and-deliver, timed cross-town drive, losing a 3-star wanted level,
  package delivery — each pays cash
- Melee combat with knockback
- HUD with cash, health, wanted stars, speed and a live 2D minimap
- Synthesised WebAudio sound: engine hum, police siren, pickup blips,
  mission jingle — no audio files
- Save / load via localStorage (cash, jobs completed, position)
- Deterministic screenshot scenes: `?shot=start|play|chase|mission`

## Layout

- `game/index.html` — page shell, import map, HUD styles
- `game/src/main.js` — bootstrap, game loop, state machine
- `game/src/config.js` — tuning constants and shared helpers
- `game/src/world.js` — procedural city
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

## License

MIT — see `LICENSE`.
