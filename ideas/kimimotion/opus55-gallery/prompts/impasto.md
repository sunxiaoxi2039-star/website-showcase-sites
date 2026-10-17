# Impasto · Palette Knife — Style Prompt

> Thick oil paint laid with a palette knife: big, flat, sharp-edged planes of colour, raked by light so every ridge of paint shows. Clarity first: value structure before texture, hard edges at the focus, calm planes everywhere else.
> Demo: *The Colour of Rain* (39.7 s) · `impasto.mp4` · source in `demo/`
> References (grammar only): the opening titles of *The Umbrellas of Cherbourg* (1964) — overhead umbrellas choreographed to music; palette-knife rainy-street paintings (Leonid Afremov and the genre around him) — knife mosaic, vertical wet reflections, warm lamps against cool dusk; Sorolla / Sargent — few, decisive strokes and strong light; Edgar Wright's music-locked editing — one action, one sound, one cut. Never copy their images, compositions, melodies or characters.

## 1. What this style is
A moving oil painting made of knife strokes. Each stroke is a real object: a slanted plane of paint with a ridge where the blade pressed, a lip where it lifted off, broken streaks where the paint ran out, two colours dragged into each other. The world is **repainted from its strokes every frame** but static paint never moves — only things that move in the story move. Light rakes across a height field, so the paint has body.

The look is clear and graphic (children's-book readable at thumbnail size) but has the tactile surface of impasto at 100 % crop.

## 2. Story: what fits this style
- Stories about **colour, light and weather**: grey → colour, night → dawn, rain → sun. The medium can "re-lay" any stroke in a new colour, so a colour change becomes an event (a knife sweeping new paint over old).
- Music stories: sound made visible as paint ribbons; choreography seen from above as moving colour discs that leave painted trails.
- Small casts, readable silhouettes (a musician, a child, a crowd of umbrellas). Faces are simple: eyes/brows/mouth are separate procedural strokes so they can act.
- Native moves that only this medium does well:
  1. **Colour re-laid by the knife** — every stroke keeps a grey version and a colour version; a reveal wave re-paints them stroke by stroke (`reveal`, `revC`).
  2. **Choreography paints the picture** — moving objects drip their colour as knife dabs; seen from above, the dance leaves a mandala on the ground.
  3. **Raking light** — at the emotional peak, drop the light to a grazing angle so every ridge of paint catches it, then let it settle.
  4. **Paint-over transitions** — the next shot's strokes are laid over the previous one in a sweep (`appear`), with a palette-knife scrape on the soundtrack.

## 3. Visual language
- **Value first.** Design each set as a flat, value-planned illustration (3 values minimum), then convert it to strokes. If the reference doesn't read at 480 px wide, no brushwork will save it.
- **Stroke sizes by importance and depth.** Coarse-to-fine layering: 40–60 px planes in sky/walls, 3–6 px only at edges and faces. Per shape: `maxR` (largest stroke), `detail` (higher = fewer small strokes), `dir` (angle, `'edge'`, radial field, or function).
- **Strokes never cross shape groups** → silhouettes stay crisp. Lost edges are opt-in (put two shapes in the same `group`).
- **Thin underpainting** (the reference itself, blurred 1.5 px) under the strokes, so the canvas never peeks through as outlines.
- Knife stroke: length 1.7–3.1 × radius, width 0.95–1.45 × radius, slanted ends (skew ±0.55), angle jitter ±13°, value jitter ±6 %. Figures and umbrellas use `run: 0–0.25` (no ragged run-out) so they stay solid.
- Light: `light [-.55,-.6,.7]`, `norm 3.2`, `amb .8`, `dif .28`, `spec .16–.3`, `ao 1.2`. Grey world gets slightly higher spec (wet).
- Palette of the demo: after-rain sunset — cobalt `#34507e` → peach `#d99a78` → gold `#f7dca0` sky; ochre `#dca064` and rose `#c98d7e` facades, shutter green `#3f7a6c`, awning red `#b8342a`; umbrellas at full chroma (cadmium red `#dc2f28`, yellow `#f4bc2a`, cobalt `#2f62c0`, viridian `#23906c`, magenta `#cc3a82`, orange `#ee7a2a`, turquoise `#26aab4`, violet `#6e4cc0`). Grey world = luminance of the same strokes, slightly cool, 5 % colour residue.
- Wet reflections are **explicit stacks of short horizontal knife dabs** under each light source, broken and fading — not a painted rectangle.
- No film grain: grain + compression eats the knife edges.

## 4. Motion language
- Static paint is static. Only rain, figures, bows, umbrellas, ribbons and light move. Smooth 24 fps (no stepping) — clarity was the brief.
- Figures are procedural strokes rebuilt each frame from fixed seeds (walk cycles, IK bow arm, umbrella open/close/hang).
- Every action on the music grid: bow direction changes on each note; umbrellas pop on beats with a scale bounce and a burst of paint dabs; the crowd's rings swell on every downbeat.
- Anticipation → action → follow-through: bow lifts before the downbeat, the girl dips the umbrella before it snaps open, umbrellas swing down to hang after closing.

## 5. Camera language
- Same wide camera for opening (grey), middle (umbrellas in colour) and finale (all colour): the change is the story.
- Moves used: slow truck + push (wide), push-in through a silence (medium), tilt-up from a puddle (girl), pull-back from a face CU (reaction), rotating crane-out from overhead (dance), push toward the arch (finale).
- Keep the camera inside the painted plate (`half = W/2/zoom`), or the canvas shows.

## 6. Sound
- Three layers: rain bed (hiss + drops + gutter trickle; low-passed when under the arch), material foley (wet cobble footsteps, nylon rustle, umbrella "fwump", raindrops on varnished wood, bow rosin, palette-knife scrapes on every repaint), music.
- Two real silences: after the cellist gives up (rain nearly gone, one drip, a child's steps as a J-cut, then a big splash), and a grand pause of digital zero before the final chord (the rain freezes in the air).
- Score: solo cello in D minor that breaks off on an unresolved E; a street-musette waltz in D major (accordion vamp, pizzicato bass, violin pizz, shaker, harp arpeggios, glockenspiel pops pitched as a rising arpeggio); the coda resolves E → D.

## 7. Subtitles & titles
- No narration: it's a music film. Title is laid in with the knife (`appear` sweep, 1.1 s) over the grey sky and washed off by the rain (drifts down and fades).
- End card: knife-painted title on deep ultramarine + crisp DOM text for credits (small text must stay legible).

## 8. Pitfalls we hit
- `half` is a reserved word in GLSL ES 3.00.
- Binding the composite quad while a stroke VAO is still bound silently rewires attribute 0 → "vertex buffer not big enough" on the next frame. Unbind VAO first.
- Painting the ground after the buildings covered their feet — draw order in the reference matters.
- Confined strokes shrink near edges and leave canvas-coloured outlines → add the underpainting texture.
- Global index in a per-shot loop flung ribbon control points off-screen (a streak from the sky). Use local indices.
- Umbrella radius 0.46 × body height looks like a parasol table; 0.34 reads as an umbrella.
- Coats as plain rectangles read as bollards: A-line taper + lit edge + shoulder dab + hair dab.

## 9. Production recipe (this repo)
1. `timeline.js`: BPM grids, cut times, melodies (`MEL_A`, `MEL_B`), pops. Picture and score both read it (`tools/dump_timeline.mjs` → `out/timeline.json`).
2. Sets in `scenes/*.js` as reference illustrations (`Ref.fill/line/text/tint`) → `paintRef()`.
3. `film.js`: shots, cameras, transitions (`EDIT` table), post looks.
4. `music/score.py` (sampler), `mix.py` (foley + ambience + ducking + true silence).
5. `demo/build.sh` renders everything (≈30 s of GPU render for 952 frames).

## 10. Engine usage
Files: `demo/engine/impasto.js` (renderer), `demo/engine/plate.js` (reference → strokes).

| API | What it does |
|---|---|
| `new Impasto(canvas, {W, H, ss})` | WebGL2 renderer, `ss`× supersampled colour + height buffers |
| `E.begin()` / `E.finish(post)` | start a frame / light + grade to screen (`light, norm, amb, dif, spec, shin, ao, expo, sat, contrast, vig, lightCol`) |
| `E.batch(Float32Array)` → `E.draw(batch, o)` | static stroke set. `o = {M, cam:{x,y,zoom,rot}, t, grey, reveal, revDur, appear, appDur, alpha, run, hgt}` |
| `E.drawNow(Float32Array, o)` | transient strokes (figures, rain, ribbons) |
| `E.texture(canvas)` + `E.under(tex, w, h, o)` | thin underpainting (supports `revC:[x,y,speed]` reveal wave) |
| `new Strokes().push({x,y,ang,len,wid,c,c2,type,taper,bend,skew,alpha,hgt,rev,app,seed})` | build strokes; `type`: `KNIFE`, `BRUSH`, `DAB`, `LINE` |
| `new Ref(w, h, scale)` + `.fill(path, fill, props)` / `.line` / `.text` / `.tint` | reference illustration; props `{dir, maxR, detail, group, type, hgt, jit, len, wid, aj, fallback}` |
| `paintRef(ref, {R:[radii], T, rev(x,y), app(x,y,level)})` | coarse→fine knife strokes confined to shape groups |
| `strokePath(out, pts, {wid, c, type, step})` | strokes along a polyline |

Minimal example — a warm-orange four-point sparkle with a short cursor tail, in knife paint:
```js
import { Impasto, Strokes, KNIFE, DAB, hex } from './engine/impasto.js';
const E = new Impasto(canvas), s = new Strokes(), c = hex('#D97757');
for (let k = 0; k < 4; k++) {                                   // four tapered knife points
  const a = k * Math.PI / 2;
  s.push({ x: 960 + Math.cos(a) * 60, y: 540 + Math.sin(a) * 60, ang: a, len: 120, wid: 46, c, c2: hex('#f0a07a'), type: KNIFE, taper: .95, seed: k });
}
s.push({ x: 960, y: 540, len: 40, wid: 40, c: hex('#f6c0a0'), type: DAB, seed: 9 });   // bright core
s.push({ x: 1060, y: 610, ang: .6, len: 90, wid: 16, c, type: KNIFE, alpha: .8, seed: 10 });   // cursor tail
E.begin(); E.drawNow(s.data(), { grey: 0, run: 0 }); E.finish();
```
"Only one colour" (monochrome with one exception): draw the world with `grey: 1, reveal: 1e6`, draw the exception with `grey: 0` — exactly how the red umbrella is the only colour in the demo's first half.
