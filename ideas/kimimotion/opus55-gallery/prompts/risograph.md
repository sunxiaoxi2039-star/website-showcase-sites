# Risograph Print — Style Prompt

> Animation that looks like it was printed, frame by frame, on a stencil duplicator: two or three translucent spot inks overprinted on warm paper, halftone dots, ink grain, and plates that never quite line up.
> Demo: *Sunday Ride* (40 s) · `risograph.mp4` · source in `demo/`

You are directing a 30–60 second film in the **Risograph Print** style. The user gives you a topic (and maybe a story). You decide everything else — story, shots, timing, sound — and deliver a finished film. Follow this guide.

---

## 1. What this style is

A risograph prints **one colour at a time**. Each colour is a separate stencil ("plate") run through the machine with its own drum of translucent soy ink. That single fact produces the whole look:

- **A tiny palette**: 2–3 spot inks (here Riso Blue `#0078BF`, Yellow `#FFE800`, Fluorescent Pink `#FF48B0`) on warm off-white paper `#F6F1E6`.
- **Overprint mixing**: inks are translucent and multiply. Blue + Yellow = green, Blue + Pink = violet/indigo, Yellow + Pink = orange-red, all three = near-black. Tints (halftone) of one ink over a solid of another give the brightest mixes (60 % Blue dots over solid Pink = purple).
- **Misregistration**: every plate lands a few pixels off. Colour edges show slivers of paper or a coloured halo.
- **Halftone dots** for mid-tones, each plate on its own screen angle (Blue 15°, Yellow 0°, Pink 75°).
- **Imperfect ink**: pinholes of paper in solid areas, faint streaks along the paper-feed direction, blotchy density.
- **Flat graphic shapes, no outlines**: forms are defined by colour fields and silhouettes (Tom Haugomat is the reference), not by line work.

**Never** reference the RISO brand, logo or machine trade dress on screen. Ink names are used only as colour references.

## 2. Story: what fits this style

Pick stories where **the printing process tells the story**. Risograph has six native powers — use at least four:

| Native power | Story use |
|---|---|
| **One plate at a time** | **Plates as narrative**: the world starts in one ink and gains a plate at each turning point (dawn, arrival, falling in love). Design every character and set so the one-ink version is *complete* and each extra plate adds meaning. |
| **Overprint mixing** | Transitions made of ink: a big shape of one colour grows over the frame, turning everything beneath it into the mix colour, then shrinks into the next scene's key shape (in the demo a pink disc swallows the park and becomes the river sun). |
| **Misregistration** | Rhythm and emotion: plates **jump** on musical accents; they **drift apart** in a held silence and **snap back** on the downbeat. Nervousness, dizziness, memory and "breathing" are all registration. |
| **Reflections = separated plates** | Water, glass or heat haze rendered as each plate wobbling on its own phase — the ripple *is* the misregistration. |
| **Halftone and grain** | Every frame is "a new print"; the grain can boil a little, like a flipbook of prints. |
| **It is a sheet of paper** | Scale reveal: pull back to show the film was a print sliding out of the machine onto a stack of earlier prints. |

Adapting any topic: decide what the **first plate** is (the "before" state), what each **added plate** means, and what the **full overprint** moment is. A product launch → monochrome problem, the product arrives as a new ink. A city history → one ink per era. A love story → two people are two inks; where they overlap, a third colour appears.

**Emotional arc for 35–45 s:** quiet one-ink opening (hook within 3 s: show the ink being laid down) → each location adds a plate and an instrument → a small turn → the full-overprint climax with a held silence → a warm resolution → scale reveal of the paper.

## 3. Visual language

**Pipeline (the important part):** draw each frame into **one RGB canvas where R = Blue density, G = Yellow density, B = Pink density** (0 = no ink, 1 = solid). Normal `source-over` painting then gives natural **knockouts** (a later shape covers all three plates); drawing with `globalCompositeOperation = 'lighter'` adds ink to only the channels you set — a true **overprint**. A WebGL2 shader "prints" that canvas:

- per plate: offset (px) + tiny rotation (±0.0005 rad) → misregistration; sample that plate's density
- halftone: cosine spot function on a rotated grid, **period 7 px at 1080p**, threshold with a ±0.07 smoothstep so dots are anti-aliased; densities ≥0.9 print solid
- grain: per-dot noise on the threshold (±0.08); pinholes where noise > 0.93 in solid areas (×0.75)
- ink density `k = 0.80 + 0.14·streak + 0.08·blot` (streak = noise stretched ×10 along the feed direction)
- composite: `paper × Π mix(1, ink_i, coverage_i)`; paper gets a faint fibre noise (±1.5 %)
- dots are anchored to the **paper** (screen), not to the objects: when the camera pans, the image slides under a fixed screen, exactly like printing each frame
- a per-plate **gate** and a **roller sweep** (a moving x edge with a slightly heavier ink band) let a plate "arrive" mid-shot

**Composition rules (learned the hard way):**
- Every area uses **at most two plates, and at most one of them as a tint**. Three halftones on top of each other turn to brown mud.
- Big flat shapes, lots of solid paper and solid ink; halftone for sky gradients (stepped bands of 20 / 38 / 62 / 100 %), shadows and distant layers.
- Characters get a **paper-white knockout halo** (4–5 px): draw them into a transparent layer, stamp the layer 12 times in a ring with `filter: brightness(0)` (= zero ink = paper), then draw it. The plates misregister around it, so the halo gets coloured fringes like a real trap.
- Haugomat framing: one horizon, one huge sun, one small figure. Put the character's head against the flattest colour in the frame (the sun disc works beautifully).
- Skin: **Yellow 26 %** (reads as cream; becomes paper in a one-ink scene). Pink dots on skin look like measles — avoid.
- Every colour on the character should contain some Blue so the one-ink version is a complete silhouette: sweater Blue 40 + Pink 100 (light blue dots → berry purple), trousers Blue 75 + Yellow 100 (→ olive green), hair Blue 100 + Pink 22, shoes Blue 100. A deliberate exception can be a mystery: the scarf is Yellow + Pink only, so it is **blank paper** until the yellow plate arrives and is the first thing to light up.

**Typography is printed too:** titles and subtitles live on one plate (Blue), so they misregister and grain with it. End titles are printed twice on two plates with a 10 px offset — the classic riso double-hit. Fonts: Bricolage Grotesque 800 (titles), Jost 500–700 (captions). Preload every weight (`document.fonts.load`) before `READY`.

## 4. Motion language

- **Character acting on twos** (12 fps pose steps); **camera pans on ones** (24 fps) — stepped camera moves look like judder.
- **Registration is not jittered every frame.** Each shot gets one fixed set of plate offsets (±1–3 px). Plates move only on purpose: an accent **kick** (8–14 px, decays in ~0.25 s with a little ringing) on title hits, plate arrivals and big actions; a **drift** of up to ~25 px during a musical break, and a snap back on the downbeat. Continuous jitter reads as flicker and doubles the bitrate.
- Grain boil is subtle (35 % of the grain re-rolls each print); paper-level streaks and blots change only at cuts.
- Pedalling: crank angle from wheel travel (`crank = distance / wheelRadius / 2.2`), legs by 2-bone IK to the pedals, scarf as a travelling sine wave.
- Pigeons: round chest, tiny steps with a head bob, head tilts for "thinking", a **4-frame flap cycle** (up / half / down / tuck) on twos; flocks mix sizes 1.2–2.4× and stagger take-off by up to 0.35 s.

## 5. Camera language

| Beat | Camera |
|---|---|
| Opening (0–2 s) | Extreme close-up of one object while the first plate is **rolled on** left→right; the action (a bell flick) lands on the first beat |
| Sleepy city | Wide lateral tracking shot: the figure small, the sky big and empty for the title |
| First plate added | Cut to a medium tracking shot as the new ink sweeps across; stage the gag (Tati's no-slowdown hand-off) at the rider's reach height, ahead of him, above the basket so nothing covers it |
| New location | Static wide: let the character cross the frame (Tati) |
| Set-piece | Ground-level low angle with foreground subjects big (pigeons), then the burst fills the sky |
| Reaction | Medium close on character + co-star for a two-beat look |
| Climax | Overprint transition → Haugomat composition, locked off; the only moment the character stops |
| Resolution | Medium side shot, the sun behind him, sharing |
| Ending | Straight top-down with long shadows → pull back to the paper coming out of the machine onto a stack of earlier prints |

## 6. Sound

- **Music**: light **bossa nova**, 120 BPM (1 bar = 2 s, so cuts land on even seconds). **The music is layered like the plates**: one ink = nylon guitar alone; + yellow = shaker, rim clave, soft brushes (and the bicycle bell as percussion); + pink = upright bass and a whistled melody; full overprint = + vibraphone. Pull the instruments out one by one during the final pull-back. A fully silent bar (reverb tails cut) under the climax's drift, full band back on the snap.
- **Foley follows the materials**: the riso machine is the signature sound (paper feed "shhk" + drum "ka-chunk" at every plate arrival; motor and paper rub at the end; a soft paper landing). Metal: bicycle bell (two inharmonic partials ~2.1/3.4 kHz, 5 fast strikes per ring), brake squeal. Bread crust crunch (dense tiny band-passed clicks). Pigeon wings (short band-passed noise bursts), coo (gliding 300–400 Hz tone). Water lapping, distant church bell (it is Sunday) in the silent bar.
- **Voice**: relaxed male narrator (Kokoro `am_adam`, speed 0.95), 5 short lines, each verified with whisper. Music ducks −8 dB under voice.
- Mix loudness −14 LUFS; no film grain added in `mux.sh` (the grain is in the print).

## 7. Subtitles & titles

- Subtitles: a **paper-white knockout strip** (zero ink on all plates, 6 px corner radius) centred 1000 px down, text in **Blue only**, Jost 500 42 px, 0.5 px tracking. Because the strip is defined by the absence of the other plates, its edges pick up coloured misregistration fringes.
- Title card: "SUNDAY RIDE" Bricolage 800 190 px printed on the Blue plate in the sky, revealed by a left→right wipe on the first chord, removed on a beat (prints don't fade — they cut).
- End card: blank paper, title double-hit in Pink + Blue, "RISOGRAPH PRINT", credits, registration crosshairs in the corners, and a tiny rider crossing the baseline while the bell rings.

## 8. Pitfalls we hit

- Three halftoned plates in one area = mud. Keep to the two-plate / one-tint rule.
- Hash noise `fract(p*vec2(233.34,851.73))` produced **vertical stripes** across solids at 1080p. Use a well-mixed hash (the `fract(vec3(p.xyx)*.1031)` family).
- Per-frame registration jitter + per-frame paper streaks made the frame flicker and pushed x264 to 900 MB. Fix: fixed offsets per shot, kicks only on beats, sheet-level noise changes only at cuts, grain boil at 35 %.
- JPEG screenshots (4:2:0) smear the pink/blue dots. Render **PNG frames** into a lossless (qp 0, yuv444) intermediate, then encode once (crf 16 `-tune grain`). Even so a 40 s halftone film is ~280 MB; crf 20 without `-tune grain` is ~120 MB and still clean at 1080p and at 50 %.
- The paper-halo layer must copy the current canvas transform, or zoomed shots draw the character at the wrong scale.
- `over()` (additive) inside a transparent layer loses its meaning; do overprints on the plate canvas.
- Staging a hand-off in 2D: the giver's arm is in the background plane and disappears behind the rider — put the exchange ahead of and above the rider.
- Bridge arches with `evenodd` filled solid; trace the underside with `arc(..., true)` instead.
- A character in stripes + round glasses + lanky reads as a famous picture-book character. Use solid knitwear and a different signature (a chunky scarf).
- The sweater/trouser colours must include Blue, or the one-ink opening shows a floating head.

## 9. Production recipe (this repo)

```
styles/risograph/demo/
  riso.js     WebGL2 print shader (plates, halftone, grain, registration, sweeps, water reflection)
  draw.js     plate-canvas helpers: ink(b,y,p), over() overprint, layer() paper-halo, IK, limbs
  rider.js    rider, bike, pigeon, baguette (all colours as plate densities)
  scenes.js   river, street + bakery      scenes2.js  park, top-down quay, printer, bell ECU
  film.js     timeline (120 BPM), shots, registration kicks/drift, plate gates, subtitles, sound events
  sheet.js    model sheet (?sheet=1)      lines.json  narration
  music/score.py  original bossa nova (numpy)   music/bell.py  bicycle bell
  mix.py      foley + ambience + ducked voice + score → mix.wav
  tools/      video_png.mjs (PNG frames, lossless intermediate), mux.sh (crf16 -tune grain), subs.py
```

1. Design the plates first: what does the one-ink frame look like, what does each plate add? Render the model sheet (`?sheet=1`) with a "plates = story" row (the same character with 1, 2, 3 plates via `S.mask`).
2. `sh styles/risograph/demo/build.sh` rebuilds everything: TTS → whisper → score → events → mix → SRT → render (960 frames, ~2–4 min with 3 workers) → mux.
3. Review: `node core/render/still.mjs styles/risograph/demo --range 0:40:1.5` + `core/render/sheet.py`; check key actions at 0.2 s steps; check the encoded film at 100 % and 50 % for moiré.
