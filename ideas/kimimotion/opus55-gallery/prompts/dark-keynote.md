# Dark Tech Keynote — Style Prompt

> A software launch film where the interface itself is the star: near-black gradient, hairline grid, soft light, one brand accent, and UI that moves with snap-grid precision. The product is revealed by a sweeping light, its promise is one giant number, and the sound design literally "tidies" itself.
> Demo: *Room to Think* (42 s) · `dark-keynote.mp4` · source in `demo/` · a launch film for **Tidy**, a fictional app that sorts your desktop, photos and inbox in one press.
> **References (grammar only):** Apple product-reveal films (the first Apple Watch and AirPods reveals) for black stage, light-sweep reveals, one line per screen and the lone giant number; Linear / Stripe / Vercel launch videos for exact snap-grid UI motion, 1 px lines, soft glows and a single accent colour; Steve Reich's *Piano Phase* and *Music for 18 Musicians* for the score's phasing and subtractive process; Edgar Wright's insert cuts for the half-second overload montage. Never use their names, interfaces, fonts, system controls, melodies or logos.

You are directing a 30–45 second launch film in the **Dark Tech Keynote** style. The user gives you a topic (a product, a feature, a release). You decide everything else (story, shots, sound, music, captions) and deliver a finished film. Follow this guide.

---

## 1. What this style is

A keynote-grade product film for **software**. There is no physical product and no glass render: the protagonist is the interface — a cursor, windows, notifications, tiles, a number. It lives on a dark stage (`#0A0B0F → #151822`) lit by soft, cool light, with one brand accent reserved for the single most important element.

The style is defined by **precision**. Every element snaps to a grid, every motion lands on a beat, every sound belongs to one designed family. The drama comes from contrast: a problem shown as out-of-control UI noise, then one action that puts every pixel back in its place, then a breath of empty space.

## 2. Story: what fits this style

| Native power | Story use |
|---|---|
| **UI can be generated without limit** | Show a problem as accumulation: notifications, files, tabs and photos spawning faster and faster, hundreds of them. You don't draw the mess, you *generate* it. |
| **The snap grid** | The whole product promise can be one motion: everything flies into a grid in one beat. Keep the grid invisible until that moment. |
| **The cursor is the only thing alive on a screen** | Make the cursor the protagonist. It blinks on the beat, gets shoved by interruptions, hesitates, winds up and presses. Make it the brand mark too, so the reveal pays off twice. |
| **Screens can pause** | Freeze everything mid-air and cut the sound to digital silence. Only a screen can stop time like this. |
| **Dark stage + soft light** | Reveal the product by sweeping a band of light across it: only the pixels the light has passed turn on. |
| **Numbers roll out of glyph noise** | The one stat gets its own screen and scrambles into place digit by digit, one digit per sixteenth note. |

**Story shape (proven in the demo):** calm hook (a cursor types the title in silence) → interruption (first notification at 3 s) → accumulation in one continuous pull-back (each bar adds a layer) → overload inserts → **freeze + silence** → **the one action** (all layers realign into one chord) → light reveal of the product → the big number → a breath where the UI puts itself away and the music subtracts itself → echo (the cursor finishes the sentence it started).

**The core directing idea — sound and picture share one timeline.** In the demo every UI element spawns *on a note* of the score. Two marimbas play the same 12-note pattern; the second slowly speeds up and drifts out of phase. Files and photos appear on the on-grid line, notifications on the drifting line, so the visual chaos *is* the audible phasing. At the press both lines realign into one chord. Adapting any topic: write the note table first (`timeline.js`), then let the picture read it.

Adapting any topic: pick the one verb your product does (sort, sync, ship, search, protect). Show its absence as generated UI noise tied to a phasing or accumulating score. Give the cursor (or the product's smallest living element) the action. Reveal with light. One number. Put everything away. End on the smallest thing on an empty screen.

## 3. Visual language

**Stage**: base `#0A0B0F`, radial lift to `#151822` at the upper centre, one large cool glow `#3B4CCA` at 8 % in the upper right, vignette 50–55 % at the corners. Hairline grid `rgba(255,255,255,.032)` every 48 px with every 4th line at `.06`. Grain: none (`mux.sh` grain 0).

**Palette**
| Role | Value |
|---|---|
| Window surface / raised / raised-2 | `#12151C` / `#1A1E28` / `#222734` |
| Border / inner top highlight | `rgba(255,255,255,.08)` / `rgba(255,255,255,.07)` (1 px) |
| Text / secondary / label | `#E8EAF0` / `#8A90A0` / `#5C6272` |
| **Brand accent (the one colour)** | lime `#B7F34A`, glow `rgba(183,243,74,.35)` — the cursor, the "Tidy up" pill, the checkmarks, "0.8" |
| Noise red (problem section only) | `#FF5A5F` badges. After the press, no red ever appears again: red is noise, the accent is the product |
| Three flow colours (collapse trails) | files `#C9D3E6`, photos `#F2A65A`, notifications `#7E95FF` |

**UI kit (all original, drawn in code)**: windows (radius 14, 40 px title bar with only a small app glyph and a title, never traffic-light buttons, menu bars or docks), notification cards (radius ≈ 24 % of height, icon squircle, two lines, "now"), folded-corner file icons with a coloured extension band and mono filenames (`final_FINAL_2.pdf`, `Untitled 38.txt`), procedural landscape photo thumbnails, inbox rows with unread dots, a tab strip that keeps splitting, red count badges, a storage bar, uniform snap tiles (60–64 px, radius 20 %).

**Type (OFL)**: Inter (UI, captions, headlines; variable weight), Inter Tight 600 for the giant number (tracking −4.5 %), JetBrains Mono for labels, filenames and status text (tracking up to 5 px in small caps labels).

**Depth**: a 2.5D camera (`s = 1/(1/zoom − z)`) gives true parallax. Cards near the lens are blurred proportionally to their magnification. Product shots use strip-rendered perspective (rotY up to 24°).

## 4. Motion language

- **Everything lands on the grid and on the beat.** Moves start a beat early and land on it. Easing is fast-out with one small overshoot (`back`, s ≈ 1.3) and an immediate settle. No floaty sine drift.
- **Spawn motions** (mess section): files drop 34 px with a 6 px bounce (0.22 s), photos fling in from off-screen with rotation (0.3 s), notifications slide 90 px from the right (0.24 s), windows pop 0.94 → 1.0 (0.22 s). Everything trembles ±2.4 px in the last second before the freeze.
- **The collapse (signature move)**: a ring expands from the cursor at 2600 px/s. As the ring front passes, each element launches **towards its own type's row** (files → Desktop rows, photos → Photos rows, notifications → Inbox rows) along a curved path; each type bends the same way, so the screen shows **three coloured streams**. Within a group, rows are filled by the elements' y order and x order, so paths don't cross. Flights last 0.26–0.40 s depending on distance, morph into uniform tiles in the first third, overshoot along their final tangent and settle. Light trails in the stream colour, 9 segments, additive. Grid slot outlines light up in the accent just behind the ring front.
- **Cursor acting**: blink = 0.5 s on / 0.5 s off (it is the metronome). Interrupted: 8 px shove + 10 % squash, 0.25 s decaying wobble, then it stays solid ("frozen"). Wind-up: height ×1.35, width ×0.8, ease-in over 12 frames (≥ 8). Press: 2 frames at height ×0.3, width ×2.4. Follow-through: spring back with overshoot over 0.6 s.
- **Light reveal**: the lit area trails the front by 700 px, a 360 px soft glint rides the front at 20 %, unlit areas stay at 7 %. It takes 1.3 s. Don't leave the product's main content in the dark for longer than that.
- **Number scramble**: glyphs cycle at 24 fps with a 3-copy vertical smear; digits lock right to left on sixteenth notes, each drops in with a small damped bounce.
- **Put-away**: one element retracts per beat (sidebar, status bar, title bar, headers), then the window rim lights in the accent, then the window collapses vertically like a CRT switching off (ease-in, 0.22 s) and shrinks into the cursor.

## 5. Camera language

| Beat | Camera |
|---|---|
| Hook | Locked extreme close-up of the cursor and one line of text (text ~150 px). Barely perceptible push (×1.04). |
| Accumulation | **One continuous pull-back** from ×5 to ×1 over 4 bars, keyed per bar in log space with monotone interpolation (one "notch" per bar, continuous velocity). Foreground cards pass the lens blurred. From 10.5 s a 1–2° dutch angle and a handheld wobble build. |
| Overload | Three half-second **inserts**, each expanding out of its source position (UI expand transition): 999+ badge / 148 thin tabs / red storage bar. |
| Freeze | Silent push-in through the frozen mess onto the cursor (×0.8 → ×2.6, ease-in-out). |
| Press | **Whip pull-out** in one beat (×2.6 → ×0.78, cubic ease-out) so the audience sees both the press point and the whole grid landing. |
| Reveal | The window turns in from a 3/4 angle (−24° → 0°) over 4.5 s while light sweeps across. The camera barely moves: only light and product move. |
| Number | Dive into the status bar counter (log-zoom to ×16), then match cut to the full-screen number. Back out the same way. |
| Breath | Slow push (×1.08) while the UI puts itself away. |
| Echo | The exact framing of the first shot. The cursor sits in the same pixel. |

**Unified transition grammar = UI expand / collapse**: every shot change is an interface element expanding into the frame or the frame collapsing into an element. No fades, no blank frames.

## 6. Sound

- **Music first**: `timeline.js` holds the tempo grid (120 BPM), the 12-note pattern and the note tables of all voices (phasing is computed there as a time warp). The picture spawns elements from the same tables. `tools/cuecheck.py` checks the key cues and that every spawned element sits on a score note.
- **Score (original, minimalist)**: marimba (voice 1, on grid) + hard-mallet vibraphone (voice 2, unison, then phasing ahead; slightly detuned and brighter at the peak) + glockenspiel (voice 3, drifting the other way) + a numpy pad (A drone that gains G#/D# dissonance and rises) + a low sine pulse (eighths → sixteenths) + a quiet noise shaker. At the press all voices land on **one A major 9 chord**, the bowed vibraphone carries it into the reveal (L-cut), then one clean pattern plays, and in the breath the pattern subtracts notes bar by bar until one quarter note is left. Samples: VCSL (CC0).
- **Sound palette = story**: the mess sounds are *scattered* (every notification pitched ±45 cents off, random pans, a different timbre per source). Tidy's sounds are *one family*: felt ticks and glass taps, all in A major pentatonic, centred. The 264 landing taps form one in-key shimmer.
- **Layers**: ambience (quiet room + computer fan and a 6.8 kHz coil whine that grow through the mess, **held back until the last voice-over line ends**), foley (cursor tick, low-profile keys, return, notification glass, file plop, photo flick, window whoosh, glitch accents, storage buzz, stacking thumps, the press "doom" = felt mallet + 55→40 Hz sine drop, grid tick, felt ticks, light-sweep shimmer, digit grains, CRT-off), music.
- **Real silences**: 15.0–16.0 s is **digital zero on every track** (the screen paused). The first sound after it is the most important one: the press. 33.0–34.0 s is near-silence (−60 dB room). The first sound after it is the cursor tick, the same sound as frame 1.
- **J / L cuts**: a muffled crowd of notifications fades in under the close-up before the pull-back (J); the press chord rings into the reveal (L); the light shimmer starts 0.4 s before the light (J); the number chord rings into the breath (L).
- **Voice**: Kokoro `af_kore`, speed 0.95, confident and restrained: short declaratives. Music ducks −8 dB and foley −4 dB under voice.

## 7. Subtitles & titles

- **Captions are a UI component**: a bottom-centre toast, `rgba(12,14,19,.72)` pill (`.88` during the mess), 1 px `rgba(255,255,255,.09)` border, soft shadow, Inter 500 40 px `#E8EAF0`, an 8 px accent "speaking" dot on the left. Enters with a 12 px rise + fade in 0.16 s. Hold ≥ max(1.8 s, speech + 0.6 s).
- **Typed text is its own subtitle**: the title and the final line are typed by the cursor in the frame, so they are not burned twice (they are in the .srt).
- **No captions over the big number** (the number is the message).
- **Title card** = the cursor typing the film title in the close-up, with a small mono overline `TIDY · A LAUNCH FILM`. **End card** = the typed tagline plus, left-aligned beneath it: film title, "a launch film for Tidy, a fictional app", style name, `Lemo-Opuscar`, `LemoLab × Claude Opus 5.5`, credits. Then everything fades except the cursor, which blinks twice and goes out.

## 8. Pitfalls we hit

- **Strip perspective of a semi-transparent canvas shows vertical seams** (overlapping slices double the alpha). Project the *opaque* window first, then apply the light sweep in screen space.
- **A hard white glint reads as a sticker reflection.** Keep the sweep front soft (700 px) and the glint ≤ 20 %.
- **Nearest-slot snapping looks like a flicker, not a collapse**: travel is too short. Send each type to its own rows along curved paths with trails. Long, ordered and readable beats short or randomly crossing paths.
- **Too few elements leave holes in the grid** that read as a mistake. Generate by rule, then trim or pad to exactly the slot count, group by group.
- **A flat tinted rectangle for "window closes" looks like a placeholder.** Squash the real window; tint only in the last 45 %.
- **An insert that starts expanding on the beat is invisible on the beat frame.** Start the expansion 1 frame early so the beat frame is already 80 % open.
- **Fan and coil noise mask the voice** (both live in 300 Hz–7 kHz). Keep them down until the last line of the section ends.
- Caption toasts can clip the bottom of a product window. Lift the product 25 px while captions are up.

## 9. Production recipe (this repo)

```
styles/dark-keynote/demo/
  engine.js     the style engine (see §10)            timeline.js  tempo grid + pattern + phasing note tables + key times
  world.js      the mess: 264 elements generated from the note tables, spawn poses, freeze, type-row snap targets
  film.js       scenes: mess / inserts / collapse / product reveal / number / breath / echo, captions, event list
  frames.js     engine demo scene          main.js / index.html   page (window.render(t), window.EV)
  music/score.py   original score (sub-agent), stems, score.json      mix.py   foley + voices + ducking + silences
  tools/        dump_timeline.mjs export.mjs cuecheck.py
```
1. Write `timeline.js` (grid, pattern, voices, key times) → `node tools/dump_timeline.mjs` → hand `timeline.json` + the cue map to a music sub-agent. Draw in parallel.
2. Build the engine and the product window first (they are the style frames), then the mess generator from the note tables, then the collapse.
3. `sh demo/build.sh` rebuilds everything: TTS → whisper → score → events → cue check → mix → srt → render → mux (−14 LUFS, grain 0).
4. Review with `node core/render/still.mjs demo --range 0.5:42:1` + `sheet.py` at least twice, plus frame strips of the collapse and the press.

## 10. Engine usage

`demo/engine.js` is a plain ES module (Canvas 2D, no dependencies besides `core/lib.js`). All drawing functions take the context first. Coordinates are in pixels of whatever transform is active.

| Function | What it does |
|---|---|
| `setAccent(hex)` | Set the one brand colour (default `#B7F34A`). Everything accent-driven follows: cursor, toast dot, `litShape({accent:true})`, `trail`. |
| `bg(g, {lift, cool, dark})` | Near-black stage with radial lift and cool glow. |
| `grid(g, {ox, oy, scale, module, alpha, rect})` | Hairline grid that can follow a camera. |
| `glow(g, x, y, r, color, a)` · `vignette(g, a)` | Soft light pools, corner falloff. |
| `panel(g, x, y, w, h, {r, fill, shadow, cheap})` | Rounded UI surface: soft shadow, top-lit fill, 1 px border, inner highlight. `cheap` = offset shadow for hundreds of items. |
| `litShape(g, path2d, {accent, color, glowR, sweep, bbox})` | **Draw any shape in this style**: dark lit surface with rim light, or (with `accent`) a glowing accent fill; `sweep` 0..1 adds a moving light band. |
| `sparklePath(cx, cy, r, k, rot)` | A four-point star path (for sparkles, "new" marks). |
| `trail(g, pts, {color, width, caretH})` | A fading light trail along points, optionally ending in a cursor. |
| `caret(g, x, y, h, {sx, sy, on, glow, color})` | The cursor with squash/stretch and blink. |
| `tidyMark(g, x, y, s)` · `wordmark(g, x, y, px)` | Brand mark (squircle + cursor) and word + cursor. Rename for your product. |
| `windowBox` / `windowContent(kind)` / `notif` / `fileIcon` / `photo` / `badge` / `appIcon` / `storageBar` | The UI kit. `windowContent` kinds: note, inbox, browser, sheet, chat, viewer, code. |
| `flyPose(from, to, p)` · `motionBlur(p, span, n, draw)` | Snap flight with overshoot, spring rotation and morph; multi-sample motion blur. |
| `lightReveal(g, src, x, y, w, h, p, {base, soft, band, glint, angle})` | Light-sweep reveal of any canvas. |
| `perspective(g, src, cx, cy, w, h, rotY, {slices})` | Strip-rendered Y-rotation of a flat canvas; returns `map(u,v)` to screen. |
| `scramble(g, text, x, y, t, locks, {px, fam, color, tracking})` | Glyph-noise-to-number roll with per-character lock times. |
| `toast(g, text, a, {dense})` | The caption component. |
| `camera({x, y, zoom, rot, sx, sy})` | 2.5D camera: `.apply(g, z)` transforms to depth z; `.proj(x, y, z)` returns screen position and scale. |
| `buf(name, w, h)` · `rr(g, …)` · `font(px, wt, fam)` · `rgba` · `mix` | Helpers. |

**Minimal example: a warm orange four-point spark with a cursor tail, in this style.**
```js
import * as E from './engine.js';
const g = document.querySelector('canvas').getContext('2d');
E.setAccent('#D97757');                       // the one colour
E.bg(g); E.grid(g, { ox: 960, oy: 540 });
const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push([360 + u * 1100, 640 - Math.sin(u * Math.PI) * 260]); }
E.trail(g, pts, { width: 8 });                // the cursor's path as a fading light trail
E.litShape(g, E.sparklePath(1480, 380, 90, 0.2), { accent: true, glowR: 40, bbox: [1390, 290, 180, 180] });
E.caret(g, 1560, 380, 120);                   // a cursor riding the spark
const card = new Path2D(); card.roundRect(300, 200, 420, 160, 28);
E.litShape(g, card, { sweep: 0.5, bbox: [300, 200, 420, 160] });   // any shape as a lit dark UI surface
E.vignette(g);
```
Render it with `?scene=engineDemo` (see `frames.js`). To keep a single element in colour in an otherwise neutral frame, draw everything with default `litShape` and only that element with `{accent: true}`.
