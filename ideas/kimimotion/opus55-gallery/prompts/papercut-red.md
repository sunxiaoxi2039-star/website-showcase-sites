# Red Paper-cut — Style Prompt

> Chinese window-flower paper-cuts brought to life: jointed red cut-outs on rice paper and indigo night paper, where the cut *is* the drawing and the holes are where the light gets in.
> Demo: *Nian Comes to Town* (49 s) · `papercut-red.mp4` · source in `demo/`

You are directing a 30–60 second film in the **Red Paper-cut** style. The user gives you a topic (and maybe a story). You decide everything else — story, shots, timing, music, sound — and deliver a finished film. Follow this guide.

---

## 1. What this style is

Every visible thing is **a piece of paper that was cut with scissors** and laid flat on another sheet of paper. There is no painting, no gradient shading, no outline stroke: detail, volume and expression come only from **what was cut away**. Red paper is the hero material; backgrounds are paper too (warm rice paper by day, deep indigo paper by night). Characters are **jointed cut-outs** (head, torso, upper and lower limbs pinned at rivets) animated in hard 12 fps steps, like the classic Chinese cut-paper films.

Learn the grammar of **folk window flowers** (Shaanxi / Yuxian): sawtooth (锯齿纹), crescent (月牙纹), cloud and swirl (云纹 / 旋涡纹), fold-symmetric rosettes (团花), and the difference between *yin* cutting (lines cut out of a red field) and *yang* cutting (a red line network left standing in an open field). Learn the jointed-figure animation and profile acting of the 1958–59 Shanghai Animation Film Studio cut-paper shorts. **Do not** copy any studio character, any named artist's work, or any real motif sheet — generate all patterns from code.

Keep it distinct from shadow puppetry: no light behind a screen, no translucent dyed hide, no rods. Here the paper is **front-lit and opaque**; backlight is a special event you save for the climax.

## 2. Story: what fits this style

Pick stories where **the craft of cutting paper is the plot**. Paper-cut has five native powers — use at least three, and make at least one the *cause* of the ending, not decoration:

| Native power | Story use |
|---|---|
| **Fold – cut – unfold** | Fold a sheet 2/4/8 times; one cut becomes many. *One lantern cut in the wedge = eight lanterns in the rosette = eight houses lit.* Put the unfold on the strongest beat. |
| **Holes are light** | A cut-out pasted on a window, lit from behind: the paper glows deep red, every hole glows gold, and the pattern is projected onto the world. Light has the shape of the pattern. |
| **Symmetry replicates** | A mirrored motif can peel off and multiply: rosette → window flowers → fireworks (a firework is just a small rosette unfolding in the sky). |
| **Scraps have a future** | The bits that fall while cutting come back later (as firecrackers, snow, confetti). Setup / payoff for free. |
| **Everything is one flat sheet** | Mountains and monsters share the same sawtooth — a ridge can stand up and be a beast. End on a **scale reveal**: the whole film was one window flower on a real window. |

Adapting any topic: find the **one thing that gets cut**, and make its *unfolded* form the answer. A product launch → the product's silhouette is folded into a wedge and unfolds into a pattern of all its uses. A love story → two figures cut from one folded sheet (a mirrored pair). A city → one house cut in a folded strip unfolds into a street.

**Emotional arc (40–55 s):** cold open on the scissors (0–3 s) → title → peaceful world → threat (the world goes dark / silent) → a quiet decision → **fold–cut–unfold** on the downbeat → the pattern becomes light and fixes the world → dawn → scale reveal.

## 3. Visual language

### Paper
- **China red** `#d2201f` for heroes and window flowers (brief range `#c8102e`–`#d7261e`). The monster / antagonist one step deeper: `#b00f26`. Near limbs one step brighter (`#c4162c`), far limbs one step darker (`#8a0c20` / girl `#b8191b`) — layered paper, not shading.
- **Rice paper** `#f2e8d0` (long fibers + cloudy density), **night paper** indigo `#1c2446`, **ink sky** `#0f142a`, **gold foil** `#d9a93f` only at the end (sun, title flecks).
- **Night rule (important):** all background layers (far hills `#1f2a55`, near hills `#29356e`, houses `#35457f`, trees `#28346c`, snow `#7a88ba`) are *indigo papers*. Only window flowers, lanterns and the protagonists are red. If background and hero are both red, the cut-out silhouettes stop "popping" (we got this wrong at gate 1).
- **Day rule:** rice-paper sky, red houses, far hills as a paler red `#e0877f`, mid hills `#cf4f4a`.
- **Paper grain:** a tileable neutral-grey texture applied with `soft-light` inside each piece (dye mottling ±7% at ~130 px, fibers, dark specks), then the piece's own alpha restored with `destination-in`, so holes stay holes.
- **Cut edge:** every silhouette is sampled to a polyline and wobbled (≈0.35 units, low frequency along the arc) — hand-cut irregularity. A 1 px light rim on the upper-left of every edge and a dark rim on the lower-right (the paper's cut face). Architecture uses straight segments + wobble, *not* smoothing (smoothing turns houses into bread loaves).
- **Paper thickness:** each piece casts a tight soft shadow on the layer below (offset 2.6/3.6 px, blur 5 px × zoom, `rgba(52,6,10,.38)`). Stacked folded paper shows 2–6 offset darker edges.

### Cutting grammar
- Figures: **red block + yin lines**. Every figure piece gets an **inset contour** (a 1.5-unit slit 3.5 units inside the outline) — the classic double outline, and it separates red-on-red overlaps (arm over coat).
- Motif library (all in `demo/motifs.js`): `sawRow` (row of thin triangular holes = fur, grass, tiles, fringe), `sawEdge` (serrated silhouette), `crescent` / `crescentRows` (scales, quilting), `swirl` / `doubleSwirl` (animal joints), `cloudCut`, `rosette` (cheek flowers), `plum`, `coin`, tapered slits.
- **No floating islands.** A closed ring cut would drop its centre out of real paper. Eyes are two crescents (upper and lower lid) that leave bridges, plus a pupil *hole*.
- Faces never morph: expressions are **swappable face pieces** (smile ∩, surprise, scared, determined almond eye, asleep ∪).
- The **团花 rosette** is designed as one 45° wedge and mirrored 8× (D4). Its middle ring is *yang* cut (band cut away, red lines left: lanterns, ruyi scrolls on the fold lines, sawtooth on the ring edges); inner and outer rings are *yin* cut. Fold seams leave faint crease lines — keep them, they are true to the craft.

### Light
- Front-lit scenes: paper as is. Night scenes: `frame × lightmap` (ambient ~`rgb(214,214,236)` — mild, the papers are already dark) + warm pools around lit windows, then **emissive** backlit windows on top (light field × paper transmission via `multiply`; holes stay at full light), then a two-level bloom (half-res blur 10 px / 40 px, strength ≈0.55) and optional zoom-blur rays from the window.
- **Backlit window flower:** radial light `#fff6d6 → #ffc46e → #ec782e`, rice-paper fibers multiplied at 50%, the rosette's transmission sprite in `#b51d18`. Keep bloom moderate — the pattern must stay legible at the centre.
- **Projected pattern:** the rosette's hole mask, squashed onto the ground (`[1.25,0,-0.9,0.3]`) and added with `lighter`; on a character it is **masked by that character's layer alpha** and added on top of a solid warm spot, so the lit face is brighter than paper and the cut eye / tears read as dark holes.

## 4. Motion language

- **Characters step at 12 fps** (pose sampled at `floor(t·12)/12`); **camera, light, snow, flames and flying lanterns move on ones** at 24 fps.
- Rigs: girl = head, coat, 2 × (upper arm, forearm+hand), 2 × (thigh, shin+shoe), scissors (2 blades on a rivet). Monster = body, head (big, ×1.32), jaw on a hinge, mane, tail, 4 × (upper leg, lower leg+paw). Rivet points: neck, shoulders, elbows, hips, knees, jaw, tail.
- Hard poses, tiny eases, 1-frame overshoots ("pop" = 1.15× for one step). Weight comes from **size and camera shake** (every monster footfall shakes the frame ~6 px, decaying in 0.3 s).
- In profile, a raised near arm crosses the face — keep hands forward of the face or let a prop (the rosette) cover them.
- **Folding** (the key move): the flap is split into 16 strips along the fold normal; each strip is compressed by cosθ and enlarged along the fold by `1 + 0.28·height` (fake perspective), darkened as it stands up, shown in the lighter back colour `#de3b30` once past 90°, with a shadow that grows with lift and a crease line after. Each fold ≈0.55 s on a woodblock hit.
- **Cutting:** the camera follows the scissor tip at ~32%. The cut pattern is revealed through a mask of circles along the scissor path (r ≈62 units), plus the whole offcut corner is removed once the outer edge has been passed; blades open/close every 0.25 s (each snip = one eighth note); scraps flutter out and land.
- **Unfolding:** three unfolds 0.25 s apart, each flap swinging from s = −1 (folded) to +1 with ease-out — the "pa!" snap — then a scale bump and warm flash on the downbeat.

## 5. Camera language

| Beat | Camera |
|---|---|
| Cold open | Extreme close-up of the scissor blades biting red paper, tracking the tip; the cut-off sheet flies away to reveal the title |
| Title | Flat front view; red cut letters pop in on 12 fps steps; exit by a **page turn** (right half folds over) revealing the next scene |
| World | Slow pan across three paper layers (hills / village / snow), ending in a push to the hero's lit window |
| Threat | Low wide; the sawtooth ridge stands up — the monster rises *behind* the far hills and towers over the village |
| Memorable shot | From a dark room: a giant eye slides into the window lattice and blinks |
| Decision | Medium close-up, props pop on the three spoken words |
| Native move | Top-down tabletop; fixed during folds, following the scissors during the cut, pulling out for the unfold |
| Payoff | Push on the glowing window, pull back to the whole village as lanterns fly to every house; close-up of the monster dazzled |
| Dawn | The night sheet **peels off** from the corner to reveal the day sheet underneath |
| Ending | Pull back until the whole scene is a round window flower on a wooden lattice window, sunlit, scissors on the sill; couplets and banner drop in as the end card |

## 6. Sound

- **Music:** a bright festive Chinese chamber ensemble, *not* piano/strings and *not* the opera percussion of shadow puppetry: pipa (physical model, tremolo on long notes), zheng (`dan_tranh`: broken chords, glissandi, tremolo), erhu, flute as dizi, woodblock, small/big gong, frame drum. D gong pentatonic, 2/4 at 120 BPM, a 4-bar original theme. Threat = low frame-drum heartbeat + erhu glide; **total silence** for the eye-in-the-window and the breath before the unfold; **tutti + big gong on the unfold downbeat**; eight rising zheng notes = eight windows lighting.
- **Foley follows the material:** scissors = metallic shear sweep (2.5–9 kHz) + 3.8 kHz ring + a paper-fibre crack; folds = paper swish + crease tap; unfold = sharp paper snap; monster steps = *cardboard* thud (55 Hz + low noise), not flesh; candle = match strike + soft whoomp, snuff = puff; firecrackers = dense clicks at 20–60 ms, accelerating, with occasional low booms; fireworks = rising whistle + boom + crackle; dawn = a long paper peel; two bird chirps.
- **Voice:** a warm grandmother storyteller — Kokoro `af_sarah`, speed 0.9, 4–6 lines. Duck music ≈9 dB and foley ≈3 dB under the voice; keep foley impacts out of the voice windows. Folk names get an `asr` alias in `lines.json` ("Nian" is heard as "Nyan"/"Nion" — the correct pronunciation, so accept it).
- Mix to −14 LUFS, **no film grain** (the paper fibres are the texture).

## 7. Subtitles & titles

- **Subtitle = a red paper banner (横批):** a deep red strip `#a8111f` (darker than the picture's reds so cream text holds), serrated top and bottom edges, swallow-tail ends, gold flecks, a small cut rosette as the bullet; Fraunces SemiBold 44 px, cream `#fff1d6`; centred 70 px from the bottom with a paper shadow. It "drops" into place in two 12 fps steps like a couplet being pasted. Hold ≥ voice + 0.7 s and ≥ 1.8 s; never overlap.
- **Title:** red paper cut-out letters (yang-cut, counters are real holes) on rice paper, Fraunces 800, popping in letter by letter on 12 fps steps; sawtooth border strips; a red seal (the character 年 cut as a hole); an italic subline.
- **End card:** couplet strips slide in beside the window, a red banner with cream cut letters "RED PAPER-CUT" drops in above, credit line "LemoLab × Claude Opus 5.5" below in ink.

## 8. Pitfalls we hit

- **Red on red.** Red houses and hills with a red hero read as one blob. Make the background indigo at night; use near/far paper tones and inset contours for overlaps.
- **Overwriting a piece's `h`.** Piece objects use `x0,y0,w,h` as the drawing box — storing wall height in `p.h` stretched the house.
- **Smoothing architecture** rounded rectangles into loaves: use straight-segment polylines for buildings.
- **Darkening one layer through the light map** also darkened what covers it (ghost legs visible through snow). Tint the layer itself (multiply + restore alpha) instead.
- **`put()` uses `setTransform`**, so it ignores an enclosing `translate`; pass absolute matrices.
- **A flat cos-squashed flap reads as a sliding card**, not a fold. Split it into strips with fake perspective, darken as it stands up, and show the back colour.
- **Cut reveal showed the uncut stack through the holes**: draw stack thickness inside the "uncut" mask only, and give the cut part its own offset copies.
- Folding-scissors pointing backwards: the blade axis must be the direction of travel, with the rivet a little behind the cutting point.
- A projected pattern centred on the monster's eye hid the eye; centre it on the snout and add a solid warm spot so the squint and tears read.
- Blank frames between shots: overlap the flying sheet of the cold open with the title card.
- Test-mode pages must not throw to stop the module (the render harness exits on any page error); guard the `window.render` assignment instead.

## 9. Production recipe (this repo)

```
styles/papercut-red/demo/
  paper.js    paper textures, piece builder (fill, cut, inset, edge, grain), shadows, transmission
  motifs.js   folk pattern library          rig.js      2D affine rig helpers
  girl.js     jointed girl + face pieces     nian.js     jointed monster + eye pieces + poses
  tuanhua.js  8-fold rosette (one wedge × D4) village.js  houses, hills, plum tree, snow, lanterns
  light.js    night lightmap, backlit windows, bloom, rays, masked projected light
  world.js    village layout (night/day palettes) + lighting pass
  fold.js     fold – cut – unfold sequence   hud.js      subtitle banner, cut-letter text
  story.js    timeline (single source of truth, 120 BPM)   main.js  shots, cameras, events
  sheet.js / climax.js / test.js   model sheets and gate-1 style frame (?test=sheet_girl | sheet_nian | frame)
  lines.json  voice script   music/score.py  original score   mix.py  foley + voice + music   subs.py  srt
```

1. `node core/render/still.mjs styles/papercut-red/demo <t…> [--q nosub=1]` — review stills; `?test=sheet_girl` etc. for model sheets.
2. `.venv/bin/python core/tts/tts.py lines.json voices` → `core/tts/asr_check.py` until all OK.
3. `node core/render/events.mjs` → `music/score.py` → `mix.py` → `subs.py`.
4. `node core/render/video.mjs styles/papercut-red/demo --fps 24 --workers 3` (1176 frames, ~30 s).
5. `sh core/render/mux.sh out/video24.mp4 mix.wav papercut-red.mp4 24 0`, then `check_final.py` (per-line whisper on the final mix + blackdetect).
Or simply `sh styles/papercut-red/demo/build.sh`.
