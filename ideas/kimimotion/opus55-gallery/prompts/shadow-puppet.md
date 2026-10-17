# Shadow Puppetry — Style Prompt

> Chinese shadow theatre: translucent dyed-hide puppets, carved like lace, pressed against a cotton screen and lit from behind by oil lamps.
> Demo: *Hou Yi Shoots the Suns* (54s) · `shadow-puppet.mp4` · source in `demo/`

You are directing a 30–60 second film in the **Shadow Puppetry** style. The user gives you a topic. You decide everything else (story, shots, timing, sound) and deliver a finished film. Follow this guide.

---

## 1. What this style is

A small stage with a white cloth screen. Behind it, a puppeteer holds flat puppets cut from **translucent, dyed donkey hide** against the cloth, and an **oil lamp** lights them from behind. The audience sees colour *by transmitted light*: red, green and ochre glow like stained glass, the carved holes shine brightest, and anywhere two pieces overlap is darker. Puppets are jointed with **visible thread rivets** and moved by **three thin rods** (one at the neck, one at each hand) that show as soft grey lines because they sit just off the screen.

It is live theatre, not stop-motion. The screen **flickers with the lamp**, puppets **tremble slightly in the hand**, legs and plumes **swing freely on their rivets**.

Reference grammar (learn from, don't copy): Lotte Reiniger's *The Adventures of Prince Achmed* (1926) for profile acting and lace-like scenery; Shaanxi / Huayin shadow theatre for carving, colour and gong-and-drum rhythm. Never reproduce a specific historical puppet, melody or recording.

## 2. Story: what fits this style

Pick stories where **the medium itself tells the story**. Shadow puppetry has five native powers. Use at least three, and put the strongest one at the emotional peak:

| Native power | Story use |
|---|---|
| **The light is the world** | The only light source is a lamp behind the cloth. Make the lamp part of the plot: more lamps = more heat/danger (the image overexposes, colours bleach); fewer lamps = calm, rich colour. In the demo, *each sun is a lamp* and each arrow puts one out, so the frame literally steps darker. |
| **Off the screen = big and blurry** | A puppet pulled away from the cloth toward the lamp grows and blurs. Use it for arrivals (a giant soft glow presses onto the screen and snaps sharp), deaths and exits (the golden crow tumbles off the screen and dissolves into light), magic and dreams. |
| **Go behind the screen** | The ultimate scale reveal: cut or truck around to the back and show the lamp, the puppeteer's hands and the rods. The "sky" was a cloth a metre wide, and the "sun" was a lamp. Put it after the climax as the echo. |
| **Carved and translucent** | Heroes have *open-cut faces* (the face is a hole, with only brow, eye, nose and mouth left as thin strips of hide), so the light shines through them. Villains have solid faces. Overlaps darken, holes glow, and scenery is lace. |
| **Hand-held, not animated** | Motion is continuous with a living tremor. Legs swing like pendulums, plumes lag behind the head, fire is a carved flame piece jiggled on a rod. |

Adapting any topic: find **what the lamp is** in your story (a sun, a hearth, an idea, a lighthouse) and **what goes off the screen** (what leaves, dies, or is only imagined). A product launch → the product is the lamp that finally lights the screen. A memory → figures lift off the cloth and blur as they are forgotten.

**Arc for 45–60s:** a lamp lights in the dark → a world appears on the cloth → trouble arrives (light changes) → the hero's entrance and freeze-pose → the action, set to percussion → a silent choice → the world restored → go behind the screen → end card on the cloth.

## 3. Visual language

**Rendering model (the heart of the style).** Composite per pixel:
`image = tonemap( lampLight(x,y) × hideTransmission(x,y) × clothTexture(x,y) )`
- `hideTransmission` is a 2D canvas that starts **white**; every puppet piece is drawn onto it with `globalCompositeOperation = 'multiply'`. Carved holes are transparent (stay white), so overlaps darken automatically.
- `lampLight` = for each lamp, a broad lobe (σ ≈ 700 px) plus a tight hotspot (σ ≈ 120 px), flickering independently (≈ ±6% value noise at 7 Hz plus a small 23 Hz sine). Warm light colour `(1, .77, .46)`.
- `tonemap`: `1 − exp(−hdr)`. Exposure is `1.75 / √(lamps lit)`, so ten lamps ≈ 3× one lamp: overexposed, hot and bleached, but still readable.
- Cloth: fine weave (sin × sin at ~2.6 rad/px with noise warp), fibre speckle, large low-frequency density blotches, edges darkened where the cloth meets the frame.
- Post: bloom from a 3-level blur pyramid (threshold 0.72, warm tint `(1,.82,.6)`), a **warm vignette** (darken toward `(.7,.47,.25)`, never neutral grey, or an overexposed frame turns grey), saturation ×1.1, gentle S-curve. Heat haze (UV warp drifting upward) only while the world burns. Film grain 2 in ffmpeg.

**Dyes (transmission colours).** Vermilion `#b8211a`, flame `#d9541c`, ochre `#dc9d1e`, gold `#c98a26`, malachite `#236e3a`, jade `#2f8a5c`, indigo `#22647e`, raw hide `#e2bd80`, ink `#1a100a` (outlines, hair, boots). Every piece gets a **hide texture** multiplied in (mottled translucency + fibres + specks, tileable 512² noise) and its alpha restored with `destination-in`, so the holes survive.

**Carving is density.** Leave thin strips of leather and cut out most of the area:
- armour = rows of thick crescent holes ("open fish-scale"), trousers = diamond lattice, belts = coin holes (circle hole with a square of hide left in the middle), collars = four-lobed cloud collar with cloud-scroll cuts, sleeves in a different colour from the torso so arms read in silhouette;
- every coloured region gets a dark carved outline (1.5–2.4 px at 1×);
- court boots: tall black shaft with cut cloud scrolls, upturned toe, thick white sole carved as a single piece (grooves + a row of oval holes).
- **Cut with an opaque fill.** With `destination-out`, the fill alpha decides how much is removed; always set `fillStyle = '#000'` first.

**Character build (a jointed puppet).** 11 pieces: head+helmet, chest, skirt, two upper arms, two forearms, two hands, two legs (+ quiver, bow, pheasant plumes). The head is ~1.2× "natural" and the helmet takes about a quarter of the figure. Joints have round lobes and a visible rivet (dark ring + pale knot). Arms are posed by 2-bone IK from hand targets; the bow is drawn procedurally (limbs bend with draw, the string goes to the nocking hand, and **the nock sits on the aim line**, grip = shoulder + u·118 and nock = grip − u·(40 + 72·pull)).

**Scenery = carved set pieces on an empty cloth.** Most of the screen is just lit cloth. Mountains are one piece each with wide strata cuts following the ridge and cloud holes near the peaks; the tree = a trunk piece plus a single lace canopy full of leaf-shaped holes; the ground is a narrow carved strip (meander band + coin holes) along the bottom, with cracks cut as tapered slits that widen and lengthen as the land burns through. Water is a separate indigo wave strip that can be lifted off. **Fire** is a carved piece of S-curling flame tongues (red → orange → yellow bands, spiral hooks at the tips) on a rod, swapped and shaken at 12 fps. No cartoon flames.

**Suns / emblems.** A carved round piece: flame-tongue rim (alternating curl direction, teardrop holes between tongues), bead ring, translucent orange-red disc, with a separate dark silhouette (e.g. three-legged crow) on top so it can drop out.

**Stage.** Red-and-black lacquer frame, carved lintel with gold cloud curls, pillars, and warm spill from the cloth on the inner edges; a few blurred children's heads along the bottom in the opening and end-card wides.

**Backstage (mirror view).** Render the same transmission canvas with the camera mirrored (`x → −x`). Surround the screen with dark wood; hang lamps (dish + cords) in front of it, one lit (flame with additive glow) and the rest just snuffed, trailing smoke (dark wisps against the cloth that turn warm-white near the lit lamp). Hands and sleeves are **silhouettes with a warm rim** (mask minus mask shifted away from the light), rods sharp.

## 4. Motion language

- **24 fps continuous** for puppets and camera. Add a hand tremor to every puppet (≈ 3 px / 0.018 rad low-frequency noise; ×1.8 when the puppeteer is "holding tension"). Only the fire pieces step at 12 fps.
- Body glides with the main rod; **legs and plumes are simulated** (damped pendulum / spring chain driven by the body's acceleration and head rotation, pre-simulated at 120 Hz so renders are deterministic).
- Operatic phrasing: quick shuffling run → small hop → crouch → **freeze pose on the big gong** (hold ~1 s while only the plumes quiver) → head turns up.
- Heads never change expression; attitude = head angle + body tilt (up = resolve, down = mercy/sorrow).
- Arrivals press onto the cloth (scale 2.6 → 1, blur 34 → 0 over 0.55 s). Exits lift off (scale ×1.9, blur +30 px, fade over ~0.9 s).
- Lamps: a new lamp flares (overshoot to 1.5×) before settling. A snuffed lamp gutters out over 0.35 s with a fast flicker.

## 5. Camera language

| Beat | Camera |
|---|---|
| Opening | Audience seat: full stage frame with children's heads. Black until a match flares behind the cloth. Very slow push. |
| Into the story | Push through the frame until the cloth fills the screen. |
| Disaster | 1.5× lateral pan across the burning land (give the disaster area). |
| Hero entrance | 1.15× follow; on the freeze-pose gong, a 5-frame **crash zoom** (the percussion accent becomes a camera move). |
| First action | Close on hands/bow/face, then a whip pan along the arrow to the target. |
| Repetition | **Locked wide** so the audience sees every step of the change (here: nine lamp-steps of darkening). |
| The choice | Medium-close with the target at the far edge: the hero at left, empty sky, the last sun at right. Music stops. |
| Echo | Pull back to reveal the stage frame again, **truck right as a blurred foreground pillar wipes the frame**, and come out behind the screen. Slow push, then a fast dive into the flame that flashes to warm white before the end card. |

When z ≥ 1, clamp the camera so it never leaves the screen rectangle (otherwise black bars appear).

## 6. Sound

- **Music = gong-and-drum patterns (锣鼓经), not generic piano + strings.** Big gong with a falling pitch after the strike ("kuang"), small gong with a rising pitch ("tai"), cymbals, a hard high clapper drum (woodblock), low barrel drum. A bright nasal bowed fiddle (erhu sample, pitched up, high-shelf + nasal formant, pitch-curve resampling for big slides and vibrato) in two modes: **ku-yin** (sorrowful, microtonal raised 4th / lowered 7th) for disaster, **huan-yin** (plain pentatonic) for heroism and healing. A suona-like shrill reed (oboe + 1.2–3 kHz formant + saturation) only for the climax.
- Patterns map to the drama: opening roll → one hit per lamp, accelerating → heartbeat drum under the disaster → *jijifeng* roll accelerating into the entrance → big gong on the freeze → fast strokes with one gong per hit → **hard stop** (≤ 30 ms, reverb tails included) for the silent choice → one tiny small-gong tap for the decision → gentle fiddle theme → gong scrape to go backstage → a final big gong tail.
- **Foley follows the materials**: wooden clapper (醒木) to open and close the show, a match strike, lamp ignition "fwoomp", bamboo rod taps on cloth, dry leather flaps when a piece lifts off, leather footsteps, bow creak (rising pitch with draw), string twang, arrow whoosh, leather thwack on hit, lamp snuff ("pfft" + sizzle), wing flaps, crackle, heat drone (hard-cut at the silence), water, a quiet backstage room tone and one breath.
- **Voice**: a storyteller (Kokoro `am_michael`, speed 0.86–0.88), 5–6 short lines, compressed, plus a little small-theatre reverb. Duck music ~12 dB and foley ~4 dB under the voice; keep the voice ≥ 12 dB above the bed. Verify every line with whisper *and* re-check the final mix (words that pass alone can blur under music: "shadow play still" became "shadow place"; rewrite rather than fight it).

## 7. Subtitles & titles

- Subtitles are a **storyteller's placard**: a narrow black-lacquer board (dark brown gradient, 0.93 alpha), a thin gold inner line, a small vermilion seal with the character 说 ("tell", Ma Shan Zheng) on the left, text in Cormorant Garamond 600, 46 px, cream `#f3e2bf`, centred 58 px above the bottom. It slides up 18 px in 0.22 s. Show each line from its start until speech + 0.8 s (≥ 1.8 s), cut 0.3 s before the next.
- Title and end card are **puppets too**: dark hide plaques with the letters cut out (`fillText` with `destination-out`, so the words glow with lamp light), red border with a meander band, green cloud-scroll corner roundels, a red seal with carved characters, carried up on two rods and lifted off the cloth to exit.

## 8. Pitfalls we hit

- **Flat vector look.** Uniform fills and sparse carving read as clip-art. Fix with the hide texture, much denser openwork, deeper dyes and a dark carved outline on every region.
- **Stilt legs / egg torso / arms lost in the torso.** Enlarge the head, lengthen the skirt, widen the trousers, add a cloud collar, and colour the sleeves differently from the chest.
- **Sun rays like a saw blade or flower petals.** Flame tongues need a fat base, a bulging belly and a hook at the tip, with alternating curl, about 40 px long × 0.78 of the arc spacing.
- **Grey corners on an overexposed frame** from a neutral vignette. Darken warm instead.
- **Arrow invisible.** Raw-hide colour disappears on a bright screen. Use a dark shaft (`#4a2612`, 3 px). The nock must be on the aim line or the arrow points sideways.
- **Mirroring flips pieces upside down** if a helper builds the rotation from `C[0]` for both axes. Use `C[0]` for x terms and `C[3]` for y terms.
- **Smoke drawn with `lighter` is invisible** against a bright cloth. Draw dark wisps normally and add a warm additive pass near the lamp only.
- **Push-in centred on a lamp at the top edge** shoves the hands out of frame. Push on the frame centre, and move the fixed point to the flame only for the final dive.
- **Heat/crackle beds leaking into the silence.** Hard-cut them at the stop.
- Headless Chrome screenshots occasionally time out while 14 other renders share the GPU. Just retry.

## 9. Production recipe (this repo)

```
styles/shadow-puppet/demo/
  carve.js     cutting toolkit: piece sprites, cut/cutLine/cutTaper, pattern library, hide texture, rivets
  gl.js        WebGL2 screen compositor (lamp field × transmission × cloth, mirror, bloom, haze, warm fade)
  houyi.js     jointed puppet (11 pieces, IK arms, bow, plumes, rods)    poses.js  key poses
  suns.js      carved suns + crow                     scenery.js  mountains, ground strip, river, tree, hut, fire pieces
  stage.js     lacquer frame, audience, pillar wipe, cut-letter plaques
  backstage.js rim-lit silhouettes (hands, lamps), lamp flame, smoke
  story.js     timeline (single source of truth)      main.js  shots, acting, lamps, events
  hud.js       subtitle placard    test.js  ?test=model | frame | hands | (main) poster
  lines.json   narration   mix.py  foley + voice + music ducking   music/score.py  original gong-and-drum score
  tools/       cues.py (SRT), mux.sh (CRF 22), probe.mjs (render timing)
```

1. `node core/render/still.mjs styles/shadow-puppet/demo 0 --q test=model`: model sheet first (character risk comes first). Then `--q test=frame&f=ten|one` style frames and `--q test=hands`.
2. `.venv/bin/python core/tts/tts.py lines.json voices` → `core/tts/asr_check.py` (use `asr` fields for homophones).
3. Timeline in `story.js`. Review with `still.mjs --range 0.5:54:1.5` + `core/render/sheet.py` (two rounds, offset by half a step), then frame strips from the mp4 for key actions.
4. `node core/render/events.mjs` → `music/score.py` → `mix.py`.
5. `node core/render/video.mjs … --fps 24 --workers 3` (1306 frames ≈ 80 s on an M-series Mac, 3 workers).
6. `sh demo/tools/mux.sh out/video24.mp4 mix.wav shadow-puppet.mp4 24 2`. Or just `sh demo/build.sh`.
