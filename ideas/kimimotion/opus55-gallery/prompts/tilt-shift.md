# Tilt-Shift Miniature — Style Prompt

> A real-looking town photographed from high above with a tilted lens and a time-lapse camera, so the whole world reads as a tabletop model.
> Demo: *Toy Town Rush Hour* (38s) · `tilt-shift.mp4` · source in `demo/`

You are directing a 30–60 second film in the **Tilt-Shift Miniature** style. The user gives you a topic. You decide everything else — story, shots, timing, sound — and deliver a finished film. Follow this guide.

---

## 1. What this style is

A town seen from high rooftops through a **tilt-shift lens**: only a thin horizontal strip of the frame is sharp, everything above and below melts into blur. Your eye reads that as a macro shot of something small, so the town becomes a model. Two more things make the trick work: **saturated, sunny colour** (model railway paint) and **time-lapse** (cars and people move in fast, jittery steps like wind-up toys).

The reference is Sam O'Hare's *The Sandpit* (2010). Learn from its grammar: high vantage points, the blur band, time-lapse rhythm, cloud shadows sweeping over streets. Do not copy its city or its music. In your film the town, vehicles and people are all original and procedural. Show no real landmarks, brands or logos.

## 2. Story: what fits this style

The medium has four native powers. Use at least three:

| Native power | Story use |
|---|---|
| **Time-lapse speed** | Time itself is a character. Fast-forward shows systems (traffic, crowds, sunrise). **Dropping suddenly to real speed (×40 → ×1)** is the strongest move you have: it says "look at this one small thing". Put it at the emotional peak. |
| **The blur band** | The sharp strip is your pointer. Move it (rack focus) to follow the subject, and narrow it to a sliver for the most intimate moment. |
| **God's-eye scale** | Everything is seen from above, like a board game or a machine. Systems stories work best: a city as a sequencer, an ant colony, a factory, a festival setting up. End by rising until the town becomes a pattern. |
| **Long-exposure light** | At dawn or dusk, car lights leave trails that draw on the town like a pen. One trail can be the whole opening. |

**Adapting any topic:** make the topic a *system with many small actors*, then find the *one tiny actor* the system bends around. A product launch → the city's traffic flows toward one shop. A love story → two commuters' paths cross on the same crosswalk every morning. A history lesson → one street time-lapsed across a century.

**Emotional arc (30–45s):** quiet (one actor) → the system wakes up (actors multiply, rhythm builds) → maximum density → **hard drop to real time on one detail** (the twist, the joke, the heart) → release back to fast-forward → rise to a scale reveal. One subject, one goal, one twist.

## 3. Visual language

- **Camera height and angle**: always high. Oblique views at 45–55° pitch, 110–200 m from the subject, lens 27–30° vertical FOV. Use straight top-down (90°) for the "board game" moment. Real tilt-shift is always shot from high up, never at street level. The one exception is the emotional peak. There, drop to a true **medium close-up at the actors' height**: camera ~1.7 m up, 6–8 m away, ~12° pitch, 17° FOV. A blurred foreground object (the hero car's hood edge with its lights) frames the sharp actors, who fill ~1/4–1/3 of the frame height. A long lens from high up kept the actors as tiny dots and killed the moment (review note).
- **Blur band** (`demo/post.js`): physical depth of field mixed with a screen-space band. CoC in pixels = `mix(aper·(1/focus − 1/z), sign(dy)·amp·(max(0,|dy|−w)/0.5)^1.2, mix)`, clamped at 30 px.
  - Typical values: band half-width `w` 0.055 (0.035 for the most intimate shot), `amp` 30, `mix` 0.55–0.7. Physical aperture `aper` 5000–9000 (world units in metres).
  - Put the band on the subject. When the subject moves, project it to the screen every frame and slide the band there (`band.follow`).
  - Gather at output resolution (after a 2× supersampled render): 128 spiral taps with per-pixel random rotation, and far samples must not bleed onto nearer sharp ones.
- **Grade**: NeutralToneMapping. Saturation ×1.55, soft contrast +0.42, slight warm highlights, vignette 0.3. Lower saturation at night.
- **Light**: a hard sun with sharp shadows (4096 shadow map fitted to each shot), a hemisphere fill kept low (~0.6, warm ground bounce) so shadows stay blue but not murky, and a sky-gradient environment map for glass and car paint.
  - **Cheat the sun azimuth per shot**: each time-lapse clip is its own shot, so aim the sun behind or beside the camera and front-light the facades you see. One fixed sun left half the film backlit and grey.
  - Dawn: sun ~3.5° below the horizon, a pink-orange low fill from the east (`#ffb48c`), only ~9% of windows lit, sodium street-light pools. It should read as 6 a.m., not midnight.
- **Model-like detail** (what separates "filmed miniature" from "game CG"):
  - Facade shader with punched / ribbon / curtain-wall / brick window types, 1.6–3 m bays, light window frames, darker window reveals, and world-space grime noise. Windows get a sky-reflective glass tint (roughness 0.08–0.22, metalness 0.35), and walls darken toward the ground (fake contact AO).
  - Awnings, shop signs, AC units, balconies, water tanks, antennas, solar panels, parapets.
  - Worn road markings, manholes, asphalt patches and oil stains.
  - Cars: rounded bodies, dark glass cabins, wheels, a soft contact shadow blob under every vehicle, and red brake lights when stopped.
  - GTAO on top of all of this.
- **Palette**: facades are warm whites, cream, terracotta, brick, pale yellow, mint, sky blue. Cars are white, silver, black, red, blue and yellow taxis. Park greens are saturated `#6fa24a`. Road asphalt is dark `#4b4e53` so white markings and cars pop. People are 0.5 m colour capsules, like model-railway figures.
- **Actors at close range**: organic lathe-turned bodies with a sheen "fuzz" material (`MeshPhysicalMaterial`, sheen 1, sheenRoughness 0.55). Make them 20–30% larger than real so they read on screen.

## 4. Motion language

- **Time-lapse stutter is the soul of the style.** In fast-forward, the whole city (cars, people, lights, sun) updates at **8 Hz**, holding each position for 3 frames at 24 fps. At 120 BPM that is exactly a 16th note, so every jump lands on the musical grid. The **camera stays smooth on every frame.** When the rate drops below ×2 the stutter disappears and motion becomes silky, which makes the real-time drop hit much harder. Step to 12 Hz while the rate is between ×2 and ×6.
- Traffic is an **IDM car-following simulation** pre-computed per clip: lights on a 96 s cycle, "don't block the box" logic, a pedestrian crossing that stops all lanes. Heavy inflow plus box-blocking gives honest gridlock. Keep light changes on bar lines by choosing the cycle offset per clip.
- Crowds are closed-form: they gather at corners during red and surge across on green, which reads beautifully at ×24.
- A hero actor needs art-directed timing. Script it (dawn car path, train kinematics fitted through beat times, duck hops) rather than hoping the sim hits a beat.
- Close-up acting: anticipation squash (0.28 s) → stretch jump → land squash → settle. Make the comedy beat a second failed attempt before success.

## 5. Camera language

| Beat | Camera |
|---|---|
| Opening | High oblique wide, very slow slide; the blur band follows the single subject (a light trail) |
| Title | Oblique across rooftops onto an **in-world sign** (neon letters light one per 8th note) |
| System waking up | Medium-high oblique on an intersection or a station, slow push; the band on the stop lines / platform edge |
| Peak density | **Straight top-down, slowly rotating** — the most "toy" angle |
| Real-time detail | One continuous **dive** from the top-down into a low medium close-up over the hero car's hood, with the car's front and lights as blurred foreground. The eye-line lands on the actors before the body does (look target eases out faster than position). Speed ramps ×40 → ×1 during the dive; land on the narrowest band. Rotate the top-down so it ends facing the close shot's direction, otherwise the dive twists. |
| Ending | **Vertical rise** with logarithmic height (40 m → 820 m) through a thin cloud layer until the town becomes a circuit-board pattern |

## 6. Sound

- **Music**: minimalist marimba ensemble (Steve Reich grammar: pulse, phasing, voices added one at a time, pulsing chords). Not generic piano and strings. **Fixed phrase skeleton; city events only decide which notes sound.** Cars crossing stop lines gate marimba A, green lights play woodblock accents, crowds trigger glockenspiel, train carriages play the bass. Each section has a base fill rate so the phrase stays audible.
  - At peak density the skeleton is full, with phased marimba B and tuned car-horn chords (sampled brass staccato pulsing 8ths).
  - The real-time drop is a **tape-stop**: varispeed the music 1 → 0.22, drop voices out one by one, then true silence. During the rest, only one soft note plays per story event, each hop a step up the scale.
  - The first note of the film is the top note of the final chord.
- **Sound design follows speed**: in time-lapse, keep it music-first with a faint granular "sped-up city" hiss, rail clacks and relay clicks. At real speed the world turns suddenly real: idling engines, distant city, sparrows, tiny quacks and peeps, webbed feet patting asphalt. On release, engines rev and wind sweeps upward during the rise.
- **Voice**: relaxed American male (Kokoro `am_adam`, speed 0.9–0.95), 5–6 short lines. Music ducks about 8 dB under the voice. Verify every line with whisper; write numbers as words in the text and put digits in the `asr` field.

## 7. Subtitles & titles

- Subtitles are a **road sign**: green `#0f5e3c` rounded panel with an inset white keyline, Overpass 600 44 px white (Overpass is the open Highway-Gothic revival, OFL), and a tiny traffic-light icon lit green on the left. Place it 118 px above the bottom, inside the lower blur band.
- Keep a **time-lapse clock** top-left (Overpass Mono): `07:12` with small seconds and a speed readout (`×24 TIME-LAPSE` in amber, `×1 REAL TIME` in green). It is the audience's speedometer for the native trick.
- Title: an in-world rooftop neon sign on a building facing a wide avenue, so nothing blocks it. Add a small road-sign tag underneath: "A TILT-SHIFT MINIATURE".
- End card: the same road-sign language over the top-down town. Show the title, the style name and `LemoLab × Claude Opus 5.5`.

## 8. Pitfalls we hit

- **Tall buildings + shallow pitch = no streets**: the first pass was a skyscraper forest. Keep 2–10 floors and pitch 45°+.
- **The dawn subject was hidden in a street canyon**: route the hero on the lane nearest the camera side, and make the band follow it.
- **Neon sign occluded**: put it facing a wide avenue.
- **Instance cap silently dropped the hero car** (1,400 cap vs 2,800 cars alive). Cull by distance from the camera (radius = 4× camera height) and raise the cap.
- **Cars stop 2 m short of stop lines** because IDM's jam gap applies to them too. For the story-critical crossing, move the stop line closer and subtract the jam gap.
- **Gridlock left the story lane empty**: box-blocking starved the segment in front of the crossing. Exempt the main avenue from box-blocking so the queue forms behind the hero.
- **Focus lagged a frame**: compute actors before the camera so `band.follow` uses this frame's position.
- **Top-down → oblique dive twisted 180°**: rotate the top-down so its screen-up already matches the close shot.
- **Close-up too far away**: the peak moment first used a high long-lens view, and the ducks were 1/15 of the frame. Go low and close. Use a small near plane (0.08 m) for the foreground hood. Put headlights on the top front edge so they read from above, and hold the hero car until the rising camera has lifted clear of it.
- **Clouds washed out the ending**: use unlit white, low opacity, and almost nothing below the camera.
- **Streetlight pools read as bubbles**: make them denser, larger and fainter so they merge into warm street lines. Remove street furniture from the close-up area.
- **Whole scene backlit and grey**: cheat the sun azimuth per shot.
- **Dawn read as midnight**: add a pink east fill and cut lit windows by a factor of ~3.

## 9. Production recipe (this repo)

```
styles/tilt-shift/demo/
  post.js    tilt-shift DOF (band + physical), grade      city.js   procedural town, facade shader, sign
  geo.js     merged-geometry builder                      sky.js    clock → sun/sky/fog/env, dawn glow
  traffic.js lanes, lights, IDM sim, fleet, trails, walkers   train.js commuter train
  ducks.js   lathe ducks + hop choreography               story.js  120 BPM timeline, time windows, rate curves
  main.js    cameras, stepping, crowds, HUD, events       mix.py    ambience + foley + VO + score
  music/score.py  sampled marimba score (skeleton + event gating)   subs.mjs  subtitle export
```

1. `sh styles/tilt-shift/demo/build.sh` rebuilds everything from scratch: TTS → whisper → events → subtitles → score → mix → 912-frame render (~60–80 s on an M-series GPU with 3 workers) → mux (−14 LUFS, grain 1) → styleframe and poster.
2. Iterate with `node core/render/still.mjs styles/tilt-shift/demo <t…> --q noev` (`noev` skips the event scan). Debug flags: `nohud`, `nodof`, `nostep`, `az=<deg>`, `cam=x,y,z,lx,ly,lz,fov`, `aper=`, `bamp=`, `bmix=`.
