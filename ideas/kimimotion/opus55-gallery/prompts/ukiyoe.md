# Ukiyo-e — Style Prompt

> Edo-period woodblock prints brought to life: flat colour blocks, carved ink lines, Prussian blue, bokashi skies, paper you can feel — and a camera that moves over the print like an unrolling handscroll.
> Demo: *Toward the Mountain · 山へ五景* (44 s) · `ukiyoe.mp4` · source in `demo/`

You are directing a 30–60 second film in the **Ukiyo-e** style. The user gives you a topic. You decide story, shots, timing, music and sound, and deliver a finished film. Follow this guide.

---

## 1. What this style is

Every shot is **a complete woodblock print**: a sheet of washi, a thin double ink border, flat areas of colour printed from separate blocks, a black key-block line on top, a vertical title cartouche and a red seal. The world is flat on purpose. Depth comes from stacked horizontal layers, mist bands and bold cropping — never from perspective rendering, lighting or shading.

What makes it read as *printed* rather than *vector*:
- **Paper** is always visible: warm washi, long fibres, slight edge ageing.
- **Each colour is its own block**, slightly **out of register** (1.5–2.5 px) with the key line.
- Large colour areas show **woodgrain** and **baren rubbing** (uneven ink density, circular streaks) and fine **goma-zuri** specks.
- **Bokashi** — hand-wiped gradients — in skies and water.

Never reproduce a specific famous print (no copy of *The Great Wave*, *Red Fuji*, *Sudden Shower over Ōhashi*). Learn the grammar, draw your own compositions.

## 2. Story: what fits this style

The medium has five native powers. Build the film on at least three and put the strongest at the emotional peak.

| Native power | Story use |
|---|---|
| **A series of views** (Hokusai's 36 Views, Hiroshige's 53 Stations) | One constant subject seen in different compositions — the story is told by *where it sits in the frame* each time (tiny on the horizon → framed by a window → dwarfed by a wave → filling the sheet). |
| **The handscroll** | Scenes don't cut; the camera slides along a long scroll **right to left** (the real reading direction) and the next print arrives from the right. Speed up the slides to accelerate the story. |
| **Printing, block by block** | A scene can *appear* the way a print is made: key line first, then each colour block lands (slightly off, then snapping into registration) with baren-pressed, uneven ink. Use it to open, and to be reborn. |
| **Paper is the white** | Foam, snow, mist and blank sky are all unprinted paper. A wave's foam can fill the frame and literally wash the print back to a blank sheet. |
| **The frame is an object** | The border line, cartouche and seal are physical. Something big enough (a wave, a dragon, a mountain) can **break out of the border** into the mounting paper — the medium's own "fourth wall". |

Adapting any topic: make it **a journey or a series** with one constant subject. A product launch → five views of the product in five places. A city → a day in five prints. A life → five ages, the same tree in every print.

**Emotional arc (40 s):** jo-ha-kyū (序破急) — slow, open, still (jo) → gathering pulse (ha) → rapid rush to a peak (kyū) → a hard cut to silence (ma, 間) → a quiet resolution and a scale reveal. One character, one goal, one turn.

## 3. Visual language

**Canvas & sheet.** 1920×1080 sheet = screen at zoom 1. Ink border at `x 44–1876, y 38–1042` (3.4 px) plus a thin outer line 9 px outside; paper margin beyond. Sheets sit on a long mounting scroll (`#c9b690`, 260 px gaps) with a wooden roller at the left end.

**Palette** (use these, not generic "Japanese" colours):

| Name | Hex | Use |
|---|---|---|
| Paper | `#eee2c6` | washi base (with ±3% mottling, fibres `#fbf6e9` / `#c7b893`) |
| Prussian blue | `#1d3a66` · dark `#13284a` · light `#4d6f98` | skies, water, mountain, wave |
| Deep trough | `#0f2344` | inside of the wave |
| Pale blue | `#8db0c6` · `#bcd0d6` | water reflections, lower sky |
| Sumi (key block) | `#231f1c` | all key lines |
| Beni red | `#b8412f` · pale `#e3a08a` · peach `#efc4a8` | sun, felt bench, seals, dawn bokashi, cartouche tab |
| Ochre / straw | `#cf9f4a` · `#c9a45c` | hats, roads, obi |
| Greens | `#8aa152` · dark `#50703c` · pine `#3e5a3a` | fields, trees |
| Indigo cloth | `#2c4a70` · gaiters `#1d2c44` | clothing |

**Blocks.** Draw each colour group into its own offscreen canvas ("block"), cached once:
`g0` key lines · `g1` blues · `g2` greens / secondary · `g3` reds / figures. Composite with fixed registration offsets `g1 (2.2,−1.3)`, `g2 (−1.8,1.9)`, `g3 (1.5,2.2)`. On each colour block apply, in this order: woodgrain `source-atop` α≈0.1–0.17 (sky/water strongest), baren streaks `destination-out` α≈0.38 (0.2 on dark wood), goma-zuri specks `destination-out` α≈0.3. Key block: specks only (α 0.12). Over the finished sheet draw light fibres (α≈0.09) so paper shows through the ink.

**Woodgrain** = iso-lines of a warped noise field (`u = y·0.035 + fbm·9 + knots`), thin dark lines where `|frac(u)−0.5|>0.4` plus broad tonal bands. **Baren** = ~260 blurred circular arcs + zigzag streaks. Dynamic big fills (a wave) get the same textures inside their clip (woodgrain + paper-coloured baren overlay).

**Bokashi** is generated per pixel (a gradient whose top edge wanders by low-frequency noise per column, ±20–30 px) — never strips of `fillRect`, which leave vertical seams.

**Line.** Key lines 2.4–3 px; large contours (mountain, wave, trunks) are variable-width filled strokes, tapered at both ends, with ±20–35% low-frequency width jitter. Distant things (a mountain in rain) get a grey key line or none.

**Motifs (how to draw them):**
- *Mountain*: asymmetric concave slopes (`y = s^1.55` left, `s^1.8` right), a notched summit, snowcap as **drips down the gullies** — 12 fingers of random depth (some long), narrow and pointed, joined by a gently wavy snow line; right-side shade band; pale beni glow on the snow at dawn.
- *Mist (suyari-gasumi)*: long rounded bands, flat colour, fading at both ends and softly toward the bottom.
- *Pines*: bent trunk with bark scales, branches ending in flat-topped **needle pads** (scalloped top edge with fans of needle strokes, flat bottom line).
- *Fields*: high, flat, parallel layering — horizontal dikes with slowly increasing spacing and gentle waves; the cross dikes are **parallel and slanted**, not converging to a vanishing point; dike line widths vary.
- *Rain*: two sets of straight fine lines at slightly different steep angles over everything; heavy sumi bokashi at the top of the sky.
- *The wave*: normalised outline (back slope → crest → forward lip → curl → hollow front). Body in **three blue bands with bokashi between them** (light blue by the crest → Prussian → deep trough), made from thick strokes of inward offsets of the back-slope curve; **grouped white flow lines** (3 lines per group, broken into long arcs). Foam rim along the crest; **fractal claws**: each big claw splits into 3 fingers, each finger splits again, all tips hooking inward; a pale-blue back layer offset behind the white front layer; spray in **clusters** (one big dot, a few medium, many small).
- *Claw roots* must grow **out of** the foam: taper the root to ~40% width, then bury it in irregular white foam blobs (stroke all blobs first, then fill all → one union outline). Claws stuck straight onto the crest read as planks.
- *Cartouche*: vertical, cream `#f3e7c6`, thick + thin ink border, a pale beni tab on top with the series title, the view title below in a brush font; a red seal (white characters cut out of red, chipped edges) below or beside it.
- *Figures* are small in the landscape (80–130 px), flat, with a big hat and clear silhouette. Side-view traveler: low conical kasa hiding the upper face, tucked-up kimono with the back corner tucked into the obi, dark gaiters, straw sandals, staff, bundle knotted at the chest. Close views: shaved pate (pale blue-grey), folded topknot, one-stroke eye.

## 4. Motion language

- Prints are still. **Most of the frame does not move**; each view has one or two small actions (hat strings in the wind, seedlings swaying in rows, rain, a boat, steam, a lantern, a falling leaf).
- **Figures and nature step at 8 fps**; rain and wave claws at **12 fps**; **the camera moves on ones (24 fps)**. Stepping the camera looks like judder.
- **Printing reveal**: each block appears over ~0.34 s with a diagonal baren sweep whose edge is blotchy (noise), sliding 5–6 px into registration as it lands.
- **Transitions are scroll slides** (eased), getting faster: 1.0 s → 0.9 s → 0.6 s. Cartouche drops in (fade + 14 px) and the seal *stamps* (scale 1.35→1 over 0.2 s).
- The climax gets the **only big camera move** of the film, and it needs time — play it in four beats (~4.5 s total):
  1. **Rise** (~1.9 s): the sea swells into a wall; the camera tilts up past the top border and widens slightly so the figure shrinks.
  2. **Hang / 亮相** (~1.2 s): the crest stands outside the border in the mounting paper, claws open and nearly frozen (jitter ×0.25) — the whole print is visible as an object. The drum roll peaks, then an 80 ms silent intake of breath.
  3. **Fall** (~1.2 s): the lip lengthens and rotates down toward the lens, claws grow ×2.5, camera pushes to 3× with a small roll.
  4. **Foam** (~0.7 s): fractal claws burst from the lip to fill the screen, fade to bare paper → hard cut to silence (ma).

## 5. Camera language

| Beat | Camera |
|---|---|
| Opening | Locked on a blank sheet; the first print is printed block by block in front of us |
| Early views | Locked frame, like reading a print on a wall. The subject is small |
| Middle view | A very slow push (1.00 → 1.065) toward a framing device (round window) |
| Transitions | Handscroll slide right → left through the mounting gap |
| Climax | First big move: tilt up past the top border into the mount, push in; then crash-zoom into the foam |
| After the climax | Hard cut to a blank sheet — hold (間) — then reprint |
| Ending | Pull back from the last print to reveal the whole scroll: every view side by side (scale reveal); end card on the scroll |

Keep subtitles clear of the figure (bottom band ~80 px from the edge; move the figure up if needed).

## 6. Sound

- **Music: jo-ha-kyū** on Japanese instruments — **shamisen** (`pluck.py shamisen` with sawari buzz), **shakuhachi**, **taiko**, **hyōshigi** (wooden clappers). No piano, no string pads.
  - Hyōshigi claps accelerate over the opening printing (one clap per block) — the kabuki curtain call.
  - Shakuhachi in free rhythm, *miyako-bushi* scale (D E♭ G A B♭), long tones with breath, a slide up into each note and *meri* drops at phrase ends.
  - Shamisen: slow pulse (72 BPM), then an ostinato (96 BPM) with a small tight drum; a fast rising run on the fastest scroll slide.
  - Taiko heartbeat that accelerates from 0.9 s intervals to a roll for the climax; one full hit on the crash; then **absolute silence** (cut the reverb tails too). Four big taiko strokes reprint the last view. The opening shakuhachi motif returns and resolves; a long shamisen note with sawari rings out under the end card.
  - Shakuhachi from samples: `flute`/`recorder`, flatten amplitude and pitch vibrato (divide by a 60 ms envelope; f0-track and counter-warp), add 1–4 kHz breath noise locked to the envelope, a *muraiki* breath burst on attacks.
  - Taiko from samples: `gran_cassa` + `toms:low_mallet` + `frame_drum:large` + a synthesized skin (pitch drop ~120→58 Hz) and a stick thud.
- **Foley follows the material**: paper (baren rub = band-passed noise with a ~9 Hz circular modulation; scroll slide; cartouche slip; seal = low thump + tacky peel), wood (block set down, hollow bridge steps, cup on wood), glass (wind chime partials 2.36 / 5.15 / 7.98 kHz), water (field trickle, rain bed with drops, sea swell every ~4 s), birds (lark chirps, geese, a kite's *pii-hyoro* on the last view).
- **Voice**: calm male storyteller, first person, 5 short lines (Kokoro `am_adam`, speed 0.84–0.88). Music ducks ~−8 dB under voice (−10 dB on the last line), ambience ~−4 dB. Loudness −14 LUFS, `mux.sh` grain **0** (the paper is the grain).

## 7. Subtitles & titles

- **Subtitle = a horizontal cartouche**: cream `rgba(243,231,198,.96)` slip, 2.6 px + 1 px ink border, a small red seal "旅" at the left, Shippori Mincho 500 42 px in sumi, centred 72 px above the bottom. It "prints" in over 0.22 s with the reveal mask and fades out over 0.25 s. Each line stays ≥ max(1.8 s, voice + 0.75 s).
- **View cartouche** (vertical, Yuji Syuku): series title on the pale beni tab, view number + name below (一 田毎の朝 · 二 雨の橋 · 三 茶屋の窓 · 四 海立つ · 五 山), seal below/beside — the "full stop" of each view.
- **Title**: a vertical cartouche 山へ五景 + a horizontal English slip *Toward the Mountain* laid on the first print, stamped with a seal, lifted away before the first line.
- **End card**: the whole scroll across the middle on dark indigo `#161a22`; title above, `UKIYO-E · a Lemo-Opuscar demo · LemoLab × Claude Opus 5.5` below, one seal (drawn `source-over`, not multiply, on dark backgrounds).

## 8. Pitfalls we hit

- Bokashi from 6 px `fillRect` strips leaves visible vertical seams → build it per pixel.
- Too much speckle / fibre overlay makes dark areas look like sandpaper or scratched film → specks α≈0.3, fibres α≈0.09.
- Flat fills without woodgrain + baren read as vector art. Put the textures on every colour block, and inside the clip of big dynamic fills.
- A regular perspective grid for rice fields looks digital. Use parallel, slanted, flat layering.
- A zig-zag snow line looks like a crown; smooth waves look like icing. Use narrow pointed drips of random length, and force control points to be x-monotonic (otherwise tiny self-intersecting loops appear).
- Pine clusters drawn as half-discs look like parasols → flat pads with needle fans.
- The first climax lasted 0.7 s and read as "some foam flashed"; the native move needs a ~1 s held beat to be read.
- First wave looked like a waterfall curtain (flow lines fanning from the base). Flow lines must follow the back-slope contour; body needs banded blues; claws must branch and hook inward — a single curled strip reads as a ribbon.
- Offset curves self-intersect at the tight lip → only use the back slope for inner flow lines.
- Drawing outside the print (the wave breaking the border) must escape **both** the sheet clip and the frame clip; clip the wave's sides to the frame so only the top breaks out.
- `mountain()` filled only when a flat colour was passed, so gradient bodies were transparent — watch option flags.
- A seal drawn with `multiply` vanishes on a dark end card or on the wave → `source-over` there.
- Figures on a foreground tree read as "in front of" it; keep low branches clear of the walking path.
- Ink reveal from pure noise looks like mould spreading → combine a directional (diagonal) sweep with noise on the edge.
- The subtitle band covers anything in the bottom 150 px — raise ground lines / figures.

## 9. Production recipe (this repo)

```
styles/ukiyoe/demo/
  print.js     paper, woodgrain, baren, specks, blocks, bokashi, carved lines, reveal masks, cartouche, seals
  nature.js    mountain + snow drips, pines, rocks, rain, geese, simple claws
  traveler.js  the traveler (walk / stand / hold hat / straw cape / sit & drink / back view / hat off)
  views.js     the five prints: cached blocks (g0–g3) + per-frame paint()
  wave.js      sea rows, wave geometry, banded body, fractal claws, spray clusters
  story.js     the timeline (single source of truth)     main.js  camera, scroll, sheets, reveal, titles, subtitles, events
  lines.json   voice   music/score.py  original score   mix.py  foley + voice + ducking + the silent ma   subs.py  cues → srt
  build.sh     one-command rebuild
```

1. `node core/render/still.mjs styles/ukiyoe/demo <t…>` (`--q nosub=1`, `--q test=trav` for the character sheet, `--q poster=1`).
2. `core/tts/tts.py lines.json voices` → `core/tts/asr_check.py`.
3. `node core/render/events.mjs styles/ukiyoe/demo` → `music/score.py` → `mix.py`.
4. `node core/render/video.mjs styles/ukiyoe/demo --fps 24 --workers 3` (1056 frames ≈ 45 s, Canvas2D).
5. `core/render/mux.sh out/video24.mp4 mix.wav ukiyoe.mp4 24 0` → `check_asr.py ukiyoe.mp4`.
