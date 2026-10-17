# Stained Glass — Style Prompt

> A medieval stained-glass window that only comes alive where the sun touches it.
> Demo: *The Dragon of the East Window* (56.5 s) · `stained-glass.mp4` · source in `demo/`

You are directing a 30–60 second film in the **Stained Glass** style. The user gives you a topic. You decide story, shots, timing and sound, and you deliver a finished film. Follow this guide.

---

## 1. What this style is

A 12th–13th-century church window seen from **inside a dark stone hall**. Every image is made of **cut pieces of coloured glass held in dark lead cames**, with faces, folds and ornament **painted on in brown grisaille**. The glass has no light of its own: it glows only when the sun is behind it, and it throws coloured light onto the stone floor.

The film is about **light moving across glass**. Characters are glass figures that move **piece by piece**, never like soft 2D animation.

Keep it a fable. **No crosses, saints, halos or other religious imagery**. Borrow the craft and the colour logic of cathedral glass, not its subjects.

## 2. Story: what fits this style

The medium has four native powers. Build the story on at least three of them.

| Native power | Story use |
|---|---|
| **Light is time, and light is the camera** | Only the lit pane is "alive". Where the sun sits in the window is the story's clock. When the light leaves a pane, its figure freezes on that frame. The camera follows the light from pane to pane. |
| **Glass projects onto stone** | A lit pane throws a soft, stretched, coloured copy of itself onto the floor. Put a key scene *in the floor light*, and let the patch lengthen as the sun sinks. |
| **Glass cracks, lead mends** | One blow can crack a whole pane: this is your one hard turning point. The pieces slide along the leads into a new picture, and the repair leaves new lead lines, a scar where the story changed. |
| **A window can hold its own light** | At night every pane goes dark. A pane that still glows needs a light source inside the story, which makes a strong ending image. |

**Structure that works:** a window with several lancets, one scene per lancet, each lit in turn (dawn → noon → afternoon → dusk). A rose window above works as the sun clock. Open in darkness with a knife-thin ray. Put one hard crack at the emotional peak, then silence, a slow reveal, re-leading on the beat, a single bell, and night.

**Adapting any topic:** turn it into a sequence of stations that the light visits in order. For a product launch, show the stages of making, one per pane, with the finished product as the pane that glows at night. For a biography, show a life in four panes and the one choice as the crack. For history, show eras across the day.

## 3. Visual language

### Rendering model (one formula for everything, `demo/comp.js`)
```
glass   = tonemap( backlight(x,y,time) × transmittance × glass texture ) + weathering haze × room light
surface = albedo × (room ambient + glow spilled from lit panes + point lights)          // stone, lead, iron
floor   = flagstones × (ambient + projected colour-patch map, blurred + halo)            // perspective or top-down
+ additive light shafts with dust · bloom (bright glass eats into the lead, the "irradiation" effect)
```
- **Tone mapping must preserve hue.** A plain per-channel `1-exp(-x)` turns backlit cobalt into pastel sky blue. Use a hue-preserving curve and blend toward per-channel only at the very top, so a sun disc can burn white while blue stays jewel blue.
- **Unlit panes** are dark and milky. Transmittance × a weak sky light, plus a weathering haze lit by the room, keeps the figures faintly readable (they look ghostly).
- **Lit pane:** backlight 2.2–2.8, with a soft moving band edge (`bandW` ≈ lancet width + 10, soft 24, slight diagonal skew).

### Glass pieces (`demo/glass.js`)
- Each piece is a smooth Catmull-Rom cut. Real glass can't be cut into deep concave corners.
- **Every piece is textured.** Apply these by `multiply` inside the piece's clip:
  - streaks (a rotated anisotropic noise pattern, different angle per piece)
  - a hue drift across the sheet (warm → cool, ±10 %)
  - darker aged edges by the lead (two soft strokes, rgb 206 / 168)
  - ±9 % per-piece thickness variation of the base colour
- The shader adds seed bubbles (dark rim, bright centre), fine scratches and large thickness clouds in world space. Fade the small features out below 0.6× zoom or they sparkle.
- **Lead** `#1d1f23`, 6 units wide (4.2 for quarries, 3–4 for small details), round joins, a faint grey flange line, solder blobs at joints. **Lead is one planar network.** Before stroking a piece's lead, erase the surface layer under that piece, or the hidden leads of pieces behind show through.
- **Background:** hand-cut **lozenge quarries**. Use a jittered lattice with shared vertices, so there are no gaps, and paint a small vine curl on each. Plain Voronoi reads as a filter. Borders are a ruby band with gold pearls, plus a white fillet with a painted running vine.

### Palette (transmittance colours)
Cobalt `#1d3a9c` (dominant) · deep blue `#142a70` · ruby `#a8101c` · gold `#dc9a22` · emerald `#2f7f36` · olive `#6b7a22` · murrey `#632a63` · flesh `#d2a288` · white `#cfdac6` · mail `#a9b7b2` · sky `#7fa2cf` · umber `#7a4e24` · ember amber `#ff9a2a`.
Chartres logic: blue and red carry the picture, with small touches of gold, green and purple. Flesh has to be *darker* than you think, or backlit faces burn white.

### Grisaille (the painter's layer)
- **Trace lines:** tapered brush strokes (a polygon with a width profile) in `rgba(44,26,12,.88)`. Brows 3.8, eyes 3.0, folds 2.3–2.6 units.
- **Matting:** a stippled brown wash over whole garment pieces (`wash .35–.45`), a graded shade across the piece, and a soft band inside the lead.
- **Scraped highlights:** repaint a thin stroke beside each fold *in the piece's own colour* (`g.__col`). In transmitted light this is the only way to get a highlight.
- Medieval face: almond eyes with a heavy upper lid and big pupils, and a brow that flows into the nose line. **Expressions live in the brows and the mouth.** Changing expression means swapping the face piece, never morphing it.
- Mail: staggered small arcs. Dragon scales: arcs that follow the spine. Belly: transverse plates.

### Room
Warm grey ashlar (courses 86 units), a splayed window embrasure lighter than the wall, mullion shafts and iron saddle bars crossing the lancets. The floor has large irregular flagstones (a jittered cell pattern, *not* the wall's running bond). A string course under the window carries the carved title (Cinzel), and a moving strip of light sweeps across it.

### Time of day (sun colour × intensity)
Dawn `(.70,.83,1.0)` × 2.2, low, long patches · Noon `(1,.97,.9)` × 2.7, short patches, brightest · Afternoon `(1,.84,.6)` × 2.35, patches lengthening · Dusk `(1,.6,.34)` × 2.6 (keep some blue alive) · Night moon `(.55,.66,1.0)` × 0.5 through every pane, plus any story light.

## 4. Motion language
- **Glass figures step at 8 fps**: sample the pose every 1/8 s and hold it. Light, camera, shafts and dust move on ones (24 fps). Stepped light would read as flicker.
- Rigid pieces on a skeleton: 2D forward kinematics, with each part drawn with `setTransform(base · T(part))` so draw order is free. The dragon is a spine chain cut into banded dorsal and belly pieces.
- Actions land on the beat: steps on half-beats, clashes on beats, welds on beats.
- **Freeze rule:** the figures in a pane use `min(t, t_lightLeft)` so they stop exactly when the light leaves.
- **Crack:** 9 jagged crack lines run out from the impact point in 0.28 s. They are bright because light pours through them. A white point-light flash (0.45 s) and a 2-frame shake go with them.
- **Re-leading:** groups of pieces (sword → legs → torso → arms) each slide into the new pose over one beat with a small outward "slide along the lead" bump. Each group ends in a weld spark (a point light) and a note. The crack lines become thin mending leads as each weld lands.

## 5. Camera language

| Beat | Camera |
|---|---|
| Opening | Black. A 1-second knife-thin band of light slides onto the first pane (`bandW` 18 → 310, skew .45 → .06). Close-up, pane fills the frame. |
| Establishing | Pull back to the whole window with its floor patch and the carved title lit by a sweep. The audience learns the rule in one frame. |
| Light moves | Truck sideways *with* the band of light, from one pane to the next. |
| Key scene in light | Tilt down the shafts to the floor, then cut to top-down: the duel plays out in the projected patch while it stretches. |
| Crack | Same framing, no cut: let the crack be the event. |
| Reveal | Slow push toward the small light, the character's face and the reveal in one frame. |
| Ending | Pull back to the same wide as the establishing shot, now lit from inside. End card carved in the stone band. |

Keep subjects big: close-ups at 1.3–2.3× on a 300-unit lancet. In a narrow lancet, stack characters diagonally (one lower-left, one upper-right) so no head is hidden.

## 6. Sound
- **Score:** medieval and plainchant, D Dorian (the raised 6th, B♮, gives the colour), with no generic piano or strings.
  - Solo recorder chant over an organ pedal drone.
  - Harp arpeggios (Dm–G) and hand chimes by day; tubular bells at noon.
  - Full organ and timpani for the fight, with timpani hits on the clashes and a roll into the blow.
  - **A hard stop at the crack, including reverb.**
  - Warm organ-soft chords for the reveal, with weld notes climbing the mode.
  - **A single bell with a very long reverb** (room ≈ .95) when the sword is laid down.
  - A recorder reprise at night.
  - Water-glass notes are "the light": the same note plays at the first ray and at the final dawn.
- **Foley (all synthesized, material first):**
  - struck glass: inharmonic modal partials 1 : 2.32 : 4.25 : 6.63 : 9.38
  - crack: snap, a pane-body thump, then a rain of tinkles
  - lead: slow stick-slip creak
  - glass sliding along a came: gritty band noise with a faint squeal
  - solder: hiss plus a tick
  - air on each light move, a large stone-hall ambience, far pigeons in the vault, the ember's quiet crackle
- **Voice:** a gentle, even storyteller (Kokoro `bf_alice`, speed .86–.88), like a nun telling an old story. Use 8 short lines. Duck the music by about 9 dB under the voice.

## 7. Subtitles & titles
- **Subtitles:** a parchment **banderole** (scroll ribbon) centred 112 px above the bottom, with curled ends, a gentle sag and a thin red rule. Text is IM Fell English 44 px in ink `#3a2412`. It unfurls from the centre in 0.28 s and rolls back up at the end. Hold each line for at least speech + 0.6 s and at least 1.8 s.
- **Title and end card:** incised Roman capitals (Cinzel 600) in the stone string course, dark cut with a light lower lip and gilding. A moving band of light reveals them. Push the camera in for the end card so the credit line is at least 30 px tall on screen.

## 8. Pitfalls we hit
- Hidden leads showed through the pieces in front (the lead layer is separate). Erase the surface under each piece before stroking its lead.
- Pastel glass came from per-channel tone mapping. Use a hue-preserving curve, and darken the flesh colour.
- Voronoi backgrounds read as a Photoshop filter. Hand-cut lozenges plus painted vines read as glass.
- Flat piece fills looked like clip-art. The fix was a texture on every piece (streaks, hue drift, dark edges) plus heavy grisaille and scraped highlights.
- A floor patch that was too sharp looked like a decal. Blur it, desaturate it about 20 %, modulate it by the stone and add a halo. Keep the figures readable as coloured silhouettes.
- The top-down floor had the same running bond as the wall. Use large irregular flagstones.
- **The projection flips the image** (the top of the window lands farthest into the room). For a top-down shot, frame it with the wall at the bottom of the frame so the figures stand upright; they will be mirrored, which is correct.
- The patch-map canvas size didn't match the code, which drew into a quarter of the texture and put the patch in the wrong place.
- Shafts painted at full strength from the window plane wash out the pane. Start the gradient near 0 at the window, peak about 40 % down, and weaken it in close-ups.
- A folded wing built from the open-wing rig looks like a pile of sticks. Draw a dedicated folded silhouette (knuckle up, pleated blade sweeping back) and hide the far wing.
- A red dusk light × cobalt glass gives mud. Keep dusk at about `(1,.6,.34)` and raise the intensity.
- A carved end card at night was unreadable in the wide shot. Push in and park the sweep light on the text.
- Homophones: whisper hears "knight" as "night". Put the expected transcription in the `asr` field.
- The turning-point reveal was unreadable in v1: the knight filled the frame and the dragon was cut by the lancet edge. In a narrow lancet, stage the reveal **at the final zoom**. Shrink both figures and move the thing being revealed (the ember) to the middle of the frame, at least about 1/8 of the frame width including its glow. Put the character on the left third looking at it, keep the other character whole inside the pane, and pull back afterwards to show both together.
- Subtitle text drawn while the banderole is still unfurling looks like it hits the ribbon ends. Fade the text in only after the ribbon is at least 75 % open, and pad the ribbon about 75 px each side.

## 9. Production recipe (this repo)
```
styles/stained-glass/demo/
  glass.js    pieces, textures, lead, grisaille brushes, lozenges    comp.js   WebGL2 compositor (glass/stone/floor/shafts/bloom)
  knight.js   glass knight rig + poses + faces                       dragon.js wyvern rig (spine bands, head, folded/open wings, ember)
  window.js   lancets, rose, borders, scenes, stone wall, carving    scene.js  camera, floor projection, shafts, dust -> compositor
  story.js    timeline: light, camera, lancet states, crack, re-lead, events, subtitles
  subs.js     banderole subtitles     test.js  model sheet / test pages (?test=sheet|knight|dragon)   frames.js  style frames (?frame=...)
  lines.json  narration   music/score.py  original score   mix.py  foley + mix   subs_export.py  -> .srt   build.sh  one-shot rebuild
```
1. `node core/render/still.mjs styles/stained-glass/demo 36 --q nosub=1`: review stills. Use `?test=sheet` for the model sheet.
2. `core/tts/tts.py lines.json voices` → `asr_check.py`.
3. `node core/render/events.mjs` → `music/score.py` → `mix.py` → `subs_export.py`.
4. `node core/render/video.mjs styles/stained-glass/demo --fps 24 --workers 3` (1356 frames, about 3–4 min with 3 workers; Canvas2D vector glass plus the WebGL compositor).
5. `CRF=22 sh demo/tools/mux.sh out/video24.mp4 mix.wav stained-glass.mp4 24 4` (grain 4).
