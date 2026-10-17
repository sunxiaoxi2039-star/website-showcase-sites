# Data Storytelling — Style Prompt

> A chart that tells a story: real data, drawn point by point on cream paper by a red–blue pencil, with handwritten notes pinned to the numbers. Each data point is a note, and the chart itself is the camera, the rhythm and the plot.
> Demo: *A Hundred Summers* (50.0 s) · `dataviz.mp4` · source in `demo/`. A hundred and one summers of real global temperature (NASA GISTEMP v4, June–August), told as one woman's life from 1926 to 2026.
> References (grammar only): Hans Rosling's *200 Countries, 200 Years, 4 Minutes* (a moving data point plus a calm narrator; one dot is a character). Ed Hawkins' warming stripes (2018): a century in coloured bands, a diverging ramp centred on a reference mean, no axes. The Pudding / New York Times scrollytelling graphics: one idea at a time, axes that grow with the story, notes pinned to data with thin leaders, the text as the figure caption. Never copy a specific chart, dataset framing, layout or typeface from them, and never name them in the film.

You are directing a 35–55 second film in the **Data Storytelling** style. The user gives you a topic. You find a real, openly licensed dataset for it and decide everything else: story, shots, sound, captions and timing. Then you deliver a finished film. Follow this guide.

---

## 1. What this style is

**The chart is the film.** Nothing on screen is decoration: every mark is a real number, and every movement is a chart operation that means something. A point lands, an axis grows, the scale rescales, a series morphs into another encoding, a note gets pinned to a value. The data must be real and traceable. You change the framing and never the numbers.

**Pick the chart the data asks for.** Our demo is a time series, so it is drawn as dots and a line that morph into stripes. That was one choice for one dataset, not the style. Choose the encoding that fits the user's data and story:

| The data is about | Chart |
|---|---|
| comparing categories, rankings | bars, a ranked bar race |
| a relationship between two measures | scatter or bubble chart (one dot can be a character) |
| place | map, choropleth, dots on a map |
| parts of a whole, counts of people | unit / waffle chart, proportional squares |
| before → after | slope or dumbbell chart |
| a distribution | histogram, beeswarm |
| where things go | flow / Sankey |
| change over time | line or dot series, stripes, area |

What stays the same whatever the chart: cream paper, the pencil that draws every mark, notes pinned to real values, axes that grow with the story, chart operations instead of cuts, and sonification (pitch = value). `inkShape`, `pencilStroke` and `stripesFill` in `demo/engine.js` draw bars, areas and map shapes as readily as dots.

Three layers make it a story rather than an infographic:
1. **A human scale pinned to the data.** Personal, handwritten notes on specific points ("1926 — she is born.") turn an abstract series into a life.
2. **A performer.** A physical pencil draws the series. It gives the style a body that can anticipate, hesitate, flinch and hand the story over.
3. **Sonification.** Each point is a pitch, so the series is also the melody. The audience hears the trend before they read it.

## 2. Story: what fits this style

| Native power | Story use |
|---|---|
| **One point = one fact** | Start with a single point and a single sentence. The first point is the character's first moment. |
| **Axes grow with the story** | Don't show the chart up front. A drop line becomes the x axis; the y axis arrives when the narration first names the unit. |
| **Pinned annotations** | Early notes are memories (blue pencil). Later notes are records or warnings (red pencil). When the content of the notes changes, the emotional arc changes with it. |
| **Rescale / breaking the frame** | The data pierces the top of the plot, and the chart has to make room: ticks compress and new gridlines appear. This is escalation that only a chart can do. Keep the torn edge as a scar. |
| **Encoding morph** | A line of dots falls into stripes (or bars, or a heat strip) in one beat. This is the signature shot, the reveal of the whole. |
| **Scale switch** | Close-up on one value → the whole series → a longer record. Always real data; never extrapolate for drama. |
| **Sonification** | Pitch = value, rhythm = time density. "Hear" the trend; let a rising series become a rising, more dissonant melody. |

**Story shape (proven in the demo).** A cold open on one point. Tender, sparse early points. A steady middle. Acceleration: the notes get denser, and the pencil hurries. The frame breaks, and the pencil flinches and flips to its red end. A rush. **Everything stops half a beat early; this is the only cut in the film, into silence.** Then the last data point, alone, followed by the whole series in one view. The morph into the other encoding comes next, then the longer record, then an empty cell for the next value ("Next summer?"). The end card lives inside that empty cell.

Adapting any topic: pick one real dataset and the chart that fits it (§1); for a series, 60–150 points works. Pin 3 human notes to the first marks drawn and 2 record notes to the last. Find the one frame-breaking moment in the data. Give the last point its own silence.

## 3. Visual language

- **Paper** `#F6F3EC`, with fixed-seed fibre noise and a faint 24 px dot grid (`#E4DDCF`). Both live in world space, so camera moves read on them.
- **Ink** `#2B2723`: axes 1.4–1.6 px, series line 2.4 px, gridlines `#DDD6C9` 1 px, zero line `#BDB4A5` 1.3 px. Tick numbers are in **IBM Plex Mono** (17–20 px, `#6E665C`).
- **Data dots**: r = 6 px, filled from the ramp, with a 1.5 px ink ring so near-centre pale values stay visible on cream. Landing: a 0.25 s pop (×1.55) and a thin ripple ring. Suppress the ripple for dots closer together than 0.1 s.
- **Diverging ramp** (warming-stripes grammar, ColorBrewer RdBu family), u = (v − centre) / half: `#2166AC` → `#4393C3` → `#92C5DE` → `#D1E5F0` → `#F2EEE8` (centre) → `#FDDBC7` → `#F4A582` → `#D6604D` → `#B2182B` → `#7A0F1E` (beyond +1). Centre = the mean of a reference period, span symmetric (demo: 1971–2000 mean 0.22 °C, half-span 0.85 °C). **Honesty beats drama**: if the early values come out pale, leave them pale.
- **Handwriting**: **Caveat** 30 px world size, blue pencil `#2F5D8A` / red pencil `#A8283A`. Use per-glyph jitter (±1.7° rotation, ±2.5 % baseline) and graphite grain (16 % of pixels knocked out). Write-on is a left-to-right reveal while the pencil tip dances over the x-height. Leaders are wobbly quadratic curves ending at an **un-closed** ring around the dot. Small doodles (three-curl wave, heart) are the same stroke.
- **Headline & caption type**: **Newsreader**. The title (66 px) is the chart's own headline, set in world space above the plot's top-left, and it stays there for the full view.
- **The red–blue pencil** (original design): hex body, blue half / red half, sharpened wood cone `#E3C79C`, tinted lead. Show only the tip end. It enters from the lower right at 35–58° (steeper in dense passages so it never covers fresh dots). Its shadow drifts farther and softer with lift. Depth of field: sharp at the tip, soft along the body; fully defocused when it is a foreground object.
- **Layout rules**: keep the plot box fixed in world space (the demo uses 1500 × 520). Put the value floor low enough to leave a **"memory zone" under the curve** for early notes. Late notes go above-left of their dot. Pin annotations in **data space** (a value offset plus a pixel offset), so a rescale keeps the layout intact. The bottom 150 px belongs to the caption.
- **One-colour exception**: every drawing call takes an `accent` colour that bypasses the ramp (the demo's engine showcase draws a `#D97757` spark).

## 4. Motion language

- **The rhythm of the data is the rhythm of the film.** Map the series to a musical grid and accelerate by subdivision, not by tempo. Demo at 90 BPM: 7 points on quarter notes → 24 on eighths → 40 on sixteenths → 27 on thirty-seconds (a point every 2 frames). At 90 BPM every 1/32 note falls on a whole 24 fps frame, so there is zero picture/sound drift.
- **Pencil acting** (anticipation / action / follow-through): it lifts before each tap, lands with its shadow meeting the tip, then gives a tiny rebound. It hurries later. In the rush it trembles like a seismograph needle. **Flinch**: when the data breaks the frame it recoils off the number and freezes for half a beat, *then* lifts and flips end over end to the red lead (0.5 s). **Hesitation**: before the last point it hovers, out of focus, lifts slightly, then descends. **Exit**: after the final question it leaves the frame, and the pencil passes to the viewer.
- **Rescale** as ratchet clicks: four steps on 1/32 notes, each eased over 0.09 beat. The second rescale, in the clarity phase, is smooth.
- **Morph**: stagger the sweep left → right over 0.85 beat. Each mark falls to the band centre (first 45 %), then stretches to a full stripe (ease-out), and loses its ring as it grows. Line segments fade as their left dot starts morphing. Annotations fade as the sweep passes them, then return as tiny pencil marks above the band.
- **No fades to blank, no generic dissolves.** Transitions are chart operations: axis growth, pull-backs, rescale, morph, and the empty cell widening into the end card.

## 5. Camera language

A 2D camera `{x, y, zoom, roll}` over one sheet of paper. **The whole film is one take with a single hard cut**, and the cut *is* the silence.

| Beat | Camera |
|---|---|
| Cold open | Extreme close-up on the first dot (≈4×). Tilt up to follow the leader as the note is written. |
| Title | Pull back to 1.55×. The drop line becomes the x axis; the headline typesets above. |
| Early life | Push back in, then track the pencil, with the newest point kept at ~62 % of frame width (past behind, future ahead). Slow pull-out as time speeds up (2.3 → 1.7×). |
| Climb | Pedestal up with the rising curve while a Dutch angle creeps in (0 → −1.5°). |
| Frame break | Punch-in over 2 frames (1.22 → 1.42×) plus decaying shake. A small jolt on the rescale. |
| Rush | Fast pull-out to 1.0×, roll to −3°, constant 2 px tremor. |
| **The cut** | Hard cut into a close-up of the empty slot: dashed column, `2026` label, level horizon. Rack focus from the defocused foreground pencil to its tip as it lands. |
| Reveal | Hold on the last point while its note is written, then pull back to the full view (1.06×). The axis rescales to fit everything. |
| Morph | Locked-off. The transformation is the movement. |
| Scale | Pull and pan (→ 0.72×) to add the earlier record. |
| Echo | Push to the empty cell; it widens into the end card (frame within frame). |

Rules: subjects fill ≥ 1/3 of frame height at key moments (first dot plus note, the century chart, the stripes band). Frozen-pane y labels: when the real axis scrolls off-screen, the tick labels pin to a paper strip on the left edge.

## 6. Sound

- **Three layers.** Ambience changes with the story: room tone → evening crickets → the sea (J-cut before "1933", L-cut after) → cicadas that grow louder and denser with the heat (J-cut before the climb) → open wind after the silence → room tone. **Foley** follows the materials, graphite, paper and a wooden pencil: tick-plus-paper-body taps, band-passed scratch strokes for handwriting, a ruler hiss for axes, a paper puncture with tear crackle for the frame break, a whoosh and a wooden click for the flip, wooden ratchet teeth for the rescale, a travelling paper sweep for the morph. **Music** is the sonification plus a modular bed.
- **Sonification** (`music/score.py`): `midi = 62 + (v + 0.4) × 17`. Values below the centre snap to D major pentatonic (always consonant), mid values to semitones, and hot values are unquantized. The voice is a **low-pass-gate "plonk"**: sine carrier with light FM whose index rises with the value (wood → metal), with amplitude and brightness decaying together. **In dense passages lower each note's level and shorten its decay (≤ 1.5 × the gap)** so it becomes a trembling rising line, not a pile of hits. Detune only the last ~15 points (5 → 45 cents). The note right before the silence is the most dissonant (max detune plus a minor-second shadow). The last point after the silence is the cleanest, highest note.
- **Bed**: detuned-saw pad (Dmaj9 → G/D → D–Bm–G–A → Bb/D–Dm → semitone cluster), soft sine kick, filtered-noise shaker, 16th hats (low-passed at 9.5 kHz), sine sub bass, sample-and-hold blips, a slowly rising drone. After the silence: a D open fifth (no third, no answer), a glissando of all 101 points replayed during the morph, Gmaj7#11 over D for the scale shot, and the **first point's note again** under the end card.
- **Silences**: 1.0 s true digital silence before the last point (all layers). 0.67 s near-silence before the empty cell. The first sound after each is the most important of its section: the last tap plus its note, then the first stroke of the empty cell.
- **Mix**: narration compressed, music ducked about −11 dB and cicadas −6 dB under the voice. Narration SNR in the 300–4000 Hz band is 8.6–16 dB. The foley is "very light", except the final tap. Loudness −14 LUFS, grain 0.
- **Voice**: Kokoro `af_alloy`, speed 0.92, calm and neutral, 5 lines, never over the rush, the silence or the morph. Whisper writes numbers as digits: set `asr` to "For 50 years…" and "…turned 100…".

## 7. Subtitles & titles

- **The subtitle is the figure caption.** Newsreader 42 px ink, left-aligned with the chart at x = 180, baseline y ≈ 985, max two lines. A 1 px rule sits above it with a small mono kicker giving the year range drawn so far (`1926–1958`). Words appear on their whisper timestamps (3-frame rise and fade). The caption flips up when it leaves. A paper-colour fade band rises behind it while it is visible, so chart ink never collides with it.
- Hold ≥ max(1.8 s, speech + 0.6 s) (asserted in `tools/subs.py`). No captions during the rush, the silence or the morph.
- The title is the chart's headline (world space). The end card sits inside the dashed "next cell": title, `DATA STORYTELLING`, a miniature of the stripes plus an empty dashed cell, `Lemo-Opuscar · LemoLab × Claude Opus 5.5`, data, font, voice and music credits (including "2026 value preliminary, retrieved 2026-09-26"), and a handwritten "Her story is fiction. Every number is real."

## 8. Pitfalls we hit

- Picking the wrong CSV column: GISTEMP has J-D and D-N before the seasonal columns. Select by header name (`JJA`), never by index.
- Annotations collide with later data. Pin them in **data space**, keep a memory zone under the curve, and put the first note *above* its dot with a long leader.
- A frame break that is rescaled after 0.17 s is invisible. Hold the pierced state at least half a beat (the pencil's flinch lives there) before the ratchet.
- Right-aligned notes are written left to right, so the pencil must hop from the leader end to the first letter (16 % of the text phase, lifted). Otherwise it teleports.
- `pencilStroke`, `dashedCell` and `dataDot` set `globalAlpha` themselves. Multiply by the incoming alpha, or fades and wipes won't affect them.
- Reverb tails and pulse tails leak across a hard silence. Render pre-cut and post-cut material into separate buffers and zero everything after the stop.
- In tracking shots the world-space title gets cut by the frame edge. Fade it while the camera is close, and bring it back when the full view arrives.
- At 32nd-note density the pencil body lies across fresh dots. Steepen its angle in dense passages.
- `ffmpeg -ss … volumedetect` reports false peaks inside a silence. Verify silence on the decoded samples.
- A baby's laugh (from the TTS or synthesized) sounds uncanny. Use a non-human soft sound (the demo uses one music-box note).

## 9. Production recipe (this repo)

```
styles/dataviz/demo/
  data/        GLB.Ts+dSST.csv (as downloaded) + jja.json      tools/extract_data.py  column → json + story facts
  timeline.js  90 BPM grid, year → beat map, every key beat, chart geometry (single source of truth)
  engine.js    the style: paper, camera, pencil strokes, handwriting, dots, stripes, morph, pencil, caption, shapes
  film.js      the story: annotations, camera path, pencil activities, chart layers, end card, events for the mix
  music/score.py   sonification + modular bed (reads events.json)      mix.py   ambience + foley + narration + ducking
  tools/       words.py subs.py cuecheck.py final_asr.py
```
1. Download the dataset and write the extractor. Print every fact the narration will claim.
2. Write `timeline.js` (grid plus year → beat map) before any drawing.
3. Build `engine.js`, then `film.js`, and render gate frames from the real engine (`node core/render/still.mjs … --range`).
4. `sh demo/build.sh` rebuilds everything from scratch in about 2 minutes: extract → TTS → whisper → words → events → score → cuecheck (107 cues, max 0.03 ms) → mix → subtitles → render (1200 frames, ~30 s with 2 workers) → mux (−14 LUFS, grain 0) → styleframe and poster.
5. Review: a 1 s contact sheet from the final mp4 twice (offset by 0.25 s), 0.1 s strips of the break, the cut and the morph, per-line whisper on the final mix, and a sample-accurate silence check.

## 10. Engine usage

`demo/engine.js` (ES module, Canvas 2D, 1920×1080; imports `/core/lib.js`). World units are chart pixels at zoom 1. Call `applyCam(g, cam)` before any world-space drawing.

| Function | What it does | Key parameters |
|---|---|---|
| `drawPaper(g, cam, {dots})` | cream paper, fibre noise and dot grid, fixed in world space | `dots` 0–1 grid alpha |
| `applyCam(g, cam)` / `w2s` / `s2w` / `viewRect` | 2D camera transform and conversions | `cam = {x, y, zoom, roll, sx, sy}` (sx/sy = shake in px) |
| `valueColor(v, {center, half, alpha})` / `rampRGB(u)` | diverging stripes ramp | reference-mean `center`, symmetric `half` |
| `pencilStroke(g, pts, o)` | **draw any polyline in pencil**: wobble, taper, graphite grain, write-on; returns the tip | `color, width, progress, seed, wobble, passes, grain` |
| `inkShape(g, path, o)` | **any closed shape** as a pencil-annotated mark: flat fill + hatching + hand outline | `fill` (accent) or `value` (ramp), `hatch, progress` |
| `plotShape(g, path, o)` | sample any path into a dot-and-line data series | `n, r, values, accent, progress` |
| `stripesFill(g, path, values, o)` | fill any closed shape with warming stripes | ramp options, `accent` + `accentIndex` |
| `dotTrail(g, pts, o)` | tapering dot trail (cursor tail / comet) | `color, r0, r1` |
| `handText(g, text, x, y, o)` | handwriting with grain and left→right reveal; returns `{tip, w}` | `size, color, progress, align, zoom` |
| `setType(g, text, x, y, o)` | printed type, letter-by-letter typesetting | `size, font, weight, progress, rise, track` |
| `dataDot(g, x, y, r, fill, o)` | data point with landing pop and ripple | `fresh` (s since landing), `ripple, accent, alpha` |
| `inkLine`, `stripe`, `morphMark(g, u, dot, box, fill)` | series line, one stripe, dot→stripe morph at 0..1 | |
| `leader`, `ringPath`, `wavePath`, `heartPath`, `bracketPath`, `sparklePath`, `quadPath` | annotation geometry | |
| `dashedCell(g, x0, y0, x1, y1, o)` | the dashed "next value" cell, drawn on | `progress, color, dash, gap` |
| `drawPencil(g, o)` | the red–blue pencil (screen space) | `tip [sx,sy], s, lift 0–1.2, flip 0–1 (blue→red), blur, focus, ang` |
| `caption(g, words, t, o)` | figure-caption subtitle with timed words | `t0, t1, kicker, x, y, size` |

Minimal example: a warm orange `#D97757` four-point spark with a cursor tail, drawn in this style (full version: `?engine=1` → `demo/stills/engine_demo.jpg`).

```js
import * as E from './engine.js';
const g = canvas.getContext('2d'), cam = { x: 0, y: 0, zoom: 1, roll: 0 };
E.drawPaper(g, cam); E.applyCam(g, cam);
E.dotTrail(g, Array.from({ length: 9 }, (_, i) => [-300 + i * 26, 170 - i * 14]), { color: '#D97757', r0: 9, r1: 2 });
E.inkShape(g, E.sparklePath(0, 0, 150), { fill: '#D97757' });            // accent bypasses the ramp
E.leader(g, [110, -200], [40, -110], { color: E.P.blue });
E.handText(g, 'the spark, in pencil', 120, -210, { size: 34, color: E.P.blue });
const tip = E.w2s(cam, 150, 0);
E.drawPencil(g, { tip, s: .8, lift: .2, flip: 0 });                        // flip: 1 = red end
```
