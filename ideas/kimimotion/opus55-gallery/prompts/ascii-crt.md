# ASCII / CRT Terminal: Style Prompt

> Everything on screen is a real character on a monospace grid, lit by the phosphor of an old monochrome CRT.
> Demo: *TRANQUILITY.LOG* (59.8s) · `ascii-crt.mp4` · source in `demo/`

You are directing a 30–60 second film in the **ASCII / CRT Terminal** style. The user gives you a topic. You decide everything else: story, shots, timing, sound. Then you deliver a finished film. Follow this guide.

---

## 1. What this style is

A single monochrome terminal screen: **P3 amber** (or P1 green) phosphor glowing on dark glass, curved at the edges, with scanlines. Every image, including title, landscape, planet, room and subtitles, is made of **real glyphs placed on a character grid** and chosen by ink density. The film has one camera, the screen itself. It moves only by changing the **font size of the grid**: bigger characters push in, smaller characters pull out.

The mood is cold, patient and machine-calm: typed dialogue, a blinking cursor as suspense, and one warm surprise.

**Never** fake it with an image plus an "ASCII filter". Characters must be drawn as characters on a grid. Don't copy any film's interface text, fonts or logos, and don't use real space-agency names.

## 2. Story: what fits this style

Pick stories where **text is the only way the character can act**: a machine, a remote operator, a message across distance or time. The medium has five native powers. Use at least three.

| Native power | Story use |
|---|---|
| **The picture is made of words** | The climax *is* a sentence turning into an image. In the demo, the reply `I AM STILL HERE.` breaks apart and its letters, sorted by ink density, become an earthrise. The image contains **only the letters of that sentence**. |
| **Font size = camera** | Push in until one character fills the screen. That character is itself made of smaller text, which reveals scale and meaning. In the demo, one `M` is made of 40 years of `NO SIGNAL` logs. |
| **Typing rhythm = editing rhythm** | Machine typing is even and fast. Human typing is uneven, with pauses and bursts. A cursor blinking three times is the most important performance in the film. |
| **CRT physics** | The screen powers on as a dot, then a line, then the full frame, and powers off by collapsing to a dot. Phosphor afterglow, bloom, curved glass. Use them for the opening and the ending. |
| **A single color change** | The film is monochrome, so one soft second color (the demo uses blue-white `#BFE4FF` for Earth, the only non-amber thing) is the emotional peak. Switch it on a musical downbeat. |

**Adapting any topic:** find the message someone has to send, and make that message become the picture. A product launch becomes a spec sheet that assembles into the product's silhouette. A love letter becomes its own words raining into a face. A history lesson becomes a log file whose dates zoom out into a map.

**Emotional arc for 45–60s:** dark and a cursor, then waking (boot log, a date jumping), then disturbance (handshake noise, a line of text), then holding breath (cursor blinks), then setback (`NOT FOUND` ×3 on three beats), then decision (typing the reply), then **near-silence for 1–1.5 s**, then the climax (letters become the image, the one color appears), then the scale reveal, then waiting, then a tiny reply, then an echo (pull out of the screen, power off to a dot).

## 3. Visual language

- **Font**: VT323 (OFL), one font for everything. Cell = advance 0.4 em × height 0.8 em (1:2). Glyph atlas prerendered at 160 px with a 2.2 px stroke for beam spread, then scaled with `drawImage` to any cell size, so zooms are continuous and never blurry.
- **Grids used**: title 20 columns (cell width 84 px), terminal 80 columns (21 px), picture 240 columns (8 px), room 213 columns (9 px), fractal push-in up to a 450 px cell with a 40-column sub-grid inside each cell.
- **Density ramp**: measure each glyph's real ink coverage from the atlas and sort. Multiply by terminal attributes dim / normal / bold (0.42 / 0.7 / 1.0) to get about 20 levels, then drop near-duplicates. Choose per cell with a small ordered-plus-hash dither (amplitude 0.7). Cells with luminance < 0.05 stay blank. **Negative space is what makes ASCII art readable.**
- **Picture pipeline**: paint the scene as grayscale into an offscreen "negative" aligned exactly to the grid (3×6 samples per cell). R = amber luminance, G = second-color luminance, B = a flag such as "night side". Average per cell and pick a glyph. Rooms get a 3×3 local-contrast boost (`m + 0.9·(m − mean)`) so objects keep their outlines.
- **Earth that reads as Earth**: use continent polygons in lon/lat (rasterized once to an equirectangular mask) rather than noise. Ocean albedo 0.14 (sparse dim glyphs), land 0.96 (dense bold glyphs), clouds 0.5 (mid-density swirls). Put a narrow terminator (smoothstep −0.03…0.10) and render the night side as sparse `.` only. Pick an angle with a clear silhouette: Africa and Europe.
- **Lunar ground**: far ground darker and sparser (×0.3), near ground brighter and denser. The horizon gets a thin bright rim (10 px falloff). Craters: the left inner wall is in black shadow, the right inner wall is lit, the rim lip is bright. Include a few big defined foreground craters.
- **CRT post** (`demo/crt.js`, adapted from `core/post/crt.js`):
  - **Phosphor color**: R maps to amber: dim `#FF6605`, mid `#FFB000`, overexposed toward `#FFEBB8`. G maps to `#B8E0FF`.
  - **Glow**: four-level bloom at 0.55 plus a halo at 0.22.
  - **Glass**: 3 px scanlines at 0.3, narrower on bright areas. Barrel curvature 0.045 with a rounded screen mask. Unlit glass is `#090604`, not black. Faint top-left reflection, 1.2% HV flicker, fine luminance noise. **No RGB grille, because monochrome tubes have none.**
- **Afterglow**: text that disappears decays with τ = 0.12 s, computed analytically so every frame is deterministic. Moving glyphs get one extra trail sample at t − 35 ms × 0.3.

## 4. Motion language

- **Characters never move off-grid, except in the climax.** Typing, scrolling and counters jump from cell to cell. A date "roller" flips digits discretely, fast then slowing.
- **Only three things move continuously**: grid scale (the camera), CRT physics, and the climax particles.
- **Typing speeds**: boot lines 12 ms/char, commands 38 ms, title and reply 120–150 ms (sixteenth notes at 100 BPM). Human typing uses hand-timed offsets with pauses.
- **The letter fall** (the demo's native move):
  1. Hold the sentence for 1.5 s with the cursor blinking.
  2. At the split, letters jitter and throw a ghost copy.
  3. Each target cell spawns a particle from a random point inside a matching source letter (only letters of the sentence exist in the ramp). The particle starts at 18 px, shrinks to the grid size and fades in over 0.2 s so particles never stack into a bright bar. Its path eases smoothly in x, with y = u·(0.6 + 0.4u).
  4. Ground lands bottom to top.
  5. Earth letters first all fall *behind the horizon*, then rise into place from bottom to top, so the planet literally rises.
  6. Source letters dim as they are used up.
  7. The landing flash is 1.9× brightness decaying over 0.12 s.
- **Fractal push-in**: push to a framing where the whole `M` is clear and **hold 1 s**, then push further until the log text is readable (cell 450 px, sub-text about 28 px). Text inside the glyph is at full brightness, text outside is at 3–6%, and neighbor glyphs are at 20%, so the letter shape reads first and the text second.

## 5. Camera language

| Beat | Camera |
|---|---|
| Opening | CRT off, then a dot, a line and the full frame. A giant cursor blinks 3× in empty space. |
| Title | The title is the file the machine opens, typed at 20 columns. It then **pulls out** to 80 columns as it becomes line 1 of the boot log. |
| Suspense | Static 80-column terminal. The only motion is text and the cursor. Hold on blinks. |
| Decision | **Push in** from 21 px to 80 px cells around the prompt. The reply is typed huge and centered. |
| Climax | The grid shrinks while falling (80 px letters become 8 px cells). Hold on the finished picture, and switch color on the downbeat. |
| Scale reveal | Push into one glyph until it becomes its own sub-grid of text, then snap back. |
| Ending | The **only** shot outside the screen: pull back until the screen image sits inside a character-drawn terminal in a dark room. Next to it is a large porthole showing the real Earth (18–20 rows tall). Only two things glow: the tiny reply and the planet. Then power off to a dot. |

## 6. Sound

- **Music**: an original Carpenter-style analog synth score, rendered in numpy and numba.
  - **Sound sources**: PolyBLEP saw and square oscillators, a resonant 4-pole ladder filter with moving cutoff, and filter envelopes. Add slow tape wow (±3 cents), a long reverb on the pad and gated reverb on the hits.
  - **Grid and key**: D minor at 100 BPM, with every cut on a bar or beat.
  - **Cue shape**: silence under boot, then a drone and a square-wave 16th sequencer while the machine wakes.
  - **The hard cut**: on the handshake the whole score drops to digital zero, reverb tails included, for five seconds.
  - **Climax**: a single saw arpeggio grows as the letters fall and opens into Bbmaj7 on the color change. **The only major chord** (D major) lands on the reply.
  - **Never chiptune.**
- **Silence is the main instrument.** Handshake, message and cursor blinks play over room tone only, and there are 1.5 s of silence before the picture forms.
- **Foley** (all synthesized):
  - **Relay and degauss**: relay click, degauss hum (60 Hz plus harmonics decaying over 0.35 s, with a thump).
  - **Keys**: buckling-spring keys (plastic click, a 3.4 kHz spring ping, key-cap thock). The space bar is duller and Enter heavier. Remote characters get a dry teletype tick.
  - **Modem**: an original handshake (2100 Hz answer tone with two phase reversals, a dual tone, 1200/2400 FSK, scrambled band noise, all band-limited to a phone line).
  - **Beeps**: a square-wave error beep, a lower one for the final error, and a 1 kHz BEL for the reply.
  - **Particles**: particle landings as clusters of tiny 2–6 kHz ticks.
  - **Room tone**: a fan bed with 120 Hz hum and a **very quiet** 15.7 kHz flyback whine (about −50 dBFS before loudness normalization).
- **Voice**: the machine's log, read by Kokoro `am_echo` at speed 0.8. Process it with 16% ring modulation at 52 Hz, a 6 ms comb (0.22), a 140–7000 Hz band-pass and soft saturation. Whisper still reads it 5/5. Use 4–6 short lines. Under the voice the music is ducked about −8 dB. The master is −14 LUFS with no grain (the noise lives in the picture).

## 7. Subtitles & titles

- **Subtitles are terminal output.** A reserved **LOG strip** sits at the bottom: a dim dashed separator, an inverse-video `LOG` tag, then `> ` and the line in uppercase VT323 at 45 px. It is **typed word by word in sync with the voice**, using whisper word timestamps, and holds 1.4 s after the line is complete. It lives outside the zooming grid, like a status line, but gets the same scanlines and glow. When nobody speaks it shows system state (`TRANSMIT [#####.....] 40%`, `SENT … AWAITING REPLY`).
- **On-screen text** such as the message, `NOT FOUND` and the reply is picture, not subtitle. In the `.srt` it appears as `[SCREEN] …`.
- **Title**: the filename, typed with key clicks, plus a small dim sub-line.
- **End card**: typed over the final room shot (`ASCII / CRT TERMINAL`, `LemoLab × Claude Opus 5.5`), followed by the CRT power-off.

## 8. Pitfalls we hit

- **Inverse video on an opaque canvas.** `destination-out` only changes alpha, and the texture upload ignores it. Keep the scene canvas opaque black and cut letters by drawing a *black* glyph atlas.
- **Offscreen negative not aligned to the grid.** Scaling by W / width drifts across 200 columns: stars doubled and crater edges misaligned. Map with cell width / samples exactly.
- **Wrong cell center.** Cells are 2·cw tall, so the center is `(j + .5)·2cw`, not `(j + 1)·cw`.
- **Every dark pixel becomes a character.** Walls fill with `-+-+` noise. Apply a luminance threshold, a gamma of about 1.25 and local contrast.
- **A noise-textured Earth reads as a textured ball.** Use continent silhouettes, a dark sparse ocean and a dot-only night side.
- **Particles bursting from 13 letter centers stack into a glowing bar.** Spawn from random points inside the glyph, start small, fade in and drop fast.
- **Earth letters rising through the still-visible sentence look messy.** Send them all behind the horizon first, then rise.
- **The thick (stroked) atlas glyph closes the gaps of `M`.** For the fractal mask, sample a separate *thin* (fill-only) glyph bitmap.
- **Lazily built data never reaches the exporter.** Particle schedules and their sound events must be built before `window.EV` is exported, or the foley for the fall is silent.
- **Power-on parameter at 0 still drew the center dot.** Set exposure to 0 before power-on and multiply the dot term by exposure.

## 9. Production recipe (this repo)

```
styles/ascii-crt/demo/
  term.js    glyph atlas, grid drawing, density ramps, image → cells
  art.js     continent texture, earth shading, lunar ground, craters
  crt.js     monochrome phosphor CRT post (WebGL2)
  main.js    the whole timeline: boot, handshake, message, reply, letter fall, fractal, room, end card, EV, SUBS
  voice_fx.py  AI voice processing      mix.py  synthesized foley + ducking + score
  music/score.py  original analog-synth score      tools/subs.mjs  export window.SUBS
```

1. `node core/render/still.mjs styles/ascii-crt/demo --range 33.4:37.4:0.2` renders frames of any section; `?frame=earth|fractal|base|poster` renders single tests; `?nosub=1` renders without the LOG strip.
2. `sh styles/ascii-crt/demo/build.sh` goes from zero to the finished film: TTS, voice FX, whisper, score, events, mix, SRT, render (1435 frames in about 50 s with 3 workers), mux, styleframe, poster.
