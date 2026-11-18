# SOLARA BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/pyx378952739/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/pyx378952739/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world city game — explore a sun-soaked coastal city on foot and by car, steal cars, outrun the police, run jobs and build your reputation. Fully offline: no build step, no network requests, all art and sound generated in code. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

## Run it

```sh
node serve.ts
```

Then open the local address it prints.

## Controls

- **WASD / arrows** — walk, or drive (W gas, S brake/reverse, A/D steer)
- **Shift** — run
- **Space** — handbrake while driving
- **E** — get in / out of a car
- **Mouse** — aim; **click** — fire the pistol, or punch when unarmed
- **F** — punch
- **T** — take the next job
- **P / Esc** — pause
- **M** — mute

## The game

- A seeded city with four districts — Marina, Downtown, Old Town, Beachfront — the same seed always builds the same city.
- Four kinds of car (sedan, taxi, van, sports car), traffic that follows the roads, pedestrians who flee from trouble.
- A 1–5 star wanted level: stealing cars, hurting people and hitting police cars raise it; police cars and officers chase you, and getting caught while slow means Busted.
- Three main jobs in a chain (Marina Delivery, Getaway Driver, Yacht Club Pickup) plus repeatable cab fares and courier runs, with a navigation marker, a timer and cash and reputation rewards.
- HUD with cash, health, wanted stars, speed, job objective and clock, plus a minimap. Best cash and progress are saved in the browser.

## Screenshot scenes

`shots.json` lists the four staged scenes, each a fixed seed so the frame repeats:

| Shot | Scene |
| --- | --- |
| `?shot=chase&seed=7` | A 3-star police chase in a sports car |
| `?shot=start&seed=7` | The title screen |
| `?shot=foot&seed=7` | Walking downtown among pedestrians and traffic |
| `?shot=mission&seed=7` | The moment a job completes |

## Files

- `game/index.html` — the page and canvas
- `game/src/config.js` — all tuning numbers and colours
- `game/src/random.js` — the seeded random generator
- `game/src/input.js` — keyboard and mouse input
- `game/src/world.js` — the city, driving, police, combat, missions: rules only, no drawing
- `game/src/render.js` — all drawing: city, cars, people, HUD, minimap, screens
- `game/src/audio.js` — synthesised WebAudio sound effects
- `game/src/shots.js` — the staged `?shot=` scenes
- `game/src/main.js` — boot and the fixed-step main loop
- `main.ts` — builds the submission dossier from `game/` and `screenshots/`
- `serve.ts` — a tiny local static server for development

---

<sub>Entered on [make.fun](https://make.fun/?ref=k6qvr7pj&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
