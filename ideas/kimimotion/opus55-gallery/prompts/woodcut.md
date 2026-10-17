# Woodcut Print — Style Prompt

> A relief print that carves itself: every frame is a black wood block, and light only exists where a knife has cut it away. One colour at most, and only for the thing that burns.
> Demo: *The Bell Founder* (58.5 s) · `woodcut.mp4` · source in `demo/`
> References (grammar only): Frans Masereel *Passionate Journey* (1919) and Lynd Ward *Gods' Man* (1929), wordless woodcut novels told as a sequence of self-contained plates; Käthe Kollwitz's woodcuts, where emotion lives in the direction of the gouge; Gustave Doré's engraving, where line spacing and direction build light and volume. Never copy their plates, figures, borders or titles.

You are directing a 40–60 second film in the **Woodcut Print** style. The user gives you a topic. You decide everything else (story, shots, timing, sound) and deliver a finished film. Follow this guide.

---

## 1. What this style is

Each shot is **one printed plate**: black ink on laid paper, framed by a paper margin. It follows three rules of real relief printing:

1. **Black is the wood surface, white is what the knife removed.** Light is not painted on. It is *carved*. A bright area is many wide cuts; a dark area is untouched wood.
2. **Pictures appear by being carved.** Nothing fades in. Cuts grow one stroke at a time along the form, coarse gouges first and fine lines after, the order a carver works in.
3. **The block is a mirror.** Letters on the block read backwards. Only when the paper is pulled do they read true, and that reversal is the style's own transition.

The one colour (a second block, "copper" `#C8502A` in the demo) is printed only where white has been carved, so it glows out of the cuts and never sits on the black.

## 2. Story: what fits this style

| Native power | Story use |
|---|---|
| **Light is carved** | Stories about fire, dawn, discovery, a lamp being lit: the moment of light can literally *be* a burst of radial cuts. |
| **Carving = time** | The picture growing cut by cut is patient work on screen. It suits craft, labour, perseverance, and first times. |
| **The mirrored block → the true print** | A reveal or a change of heart: the audience reads a backwards word, the sheet is pulled, and it reads true. |
| **Snow = stab cuts** | White dots are wounds in the wood. They can freeze mid-air, or be "inked back in" until the sky is clean. That makes an ending no other medium has. |
| **One colour plate** | Save it for the one thing that matters (molten metal, a heart, a flame). Let it spread at the climax and shrink to a single highlight afterwards. |
| **Wordless-novel sequencing** | Four or five spoken lines at most. Plates carry the story; the gap after a failure can be completely silent. |

**Story shape (proven in the demo):** first knife stroke in the dark (the horizon) → the world carved → the first print pulled (mirror → true) → a long close-up of hands → a quick montage of small offerings → a first attempt that **fails in close-up** → a silent plate → a personal sacrifice → a second attempt where the colour plate floods the frame → the longest silence → the payoff sound → the colour withdraws to one highlight → the white marks are inked back in → the last cut is the horizon again.

Adapting any topic: find the one thing that should *glow* (that is your colour plate), the one thing that is *made by hand* (that is your long close-up), and the one thing that should *disappear* at the end (that is your stab-cut texture).

## 3. Visual language

**Palette**: ink `#111111` · paper `#EFE8D8` · the wood block itself `#D8C29C` (only in shots that show the block) · one colour plate `#C8502A`. A colour plate over ink is nearly invisible, so plan it on carved white.

**Print frame**: 1920×1080, printed image area `36, 36, 1848×912`. The bottom paper margin (132 px) holds captions. The image edge is the block edge: ragged ink, never a clean rectangle.

**Knife classes** (widths in 1080p pixels at 1× camera):
| Tool | Width | Use |
|---|---|---|
| Knife `k` | 1.2–2 | contours, the white outline that separates a black figure from a black ground |
| V-gouge `v` | 2–8 | hatching, hair, beard, fine light |
| U-gouge `u` | 10–22 | rays, sky sweeps, the first rough-out |
| Stab `stab` | r 3–8 | snow, sparks, flecks of loam, wood chips |

**Hatching (Doré grammar in wood)**: line **direction follows form** (a bell is wrapped in horizontal arcs, slopes follow the fall line, fire and light radiate, cloth follows its folds). **Width follows tone**: bright = wide cuts almost merging into white, mid-tone = thin cuts, dark = no cuts. Far = dense and fine, near = sparse and coarse. Every line is a separate cut, 30–160 px long, blunt at entry, tapered at exit, with small chips on its edge. Never a continuous machine line.

**Figures**: a black silhouette + a white knife halo against the ground + grazing-light hatching on the lit edge only (light vector with z ≈ 0.2, so flat areas stay black). **Skin is carved white and features are left black** (the wordless-novel rule). At small sizes a black face with white cuts is unreadable.

**Close-ups (hands, objects)**: don't hand-draw them. Sculpt a small height field (capsules, blobs, planks, creases), light it, and run the grey image through `woodcutFilter` (§10). The cuts then follow the isophotes the way an engraver follows a cheek. The demo's hands, the compass and the filter still are made this way.

**Printing**: the mask (white = cut) goes through a WebGL2 compositor: displaced and noise-thresholded edges (knife burr), ±6 % ink unevenness, wood-grain streaks, specks where ink didn't take, the colour plate with its own mottle and a fixed 3 px misregistration. Block mode shows the inked wood: glossy black with grain sheen, pale wood in the grooves.

## 4. Motion language

- **Characters step on twos (12 fps)**; camera, snow, fire and light run at 24 fps. Hatching is generated in each body part's local space, so cuts move with the limb and don't boil. Only fire and molten metal re-cut every 2 frames, which is deliberate boil.
- **Every key action has anticipation / action / follow-through**: hammer lean-back 4 frames → strike 2 frames → settle + 3-frame camera shake; bellows push with the whole body; the throw is clutch → release → hand holding in the air.
- **Carve reveal**: each stroke has its own start time and speed (0.08–0.35 s). Reveal keys: `light` (bright areas first, coarse to fine), `radial` (from a point: rays, the pour), `down`, or any function.
- **Hard cut = a new impression**: two frames of misregistration (`jolt`: [5,−3] then [−2,1] px).
- **Paper transitions** (the one transition grammar): brayer rolls ink (a wet highlight sweeps across) → paper lays down → baren spirals and the image soaks through the back → the sheet peels on a cylinder toward camera, heavy at first and fast at the end, showing the mirrored show-through on its back.

## 5. Camera language

The camera moves over the paper; the paper margin stays fixed. "The knife is the camera": the knife tip, or later the brightest cut, is always the focus.

| Beat | Camera |
|---|---|
| Hook (0–3 s) | Extreme close-up on a black block; tracking with the knife as it cuts one white line (the horizon). |
| World | Pull back 3.5× → 1× as mountains, roofs and the empty tower are carved: a line becomes a world. |
| First print | Locked off for the ink / paper / baren / peel; then tilt down and push in to the empty belfry. |
| Breath | 4 s near-static macro on the founder's hands (slow push 1.0 → 1.13). |
| Montage | Hard cuts on every beat, speeding up (1 / 1 / 1 / .5 / .5 / .25 / .25 s), each landing with a jolt. |
| First colour | Push in on the crucible as the copper turns orange, so the first colour lands in close-up. |
| Failure | Snap zoom (0.2 s) to the bell wall and hold 1.3 s while the crack climbs. |
| Silence | Frame in a frame: the workshop door, villagers outside, the founder's back, the hammer slowly lowering. Nothing moves but snow. |
| Climax | Start on the stream only (z 2.4), radial cuts burst from the mould, then crane up and out to show both faces lit. |
| Signature | 8× → 1× continuous pull-back from the bell wall to the whole valley as the bell rings: the sound travels as far as the camera does. |

## 6. Sound

- **Grid first**: 60 BPM, switching to 90 BPM through a 3:2 metric modulation (60's triplet eighth = 90's eighth) for the forge. `timeline.json` is the single source of truth. `tools/cuecheck.py` checks score cues against picture events and both silences (demo: 25 cues, max offset 0 ms).
- **Score**: low strings only (contrabass, cellos, spiccato, pizz; violas only after the bell) + wood and skin (log drum, woodblock, frame drum) + gran cassa / timpani + one tam-tam + a **synthesised anvil** (modal numpy: 3–5 inharmonic partials + hammer transient). **No bell timbre anywhere before the bell rings**: the village "has no voice", so the first bell is the climax. D minor, turning to D major in the bell's decay.
- **Foley follows the material**, all synthesised: knife into wood (short transient + band-passed fibre tearing modulated by knife speed), chips, brayer tack, paper air, baren rasp, the wet peel; brass by size (pot = low, wide; keys and ring = high, pure); clay scrape and smash; bellows leather + air; molten bubbles, pour roar, hiss into the mould; the bell as a modal model (hum 0.5, prime 1, tierce 1.2, quint 1.5, nominal 2, 2.5, 3, 4 with their own decays and beating) + two valley echoes.
- **Two real silences**: 29.7–32.3 s (−40 dB distant wind only; the first sound after it is the compass lid's *click*) and 44.3–47.3 s (**digital silence**, measured −91 dB; the first sound after it is the bell, the loudest moment of the film).
- **J/L cuts**: fire crackle enters before the hands shot; outdoor wind carries into the workshop muffled; wind leads the peel into the belfry; the bell's tail runs under the end card.
- **Mix**: music ducks ~8 dB under voice (6 dB after the bell) and 4 dB under key foley. **Foley ducks too** (−5 dB, −9 dB under a line that shares its beats with metal hits). Narrator: Kokoro `am_onyx` at 0.88, 4 lines.

## 7. Subtitles & titles

- **Captions are letterpress in the paper margin**, below the plate, like a plate caption in a woodcut novel. They never cover the image. IM Fell English 42 px, ink `#111`, pushed through the same print shader. The ink comes up in 0.1 s with no slide and fades over 0.15 s. Hold ≥ max(1.8 s, speech + 0.6 s).
- **Title**: carved *mirrored* into the block (IM Fell English SC), readable only once the first print is pulled.
- **End card**: a fresh print: title carved out of a black panel, a small bell keeping the film's last copper highlight, then *A Woodcut Print*, Lemo-Opuscar, LemoLab × Claude Opus 5.5 and credits in letterpress. The final knife cut under the title echoes the first sound of the film.

## 8. Pitfalls we hit

- **Snow on white snow is invisible.** White marks only read on black. Add black snowbanks and wind-carved ground; flakes read on the sky and on dark masses.
- **Hatching every surface looks like fur or rain.** Use grazing light so flat planes stay black and only 3–6 cuts sit on the lit edge.
- **Black faces with white cuts don't read small.** Carve skin white and leave features black, and outline white parts with a black keep-line.
- **Hand-drawn polygons for hands and props look like mittens and blobs.** Sculpt a height field and use `woodcutFilter` for anything seen close.
- **Short hatch segments with a tonal sine wobble turn into zig-zag chevrons** (the first bell). Use long cuts (14–50 × spacing), a smooth tone with one broad highlight band and a thin rim light, and a stronger halo so the shadow side still has an edge.
- **Steam drawn on top of the subject reads as flames.** Draw it *behind* the subject so only wisps escape past the silhouette.
- **The baren show-through built from stacked translucent discs** leaves a grey ring. Start with a faint overall soak and add soft radial-gradient dabs along an inward spiral.
- **Lazily cached strokes shared between shots** (`X.coatFolds || []`) make frames depend on which render worker drew which shot first. Every cache must build itself on first use.
- **Metal gift hits masked the narrator** (whisper heard "is had" for "it had"). Foley has to duck under voice too. Pan the offending hit away from centre.
- **File size**: fine hatching + per-impression ink noise + grain 6 made a 58 s film 326 MB at CRF 19. Re-encode at CRF 28 with `-tune grain`: 93 MB, and no visible difference at a 1:1 crop.
- The structure tensor in `woodcutFilter` produced NaN in flat areas (box blur leaves tiny negative sums). Clamp before `sqrt`.
- `still.mjs` can fail when many renders run at once. Retry up to 3 times.

## 9. Production recipe (this repo)

```
styles/woodcut/demo/
  engine/        index.js (shape, cutAlong, flecks, rays, plate…), knife.js (strokes), hatch.js (regions, streamline hatching),
                 print.js (WebGL2 print/block compositor), filter.js (image → woodcut)
  stage.js       print frame, camera, caption          world.js   the valley (mountains, village, tower, snow)
  chars.js rig.js views.js   founder & apprentice (parts rig, poses, expressions)   hands.js   height-field sculpts → filter
  interior.js fx.js          workshop, crucible, pour, sparks, mould; bell, bellows, gifts, villagers, sound rings
  trans.js       paper curl / peel        shots.js shots2.js   the 17 shots        film.js main.js   assembly, captions, events
  timeline.json  tempo grid + every cue   music/score.py   original score   mix.py   foley + ambience + voice + ducking + bell
  tools/         cuecheck.py subs.py final_asr.py mux.sh      test.js   ?test=char|hands|pour|village|sheetA|sheetB|filter|spark
```
1. Write `timeline.json` (grid + cue keys) and the cue table first; hand them to a music sub-agent; draw in parallel.
2. Build the engine and one style frame before any story. Get the carve + print look right on a still.
3. `sh demo/build.sh` rebuilds everything: TTS → whisper → score → events → cue check → mix → srt → render (4 workers ≈ 45 s for 1404 frames) → mux (−14 LUFS, grain 6, CRF 28) → whisper on the film → styleframe / poster / engine example.
4. Review twice with 1–2 fps contact sheets from the film itself, plus full-size frames of every key action (peel, smash, crack, rays, bell pull-back, end card).

## 10. Engine usage

`demo/engine/index.js` is self-contained (it only imports `/core/lib.js`). It draws **any path or shape** as a carved relief and prints it. You always work on two canvases: a **mask** (fill black = uncut block; draw white = cut away) and an optional **colour plate** (alpha = plate density), then call the printer.

| Function | What it does | Key options |
|---|---|---|
| `canvas(w=1920, h=1080)` | → `[canvas, ctx]` | |
| `shape(polys, o)` | A carved solid: black silhouette + white halo + form-following hatching lit by `light`. Returns `{ draw(g, t), strokes, halo, reg, tone }`. | `light` (`light(x,y,z)`), `sp` spacing, `wmax`, `lo/hi` tone range, `dir` (`'contour'` / angle / `dirRing(cx,cy,sy)` / `dirRadial(cx,cy)` / fn), `halo` px, `white` (white part with black cuts), `tone(reg)→(x,y)=>0..1` override, `seg`, `gap`, `reveal:{t0,t1,key,speed}` |
| `cutAlong(path, o)` | Breaks a path into hand-cut knife strokes (outlines, rules, rope, cracks). | `w` (number or `(u,pt)=>w`), `kind` `'k'|'v'|'u'`, `closed`, `seg:[a,b]`, `gap:[a,b]`, `reveal:{t0,t1,speed}` |
| `hatch(region, o)` | Streamline hatching of any `Region` (evenly spaced, direction and width fields). | `dir(x,y)`, `tone(x,y)`, `sp`, `wmax`, `seg`, `gap`, `kind`, `reveal` |
| `flecks(pts, o)` | Stab cuts (snow, sparks, chips). `pts = [[x,y,r],…]` | `angle`, `seed` |
| `rays(cx, cy, o)` | A burst of carved light. | `n`, `r0`, `r1:[a,b]`, `w`, `jit`, `bend`, `a0/a1`, `reveal:{t0,t1,jit}` |
| `drawStrokes(g, strokes, {t, color})` | Draws strokes onto the mask at time `t` (a reveal-timed stroke is carved progressively, knife tip and all). `color:'#000'` re-inks. | |
| `plate(c, polys, a)` | Paints the **one colour** plate. It shows only where the mask is cut white. | |
| `woodcutFilter(img, o)` | **Image / video frame → woodcut.** Luminance sets cut width, the structure tensor sets cut direction; returns strokes with reveal times. | `rect:[x,y,w,h]`, `sp`, `black/white/gamma` levels, `res`, `region`, `reveal:{t0,t1,mode:'light'|'radial'|'down'|fn,speed}` |
| `makePrinter(W,H).render(mask, plate, o)` | WebGL2 compositor → canvas. | `mode:'print'|'block'`, `seed` (paper), `inkSeed` (per impression), `plate:'#hex'` (the one colour), `ink`, `paper`, `reg:[dx,dy]` misregistration, `edge` burr, `sheen`, `wetX` |
| `light(x,y,z)`, `Region(polys | drawFn, {res,bbox})`, `mkStroke`, `spline`, `offsetPoly`, `ellipse`, `rect` | helpers | |

Demo-level, reusable: `demo/trans.js` `curl(g, front, back, xf, r)` + `peelState(u)` (the paper peel); `demo/hands.js` `Sculpt` (capsule / blob / plank / creases → `shade(light)`) for close-ups.

**Minimal example**: a warm orange `#D97757` four-point spark with a cursor tail, carved in and kept in its own colour. It is exactly `?test=spark` in `demo/test.js`; the result is `demo/stills/engine_example.jpg`.

```js
import * as WC from './engine/index.js';
const [mask, m] = WC.canvas(), [plate, c] = WC.canvas(), P = WC.makePrinter();
const star = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 70 : 260; star.push([960 + Math.cos(a) * r, 500 + Math.sin(a) * r]); }
const spark = WC.shape([star], { light: WC.light(.5, -.6, .6), sp: 9, halo: 8,
  reveal: { t0: 0, t1: .8, key: (x, y) => Math.hypot(x - 960, y - 500) / 300 } });        // carved from the centre out
const tail = WC.cutAlong([[1030, 590], [1090, 680], [1110, 770]], { w: 24, kind: 'u', seg: [300, 400], reveal: { t0: .8, t1: 1.1, speed: 900 } });

function frame(g, t) {
  m.fillStyle = '#000'; m.fillRect(0, 0, 1920, 1080);                                       // the uncut block
  c.clearRect(0, 0, 1920, 1080);
  WC.drawStrokes(m, WC.rays(960, 500, { n: 36, r0: 300, r1: [420, 640], w: 10, seed: 2, reveal: { t0: .5, t1: 1.0 } }), { t });
  spark.draw(m, t);
  WC.drawStrokes(m, tail, { t });
  WC.plate(c, [star], t > .8 ? 1 : 0);                                                      // the one colour
  g.drawImage(P.render(mask, plate, { seed: 4, plate: '#D97757' }), 0, 0);
}
```

**Filter on a photo or film frame** (for re-drawing footage): `const F = WC.woodcutFilter(video, { rect: [36, 36, 1848, 912], sp: 5, reveal: { t0, t1, mode: 'light' } }); m.fillStyle = '#000'; m.fillRect(…); WC.drawStrokes(m, F.strokes, { t });` then print. About 1,900 cuts and 140 ms for a 1080p frame. See `demo/stills/filter_v1.jpg` and `?test=filter&img=…`. For a moving shot, re-run it on twos (12 fps) with the same `seed` so the cuts stay stable where the image does.
