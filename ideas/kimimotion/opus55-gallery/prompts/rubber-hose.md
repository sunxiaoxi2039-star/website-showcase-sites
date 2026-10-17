# 1930s Rubber Hose Cartoon — Style Prompt

> Black-and-white hand-inked cartoons where every object is alive and swings to a hot jazz band.
> Demo: *Coffee Cup Chase* (50s) · `rubber-hose.mp4` · source in `demo/`

You are directing a 30–60 second film in the **1930s Rubber Hose** style. The user gives you a topic. You decide everything else — story, shots, timing, music, sound — and deliver a finished film. Follow this guide.

Reference lineage (learn the grammar, never copy characters, designs, melodies or logos): early Fleischer Studios shorts (c. 1930–33) for "the whole world dances"; *Cuphead* for how a modern team finishes the look and scores it with a big band. Never use an existing cartoon character, name or silhouette. **Avoid the "cup-head on a human body with a straw" design** — if your hero is an object, the *whole object is the body*.

---

## 1. What this style is

Hand-inked black-and-white animation from the early sound era: characters with **rubber-hose limbs** (equal-width tubes, no elbows, no knees), **white four-finger gloves**, **pie eyes** (black oval pupils with a wedge cut out), huge round shoes, and bodies that squash and stretch like balloons. The backgrounds are soft gray watercolor paintings; the characters are flat white, gray and ink. Everything — furniture, pots, clocks, curtains, the walls — **breathes in time with the music**. The film looks like a worn 35 mm print projected in a 4:3 gate: flicker, scratches, dust, gate weave, vignette.

## 2. Story: what fits this style

Pick stories where **music and motion are the story**. Rubber hose has four native powers — use at least three, and put the strongest at the emotional peak:

| Native power | Story use |
|---|---|
| **Everything breathes on the beat** | The setting is a character. At the climax the *whole world* dances in sync — every prop, even the walls. This is the payoff shot. |
| **Mickey-mousing** | Every step is a note. Turn a prop into an instrument (in the demo: a stair of plates is a xylophone — the small character climbs it on rising xylophone eighths, the big one on tuba quarters). |
| **Rubber-hose stretch** | Limbs reach any length. Use it for the turning point (the demo's arm stretches around a whirlpool and down a drain in one unbroken shot). |
| **The film is a physical object** | Title cards roll up like window shades; the iris can be grabbed and pulled shut by a character; intertitles can be bumped. Great for openings and endings. |

Adapting any topic: make the topic a **chase or a performance inside one lively location** (a kitchen, an office, a toy shop, a factory). Give the location a supporting cast of 5–8 living objects.

**Emotional arc (40–55 s):** hook on frame 1 (bouncing title letters, band hit) → a small want → a chase in 3 escalating set pieces, one visual gag each → danger → the stretch → dead silence → a quiet, kind turn → release: the whole world dances → iris out with a gag. Keep one hero, one goal, one turn.

## 3. Visual language

- **Frame**: 1920×1080 output with a **4:3 gate** (1440×1080 centered, black pillarbox), gate corners rounded r≈28 px, soft inner shadow on the gate edge.
- **Palette** — strictly grayscale, 6 steps + character white:
  paper `#F1EEE6` · light `#C8C5BC` · mid `#9A978F` · dark-mid `#6B6963` · dark `#3B3A37` · ink `#0E0D0C` · character white `#FCFBF7`.
- **Contrast rule** (important — our first style frame was too flat): characters own the extremes. Character whites and ink blacks must be brighter/darker than anything in the background. Walls sit in **mid gray** (`#8C8981`), tiles `#A29F97`, cabinets `#66635D`–`#7C7972`. Add `contrast(1.14)` in the final composite.
- **Characters**: flat fills, one hard-edged form-shadow band (light gray) on the side away from an upper-left light, ink outline **6 px constant in screen space** at any zoom (transform points first, then stroke), light **line boil** (±1.2 px, 3 drawings cycling at 12 fps).
- **Anatomy kit**:
  - Limbs: noodle tubes of constant width (13 px on a 280 px character), one smooth bend, round caps.
  - Gloves: palm + 3 fat fingers + thumb, flared cuff with a fold line, 3 stitch lines on the back. Outline the union only (stroke all parts thick first, then fill all).
  - Pie eyes: white oval, big black pupil (64% × 74% of the eye) with a wedge cut toward the upper right; blink with an eyelid in body color and a lid line.
  - Mouths: smile with cheek ticks, open grin with gray tongue, "O", wavy (scared), pucker (disgust), "bleh" tongue-out, beam.
  - Shoes: big black ovals with a white toe glint.
- **Object characters**: face on the body; a secondary feature carries the mood (the demo mug's **steam**: lazy waves / bitter zigzag / straight-up alarm / wilted droop / heart). For a cube or box, project a real 3D cube with a slight top-down view (elevation ≈0.26 rad) and map the face onto the front face with an affine transform.
- **Backgrounds**: painted once into a cached canvas at 1.25–1.5× resolution (so camera push-ins stay crisp): flat wash + soft blurred blotches (±5% light/dark) + an inner edge-darkening stroke + thin dark-gray outline (3 px) + paper grain. Backgrounds never boil. Classic motifs: striped wallpaper with small diamonds, square tiles, paneled cabinets, black-and-white checker floor, hanging lamp.
- **Film damage** (drawn in the composite pass, not in the scene): gate weave ±1.2 px low-frequency plus a rare 3–6 px jump; per-frame brightness flicker ±4%; 0–3 vertical scratches drifting over a few frames; 3–8 dust specks per frame; an occasional hair; strong vignette (0 → 62% black at the corners); a 3 px vertical jump on every cut; 0.55 px blur. Grain goes in ffmpeg (`mux.sh` grain **3**), not in the page.

## 4. Motion language

- **Characters on twos** (12 fps); camera moves on ones (24 fps). Stepped cameras read as judder.
- **Tempo grid**: choose a BPM where one beat is an integer number of frames. **144 BPM → 1 beat = 10 frames**, so every beat lands on an even frame and twos-animation can hit it exactly.
- **Breathing**: every idle object squashes/stretches with `cos(2π·beats)` — **an extreme on every beat** (stretch on the beat, squash on the off-beat), sampled on twos, amplitude ~5–7%. All props in phase. At the climax raise amplitude ×3 and also squash the whole background painting around the floor line (~2.5%).
- **Walk**: one step per beat, body bob 10 px; sad walk = smaller steps (34), bob 4, limp arms. **Run**: legs as a windmill (feet orbit a circle), lean forward 0.24 rad, speed lines, steam blown back.
- **Anticipation–hold–action**: before every big move, crouch (squash to 0.8), hold (let the band stop), then snap. Impacts get a squash with an exponential spring-back.
- **Held frames are acting**: the demo's hesitation beat = crouch (hold) → eyes to the other character's back (hold) → eyes up to the goal (hold) → back → up + grin → small hop → leap. Each glance on an eighth note, with a woodblock tick, while the camera slowly pushes in.
- **Freeze on a band stop**: when the music stops for a "lock eyes" beat, freeze everything, background breathing included.

## 5. Camera language

| Beat | Camera |
|---|---|
| Opening | Title card with rotating sunburst; letters hop in a wave each beat; the card rolls up like a window shade to reveal the set |
| Establishing | **Stage-wide, locked off**, eye level. The set reads like a proscenium; props lined along the counter |
| Reaction gag | Hard cut to a close-up of the face (the only big face shot early on) |
| Chase | **Trucking pan** alongside the runners, eased start and stop; the destination prop enters frame before the gag |
| Vertical set piece | Don't frame the whole set piece far away — follow each climber in a **medium shot** (character ≈1/4–1/3 of frame height) so each musical step and the plate's bounce reads; cut between climbers; then tilt down with the fall |
| Danger | Slightly high angle so the hazard reads at a glance; **hold one unbroken shot** through the big stretch |
| Quiet turn | Medium two-shot, then the hero's **back** walking away small in the background while the other character is big in the foreground (on a foreground counter piece) |
| Climax | Pull back from a close-up to a **medium-full** shot (not a far wide — faces must read): hero in the middle, living props on the counter behind, and a **foreground row of bigger dancers** on a nearer counter piece. 2–3 steps by bar (sway → kicks → group squat-and-spring), then **everyone freezes in a ta-da pose on the last beat** and holds into the iris |
| Ending | Iris closes on the heroes; a character's glove pulls it shut |

## 6. Sound

- **Music**: 1930s hot dance band / ragtime — stride piano, clarinet, trumpet (open + plunger-mute "wah-wah"), trombone, tuba oom-pah, banjo on 2 & 4, snare with brushes and rolls, xylophone, woodblocks, slide whistle, cymbal. **No string pads, no modern synths.** One original 4-bar syncopated theme, stated for the title, the chase, a slow solo-clarinet version for the tender beat, and a key-change full-band out-chorus for the climax.
- **Mickey-mouse the score**: stops (hard silence including reverb tails) on the lock-eyes beat, on the suspense before a gag, and a full 2 beats of silence right after the stretch; stingers on every gag; slide whistle for every stretch/slide/fall; the xylophone *is* the plates.
- **Foley by material** (all synthesized): porcelain = hard inharmonic partials (~2.7/4.2/6.3 kHz) + tiny transient; thick mug = lower, duller partials; sugar = high woodblock + sparse crunch; clock = 18 Hz hammer on two bells; toaster = click, eighth-note ticks, bell + spring "boing"; water = filtered noise + rising blips, drain slurp, bubble bed; rubber = sawtooth creak through a band-pass.
- **Voice**: an old radio announcer calling the action like a horse race (Kokoro `bm_lewis`, speed 1.0), 5–7 short lines. Chain: HP 260 Hz / LP 4.6 kHz, tanh saturation, a short room, compression. Duck the music ~8 dB under the voice.
- **Optical soundtrack pass** over music + foley: band-limit 110 Hz–6.2 kHz, slight wow (0.6 Hz) and flutter (7 Hz), soft saturation; then add a bed of hiss, crackle and a 24 Hz projector gate clatter that is the *only* sound during the silence.
- Loudness −14 LUFS (two-pass loudnorm in `core/render/mux.sh`).

## 7. Subtitles & titles

- **Subtitles are "the announcer's title card"**: a small black plate (rgba(12,11,10,.92)) with a white double-rule border, dot-and-ring corner ornaments and a tiny 1930s ribbon-microphone icon; text in **IM Fell English SC** 36 px, paper white. Drawn in the scene layer so it weaves and flickers with the film. Pops on/off with no fades. Bottom (y≈986) by default, top when the action is low in frame. One card may span two voice clips; each card ≥ speech + 0.6 s.
- **Title**: **Shrikhand** fat retro script, white face, 14% ink outline, ink drop shadow offset down-right; each letter hops in a traveling wave on the beat. Sub-line in **Limelight** caps.
- **End card**: same sunburst, a wavy-edged sign with "The End", style name, `LemoLab × Claude Opus 5.5`, small credit lines at the bottom. Opens with an iris from black.

## 8. Pitfalls we hit

- **Flat, gray first style frame.** Push walls to mid gray, keep pure white/ink for characters, add a contrast filter. 30s prints are rich black + bright white.
- **Kokoro heard "bitter" as "better"** after an ellipsis (`is... bitter!`). "And boy, is this coffee bitter!" passes. Check every line with whisper; also check the final mp4 (whisper writes "7am"/"they're" — normalize before comparing).
- Short announcer clips → subtitles too short. Merge consecutive lines into one card.
- **Cube read as a tall box** in pure front view — use elevation ~0.26 and prefer a slight 3/4 turn for expressions.
- "Sad" brows drawn as "angry": define brows by inner/outer end (inner = near the nose), not by left/right.
- Wide shots made characters tiny (reviewer note): a far shot of the plate-xylophone and of the dance climax killed both gags. Mickey-mousing needs medium shots; the climax needs a medium-full shot packed with dancers, not a room-wide view.
- A kicking leg drawn behind a mug body gets hidden by the handle — kick outward past the silhouette.
- Painted characters can collide with background props at certain camera positions (a pot "grew" out of the mug's head). Check every shot's final frame.
- Smoke puffs laid out in a row read as "thought bubbles" — scatter and grow them.
- A leap arc that's too high leaves the frame; keep arcs inside the gate at the camera's zoom.
- `sfx`-style clips of different lengths → numpy broadcast errors. Place clips into a fixed-length buffer (`seq()` in `mix.py`).
- zsh: `echo =====` fails (`=word` expansion) and `timeout` doesn't exist on macOS.
- JS: `-x ** 6` is a syntax error; write `-(x ** 6)`.

## 9. Production recipe (this repo)

```
styles/rubber-hose/demo/
  toon.js    constant-width ink + line boil + affine stack      film.js   4:3 gate, weave, flicker, scratches, vignette
  chars.js   mug & cube rigs, pie eyes, gloves, shoes, steam     cast.js   living kitchen props (all take a breath phase)
  bg.js      cached watercolor backgrounds (kitchen, cupboard+sink)
  story.js   144 BPM bar grid, VO times, subtitle cards, shots, key moments, music cues  (single source of truth)
  scenes.js  every shot: camera, props, acting            events.js  foley event list → events.json
  ui.js      title lettering, announcer title card        sheet.js   model sheets (?mode=sheet / ?mode=kitchen)
  music/score.py  original big-band score (VSCO 2 CE / VCSL samples via core/audio/sampler.py, banjo via pluck.py)
  mix.py     foley synthesis + radio-voice chain + ducking + optical-track aging
  build.sh   one-command rebuild (≈9 min, mostly TTS/whisper/sample loading; frames render in ~50 s)
```

1. Write the bar grid first (`story.js`), then the cue map; score to it (a forked sub-agent can write `music/score.py` in parallel from `story.js` + the cue list).
2. Model sheets: `node demo/tools/still.mjs demo 0 --q 'mode=sheet&w=2880&h=1620' --w 2880 --h 1620`.
3. `core/tts/tts.py lines.json voices` → `core/tts/asr_check.py`.
4. Review: `core/render/still.mjs demo --range a:b:1` + `core/render/sheet.py` (two full passes), and frame strips at 1/12 s on key acting beats.
5. `node core/render/events.mjs demo` → `python music/score.py` → `python mix.py`.
6. `node core/render/video.mjs demo --fps 24 --workers 3` → `sh core/render/mux.sh out/video24.mp4 mix.wav rubber-hose.mp4 24 3` → `python demo/tools/final_asr.py rubber-hose.mp4`.
