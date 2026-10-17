# 80s Cel Anime — Style Prompt

> Hand-painted cel animation from the golden age of Japanese OVAs, re-created in code: flat two-tone cels over airbrushed backgrounds, backlit neon, limited-animation timing — played back as a 1987 videotape on a CRT television.
> Demo: *City Lights, 1987* (59 s) · `cel-anime-80s.mp4` · source in `demo/`

You are directing a 30–60 second film in the **80s Cel Anime** style. The user gives you a topic (and maybe a story). You decide everything else (story, shots, timing, sound) and deliver a finished film. Follow this guide. The style is *inspired by 1980s Japanese cel animation*: borrow the era's craft, never a specific work's characters, mecha, logos, place names or signature shots.

---

## 1. What this style is

Two materials stacked on top of each other, and the contrast between them is the look:

| Layer | Look | How we make it |
|---|---|---|
| **Background painting** | soft, painterly, airbrushed gradients, glowing windows, wet reflections | painted once at load into large offscreen canvases (color + emissive pair), then only *slid* per frame |
| **Cel** (characters, vehicles, props) | flat fills, **hard-edged** shadow and highlight shapes, **colored** outlines (dark brown for skin, dark purple for hair, dark navy for a blue jacket, never pure black) | vector paths drawn per frame, stepped at 12 fps or 8 fps |
| **Light** | backlit cel (透過光): neon, lamps, title letters glowing *through* the frame; lens flares, halation | a separate emissive canvas that feeds a bloom + red halation pass |
| **Playback** | a videotape on a CRT: horizontal chroma bleed, fine scanlines, RGB aperture grille, phosphor glow, darkened corners, faint signal noise; power-on line at the start, tracking noise at story beats | WebGL post pass (deterministic per frame); only a whisper of noise in ffmpeg |

If a frame looks like modern digital anime, you are missing one of the four rows above.

## 2. Story: what fits this style

Pick stories the medium tells best. 80s cel anime has five native powers; use at least four:

| Native power | Story use |
|---|---|
| **Painted city vs flat cel** | Night cities, rain, neon, sunsets, space, the sea at dawn. Put a small flat-colored hero inside a huge painted world. |
| **Limited animation** | Moments that *stop*: a held close-up, a freeze on the climax, a pan across one big still. Stillness is drama, not a budget cut. |
| **Backlit light** | Anything that glows: signs, headlights, cockpit gauges, screens, lasers, stars, a title card. |
| **Speed grammar** | Vehicles, chases, flights, races, transformations: speed lines, looping backgrounds, impact frames. |
| **The theme song** | An era of city pop, synth funk and anime openings. A song can be a plot object (a tape, a radio broadcast, a concert). |

**Emotional arc for 45–60 s:** cold open with a deadline → the hero sets off (title hit) → joyful momentum montage → an obstacle → one decisive move (the climax *freezes*) → release into a new light (night becomes dawn, rain becomes clear sky) → end card. One hero, one goal, one deadline.

Adapting any topic: turn it into **a delivery, a race against a deadline, or a launch**. A product launch → a courier races the product across a neon city to the stage. A love story → two lights crossing a sleeping city. A history lesson → a pilot flies through eras painted as backgrounds. Plant the goal early (a rocket on the horizon, a clock tower), block it in act two, reveal it in the light at the end.

## 3. Visual language

**Cel rendering (the rules that make it read as a cel):**
- Fill, then **hard** shadow crescent, then **hard** highlight crescent, then colored outline. No gradients inside a cel shape, ever (exception: a single "harmony" painted still at the climax).
- Automatic shading trick: clip to the shape, fill the region `shape − shape shifted toward the light` with the shadow color (even-odd path). Same with a small shift away from the light for the highlight, and for a neon **rim light** in a saturated color. This gives consistent two-tone shading with one line of code per shape. Add hand-placed shadow shapes for cast shadows (bangs on forehead, chin on neck).
- Outlines ~2–3 px at 1080p for medium shots; scale the global line width down for extreme close-ups (0.45–0.8×) or lines turn into marker strokes.
- **Color models per time of day** (色指定): define the character once in daylight colors, then derive night and dawn sets by multiplying lit / shadow / line colors separately (night: lit ×[.78,.74,1.0], shadow ×[.58,.52,.92]; dawn: lit ×[1.04,.9,.84]). A backlit silhouette set (dark purple with an orange rim) for heroic moments against the sky.
- **Character design — how to draw an 80s heroine (rules that separate it from modern moe anime):**
  - *Construction*: skull sphere + jaw. A long **egg-shaped** face (narrower than you think, lower face slightly long), chin a *soft point* — neither a V nor a U. In 3/4 view the far eye is foreshortened (~0.6 width), the far cheek contour shows the **cheekbone turn** (bulge under the eye, then in toward the mouth), the nose sits near the far contour. Neck of normal thickness, starting behind the chin; the throat line starts below the jaw angle. Profile: small skull-back, clean brow–nose–lips–chin line, small slightly upturned nose, neck leaning forward.
  - *Proportions*: eyes centered near the vertical middle of the head (crown to chin), spaced about one eye-width apart; mouth at the upper third between nose base and chin.
  - *Eyes*: almond-shaped (inner corner low, outer corner lifted), a **thick upper lash line** thickening outward into a flick with 2–3 separate lashes, a double-eyelid line, a **tall oval iris** layered top-dark band → dark upper half → main color → bright lower crescent, a pupil, one large and one small highlight; lower lashes only a faint short stroke at the outer corner; long thin eyebrows. Never round moe eyes with giant irises.
  - *Nose & mouth*: the nose is a small shadow plane plus one stroke at the base; the mouth has lip shape, a dark-red interior with tongue/teeth, and a family of shapes (closed, set, talk, "oh", pant, smile, open smile) plus a faint lower-lip stroke. Blush is one faint layer — no hatched blush lines (that is a post-2000 mannerism).
  - *Hair*: separate locks with thickness that overlap, with dark gaps between them (a dark under-layer wider than the locks); tips of uneven length and sharp; 2–3 stray strands; the signature **"angel ring" highlight** — one continuous band following the skull curve with a zigzag lower edge; rim-light edges when backlit. Lock outlines thin and close to the hair shadow color, or the hair turns into a tangle of lines.
  - *Colored line art*: skin outlined in a **thin warm dark brown** (≈ #5a2e2e), hair in dark purple, lashes/brows near-black purple; only hard props (headset, goggles) keep near-black, slightly heavier lines. Uniform thick black lines read as modern vector art.
  - *Shading*: one consistent light direction: two-tone cels with bangs casting a light shadow on the forehead (follow the lock edges, keep it pale), the chin casting onto the neck, a shadow plane under the far cheekbone and beside the nose. When the key light comes from the other side, switch to an automatic crescent on the near side plus a warm rim on the lit contour.
  - *Acting*: blinks are fast — the closed drawing holds 2–3 frames (one drawing at 8 fps). Emotion lives in brows (inner end down = resolve; outer end down = exhaustion/worry), upper lid height, iris size (small when surprised) and mouth corners; add body (shoulders up when panting).
  - *Night color model*: override skin separately (neutral light + cool purple shadow); multiplying daylight skin by a blue-purple night tint makes the whole face pink under neon.
  - Build a **model sheet first** (3/4, profile, front × 4 expressions + a head close-up) and approve it before putting the face into shots; draw every shot from the same head function.
- **Palette:** night = indigo / deep violet / neon magenta / cyan / warm window gold; dawn = periwinkle / rose / peach / pale gold. Give the hero one accent color that pops in both (here: coral scarf).

**Backgrounds (the painted layer):**
- Build every plate at load: sky gradients, airbrushed clouds (blurred ellipses with a lit underside), skyline towers with window grids, facades with lit shop windows, neon signs with a tube stroke (white core + colored edge) and a colored spill on the wall.
- Always paint a matching **emissive plate** (only the light sources) and slide it with the color plate; it feeds the glow pass.
- **Wet asphalt**: a vertically flipped, blurred, streaked copy of the facade plate (color and emissive), darkened with horizontal ripple bands. This single trick sells "rain-soaked neon city".
- Text on signs: generic words only (BAR, CAFE, 喫茶, ホテル, カラオケ…), never real brands.
- Moving backgrounds get a light horizontal smear (~16 px) — enough to soften strobing, not enough to look like a photo.

**Light and lens:**
- Backlit cel: signs, lamps, gauges, title letters are drawn on the emissive canvas too. Bloom from the emissive canvas is strong; bloom from the color canvas only above a high threshold (0.9) and weak, or white cels wash out.
- Halation: the widest bloom levels tinted red-orange, added on top.
- Lens flares: star-burst, a long horizontal anamorphic streak, hexagonal ghosts along the line through frame center. Use them on headlights, the sun, a glint in the eye.
- **Occlude the glow**: when a cel passes in front of a lit background, stamp its silhouette in black onto the emissive canvas, otherwise neon bloom bleeds through the character.

**Videotape + CRT playback (restrained):** the conceit is "a 1987 OVA recorded on videotape, watched on a CRT". In the post shader, per frame and deterministic:
- *Chroma bleed*: convert to Y/Cb/Cr, keep luma sharp, box-blur chroma horizontally (~7 px at 1080p), shift the red-difference channel right ~2 px.
- *Scanlines*: 3 px period, strength ~0.18, a cosine profile; the dark gap shrinks on bright pixels (`1 − a·ph·(1 − 0.6·L)`). Anchor them to output pixels, not to the image, so they stay put when the picture jumps.
- *RGB aperture grille*: vertical R/G/B stripes, ±0.06.
- *Phosphor glow*: add a wide blur of the bright areas (~0.35).
- *Corners*: darken the corners (`1 − 0.28·(2u²v² + 0.25(u²+v²))`); no curved-screen black borders.
- *Noise*: faint per-pixel signal noise in the shader; in ffmpeg only `noise=c0s=2:allf=t` (the CRT texture already costs bits — keep CRF ≈ 23 to stay near 30 MB per minute).
- *Subtitles are on the tape*: composite them inside the shader after grading but before scanlines/grille, so they get the same TV texture without being color-graded.
- *Two accents*: a **power-on** at the first frame (a dot stretches into a bright horizontal line, then opens vertically, ~0.6 s, with a small "thunk" + line-whine sound), and **tracking noise** for 6–10 frames at a story beat that involves the tape (per-line horizontal tearing, one rolling noise band, a vertical hop, a head-switching strip at the bottom, with a short hiss/warble in the mix).
- Remove film-only artifacts (gate weave, dust, scratches, misregistration); they contradict the videotape conceit.
- *Moiré check*: export a frame, downscale to 1280×720 and inspect. A 3 px sinusoidal scanline becomes a clean 2-row alternation at 720p (no beat); 900p shows a faint 5-row pattern; below 480p it disappears.

**Frame:** full 16:9, treated as a theatrical feature. (A 4:3 pillarbox is valid for an OVA feel but wastes the showcase.)

## 4. Motion language

- **Characters step at 12 fps (on twos)**; performance beats (blink, eye opening, throttle twist, lip flaps) step at **8 fps (on threes)**. Camera pans, light sweeps, flares and rain move on ones (24 fps). Stepping the camera reads as judder.
- **Cycles** for secondary motion: hair and scarf are ribbons driven by a travelling sine wave with a 4-drawing cycle (6 drawings when the wind is calm). Vehicle bounce = a 12 fps random jitter of a few px.
- **Move light, not drawings**: a held cel with colored light bands sweeping across it (composite `source-atop` on the cel layer) is the cheapest way to make a close-up feel fast.
- **Impact frames**: 2 frames (1/12 s) of an inverted or monochrome silhouette over radial lines right on the hit, then cut to the result.
- **Hold the climax**: the biggest moment is a painted still (the "harmony" cel) with a slow pan and only the cycles moving.
- **Lip flaps**: 3–4 mouth shapes cycled at 8 fps while the line plays; end on a held expression.
- Eyes: blink/opening in three drawings (0.3 → 0.72 → 1.0 open), then narrow the upper lid for determination. A star glint in the highlight on a musical accent.

## 5. Camera language

| Beat | Camera |
|---|---|
| Cold open | **Multiplane crane-down** over a tall painted plate (sky → rooftops → neon → street), foreground layers faster |
| The object that matters | Tight insert on a hand holding it, soft bokeh behind, a highlight sliding over its plastic |
| Resolve | Extreme close-up on the eyes, eyes open on the line |
| Title | Backlit title card, letters flicker on at 12 fps, a light bar sweeps across, star glint |
| Momentum | Side tracking with 3–4 parallax layers + tail-light trail; rear view into a neon canyon (pseudo-3D); held bust with light bands; mechanical insert (wheel, gauge); a wide establishing shot that **plants the goal** |
| Obstacle | First-person approach to the obstacle; hands and gauges in extreme close-up, cutting faster |
| Climax | Low front view on radial speed lines → one-beat freeze + white flash → impact frame → painted still with slow pan → impact frame → landing with camera shake |
| Release | The same side-tracking composition as the night ride, repainted at dawn with the sky open |
| Ending | Warm close-up that answers the opening line, then the end card |

Cut on bars. Keep subtitles clear of the lower 120 px of important action.

## 6. Sound

- **Music**: an original city-pop / synth-funk "anime opening" is the best fit (we synthesized one in numpy — see `demo/music/score.py`): 110–120 BPM, a major key with maj7/9 chords, the J-pop "royal road" progression (IVM7–V7–iii7–vi7), FM electric piano (DX7-style 1:1 carriers + a 14:1 bell transient), slap bass (thumb + octave pops), gated-reverb snare, synth brass stabs, chorus-y 16th-note guitar chanks, string pad, a singable lead hook, FM bell sparkle, and a **key change up a semitone** for the last chorus.
- **Write the score to the cut**: intro under the cold open, a fill bar with space for engine revs, the title on a brass hit, verse under the montage, a pre-chorus build, **one beat of true silence** before the climax, the chorus on the climax, an accent on the landing, and the final chord on the end card.
- **Diegetic twist**: if the story has a song object (tape, radio), band-pass the score to a cassette/AM sound for one bar when it "plays", then open to full range with the key change.
- **Foley** (all synthesized): engine from an RPM curve (harmonic saw stack + firing jitter + band-passed exhaust pulses, low-passed when airborne), rain bed + random drops, tire hiss on wet road, wind, bells, radio squelch clicks, impact boom, metal scrape and sparks, cassette clicks, button + motor, rocket ignition and roar.
- **Voices**: an English-dub feel — a young heroine (Kokoro `af_bella`) and a radio dispatcher (Kokoro `am_michael` through a band-pass 380–2800 Hz + saturation + squelch). 6–8 short lines. Verify every line with whisper and rephrase anything it mishears (we changed "Launch is at dawn" → "The launch is at dawn").
- **Mix**: limit then compress the TTS, balance voices by RMS ~10 dB above the ducked music, duck music ~9 dB under lines, duck engine and ambience 3 dB, keep the chorus 4–6 dB louder than the intro, two-pass loudnorm to −14 LUFS.

## 7. Subtitles & titles

- Subtitles are part of the tape: draw them on an offscreen canvas and composite them inside the CRT pass (they get scanlines but no grading). Semi-condensed sans (Barlow Semi Condensed 600, 54 px), cream-yellow `#fff0a0` with a 9 px dark outline and a soft shadow, 96 px above the bottom. Radio lines in cyan `#8ff4ff` with a small boxed "● BASE" tag. A line stays up for max(duration + 0.6 s, 1.9 s) and yields when the next line starts.
- Title card: heavy italic Latin title with a **chrome gradient** (sky blue → white horizon line → violet → pink → gold), thick dark outline + neon outline, katakana line above (Dela Gothic One), a red year, a spaced-out tagline; glow through the emissive layer; flicker-on and a light sweep.
- End card: darkened final background, title, style name "80s Cel Anime", "LemoLab × Claude Opus 5.5", a one-line originality note and credits.

## 8. Pitfalls we hit

- **Bloom from white cels**: a threshold bloom on the color canvas turned the white bike and the jacket pink. Fix: bloom mostly from the emissive canvas; threshold 0.9 and weak on color.
- **Neon bleeding through the character**: the emissive plate is behind the cel but has no depth. Stamp every cel's silhouette in black onto the emissive canvas.
- **Black hole in the headlight**: the S-curve `c*c*(3-2c)` goes to zero above 1.0 — clamp before tone curves.
- **Rim light too thick**: the offset crescent must be 2–4 px, not 6–8, or thin hair ribbons turn completely pink.
- **Hair that looks like tentacles**: uniform tapering ribbons with round tips read as tentacles. Use wide, overlapping locks with sharp tips, a darker lock in between, and a solid hair mass behind them.
- **Bangs over the eyes**: keep lock tips above the upper lash line except one lock between the eyes.
- **Front-view faces are the hardest drawing**: tuck the rider behind a tinted windscreen so only goggles and hair show, and let the headlight flare carry the shot.
- **Pseudo-3D behind the camera**: points with z < near plane flip upward into the sky. Clamp z.
- **A rocket that leaves the frame**: follow it with a delayed tilt and a slower (quadratic) climb.
- **Fonts**: load every weight you draw with `document.fonts.load` before painting plates, or the canvas silently falls back to a serif.
- **Grain in ffmpeg makes files huge**: luma 4 + chroma 1 at CRF 22 gives ~32 MB/min; luma 5 + chroma 2 at CRF 18 was 270 MB.
- **Single-pass loudnorm** landed at −13.5 LUFS; two-pass with `linear=true` lands at −14.0.
- **Dynamics**: a hot limiter squashed the chorus to the same loudness as the intro. Normalize to the 99.99th percentile and let only rare peaks hit the limiter.

- **Face that looks like a paper mask** (first version): a 3/4 body with a flattened front face — equal eyes, no cheekbone turn, V chin, long thin neck. Fix by constructing the head (sphere + jaw), foreshortening the far eye and drawing a proper far contour.
- **Moe eyes in an 80s film**: round eyes with giant irises and hatched blush instantly date the drawing to the 2000s. Use almond eyes, thick lash line with a flick, faint blush.
- **Uniform black lines** make cels look like vector clip-art; colored, thinner skin lines fix it.
- **Pink faces at night**: multiplying the skin by the night tint plus magenta rim light and pink light sweeps washes the face pink. Give skin its own night colors and keep the pink sweep weaker on faces.
- **Forehead patches**: gaps between bang locks expose hard shadow shapes; widen the dark under-layer and lighten the forehead shadow.
- **File size with CRT**: scanlines + grille add fine detail; CRF 22 went over 35 MB/min, CRF 23 with luma-only noise 2 lands at ~31 MB.

## 9. Production recipe (this repo)

```
styles/cel-anime-80s/demo/
  cel.js     path / cel / ribbon / flutter helpers      pal.js   color models (day → night / dawn / backlit)
  rider.js   side-view bike + rider, limbs, wheels      head80.js  80s heroine head: 3 views × expressions, body/collar/scarf
  hands.js   pinch-grip gloves                          bg.js    painted plates (street, skyline, tall crane plates, reflections)
  fx.js      rain, splashes, speed lines, flares, lamps, light trails
  post.js    WebGL videotape + CRT pass (bloom, grade, chroma bleed, subtitles, scanlines, grille, glow, power-on, tracking noise)
  shots.js + scenes1–4.js   one function per shot     story.js  bar-aligned timeline, lines, credits
  hud.js     VHS-style subtitles     main.js  plates, shot dispatch, sound events
  lines.json voices   mix.py   music/score.py (original score)   tools/ (still, sheet, srt, mux)
```

1. Treatment → `story.js` (116 BPM bar grid, shots, lines).
2. `node styles/cel-anime-80s/demo/tools/still.mjs styles/cel-anime-80s/demo --range 0.5:58.5:1 --out /tmp/cs` → `tools/sheet.py` contact sheet → look → fix. `?test=model|close|side` renders the model sheet / head close-up / rider; `?raw=1` bypasses the CRT pass; `?nosub=1` hides subtitles.
3. `.venv/bin/python core/tts/tts.py demo/lines.json demo/voices` → `core/tts/asr_check.py`.
4. `.venv/bin/python demo/music/score.py` (score + stems + cue times).
5. `node core/render/events.mjs demo` → `.venv/bin/python demo/mix.py`.
6. `node core/render/video.mjs demo --fps 24 --workers 4 --out demo/out/video24.mp4` (1416 frames ≈ 36 s on an M-series Mac).
7. `sh demo/tools/mux.sh demo/out/video24.mp4 demo/mix.wav cel-anime-80s.mp4 24`, `python demo/tools/srt.py`.

## 10. Credits and licenses (demo)

- Original score, sound design, animation and all drawings: generated by code in this folder (numpy, Canvas 2D, WebGL). No samples, no stock art.
- Voices: Kokoro TTS (Apache 2.0), voices `af_bella`, `am_michael`.
- Fonts (SIL Open Font License 1.1, license files in `demo/fonts/`): Dela Gothic One (artakana), Kanit (Cadson Demak), Barlow Semi Condensed (Jeremy Tribby).
- Inspired by 1980s Japanese cel animation; all characters, vehicles, places and the story are original.
