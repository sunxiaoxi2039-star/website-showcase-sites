# Glass Product Render — Style Prompt

> Launch-film product rendering in transparent and frosted glass: dark-field studio, strip-light sweeps, dispersion, caustics, slow exploded views that snap shut on the drop.
> Demo: *Aura — Hear the Light* (32s) · `glass-product.mp4` · source in `demo/`

You are directing a 30–60 second film in the **Glass Product Render** style. The user gives you a topic (usually a product, sometimes an idea). You decide everything else — story, shots, timing, sound — and deliver a finished film. Follow this guide.

---

## 1. What this style is

A single hero object made of **glass, metal and light**, floating in an infinite black studio. The look is borrowed from premium product launches and **dark-field glass photography**: the background is black, the lights are long strips placed *behind and beside* the object, so clear glass turns into a thin white outline with rainbow edges and the internals show through as if in a display case. Everything moves slowly and precisely; every cut, sweep and pulse lands on the beat.

The object is always **fictional**. Never reproduce a real product silhouette (no stemmed earbuds, no famous phone outlines), a real brand name, logo, typeface or UI.

## 2. Story: what fits this style

Pick stories where **the material itself tells the story**. Glass-and-render has six native powers — use at least four:

| Native power | Story use |
|---|---|
| **Transparency** | "Nothing to hide." The inside is the hero: show the mechanism through the shell, rack focus from the surface to the part inside. |
| **Lensing** | A thick glass dome magnifies and bends what is behind it — macro shots through the lens feel like looking into a jewel. |
| **Dispersion** | Thick edges split light into rainbow fringes; a sweep crossing an edge becomes a moving spectrum. |
| **Light that travels inside** | Light guides, channels, rings: energy (sound, data, charge, heat) becomes light running *inside* the object. |
| **Caustics** | The object throws focused light onto the floor; a pulse inside becomes a ring spreading across the ground. |
| **Exploded view** | The object comes apart in slow motion, parts float and turn, then **snap back on the drop**. Deconstruction → reassembly is the emotional turn. |

Adapting any topic: find **the invisible thing the product does** and make it visible as light inside glass. Headphones → sound becomes light pulses. A battery → charge fills a glass cell. A watch → time as a light ring. A router → data as light threads. A perfume → scent as caustics.

**Emotional arc (30–40s):** lit from outside in the dark (mystery) → opened (curiosity) → seen through (intimacy, macro) → taken apart (suspension, total silence) → **snaps together on the drop and lights up from inside** (release) → confident rhythm → returns home (settle, echo). One object, one goal (to emit its own light), one turn (reassembly).

**Bookend:** open with a light sweep revealing the dark object; end with the *same* sweep over the object that now glows by itself.

## 3. Visual language

- **Studio = a strip-light scene, not an HDRI.** Photo-studio HDRIs contain windows and clutter that print as messy streaks on glass. Build a tiny black scene with emissive planes and bake it to PMREM **every frame** (`pmrem.fromScene(env, 0, 1, 1000)`, dispose the previous RT):
  - left & right tall strips behind the object (22×170, ×3.2) — outline the silhouette
  - a wide horizontal strip far behind (260×14, ×1.4) — horizon rim
  - a soft top box (160×70, ×1.1) — volume for frosted glass and metal
  - a weak low front card (×0.18; switch to 0 when a concave glass surface faces camera, it prints as a grey rectangle)
  - a top-front key box (150×60, ×2.5) only for exploded views
  - **the sweep**: a tall strip (26×240) moving on an arc *behind the camera* (azimuth = camera azimuth + π, ±1.35 rad). Because it is real geometry in the env, the highlight band, refraction and dispersion all move physically.
  - an accent card tinted with the light-guide colour, intensity driven by the pulses (off when a big concave glass surface is in shot).
- **Clear glass**: `MeshPhysicalMaterial` transmission 1, roughness 0.015, IOR 1.52, thickness 3–4.5 (thicker = stronger lensing), **dispersion 5** (three r163+), attenuation near-neutral `#f3f8fb` at 160 mm. `side: DoubleSide` so other glass sees its back faces.
- **Frosted glass**: transmission 0.82–0.9, roughness 0.4, milky tint `#eef2f5`, thickness 7–14. On black it reads as dark grey plastic unless **something bright is behind or inside it** — put an opaque emissive disc inside (it gets blurred into a soft internal glow) and/or a bright background gradient behind.
- **Metals**: satin titanium band (rough 0.16), mirror-chrome magnet (0.14 — 0.05 blows out to a white disc), brushed steel and champagne diaphragm with a concentric-brush roughness map, graphite PCB with gold traces. These are what make the transparency worth looking at.
- **One accent colour for light**: ice blue `#62DCFF` → soft violet `#A98BFF`. Everything else is neutral.
- **Light guides**: opaque (anything *inside* transmissive glass must be opaque — three.js only renders opaque objects into the transmission buffer) dark polished acrylic `#15181b`, clearcoat 1, plus an emissive term injected via `onBeforeCompile`: **comet pulses** along `uv.x` — narrow Gaussian head (σ = w/2), exponential tail behind it (length 4w, 55%), a white-hot core (head³ × 0.35), hue drifting from blue to violet with age. Keep the idle base near zero; a uniformly lit ring reads as pale-blue plastic.
- **Background**: black, with an optional dark-grey radial sweep (`#34383d → #16181b → #000`) at 0–1.1 intensity; the floor fades into the same gradient so there is no horizon line. The sweep also separates glass edges from pure black.
- **Floor**: black glossy with a blurred mirror reflection (Reflector, 12-tap blur, ×0.32, radial fade) + procedural caustics: a lens-ring caustic with R/G/B radii offset (dispersion) + a warped Voronoi-edge filament net, plus expanding colour rings per beat.
- **Post**: 2× supersampling, physical depth of field (macro aperture 700–900, exploded view 70, wides 160–300), bloom only above 1.1 (strength 0.16–0.3), **Neutral tone mapping** at exposure 1.1 — AgX washes saturated blues to white.
- **Scale**: model in millimetres; camera near plane 1, macro distances 25–45 mm.

## 4. Motion language

- **Everything moves on ones** (24 fps), eased: `eio` for camera orbits, `eo` for parts decelerating into a float, `ei` for the snap back.
- **Camera always drifts**: slow orbits (0.2–0.4 rad per shot) or slow push-ins; never a locked-off frame, never handheld — except **two frames of micro-shake** on the snap.
- **Exploded view**: parts spread along the product's axis with offsets ~2× the product size in total, each with its own small deterministic tilt (`sin(i·1.7)·0.32`, `cos(i·2.3)·0.28`) and slow spin proportional to its offset. Timing: 3 s ease-out apart → 0.75 s hover (drifting +3%) → **0.25 s ease-in snap** exactly on the downbeat of the drop. Push the camera in by ~40% during the 0.9 s after the snap.
- **Magnetic lift**: objects rise out of cradles with a slight tilt toward camera (1.2–1.4 s, `eio`), and settle back upright.
- **Hovering pairs** turn 3/4 toward camera so the lens face and light ring are visible; straight-up they read as mushrooms.
- **Lids**: hinge at the back edge and stand upright behind the object (~100°), backlit into a glass halo. A lid lying flat reads as a pot lid.

## 5. Camera language

| Beat | Camera | Why |
|---|---|---|
| Open (0–4s) | Low 3/4 side, very slow push, ambient near zero; two sweeps | Only contours, no content — curiosity. Grab within 3 s. |
| Reveal structure | High 3/4, slow 40° orbit while the lid opens | Explain the object in one move |
| Macro | 25–45 mm away, rack focus from the glass surface to the part inside; a short sweep on every beat | Pulls the viewer *into* the glass |
| Profile | Side macro orbit | Material contrasts: clear / metal band / frosted / soft tip |
| Exploded view | 3/4, axis at ~40° to the view so parts form a diagonal with depth (near big, far small), spanning ~80% of frame, slow orbit for parallax | Technical beauty; parallax sells the depth |
| Hero front | Straight on, slight push | Declaration: the light ring complete |
| Pattern macro | Top-down macro on the light channels | The concept at maximum size |
| Pair | Medium two-shot, second object flies in on a downbeat | Stereo = left/right alternation |
| Caustics | High top-down on the floor | The most memorable shot: sound spreading over the ground |
| Hero end | Low 3/4, centred under the title, slow pull-back that makes room for credits | Name + slogan + product |

Cut only on beats (bar lines where possible). Product films do **not** need spatial continuity between shots: every shot is its own presentation stage — hide or move anything (the case, the other object) that doesn't serve the shot.

## 6. Sound

- **Music: minimal electronic**, never piano-and-strings. 120 BPM, minor key. Sub drone + glass shimmer for the dark open; FM glass-pluck arpeggio with a low-pass opening over the build; soft short kicks on every beat under the macro sweeps; noise + saw risers over the exploded view; **half a bar of total silence (reverb tails cut too)** before the drop; **808 drop** (sine with pitch envelope, long tail, soft saturation, occasional slides) with a syncopated pattern ([0, .75, 1, 1.5] per bar) that the light pulses follow exactly; clap on 2 & 4; a four-note glass-bell motif; a minor-9 pad for the reveal; a high glass ding on the final settle.
- **Every pulse, sweep and snap is locked to the score**: write the cue map first, share one kick list between the score and the renderer.
- **Foley follows the material**: glass shimmer for sweeps (band-passed noise sweep + inharmonic partials, panned with the strip direction), slow glass-metal friction for lids, magnetic clicks (sub-2 ms transient + 3.2/5.1 kHz metal resonances + low thump), air puffs for each exploded part, a long reverse whoosh inside the silence, and on the snap a cluster of six clicks 15 ms apart + an inharmonic glass chord (partials ×2.76, ×5.4).
- **Voice**: a restrained low male launch voice (Kokoro `am_michael`, speed 0.86–0.88), 3–4 very short lines. Avoid a product name alone ("Aura." is misheard as Laura/Dora) — use "Meet Aura." Duck music −12 dB and foley −6 dB under the voice.
- Mix: peaks limited ~3 dB at the drop so loudnorm can stay linear; −14 LUFS; **grain 0** (grain flickers on black and glass).

## 7. Subtitles & titles

- **Subtitles are a slab of frosted glass**: centred rounded bar 76 px tall, radius 38, filled with the live frame blurred (canvas `filter: blur(18px) brightness(1.25)` on the WebGL canvas, `preserveDrawingBuffer: true`) plus 10% cool-white, a 1.2 px gradient highlight stroke, and a thin blue→violet dispersion line on the top edge. Text: Inter Tight 300, 40 px, tracking 1 px, near-white. On screen ≥ 1.9 s and ≥ speech + 0.7 s.
- **Titles**: Inter Tight 200 at 112–132 px with very wide tracking (56–64 px), centred in the upper third; a diagonal light glint sweeps across the letters in sync with the sweep light on the object. Small tracked caps (18–20 px, tracking 8–10) for "A GLASS PRODUCT FILM", "MEET", credits.
- Lines that are the product name and slogan are **not** put in the subtitle bar: they are the title card itself.
- **End**: the title stays; credits (style name, `LemoLab × Claude Opus 5.5`) fade in at the bottom over a soft dark gradient while the camera pulls back to make room; fade to black in the last 0.6 s.

## 8. Pitfalls we hit

- **Reflector with a manually-called update used last frame's camera** → streaks across the floor, no reflections. Call `scene.updateMatrixWorld(); camera.updateMatrixWorld()` before updating the mirror.
- The floor mirror is an opaque object, so three's transmission pre-pass re-renders the reflection. Replace `onBeforeRender` with a no-op and update it once per frame yourself.
- **Anything inside glass must be opaque**; transparent objects are not in the transmission buffer and vanish behind glass.
- A cyan light strip inside frosted glass smears into a **teal cast over the whole object**. Keep internal emitters cool-white and dim; colour belongs to the light guide only.
- The idle glow of a light ring gets magnified by the lens dome into a pale-blue blob. Idle emission ≈ 0.
- **AgX tone mapping** desaturated the blue/violet pulses to white; Neutral kept them.
- Frosted glass on black = black. Needs an internal emitter or a bright backdrop.
- A mirror-chrome part facing a front softbox becomes a white disc; roughen to ~0.14.
- An exploded view seen perpendicular to its axis is a row of edge-on lines; turn the axis ~40° toward camera.
- Hovering earbuds seen straight-on read as mushrooms; a flat lid behind the case reads as a pot lid.
- A standalone product name is misheard by ASR (and viewers); give it a verb.
- An object rising "from below" through a visible floor is a continuity error; fly it in from the side.
- loudnorm fell back to dynamic mode (−13.7 LUFS) because the 808 peaks left no headroom; limit the drop peaks ~3 dB in the mix.

## 9. Production recipe (this repo)

```
styles/glass-product/demo/
  product.js   earbud + case geometry, glass/metal/guide materials, comet-pulse shader, explode()
  studio.js    strip-light env (PMREM per frame), sweep strip, background sweep, floor mirror + caustics + beat rings
  story.js     120 BPM timeline: shots, kicks, sweeps, VO, SFX events
  main.js      per-shot staging & cameras, light/pulse logic, frosted-glass subtitles, titles, end card
  music/score.py  original numpy score (stems + score.json self-check)
  mix.py       foley synthesis + voice + ducking → mix.wav
  lines.json · subs.py · check_mix.py · build.sh
```

1. Write the cue map and `story.js` first (BPM grid, kick list shared by score and renderer).
2. `node core/render/still.mjs styles/glass-product/demo 9.3 14.6 26.8 [--q nosub=1]` — iterate stills; `--range 0.5:31.5:1` + `sheet.py` for overview passes.
3. `.venv/bin/python core/tts/tts.py demo/lines.json demo/voices` → `core/tts/asr_check.py` until all OK.
4. `python demo/music/score.py` → `node core/render/events.mjs demo` → `python demo/mix.py`.
5. `node core/render/video.mjs demo --fps 24 --workers 3` (768 frames with 2× SSAA, transmission, per-frame PMREM and mirror ≈ 30–45 s on an M-series Mac).
6. `sh core/render/mux.sh out/video24.mp4 mix.wav glass-product.mp4 24 0`, then `python demo/check_mix.py glass-product.mp4`.
7. Or simply `sh styles/glass-product/demo/build.sh`.
