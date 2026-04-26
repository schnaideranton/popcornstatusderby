# Popcorn Status Derby

Single-file browser car-bash arena. Drive a parametric car around 8 ramps,
shoot at AI cars to climb the status ladder; getting hit drops you down.
The shoot button plays the Popcorn melody (Gershon Kingsley / Hot Butter,
1972) one note per shot, in tempo. Engine runs the bass line.

**[Play it →](https://schnaideranton.github.io/popcornstatusderby/)**

## Controls

| Key | Action |
|---|---|
| `W` / `↑` | Gas |
| `S` / `↓` | Brake / reverse |
| `A` / `D` | Steer |
| `Space` | Handbrake |
| `Q` | Shoot |
| `E` | Jump |
| `V` | Cycle camera (chase / side-L / side-R / front) |
| `M` | Mute |
| `R` | Manual respawn (costs −5 levels) |

## How status works

Every car carries an integer level. The leader's badge is yellow, everyone
else is white. Hitting another car: shooter `+1`, victim `-1`. A victim at
level 1 cannot drop further — the next hit teleports it to a random spot
so it can't be farmed in a corner. Hitting the player gets you no bonus
unless you actually score.

Visual archetype steps with level (capped at tier 4 visually):

| Level | Archetype | Wheels | Headlights |
|---|---|---|---|
| 1 | jalopy | small | round |
| 2 | hatch | smaller | box / round |
| 3 | sedan | normal | box / wide |
| 4 | SUV | bigger | split / wide |
| 5+ | super-luxe | biggest | double (split) |

## Sound

The Popcorn MIDI was sliced and routed across game events:

- Channel 0 (240-note melody) → **shoot** — fires at the song's tempo, so
  holding `Q` plays the riff at 147 BPM. Sixteenth-note flurries make the
  fire rate speed up.
- Channel 1 (24-note bass ostinato) → **engine** — loops continuously,
  loudness scales with car speed.
- Hits / respawns / mutations → derived stabs in the same key (B-minor).
- AI shots are silent so the melody stays clean.

## Stack

- [Three.js](https://threejs.org) r128 — rendering
- [cannon-es](https://pmndrs.github.io/cannon-es/) 0.20 — vehicle physics
  (RaycastVehicle), bundled locally as `cannon-es.js`
- Web Audio API — synth (no sample files)
- One file: `index.html`

## Run locally

Just open `index.html` in a modern browser. ES modules require an `http://`
origin, so use any static server:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## Credits

- *Popcorn* — Gershon Kingsley (1969), arrangement by Hot Butter (1972)
- Built with [Claude Code](https://claude.com/claude-code)
