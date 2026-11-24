# Palmera Bay

An original sun-soaked coastal open-world crime game, built with three.js.
The city, characters, vehicles, story, art and sounds are all our own —
nothing is taken from any commercial game.

You are **Leo Marlow**, a driver fresh off the ferry in Palmera Bay. Rosa,
the fixer who runs the bay's back rooms, has four jobs for you — and the
Palmera Bay police have other plans. Steal cars, outrun the law, finish the
jobs, and own the bay.

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
| --- | ------ |
| W A S D | Move on foot / drive |
| Mouse | Look around (click the game to lock the pointer) |
| Shift | Run |
| E | Enter / steal a car, exit a car |
| F or Click | Punch |
| P | Pause |
| M | Mute sound |

## Features

- Procedural coastal city: street grid, downtown high-rises, beach, ocean,
  marina with docks and boats, palm trees, streetlights, warm late sun
- On-foot third-person controls and arcade car driving (4 car models)
- Traffic AI cruising the avenues and pedestrians strolling the sidewalks
- Stealable parked cars — stealing one earns a wanted star
- Wanted system (1–5 stars): crimes raise the heat, staying clean cools it
  off; police cars chase and ram, and a cop that catches you on foot busts you
- 4 story missions with HUD tracker, 3D golden beacon and minimap blip:
  steal-and-deliver, a timed crosstown dash, losing a 3-star wanted level,
  and a two-stop package run — each pays cash
- Melee combat: punch pedestrians (the law notices) or set off car alarms
- HUD with cash, health, wanted stars, speed and a live 2D minimap
- Synthesised WebAudio sound: engine hum, police siren, pickup blips,
  mission jingle — no audio files
- Save / load via localStorage (cash, job number, position)
- Deterministic screenshot scenes: `?shot=start|play|chase|mission`

## Layout

- `game/index.html` — page shell, import map, HUD and menus
- `game/src/main.js` — bootstrap, input, camera, game loop and modes
- `game/src/config.js` — tuning constants, RNG and palette
- `game/src/world.js` — procedural city, beach, sea and marina
- `game/src/player.js` — on-foot controls and character
- `game/src/vehicles.js` — car meshes and arcade driving
- `game/src/traffic.js` — AI traffic
- `game/src/pedestrians.js` — pedestrians
- `game/src/police.js` — wanted system and police AI
- `game/src/missions.js` — the four story jobs
- `game/src/combat.js` — melee punching
- `game/src/hud.js` — HUD, minimap and menus
- `game/src/audio.js` — synthesised sound
- `game/src/save.js` — save / load
- `game/src/shots.js` — deterministic screenshot scenes
- `game/vendor/three.module.min.js` — three.js r160 (MIT)

## License

MIT — see `LICENSE`.
