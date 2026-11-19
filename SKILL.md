---
name: shabtaz
description: A top-down neon arcade racer PWA — daily-seeded procedural track plus three deterministic ghost rivals, built as a vanilla JS canvas game skill.
---

# شب‌تاز: مسابقه شبانه (ShabTaz: Night Race)

A 2D **top-down** neon arcade racer. Every day a new procedural circuit is generated from that day's date seed, so everyone on the same day races the *same* track against the *same* three AI ghost rivals. The race is 3 laps. Best lap and best total time are persisted per day in `localStorage`, and recent results are kept in a history array.

## What this skill gives the model

After reading this skill, the model understands:

- the genre and core loop of ShabTaz (daily top-down circuit racer)
- the exact mechanics (car physics, AI ghost following the racing line, lap detection, collisions, scoring/timing, records)
- the controls (touch + keyboard + mouse via the same pointer buttons)
- the PWA structure required (manifest, service worker, icon)
- the file layout and how to deploy on GitHub Pages
- how the daily seed makes the race fair and deterministic

## Game design

**Theme.** A nightly neon circuit floating in deep indigo space. The palette is Persian festive-neon: saffron `#ffb62e`, turquoise `#35e0c6`, magenta `#ff5575`, violet `#b69cff` over a deep indigo `#0a0820` ground, with a parallax starfield and two soft nebula glows that drift with the camera. No external images or fonts — everything is drawn with canvas primitives and the UI uses `system-ui, "Segoe UI", Tahoma, sans-serif`.

**Objective.** Complete 3 laps of today's track as fast as possible and finish ahead of the three AI ghosts. Final standing (1st–4th), total race time, best lap, and whether you set a new daily record are reported on the finish screen.

**Player avatar.** A neon saffron rectangle with a darker cockpit, a white front-tip direction marker, a `shadowBlur` glow, and a fading rectangular trail of recent positions. It has a heading, speed, and friction; steering authority scales with speed (you cannot turn while stopped).

**Opponents.** Three AI "ghosts" in turquoise, violet, and magenta. They do not think — they follow the track centerline at a fixed per-car target speed with a small seeded lateral offset. One is slightly faster than the player's top speed, one is similar, one is slower. Their speed and lateral nudge are seeded from the same daily PRNG, so the same day always produces the same competitor behaviour. They never leave the track; the player wins by driving a cleaner/faster line, not by the AI making mistakes.

**Scoring & records.** Race time and per-lap times are tracked. Best lap = the fastest single lap. On finish, best lap and best total time are compared to the persisted daily records (`shabtaz.bestLap.<day>` / `shabtaz.bestTotal.<day>`) and updated if beaten, with a "new record" callout. The result is also prepended to `shabtaz.history` (capped at 20 entries).

**Art direction.** The track is a thick closed-loop polygon strip following a Catmull-Rom-smoothed centerline of seeded waypoints. Inner edge glows cyan, outer edge glows magenta, a dashed faint line marks the racing line, and the start/finish is a checkered strip perpendicular to the track at centerline index 0. A mini-map in the bottom-right shows the whole track, the start marker, AI dots, and the glowing player dot. Camera is **non-rotating** (translates only): simpler, keeps the track orientation readable, and the car sprite rotates within the world. Documented here as a deliberate choice.

## Mechanics in detail

- **Daily seed.** `dayNumber() = Math.floor(Date.now() / 86400000)` (the UTC day number). `generateTrack(seed)` builds a deterministic track from this via a `mulberry32` PRNG. Same day → same seed → same track → same AI variations.
- **Track generation.** 14 control points are placed around a circle (`angle = i/14·2π`) with a multi-frequency radius variation driven by the seeded RNG. A closed Catmull-Rom spline (`18` segments per control point) produces a smooth centerline of 252 points. For each point we store cumulative arc length `s`, unit tangent `(tx,ty)`, and unit normal `(nx,ny)`. Track half-width is `CFG.trackHalf = 74`.
- **Car physics (player).** Each 60Hz step: `accel` adds `CFG.pAccel` to speed; otherwise speed decays by `CFG.pFriction`; `brake` subtracts `CFG.pBrake`. Speed is clamped to `[0, CFG.pMax]`. Steering changes heading by `CFG.pTurn * (0.35 + speedFactor·0.85)` where `speedFactor = speed/pMax`, so turning is impossible when stationary and strongest at speed. Position advances by `(cos θ, sin θ)·speed`.
- **Wall collision.** After moving, the closest centerline index is found (a spiral search ±26 around the last index, keeping progress monotonic). The signed lateral offset `along = (pos−cp)·normal` is computed; if `|along| > trackHalf − carWid/2` the car is pushed back to the edge and speed is cut to ~58% (arcade bounce-slow, no damage). A short shake and a low beep fire.
- **Car-to-car collisions.** Circle-based: if two cars overlap within `0.85·carLen`, they are separated equally along the contact normal and their speeds are blended toward the average. Gentle, no damage.
- **Lap detection (player).** Index-wrap based: when the closest index jumps from the last 28% of the loop to the first 28% (forward crossing), `player.lap++`. On each new lap the elapsed lap time is recorded; best lap updates if faster. When `lap >= 3`, `finishRace()` runs. Backward crossings are ignored.
- **AI movement.** Each AI has a `progress` (distance along centerline). Each step `progress += baseSpeed`; on wrap past `totalLength`, `lap++` and (if `lap >= 3`) the AI is marked finished with its finish time. Position is `center[idx] + normal·lateral`; heading is the centerline tangent.
- **Positions.** All cars are ranked by `lap·totalLength + progress` (descending); the player's `position` is its 1-based rank and is shown live in the HUD.
- **Camera.** Smooth follow: `cam += (player − cam)·0.12`. In the menu, the camera slowly orbits the track bounds so the start screen shows a live preview of today's circuit behind the panel.
- **Timer.** `raceTime` increments by `1000/60` each physics step during play. Lap time = `raceTime − lapStartTime`. Best lap = min of recorded lap times.
- **Records.** On finish: compare `bestLap`/`totalTime` to `shabtaz.bestLap.<day>`/`shabtaz.bestTotal.<day>` (parsed JSON numbers, `null` = no record yet); overwrite if beaten; push `{day, date, position, total, bestLap}` to `shabtaz.history` (capped 20).
- **Wrong-way detection.** If the dot product of the player's heading vector and the centerline tangent at its index is `< −0.25` while moving, a magenta "اشتباه می‌روی!" warning shows.
- **Audio.** Minimal WebAudio: short square-wave beeps on wall hit, car collision, lap completion, countdown GO, and finish fanfare. `M` toggles mute (persisted). No engine drone, no assets.

## Controls

- **Touch:** on-screen buttons — bottom-left `◀ ▶` steer, bottom-right `▲` accelerate / `▼` brake. Landscape preferred; a "rotate device" hint shows in portrait.
- **Keyboard:** `←/→` or `A/D` steer, `↑` or `W` accelerate, `↓` or `S` brake, `P`/`Esc` pause, `M` mute.
- **Mouse:** the same on-screen buttons respond to pointer/mouse hold.

## File layout

- `index.html` — Persian RTL (`lang="fa" dir="rtl"`) shell: 16:9 frame, `<canvas id="game">` at 1600×900, HUD overlay (pause/mute buttons, position chip, time+best-lap chip, lap chip), touch control buttons, `<canvas id="mini">` mini-map, Start/Pause/Finish screen sections, registers `sw.js`.
- `styles.css` — responsive neon styles; `#frame` is `min(100vw, 177.78vh)` with `aspect-ratio:16/9`; all sizes use `clamp()`; HUD/touch/minimap shown only during countdown/playing via `#frame[data-mode=…]` selectors; portrait rotate hint; safe-area insets.
- `main.js` — the whole game: PRNG, track generation, car physics, AI, collisions, lap detection, records, rendering (background/track/start-line/cars/trail), mini-map, HUD text, audio, screens, fixed-timestep loop, keyboard + pointer input. Exposes `window.shabtazTest` for deterministic testing.
- `manifest.json` — PWA manifest, `start_url:"./"`, `scope:"./"`, `orientation:"landscape"`, single SVG icon (`any maskable`).
- `sw.js` — service worker; precaches the 6 shell files on install, serves cache-first with network fallback, falls back to `index.html`.
- `icon.svg` — neon saffron car on a dark circuit with magenta/cyan edges and a checkered start strip.

## How to run / deploy

1. Open `index.html` directly in a browser, OR
2. Push the folder to a GitHub repo and enable Pages — the game runs from the repo root or a subfolder because every path is relative.

The manifest + service worker make it installable on Android/iOS/desktop. After the first load it works offline.

## PWA install

`manifest.json` declares `display:fullscreen`, `orientation:landscape`, the saffron SVG icon, and `start_url:"./"`. `sw.js` precaches `./`, `index.html`, `styles.css`, `main.js`, `manifest.json`, `icon.svg` and serves them cache-first. No runtime network calls.

## Daily-seed determinism

`generateTrack(seed)` uses `mulberry32(seed)` for all randomness (control-point radii). AI variations (per-car speed jitter and lateral nudge) are drawn from `mulberry32(seed ^ 0xA17A5)`. Because `seed = Math.floor(Date.now()/86400000)` is the same for everyone on the same UTC day, the track and the three rivals are identical for all players that day, then change at the next UTC midnight. `window.shabtazTest.generateTrack(seed)` is exposed so a test harness can confirm that two calls with the same seed produce identical centerlines.

## Customization hooks

In `main.js`:

- `CFG.trackHalf` (74) — track width.
- `CFG.laps` (3) — race length.
- `CFG.carLen`, `CFG.carWid` (36, 20) — car footprint.
- `CFG.pMax`, `CFG.pAccel`, `CFG.pBrake`, `CFG.pFriction`, `CFG.pTurn` — player handling.
- `AI_DEFS` — per-rival name, color, base speed, starting lateral offset.
- `PLAYER_LATERAL` (+18) — player's grid slot.
- `COL` — the palette object.
- Track shape: in `generateTrack`, `N` (control points), `baseR`, and the radius-variation amplitudes (300/170/220) and `seg` (spline resolution).
- Lap/wrong-way thresholds: the `0.72/0.28` index-wrap band and the `-0.25` wrong-way dot threshold.
