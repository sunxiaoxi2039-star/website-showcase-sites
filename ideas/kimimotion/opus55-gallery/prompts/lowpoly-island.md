# Low-poly Isometric Island — Style Prompt

> A tiny faceted world seen through an orthographic isometric lens: everything is a geometric block, and everything that appears arrives with a bounce and a note.
> Demo: *The Island That Grew* (53 s) · `lowpoly-island.mp4` · source in `demo/`

You are directing a 30–60 second film in the **Low-poly Isometric Island** style. The user gives you a topic. You decide everything else — story, shots, timing, music, sound — and deliver a finished film. Follow this guide.

---

## 1. What this style is

A miniature world built from **flat-shaded low-poly geometry** (hexagonal tile columns, box houses with gable roofs, cone pines, icosahedron trees) floating in a faceted sea, watched by an **orthographic camera** at an isometric angle. There is no perspective and no horizon: far water dissolves into a **screen-space sky gradient**, so the world looks like a model suspended in colour. Light, not texture, tells time — every facet changes colour as the sun moves, and at night the only colour left is warm windows and a lighthouse beam.

Learned from: *Townscaper* (building is the performance; every piece lands with a springy bounce and sound; houses sprout cute details by themselves) and *Monument Valley* (isometric geometry, soft pastel palettes, gradient skies, calm pacing, lots of empty space). Do **not** copy their grids, buildings, characters, UI or typography. Never name them on screen.

## 2. Story: what fits this style

Pick stories where **the medium does the storytelling**. The style has five native powers — use at least three:

| Native power | Story use |
|---|---|
| **Procedural growth** — tiles rise from the sea, floors stack with an elastic landing, trees pop | The plot is something growing. Each growth event = one sound = one musical note. |
| **The orthographic gaze** — no vanishing point, the world reads as a table-top model | Scale reveals by pure zoom: start with one object filling the frame, end with the whole world as a speck. |
| **Turntable rotation** | A continuous rotating shot shows the thing being built from every side. |
| **Flat shading × light direction** | Day/night cycles and time-lapses without any texture work: shadows sweep, facets re-colour. |
| **Emissive blocks in the dark** | Lights coming on one by one; a beam sweeping over the world like a clock hand or a music-box comb. |

**Signature move (from the demo): "building is composing."** Every growth event is exported from the page with a MIDI note; the score's melody voice is synthesized directly from those events, so the picture literally writes the tune. Pay it off: in the demo a lighthouse beam turns once every 12 beats and passes one ring cell per beat; the eight houses standing on those cells light up and chime as it passes, so the notes that were laid down in a shuffled build order are replayed in **spatial order** as the complete theme. Any topic can use this: a city skyline whose floors are notes, a garden whose flowers are a chord, a product assembled part by part.

Adapting any topic: turn it into **a small world that grows, lives through a day, and meets one problem that the final piece solves**. Keep it to one subject (an island, a town, a garden), one goal (to be complete / to become a home), one turn (night falls, something is missing / someone is lost).

**Emotional arc for 45–55 s:** emptiness → first note → accelerating joy of building → a lived-in day → dusk warmth → silent night with one thing missing → the final piece ignites (climax) → pull back to scale, with an echo of the opening.

## 3. Visual language

- **Camera**: `THREE.OrthographicCamera`, azimuth 45° by default, elevation **30°** (build), **33–35°** (day detail), **20–25°** (night — a lower angle widens the sky band so stars show), **50°** (a top-down-ish view when something sweeps across the world). Frustum height is the "zoom": 5–7 units for close-ups, 12–16 for the whole island, up to 420 for the final scale reveal. Place the camera far enough away (distance ≥ 3 × frustum height) or the bottom of the frame looks under the sea.
- **Geometry** (world unit = one hex tile's circumradius): pointy-top hexagonal columns (`CylinderGeometry(r, r, h, 6)`), axial → world `x = √3(q + r/2)`, `z = 1.5 r`. The second ring around a centre cell has 12 cells at exactly 30° steps, which is handy for rotating/beat-synced ideas. Heights: sand 0.36–0.42, grass 0.74–0.9, hills 1.1–1.4, rock peak 1.95. A separate 0.16-thick top cap (grass/sand) sits over a darker side colour; **sink the side column's top 0.1 below the cap** or you get z-fighting. Leave a 1.5 % gap between tiles so AO draws seams.
- **Props**: box houses 0.92 wide, 0.62 per floor, gable roof prism (overhang 0.08) with wall-coloured gable ends; windows are small quads with their own emissive material per house; cone pines (6 sides), icosahedron (detail 0) broadleaf trees, 3-sided-cone palm fronds; windmill (6-sided tapered tower, 4 blades); dock planks on posts; a boat from a pinched box hull + triangle sail; lighthouse = 4 tapered 8-sided rings alternating white/red + dark gallery + emissive glass + red cone cap.
- **Materials**: `MeshStandardMaterial({ flatShading: true, roughness: .88 })`, no textures at all. Jitter each tile's lightness ±4 % so the ground isn't a spreadsheet.
- **Palette (sRGB)**: sand top `#f3dfab` / side `#e2c68e`; grass `#93c96c`, `#7fbd62`; earth side `#c99c6e`; rock `#b4b8bd` / `#8f949c`; walls `#fbf3e6 #f5c2b0 #b5dccb #a9cbe8 #f7df8f #e9c9e6`; roofs `#d9644a #4f7fb8 #e0874f #6a5a8e #3f8f86`; pines `#3f8a5a #4f9c63`; leaves `#7fc36a #9ad06f`; warm windows `#ffc676`; lighthouse `#f6f2ea` / `#d9544a`.
- **Sea**: a 220×220 plane with 200×200 segments, non-indexed, vertex-displaced by four summed sines (amplitude ≈ 0.2) in `onBeforeCompile`, `flatShading` so each triangle glints on its own (roughness 0.55 — lower and the facets flash white). A coarse 5000-unit plane 0.55 below covers the zoom-out. **Shallow lagoon**: a 512² canvas redrawn every frame with soft blobs where tiles have risen, sampled by the water shader to mix deep → shallow colour and a faint foam rim — the lagoon grows with the island. A narrow white hex ring (0.99–1.12 r, opacity ≈ 0.32) at each tile's water line = surf.
- **Sky without a horizon**: in post, linearise the orthographic depth and blend distant pixels into a vertical screen gradient (horizon colour → zenith colour). Haze start/end are set as fractions of the frustum height × cot(elevation), so the "horizon band" stays in the top third at any zoom. Stars (hash grid, twinkle) appear only where haze is thick.
- **Day/night keyframes** (zenith / horizon / deep sea / shallow / sun colour & intensity / sun elevation & azimuth): dawn `#9fb6cf / #f3d2c4 / #4f8ea3 / #8fc9c4`; day `#88c8e8 / #eaf5f2 / #38a5bc / #86e2d4` sun 2.7; dusk `#6f6fa8 / #ffa888 / #5a6a9e / #b08aa6` sun `#ff9a68` elevation 8°; night `#12163a / #4a4478 / #23264a / #363a66`, moon `#a9b0e8` 0.9. Night sea is desaturated blue-violet, darker near the camera and brightening toward the sky band, so warm windows and the beam are the only bright things.
- **Post** (`demo/post.js`): scene with MSAA + depth → GTAO (radius 0.7, scale 1.5; mandatory, it draws the seams between tiles and under roofs) → sky/haze composite → very light tilt-shift (max radius 3 px at the frame edges, a miniature feel) → bloom (threshold 0.95, strength 0.22 day / 0.5 night) → pastel grade (sat 1.04–1.1, soft contrast, small blue lift at night) → NeutralToneMapping. Supersample 2× (render 3840×2160).
- **Lighthouse beam**: a camera-facing ribbon (its plane contains the beam axis and turns toward the camera each frame), Gaussian across its width, bright at the root and fading with distance, plus a 2.4× wider, 0.32-strength halo copy for volume; tilted 7° down so it meets the sea far away. The water under it is lit in the sea shader: an angular band around the beam direction plus per-facet sparkles.

## 4. Motion language

- Everything moves on ones (24 fps), smooth. The charm is in the **arrival curves**, not in stepping.
- **Rise from the sea** (tiles): 0.5 s cubic ease up from below the water, then `sin(13 s)·e^(−7 s)·0.18` overshoot; a hex splash ring and 14 spray droplets burst the moment it breaks the surface (0.12 s before it settles). The event time is the moment it settles.
- **Drop and stack** (floors, roofs, lighthouse rings): fall 2.4 units in 0.22 s (ease-in), land, bounce `|sin(15 s)|·e^(−9 s)·0.22`, squash-and-stretch `1 − 0.16·e^(−12 s)·cos(26 s)` on Y with volume preserved.
- **Pop** (trees, lamps, chimneys, flowers): scale `1 − e^(−9 s)·cos(17 s)` — about 25 % overshoot.
- **Life**: windmill spins up on the "island complete" chord; chimney smoke puffs; three gulls circle; the boat bobs and rolls with the same wave function as the sea (evaluated on the CPU).
- **Schedule growth on the music grid**: one piece per 16th-note slot at most, so every event has its own note; tiles on halves → quarters → eighths (accelerando by density, not tempo).

## 5. Camera language

| Beat | Camera | Why |
|---|---|---|
| Opening | Close ortho (frustum 7.5) on one lonely object, empty faceted sea, sky band at the top | Give the viewer nothing to look at; the first tile then becomes an event |
| Growth | Turntable (azimuth +45° over ~5 s) with a slow zoom-out, **intercut** on beats with close-ups: a peak rising with a splash (elevation 23°, frustum 5.2), floors stacking (26°, 6), dock planks and the boat drop (27°, 6.6) | Wide shots show the shape growing; close-ups sell the bounce and the splash |
| Day | Medium on the village, sun sweeping 100° in 2.5 s (time-lapse shadows) | Light is the time machine |
| Departure | Side angle computed from the dock direction, camera trails the boat | The boat must move across the frame, not toward the lens |
| Dusk | Fixed 3/4 wide, slow push, windows light one per eighth note | Let the lights be the only motion |
| Night | Very wide, elevation 21°, island lower left, one tiny light far out in the dark | Negative space = danger |
| Climax | High angle (50°) turning at 0.22× the beam speed, then easing down to 25° so the starry sky "rises" | You must see the beam sweep over every house; then the sky opens up |
| Ending | Pure orthographic zoom ×25; an echo object far away in the lower right | Scale reveal and echo |

## 6. Sound

- **Music is event-driven**: page `EV` entries carry `note`; the score script synthesizes every one at its exact time (rise → marimba, pop → kalimba, floor → woodblock, roof → kalimba+marimba = the melody, window → soft kalimba, ring → rising marimba, beamhit → kalimba lead + marimba octave + bell shimmer). Underneath: ambient pad, a gentle marimba ostinato and shaker/soft kick only in the day and climax sections. 96 BPM, D major pentatonic feel. **No piano, no strings.**
- **One note as a motif**: a buoy bell on D5 opens the film ("the only note the sea knows") and a distant bell plays the same note at the end.
- **Silence**: the night section drops to a low pad drone, waves and crickets; the music bus is digital zero for the last half-beat before the climax downbeat.
- **Foley follows material** (all synthesized in `demo/mix.py`): underwater bubble sweep + splash with droplet ticks for rising tiles (bigger = lower); wooden knock + a quieter second knock 0.21 s later (the bounce) for floors; ceramic clack for roofs; hollow plank knock for the dock; heavy stone thunk for lighthouse rings; glass tink for the lamp room; low "whump" + faint electric hum on ignition. Beds: low-passed brown-noise waves with slow swell and random laps, gulls by day (downward-gliding FM chirps), windmill creak, crickets from dusk.
- **Voice**: Kokoro `af_sky` (clear, gentle female), speed 0.86–0.92, 4–6 short lines. Avoid homophones that whisper (and listeners) confuse — "sea" was heard as "C" in a film about notes, so we said "ocean".
- Mix: voice compressed and ~10 dB over the music; music ducked −8 dB under the voice; loudness −14 LUFS; **grain 0** (flat colour shimmers with grain).

## 7. Subtitles & titles

- **Subtitles**: no box — Quicksand 600, 44 px, warm white `#fffdf8` with a soft navy drop shadow (blur 14), centred 118 px above the bottom; to the left, a tiny flat-shaded hex tile icon (top + two side faces) whose top colour follows the time of day (dawn pink, day grass, dusk orange, night window-yellow). Shown from 0.05 s before the line, at least 1.8 s and never shorter than the line + 0.6 s, never overlapping the next line or the title.
- **Title**: Josefin Sans 600, all caps, 78 px, 16 px tracking; letters rise one by one (55 ms apart) from under a thin "water line", overshoot and settle like tiles; a 300-weight lowercase sub-line ("a low-poly island film").
- **End card**: the night scale-reveal frame, darkened; same title block (static), hex icon, `LOW-POLY ISLAND · LEMO-OPUSCAR`, `LemoLab × Claude Opus 5.5`, credits. Lay it out so the tiny lit island stays visible in a gap between the text blocks.

## 8. Pitfalls we hit

- `core/three/post.js` uses `perspectiveDepthToViewZ` — wrong for an orthographic camera. Use `orthographicDepthToViewZ`.
- **GTAO draws sprites as solid quads** (it renders the scene with an override material): an invisible glow sprite became a black parallelogram floating on the sea. Hide every sprite/transparent object during the AO pass, and set `visible = false` on zero-opacity sprites.
- Tile side column and top cap sharing the same top plane → pixelated z-fighting patches. Sink the column.
- A double-sided additive cone for the beam reads as two parallel white lines. Use a camera-facing ribbon with a Gaussian profile plus a wide halo.
- An orthographic camera placed too close: at large zoom-outs the rays from the bottom of the frame start below the sea and show sky. Keep camera distance ≥ 3 × frustum height.
- Shadows on the sea at low sun made a long dark stain; the sea doesn't receive shadows.
- A low sun behind the camera's target turns the faceted sea into a pale sand-coloured glare; keep the sun sideways to the camera in key shots.
- The boat was 21 units out — off-screen when the beam found it. Derive the boat's position from the beam's angular speed so the beam finds it on a chosen beat (we used a rest in the melody, so the boat's answering bell fills the gap).
- `half` is a reserved word in GLSL.
- Do all growth scheduling on a 16th grid with one piece per slot; two pieces landing in the same slot muddied the melody.

## 9. Production recipe (this repo)

```
styles/lowpoly-island/demo/
  story.js   timeline (96 BPM grid), VO, chords, day/night keyframes, shots
  world.js   hex layout, all props, growth schedule → EV (with notes), per-frame animation
  sea.js     faceted wave shader, shallow-lagoon map, beam-lit water
  post.js    ortho post: GTAO → sky/haze + stars → tilt-shift → bloom → grade
  main.js    renderer, lights, cameras per shot, HUD (title, subtitles, end card), EV export
  music/score.py   event-driven score (+ check.py: librosa onset/pitch check vs events)
  mix.py     foley + ambience + voice + ducking     subs.py  subtitle cues
  build.sh   one-command rebuild
```

1. `node core/render/still.mjs styles/lowpoly-island/demo --range 0.5:52.5:1` + `core/render/sheet.py` — overview sheets, iterate.
2. `core/tts/tts.py lines.json voices` → `core/tts/asr_check.py` until all OK.
3. `node core/render/events.mjs styles/lowpoly-island/demo` → `music/score.py` → `music/check.py` → `mix.py`.
4. `node core/render/video.mjs styles/lowpoly-island/demo --fps 24 --workers 3` (1272 frames, 2× SSAA + GTAO).
5. `sh core/render/mux.sh out/video24.mp4 mix.wav lowpoly-island.mp4 24 0`. Or just `sh demo/build.sh`.
