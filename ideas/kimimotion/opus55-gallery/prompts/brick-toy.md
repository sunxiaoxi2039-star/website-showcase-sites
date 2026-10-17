# Brick Toy — Style Prompt

> Stop-motion toy-brick films shot like macro photography on a real desk.
> Demo: *Rocket from Spare Parts* (54s) · `brick-toy.mp4` · source in `demo/`

You are directing a 30–60 second film in the **Brick Toy** style. The user gives you a topic (and maybe a story). You decide everything else — story, shots, timing, sound — and deliver a finished film. Follow this guide.

---

## 1. What this style is

A world built entirely from interlocking plastic bricks with round studs, sitting on a **real wooden desk**, shot with a **macro lens** and animated **in stop-motion**. The charm comes from the tension between the toy world and the real room around it.

**Never** use the LEGO name, logo or minifigure silhouette (trademarks). Characters are *built from bricks* (1×1 columns for legs, 2×2 bricks for torso, round bricks for arms, a round 2×2 helmet). Studs carry no lettering.

## 2. Story: what fits this style

Pick stories where the **medium itself does the storytelling**. Brick has four native powers — use at least three:

| Native power | Story use |
|---|---|
| **Snap-together building** | The plot is an act of building. Open on one brick, end on one brick. |
| **Break without harm** | Things fall apart and become parts for something better. Failure → spare parts. |
| **Toy on a real desk** | Real objects become landscape: a teapot is a mountain, a stack of books is the moon, the lamp is the sun. |
| **Hand-made stop-motion** | 12 fps motion, tiny imperfections, even fire and smoke are made of bricks. |

Adapting any topic: turn the topic into **something being built**. A product launch → the product is assembled brick by brick. A love story → two characters build a bridge between two books. A history lesson → an era is built, falls, is rebuilt.

**Emotional arc for 45–60s:** curiosity → excitement → a setback (collapse) → a quiet beat → rebuilding → climax → a warm scale-reveal. Keep it to one character and one goal.

## 3. Visual language

- **Plastic**: ABS with strong clearcoat (0.85, clearcoat roughness 0.07); roughness map with faint fingerprints and scratches (base ~0.17, scratches up to ~0.65); bevel radius 0.06 so edges catch a highlight. Colors from the classic brick palette: red `#c91a09`, blue `#0055bf`, yellow `#f2cd37`, green `#237841`, white `#f2f2ee`, black `#1b2a34`, orange, light/dark gray, tan, azure.
- **Geometry**: rounded box bodies (bevel ~0.045 stud), studs with a thin lip. Unit = 1 stud pitch (8 mm); brick height 1.2, plate 0.4. Baseplate is matte green (lower clearcoat than bricks, or it turns cyan in studio reflections).
- **Set**: a real desk (walnut texture), real props at true scale (1 m = 125 studs): teapot, cup, pencil, books, lamp. A neutral daylight studio HDRI — **not** a tungsten interior (white bricks turn orange).
- **Light**: toy-photography setup. A directional key from upper-left (`#fff4e8`, casts shadows; fit its shadow frustum to each shot for crisp shadows), two or three **RectAreaLight softboxes** (key front-left, cool rim behind, one over the finale set) so glossy plastic shows clean rectangular highlights, environment kept low (~0.45) for contrast. Add a soft contact-shadow blob when the key's shadow falls behind a hero object.
- **Ambient occlusion is mandatory**: GTAO (radius ~3.5 studs, scale 2.5) darkens seams between stacked bricks, stud bases and contact points — without it bricks look pasted on.
- **Grade**: slight cool white balance so white bricks read pure white (the room bounce pushes them cream), soft contrast (+0.26), saturation ×1.1.
- **Supersample 2×** (render 3840×2160, deliver 1080p): thin stud edges and bevel highlights shimmer without it.
- **Lens**: physical depth of field (CoC ∝ |1/focus − 1/z|). Close-ups aperture ~500–700, mediums ~800, the final wide ~400. Focus is always on the character's head or the brick being placed.
- **Effects are bricks**: flames = translucent orange/yellow round plates, jittered every frame; smoke = white round bricks that grow and roll outward; the moon = gray round plates with crater tiles.

## 4. Motion language

- **Characters and bricks step at 12 fps** ("on twos"); **camera, focus, flames and vehicle flight move on ones** at 24 fps (the LEGO-Movie approach). Stepping the camera too reads as judder, not charm — we tried it and it looked unsmooth.
- Bricks **fly in on arcs** and **snap** with a tiny overshoot (0.35 stud → 0 in ~0.17 s). Every snap is a click on the soundtrack.
- Characters act with big readable poses: arms-up V for pride, arms flung up for alarm, sitting with head bowed for sadness, a hop for joy. Walk cycles swing legs ±0.55 rad with a small bob.
- Collapses use real physics: a rigid tip about the base edge, then independent bodies with gravity (~420 studs/s² reads better than true 1225), bounces (restitution ~0.3), friction, settling flat. Pre-simulate so every render is identical.

## 5. Camera language

| Beat | Camera |
|---|---|
| Opening | Extreme macro on one brick, slow push, background blurred to real props |
| Building | Low angles make the tiny character heroic; cut every bar |
| Setback | Handheld shake on the collapse, then a **low, wide, lonely** frame with the character small |
| Emotional beat | Close-up from the front, character's hands and the brick in focus |
| Climax | Low angle following upward; then a **tracking shot** alongside the moving object with the destination visible ahead |
| Ending | Slow pull-back to a high wide shot of the whole desk: the scale reveal |

Keep foreground clutter out of frame edges (spare-parts piles love to block the lens). Check every shot for headroom.

## 6. Sound

- **Music**: playful acoustic/ukulele for building (cut on bars), the same theme returning quietly for the rebuild, an orchestral swell for the climax. Edit so the climax hit lands on the key action and the final chord lands on the end card (bar-aligned jump, chroma similarity).
- **Silence is a tool**: cut music dead on the collapse; leave only room tone and a ticking clock. Pull music out again before the climax (a low heartbeat drum under a countdown).
- **Foley** (all synthesized): brick click (short transient + 2.9 kHz / 4.6 kHz resonances), clack on wood, crash (many clacks), whoosh on throws, plastic creak before a collapse, tiny plastic footsteps, a bell "ding" for discovery, ignition boom and rocket roar.
- **Voice**: a warm British storyteller (Kokoro `bm_george`, speed ~0.9). Secondary voices through a radio filter (band-pass 380–2800 Hz + soft saturation) with Quindar beeps. 4–6 short lines, each with room to breathe. Verify every line with whisper.
- Mix: voice compressed, music ducked ~40% under voice, loudness −14 LUFS.

## 7. Subtitles & titles

- Subtitles: a dark rounded pill (rgba(18,20,26,.62)) centered 150 px above the bottom, Fredoka 600 46 px white, with a small yellow 2×1 brick icon on the left. Radio lines get a red brick icon and a "MISSION CONTROL" tag.
- Title: Fredoka 700, popping in on 12 fps steps, with a small yellow sub-line ("A BRICK TOY FILM").
- End card: darkened final wide, title, brick icon, style name, credits.

## 8. Pitfalls we hit

- Tungsten HDRI → orange whites. Use a neutral studio HDRI.
- Helmet visor made from a sphere segment disappears inside a cylinder helmet; use a curved open-cylinder panel instead.
- Clearcoat on a large baseplate reflects softboxes as a cyan wash — make it matte.
- Too much aperture blurs the hero at mid distance; scale aperture with shot size.
- A rocket that simply accelerates upward becomes a dot on a blank wall — follow it with a tracking shot aimed at the destination.
- A prop (desk lamp) placed on the camera axis of a later shot keeps sneaking into the background; check props against every camera.
- Material index math on random jitter can go negative → undefined material crash. Clamp.
- First pass looked flat and slightly jagged: even light, no AO, single-sample rendering, stepped camera. Fixed with softboxes + low env, GTAO, 2× supersampling, cool grade, camera on ones.

## 9. Production recipe (this repo)

```
styles/brick-toy/demo/
  bricks.js   geometry + plastic materials        rockets.js  props, physics, fx
  actors.js   brick-built character rig            set.js      desk, HDRI, real props, moon
  story.js    timeline aligned to music bars        main.js     acting, cameras, subtitles, events
  lines.json  voice script    mix.py  foley+voice+music    music/edit.py  score edit
```

1. `node core/render/still.mjs styles/brick-toy/demo <t…>` — review stills, iterate.
2. `.venv/bin/python core/tts/tts.py lines.json voices` → `core/tts/asr_check.py` to verify.
3. `node core/render/events.mjs styles/brick-toy/demo` → `python music/edit.py` → `python mix.py`.
4. `node core/render/video.mjs styles/brick-toy/demo --fps 24` (1296 frames with 2× SSAA + GTAO ≈ 65 s on an M4 Pro).
5. `core/render/mux.sh out/video24.mp4 mix.wav brick-toy.mp4 24`.
