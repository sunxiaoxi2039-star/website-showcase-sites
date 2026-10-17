# Chinese Ink Wash — Style Prompt

> Xieyi ink painting on rice paper, animated: blank paper is space, one brushstroke is a mountain, a wave, or a sword cut.
> Demo: *The Swordsman and the River* (48 s) · `ink-wash.mp4` · source in `demo/`

You are directing a 30–60 second film in the **Chinese Ink Wash** style. The user gives you a topic. You decide everything else — story, shots, timing, sound — and deliver a finished film. Follow this guide.

---

## 1. What this style is

A film that looks like a Chinese ink painting (水墨, *shuimo*) that is being painted and unrolled in front of you. Everything is black ink on warm rice paper, in five tones, plus **one** red: the vermilion seal. There are no outlines in the Western sense: forms are made by **loaded brushstrokes** whose dark edge *is* the contour (没骨, "boneless" painting), by **wet washes** that bleed into the paper, and by **dry, fast strokes** where the paper shows through the bristle tracks (飞白, "flying white").

Most of the frame is **empty paper** (留白). Emptiness is not background — it is water, sky, mist, silence. A good ink frame is 60–80 % untouched paper.

Learn the grammar from Shanghai Animation Film Studio's *Feelings of Mountains and Water* (1988) — blank-paper space, ink bloom, guqin-led pacing, figures in a few strokes — and, for action, from the bamboo-forest sequence of *Crouching Tiger, Hidden Dragon* (weightless "qinggong" leaps, stillness before motion). Do not copy their characters, compositions or music.

## 2. Story: what fits this style

Pick stories where **the brush itself is the event**. Ink has six native powers — use at least three, and put the strongest at the emotional peak:

| Native power | Story use |
|---|---|
| **One stroke is everything** | A drop of ink lands on blank paper and blooms into mountains. Things are *painted into existence* rather than cut to. |
| **Emptiness is matter** | The river, the sky, the path are blank paper. Cutting something reveals *paper white* — the most powerful "effect" is removing ink. |
| **Brush = gesture = action** | A sword path writes a calligraphic character; a dance is a line; a punch is a dry stroke. Stroke order becomes choreography. |
| **Flying white (飞白)** | The climax is one fast dry stroke across the whole frame — the ink runs out at the speed of the action. Precede it with total silence. |
| **Ink bloom transitions** | Instead of cuts or dissolves, a drop spreads through wet paper and the next scene grows inside it, with a dark tide-line at the front. |
| **The handscroll** | The whole story lives on one long painting. Pan right-to-left like unrolling a scroll; end by pulling back to reveal the full scroll and stamp the seal. |

Adapting any topic: find the **one gesture** at the heart of it and make it a brushstroke. A product launch → the product is written in one stroke. A love story → two strokes that finally meet. A history → a scroll that unrolls through eras and is sealed at the end.

**Emotional arc for 45–60 s:** emptiness → a drop of ink (creation) → a small figure in vast space → lightness/joy → an overwhelming obstacle (drawn as mass: a wet splash of dark ink) → silence → one decisive stroke → release → scale reveal (the figure is a tiny mark in the whole painting) → seal. One character, one goal, one turn. A philosophical closing line lands better than a triumphant one ("cut water with a sword and it only flows on").

## 3. Visual language

**Paper** (procedural, in the compositor, not a texture file): base `#F2ECDE`–`#F3EBDD` (warm rice paper, rgb .95/.925/.87), large cloud mottling ±7 %, three directions of long thin fibers (+1.8 % light), faint pulp dark flecks, fine grain that fades out when the camera zooms out (else it shimmers). Light vignette (~.22), slight warm grade. Paper texture is anchored to the world, so it pans with the camera.

**Ink** — five tones (墨分五色), used as stroke opacity on paper (multiply, not overlay):

| Tone | Value | Use |
|---|---|---|
| 焦 jiao (burnt) | .96 | calligraphy, sword, hat brim line, moss dots |
| 浓 nong (thick) | .82 | contours, hat, dark edge of loaded strokes |
| 重 zhong (heavy) | .60 | secondary lines, folds, scabbard |
| 淡 dan (light) | .34 | mountain bodies, robe washes |
| 清 qing (clear) | .16 | far mountains, face, mist |

Ink colour runs from cool grey `rgb(.52,.55,.58)` at low density to warm black `rgb(.075,.068,.062)` at full density. Vermilion `#B02E22` only for the seal and one tiny accent on the hero (a sword tassel) — it finds him in wide shots and rhymes with the final seal.

**Brushstroke model** (`demo/ink.js`): centreline (Catmull-Rom, resampled by arc length) × pressure profile × width noise, plus 4–60 **bristles**. Each bristle has an ink load that drops along the stroke; a long-scale noise decides where it breaks. `dry` 0 = solid wet stroke, .3 = textured, .6+ = flying white. The body fill fades with dryness `(1-dry)^1.6` so dry strokes are made of bristle tracks only.
- Profiles: `brush` (press-in, taper out), `tip` (both ends pointed), `nail` (heavy head), `lens`, `fan` (narrow → wide), `rise`, `robe`, `even` + per-point pressure.
- **Loaded stroke** (`darkDir`, `side`, `brWet`): bristles darker on one side → the stroke carries its own contour. This single trick is what makes robes, rocks and waves read as ink painting rather than vector shapes. Its bristles go into the *wet* layer so they blend.
- **Wet vs dry layers**: two canvases. The compositor bleeds the wet one (12-tap noisy Poisson blur ~5 px at 1:1, feathered displacement), adds **edge pigment accumulation** (small blur − large blur) and paper granulation; the dry one only gets fiber jitter and paper-tooth breakup.
- Masses (hat cone, mountain bodies) are soft polygons with jittered, subdivided edges and a gradient — never flat fills with straight edges.

**Mountains** (`demo/land.js`): generated per pixel once and cached — ridge (pointed exponential peaks, rounded tops, 3-octave roughness) with a dark rim under the ridge fading downward, dissolving into horizontal mist bands; then 披麻皴 texture strokes down the slopes and clustered 苔点 moss dots on the ridges. Far ranges: tone .12–.16, no texture. Near ranges: .4–.5 with texture. Fade range ends with a horizontal alpha mask, never by sloping the ridge (it crosses the river).

**Rocks/cliffs**: outline (broken, thick-thin 焦墨 segments) → texture (short axe-cut 斧劈 strokes along facet lines) → wash (loaded vertical strokes on the shadow side, fading down into mist) → dots. **Pine**: one loaded crooked trunk, a few tip branches, fan-shaped needle clusters. **Reeds**: long tip strokes + lens leaves; foreground only, at the frame bottom.

**Water**: blank paper. Motion is shown by a few faint dry streaks, ellipse **ink rings** at each footfall (one stroke, 1.86π, open gap, expand as r ∝ age^0.6 and fade over ~2.4 s), and, when water becomes solid (a wall, a wave), by Song-dynasty-style **parallel wave lines** — dense and dark near the edge, sparse and pale away from it — with a few small curls.

**Waves**: a pale wet body + 4–5 huge loaded strokes swept up along the wave face and curled over at the crest (the stroke direction *is* the water's motion) + a few thin wave lines + spray as irregular ink blots. Never hatch the body with uniform lines (it becomes a wire mesh).

**Calligraphy**: use an OFL brush font (Ma Shan Zheng for regular script) as a **skeleton reference**: trace the centreline of each stroke in stroke order over the glyph, set pressure from the glyph thickness, add a 45° lead-in point for the hidden-tip entry (藏锋) and taper to .12–.18 for 撇/钩 exits. Draw with `solid: true` (body in the dry layer + a wet halo) and low dryness (.17). Don't clip brush strokes with the font outline — it creates notches at junctions.

**Characters — xieyi figures** (`demo/hero.js`): 100-unit-tall rig (joint dict: hip, chest, head, arms, legs, hem points, flare, sheath, ribbon) regenerated as strokes every drawing. Few strokes: hat = one wet mass + two dry ridge lines + a burnt-ink brim line; robe = one pale base mass + two loaded strokes (dark edge at back and front); legs/sword = burnt-ink lines; one ribbon trailing in the wind. The face stays hidden under the hat almost always; show features once (a close-up or the final bow) with 3–5 strokes: sword brows, phoenix-eye lids, one nose line, drooping moustache.

**Titles & seal**: title in vertical columns (English letterforms rotated 90°, Cormorant SC 600, wide tracking) placed in the painting's empty space, with a vermilion 白文 seal drawn by code (seal-script-like lines knocked out of a slightly irregular red square, with ink-paste speckles).

## 4. Motion language

- **Characters step at 12 fps** (on twos); their *position*, the camera, blooms, ripples, splatter and the wave move on ones at 24 fps. Poses are keyframed joint dicts blended with smoothstep.
- **Stable strokes on twos**: seed every stroke by its index, and compute bristle breaks and width noise along *normalized* arc length × a fixed reference length (`gapLen`), not the actual length — otherwise flying-white gaps crawl every drawing and the figure flickers into a blur. Allow only a small per-drawing "boil" phase on the width noise (5-drawing cycle).
- **Qinggong (lightness) leap**: body pitched ~30° forward, one knee tucked, the other leg trailing, robe pulled back into a big pale mass with a dark back edge, sleeves streaming. Step cycle: touch (14 %) → rise → glide (45 %) → descend; height `sin(π·phase)`. One ink ring per touch.
- **Painted into existence**: strokes appear in drawing order (`p` progress), each landing on a musical pluck.
- **Stillness before the strike**: hold the frame (only a slow 5 % push-in) through total silence, then the decisive stroke crosses the frame in ~4 frames. Delay the consequences (the wave splitting) until the stroke has finished.
- **Splitting a mass**: render it to a temp layer, draw the two halves through clip paths on either side of the cut line; the upper half rises/rotates and fades, the lower half slumps and squashes; add curling crests along both torn edges and pale wash blocks; splatter flies along the sword direction with gravity and stays on the paper.
- **Ink bloom** (reveal/transition): noisy radial mask `d·(0.62 + 0.8·fbm)` against a growing radius, with a dark tide-line band at the front. For individual world elements use a low-res (1/4) mask computed per frame in world-anchored noise and `destination-in`; for scene transitions do it in the compositor between two layer sets.

## 5. Camera language

| Beat | Camera |
|---|---|
| Opening | Locked frame of blank paper; the drop falls into it. Give "nothing" before "something". |
| Establishing | Slow right-to-left pan (scroll unrolling), ending on a **high wide** frame: the figure 150–180 px tall, the river a huge blank. |
| Travel | Lateral tracking with the figure at ~60 % of the frame, lead room ahead; very slow parallax far mountains; occasional dark reeds passing at the very bottom. |
| Threat | **Low angle**, horizon low, the mass towering, the figure tiny in a corner; slow push-in with growing shake. |
| Silence | Hard cut to an extreme close-up (hat brim, no eyes); then an **over-the-shoulder** frame putting the figure, the written character and the threat on one axis. |
| Release | Back to the same high wide scale as the establishing shot — the rhyme shows what changed. |
| Ending | Continuous pull-back from the figure to the whole handscroll on its silk mount; seal; end card below the scroll. |

## 6. Sound

- **Music — guqin-led, not piano+strings**: guqin (`core/audio/pluck.py` `guqin`: open strings, stopped notes with slides `bend`, vibrato `vib`, harmonics `harmonic=True`, sweeps with `P.strum`), xiao substitute (sampled flute, low octave, low-passed, breath noise following the envelope), big drum (`gran_cassa`) + `timpani`, `frame_drum` for footsteps, a small gong for the seal. F-gong pentatonic (F G A C D). Structure by cue, not by loop: free-time opening, 60 BPM for landscape, 90 BPM for travel (footsteps on beats), drum roll for the threat, **digital silence**, three glassy harmonics for three written strokes, silence again, then drum + seven-string sweep on the cut; the theme returns for the release; last note = seal.
- **Silence is literal**: zero the whole bus (music, ambience, reverb tails) in the silence windows with 20 ms fades; hard-cut ambience at the cut to silence. The only sounds allowed in silence: a single drip, the sword ring.
- **Foley follows material**: ink drop (short falling "tink" + soft wet thud), brush/sword air (band-passed noise with bristle grains, not a metal whoosh), footfall on water (small splash + plop + droplets), sword draw (scabbard scrape + long thin metallic ring, cut before the second silence), the cut (tearing air + river roar + low boom), ink splatter (dozens of tiny wet ticks), seal (dull wooden thump + paper crackle).
- **Voice**: calm British narrator (Kokoro `bm_george`, lang `en-gb`, speed .82–.86), 4–6 lines like colophon inscriptions — they do not explain the picture. Music ducked ~8 dB under voice; ambience ducked too (a river roar under a line made whisper hear "Halfway" as "This way"). Verify every line with whisper *and* re-check the final mix.

## 7. Subtitles & titles

- Subtitles are **inscriptions (题跋)**: Cormorant Garamond italic 500, 46 px, ink colour, 1 px tracking, max two lines, no box — placed in the empty paper of each shot (each shot defines its own subtitle position). A small vermilion square marks the start of each line. They appear "wet" (partly in the bleeding layer) and dry within ~0.35 s. Stay ≥ voice + 0.6 s and ≥ 1.8 s.
- Title: two vertical columns written on the scroll itself (moves with the pan) + seal; fades in wet → dry and evaporates when the pan starts.
- End card: the whole scroll on a dark table with silk borders and rollers; "CHINESE INK WASH" (Cormorant SC 600, 44 px, 14 px tracking) and the credit line (italic 30 px) in pale paper colour below.

## 8. Pitfalls we hit

- Dry brush looked like dashed lines → bristle breaks must use long-scale noise and an ink load that decreases along the stroke.
- Parallel semi-transparent strokes made robes look like organ pipes → one base mass + two loaded strokes.
- Big side-brush strokes at large scale look like a hairbrush (every bristle visible) → use a mass with a gradient plus fewer, low-dryness strokes; keep bristle strokes for smaller widths.
- Mountain gradients drawn in vertical bands left seams and hard bottoms → per-pixel mountain layer, cached.
- Splitting stroke body between wet and dry layers lowered the density (union < alpha) → `solid` mode draws the full body in the dry layer plus a wet halo.
- Clipping calligraphy with the font outline caused notches → use the font only as a skeleton.
- Character strokes regenerated on twos flickered → normalized-arc-length noise with a fixed `gapLen`.
- Subtitles inherited the world camera transform in panning shots and slid off screen → always reset the transform when drawing screen-space overlays (subtitles, seal on posters).
- A cliff drawn with `flip=-1` put the figure in mid-air; the back of a cliff polygon showed a straight vertical edge; a rock's base was cut by the layer canvas bottom → compute screen extents after flipping, slant the back side, fade layer bottoms with a `destination-in` gradient.
- The cut began splitting the wave while the stroke was still crossing the frame → start consequences after the stroke ends.
- A scene with rare, heavy per-pixel steps can exceed Playwright's default screenshot timeout; just retry the still render (the frame itself is deterministic).

## 9. Production recipe (this repo)

```
styles/ink-wash/demo/
  ink.js     brush engine (strokes, bristles, masses, blots)   comp.js    WebGL rice-paper compositor (bleed, edge, paper, bloom)
  hero.js    xieyi figure rig + poses                           face.js    close-up face (one use)
  land.js    mountains, cun, cliffs, pine, reeds, ripples       wave.js    gestural wave
  glyph.js   "水" traced from Ma Shan Zheng + the cut stroke    seal.js    vermilion seal
  world.js   the handscroll world, reveals, shots 1–2           cross.js   crossing + rising (shots 3–4)
  climax.js  silence, writing, the cut (5–6)                    passage.js parted river, bow, scroll, end card (7–8)
  story.js   timeline (single source of truth)                  shots.js   dispatcher, transitions, subtitle spots, sound events
  subs.js    inscription subtitles   music/score.py  original guqin score   mix.py  foley + voice + music   build.sh
```

1. Write `story.js` times first (voice durations from `core/tts/tts.py`), then brief the score with the same numbers (the composer can run in parallel).
2. `node core/render/still.mjs styles/ink-wash/demo --range a:b:1` + `core/render/sheet.py` for overview sheets; `?test=sheet|pose|shui|frame` pages for design work; `?nosub=1`, `?poster=1`.
3. `node core/render/events.mjs` → `mix.py` → `video.mjs --fps 24 --workers 3` (1152 frames ≈ 60–130 s) → `mux.sh … 24 0` (grain 0: the paper is in the shader).
4. Or simply `sh styles/ink-wash/demo/build.sh`.
