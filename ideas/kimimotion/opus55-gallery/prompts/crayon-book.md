# Crayon Picture Book — Style Prompt

> A bedtime picture book drawn live in wax crayon on toothy paper, with one watercolour wash that reveals what the crayon was hiding.
> Demo: *The Moon Can't Sleep* (52s) · `crayon-book.mp4` · source in `demo/`

You are directing a 30–60 second film in the **Crayon Picture Book** style. The user gives you a topic. You decide everything else — story, shots, timing, sound — and deliver a finished film. Follow this guide.

---

## 1. What this style is

A children's picture book page that is **being drawn while you watch**: wax crayon on warm off-white drawing paper, a limited box of crayons, child-logic perspective, colour that spills past the outline, and every line gently **boiling** because each frame is a fresh drawing. The tone is a bedtime story: tender, slow, music-led, with a few lines of narration that are literally the words printed on the page.

It is not "cute vector art with a crayon filter". The look comes from **material physics**: wax only sticks to the peaks of the paper tooth, pressure decides how much of the tooth it reaches, watercolour is repelled by wax. Reference for grammar only: Raymond Briggs' *The Snowman* (1982) — hand-textured frames that breathe, wordless tenderness, a lyrical passage where one song carries the film, a child at a lit window at night. Never copy its characters, song or imagery.

## 2. Story: what fits this style

Pick stories where **the act of drawing and colouring is the plot**. Crayon + watercolour have six native powers — use at least three, and put the strongest one at the emotional peak:

| Native power | Story use |
|---|---|
| **Wax resist** — white crayon is invisible on white paper until a wash is brushed over it | The reveal. Hide the payoff in plain sight from the first frame (stars, a message, a path, a hidden friend) and let a sweep of watercolour uncover it at the climax. |
| **Drawn live** — lines appear stroke by stroke, colour is scribbled in | Open on a blank page. The world helps the hero by drawing itself just ahead of them (a ladder that grows rungs under her hands, a bridge, a path). |
| **Colouring is an action** | A character "does" something by being coloured in: pulling up a blanket = scribbling a quilt over the moon; blushing = pink scribble; night falling = a wash. |
| **Boil** | Even a held frame is alive. Calm the boil (half amplitude) when the story goes to sleep. |
| **Child logic** | Wrong perspective, faces on the moon, numbers written in the sky while counting sheep. Things a child would draw are allowed to happen. |
| **It is a book** | End by pulling back to the physical book on a table, the crayons beside it; turn the page to "The End". A one-take film over one page is explained by that reveal. |

Adapting any topic: turn it into **one page of a picture book that gets finished**. A product launch → the product is drawn in outline, coloured, and a wash reveals the hidden feature. A history lesson → a page of events coloured in one by one. A thank-you film → names written in white crayon, revealed by the wash.

**Arc for 45–55s:** blank page → a character is drawn and wakes up (hook in 3s) → a small comic problem → a second character → a small brave act → the wash reveal on the song (peak, no narration) → everyone sleeps / resolves → pull back to the book, page turn.

## 3. Visual language

- **Paper**: warm off-white `#f4efe3`. The tooth is **anchored to the page** (it pans with the camera; on zoom, two octaves cross-fade so grains stay ~1 px on screen) — never screen-fixed. A procedural tooth height-field: three octaves of value noise at 1.35 / 2.9 / 6.3 px plus a horizontal fibre term (x/10, y/1.9), contrast `smoothstep(.16,.86)`. Final pass embosses the paper (gradient lit from top-left, strength ~0.55), less where wax has filled the tooth. Low-frequency mottling ±2%. Warm vignette.
- **Wax adhesion (the core rule)**: every crayon layer is a Canvas2D where RGB = crayon colour and **A = pressure**. The shader deposits wax where `tooth > 1 − 1.22·pressure` (soft edge ±0.07). Light pressure = only the peaks (speckled); heavy pressure = almost solid. Heavier wax also darkens the colour slightly (×(1−0.1·p²)).
- **Strokes**: outlines are ribbons with a hand wobble (low-frequency normal offset ~1.7 px), width variation ±15%, tapered ends, a denser inner core and 1–2 thin streaks along the stroke. Outline width ~7 px on characters, 8 px on buildings, 4–5 px for refined "adult" objects.
- **Colouring**: back-and-forth zig-zag hatching, gap ~10.5 px, width ~11 px, every pass at a slightly different pressure (0.72–1.14×) so individual strokes read; **overshoot the outline by 0–7 px** (children colour outside the lines); cross-hatch second pass on big areas at 40–50% pressure.
- **Palette** (12 crayons, never more): ink/indigo `#2d3263` (all outlines — never black), yellow `#f5c63c`, orange `#ec8a3c`, red `#d4483c`, pink `#ee8ea4`, peach `#f4c7a4`, brown `#7a4b31`, ochre `#e7b867`, green `#62a24c`, sky `#79acd9`, violet `#6a5aa6`, white `#fbfaf4` (wax resist). One watercolour: ultramarine, transmission `(0.15, 0.19, 0.44)`.
- **Watercolour wash**: a separate density canvas, multiplied over the page. Pigment pools at the edges (density − mip-blurred density → darker rim), granulates in the deepest tooth pits, blooms with low-frequency noise, and is **resisted by wax**: `density × (1 − 0.93·smoothstep(.12,.55, waxCoverage))`. Brush strokes are wide bands with bristle streaks (darker/lighter lines along the stroke) and a wet leading edge that is darker while moving.
- **Occlusion**: a front part erases the lines and colour of the parts behind it inside its outline, and characters "keep the paper white" behind them (a knock-out pass that restores paper and resets wax to 0), the way a child draws the figure first and colours the background around it.
- **Characters**: a skilled adult imitating a child: round head (≈2.6 heads tall), dot eyes with a white-wax catchlight, round pink cheeks, simple tube limbs with mitten hands, bold hair shapes with a scalloped fringe. One colour accent that echoes the story (her yellow star hair-clip = the stars). Objects with faces (the moon) get big readable eyes, eyelids, eye-bags.
- **Child perspective**: gable front + slanted side wall + a big roof plane; people bigger than doors; a round tree with red dots.

## 4. Motion language

- **Everything drawn steps at 12 fps** (on twos): characters, lines, colouring, boil seed. Camera moves, the wash's leading edge and star twinkles run at 24 fps.
- **Boil**: every stroke re-jitters its whole-stroke offset (±0.8 px), its wobble (±0.9 px) and its hatching rows every 2 frames. Characters ×1; background *lines* ×0.6; background *colouring* does not boil (a still painted background with living characters, as in *The Snowman* — and it halves the bitrate). After the characters fall asleep, ×0.5.
- **Drawing on**: lines reveal along their length (`draw` 0→1) in 0.4–0.9 s; colouring reveals row by row. Text is written letter by letter in 0.35 s.
- **Acting**: substitution animation — a new drawing per pose (tossing = a scrunched face rotated 35°, on the beat). Climbing alternates two key drawings per rung. Keep poses big and simple; a child's drawing doesn't in-between.
- **Sleep grammar**: eyelids come down as yellow scribbles, a nightcap is drawn on, a quilt is coloured up from below with the folded edge appearing first, a tiny hand tucks it in.

## 5. Camera language

The film is **one continuous camera over one page** (world 3200×1800; full page = scale 0.6). Every move needs a reason:

| Beat | Camera |
|---|---|
| Opening | Locked full page, flat: the audience must see the paper before anything is drawn |
| Title leaves | Push toward the character instead of fading the title (you can't fade crayon) |
| Comic beat | Locked medium close-up; let substitution poses do the comedy |
| Discovery | Tilt along a character's gaze (the camera *is* the moon looking down) |
| Two-shot | One character peeking in from the frame edge, the other small in a lit window |
| Brave act | Tight follow tilt; the world draws itself just ahead of the hero |
| Wash reveal | **Hold a wide.** Let the brush and the music do the motion. Small figure, huge sky |
| Resolution | Slow push-in on the face falling asleep, then tilt to the second sleeper |
| Ending | Pull out until the page becomes a book on a table; page turn; glide onto "The End" |

## 6. Sound

- **Music first, in 3/4 at 72 BPM** (bar = 2.5 s). Music box (lead, mechanical tines), toy piano (comic waltz, one note per sheep / per rung), flute as the singing voice (instrument replaces voice), clarinet for bass and humour, glockenspiel for every star the wash uncovers. No strings, no grand piano. The lullaby theme appears in full exactly once, at the wash; the opening music-box motif is its first phrase. End with the music box **winding down** (ritardando + slight pitch droop).
- **Silence**: a full beat of silence after the failed sheep-count; a 0.3 s breath before the song.
- **Foley follows the material**: crayon = stick-slip band-passed noise whose grain rate follows stroke speed (colouring = rhythmic back-and-forth swishes); wet brush = soft low-passed broadband with fine bristle grain, panned with the stroke; sheep landing = felt puff; tossing = blanket swish; page turn = lift / whoosh / flap. Night = very faint crickets; the desk = warm room tone and a distant clock.
- **Mix**: music −7 dB under narration, +4 dB for the wordless song; music-box and glockenspiel stems +3 dB with a gentle 3–7 kHz lift so the metal sparkles over flute and clarinet.
- **Voice**: a soft, warm bedtime storyteller (Kokoro `af_heart`, speed 0.86–0.90; v3 re-voice — `bf_emma` read too bright and hard), 6–8 short lines with a breath between them. Chain: high-pass 75 Hz → **compress first** (thr 0.2, 2.5:1, 8 ms / 140 ms) → low shelf +1.5 dB @220 Hz, −2 dB dip @3.2 kHz, **high shelf −4 dB @6 kHz** → split-band de-esser (4.8–10 kHz, 4:1) → per-line RMS match → warm near-field reverb (12 ms pre-delay, early reflections, 0.7 s low-passed tail, wet ~−17 dB). Music ducks ~7 dB and foley ~4 dB under it; voice sits ~7–10 dB over the bed, never louder. Verify every line with whisper — dry *and* cut from the final mix. Avoid famous-book phrases ("Goodnight, Moon" — use "Night, night.").

## 7. Subtitles & titles

- Subtitles are **the book's printed words**: Patrick Hand (OFL) 54 px, indigo crayon, bottom-centre, each glyph with its own small tilt and baseline offset, boiling on twos, written on left→right in 0.35 s. Behind them, a ragged blank patch of paper (a knock-out, not a dark box), as if the child left room for the words. Hold ≥1.8 s and ≥ voice + 0.6 s; none during the song.
- Title: hand-lettered on the page (Gaegu Bold) in two lines in a corner, written on letter by letter while the colours are scribbled in.
- End card: the next page of the book — "The End" (Gaegu Bold), a small crescent doodle, the style name and credit in Patrick Hand.

## 8. Pitfalls we hit

- **White gaps between wash bands** and a sky that stopped above the ground: wash bands must overlap and the last one must reach down to the grass line; sky exists wherever there is paper.
- **Low-frequency wavy band edges read as mountains** in the sky. Keep band edges' waviness small and high-frequency.
- **Wide light bristle streaks** looked like hills too; keep lighter streaks thin and faint (α ≤ 0.12).
- **Walls coloured at light pressure turn muddy blue under the wash** (the wash sinks into every gap). Anything the wash will cross needs heavier pressure (≥0.8) or cross-hatching.
- **Titles and numbers written in the sky survive the wash** (wax resists!). Put the title in a corner the wide shot won't show, or accept it as part of the page.
- **Outlines drawn over hair read as a headband**: outline only the visible part of the face; outline hair masses on their outer edge only.
- **A blanket drawn as a flat violet half reads as the moon's dark side.** Give it quilt features: patchwork squares, stitch lines, star appliqués, a light turned-down edge, a draped hem that spills past the disc, and a hand that pulls it up.
- **Knock-out layers must use a dummy canvas when drawing into a plain layer**, or the black mask gets drawn as grey crayon.
- **Page turn with rectangle strips** shows a staircase of page edges; map each strip with an affine transform so top and bottom edges stay continuous.
- **Double vignette/emboss at the book transition**: render the page texture with vignette 0 and ramp the desk's vignette, emboss and lamp light in from 0.
- **Screen-fixed paper tooth made the film 190 MB** (every pixel changes whenever the camera moves). Anchor the tooth to the page, don't boil background fills, no extra ffmpeg grain, CRF 26 → 74 MB with no visible loss.
- **The heroine disappeared into the night** because the wash sank into her colouring gaps. Composite the characters the story needs to read *after* the wash.
- **Reverb IR built from unit-variance noise** is enormously loud (energy = decay·SR). Scale the IR so the wet level sits ~18 dB under the dry voice.

## 9. Production recipe (this repo)

```
styles/crayon-book/demo/
  gl.js      WebGL2 compositor: paper, wax adhesion, knock-out, watercolour + resist, image pass, final emboss/vignette/lamp
  crayon.js  stroke engine: line (ribbons, taper, streaks, boil), fill (zig-zag hatching, overshoot), text, shapes
  rig.js     parts with occlusion + knock-out, limb tubes, curves
  chars.js   the girl (views × expressions × poses), the sheep, the moon (expressions, nightcap, quilt, crescent face)
  world.js   the page: house, tree, grass, ladder, 250 white-wax stars, 3 wash bands
  film.js    timeline, one-take camera, events, subtitles     end.js  book on a crayon desk, page turn, The End
  sheet.js   model sheets (?test=model&page=girl|moon)        lines.json, mix.py, music/score.py, build.sh
```

1. `node core/render/still.mjs styles/crayon-book/demo 0.5 --q 'test=model&page=girl'` — model sheet first; iterate the character before any shot.
2. `core/tts/tts.py lines.json voices` → `asr_check.py` until all OK.
3. Build the timeline in `film.js`; review with `still.mjs --range 0.5:51.5:1` + `sheet.py` (two rounds minimum).
4. `node core/render/events.mjs` → `music/score.py` (cues on the 72 BPM grid, glockenspiel from `glint` events) → `mix.py`.
5. `node core/render/video.mjs styles/crayon-book/demo --fps 24 --workers 3` (1248 frames ≈ 80 s on an M-series Mac).
6. `CRF=26 sh demo/tools/mux.sh out/video24.mp4 mix.wav crayon-book.mp4 24 0` — no added grain (the paper is the grain); local mux copy exposes CRF. `demo/build.sh` runs the whole chain from TTS to the finished film.
