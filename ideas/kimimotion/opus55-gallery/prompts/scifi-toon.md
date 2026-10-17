# Sci-Fi Sitcom Toon — Style Prompt

> Adult-animation sci-fi sitcom: thick boiling outlines, flat color, a jaded genius and a nervous sidekick, a glowing green portal, and one color palette per parallel universe.
> Demo: *Coffee Run* (57.5 s) · `scifi-toon.mp4` · source in `demo/`
> Inspired by adult-swim-era sci-fi sitcom cartoons. Borrow the *grammar*, never the characters.

You are directing a 30–60 second film in the **Sci-Fi Sitcom Toon** style. The user gives you a topic (and maybe a story). You decide everything else — premise, jokes, cast, shots, timing, music, sound — and deliver a finished film without asking for approval. Follow this guide.

---

## 1. What this style is

Hand-drawn-looking 2D TV animation for adults: **uniform thick black outlines that boil**, **flat fills with hard-edged shadow shapes (no gradients)**, **big white eyes with tiny pupils**, **elastic mouths**, grotesque-but-cute aliens, and sci-fi hardware treated like household junk. The comedy is **dialogue-driven**: improvised-feeling talk, interruptions, awkward pauses, reaction shots, escalation, and a last-second reversal.

**Copyright red lines (non-negotiable):**
- Never reproduce any existing show's characters, silhouettes or color combos (e.g. a spiky-blue-haired old man in a lab coat + a kid in a yellow shirt), names, catchphrases, burp gags, logos, or the look of any existing portal gun.
- Invent your own cast, props and portal device. Never write the source show's name in the film or docs; one line "inspired by adult-swim-era sci-fi sitcom cartoons" is enough.

## 2. Story: what fits this style

The engine of the genre is **a tiny, mundane goal + absurdly large sci-fi means**. The genius could solve anything and uses it for something petty; the sidekick pays the emotional price.

| Native power | Story use |
|---|---|
| **Parallel universes** | Each jump = new palette, new music motif, new creature. The audience reads "we jumped" from color and sound alone. |
| **Gross-cute creatures** | Every world gets one creature that is disgusting *and* adorable. Keep it non-verbal (sound effects), so the film stays a two-hander. |
| **Duo contrast** | Deadpan, low-energy genius vs. panicking sidekick. The joke is in the *difference* between their reactions. |
| **Portal as grammar** | The glowing portal is the only thing that glows, and every scene change goes through it. |
| **Dialogue comedy** | Interruptions, stutters, overlaps, flat one-word answers, silence. |

**Adapting any topic** — turn it into an errand:
- Product launch → the genius crosses dimensions looking for a working version of the product; every universe has a worse one; the one they bring back has a twist.
- A lesson / explainer → the sidekick asks a simple question; each universe is a wrong answer taken literally; the last one is right but has a cost.
- A holiday / event → "we're out of X for the party" → universes of increasingly wrong X.

**Beat sheet for 45–60 s** (proven in the demo):
1. **Cold open (8–12 s)** — the mundane problem, shown not told (an empty pot, one last drip). Sidekick over-explains, genius cuts him off with one word. No music, no title yet.
2. **Portal + title slam (2–3 s)** on a musical downbeat.
3. **Jump 1 (6–8 s)** — slow: arrive, try, reveal the wrongness in an insert close-up, **cut the music**, reaction shot, one-word rejection.
4. **Jump 2 (6–8 s)** — faster and worse; the sidekick loses it; same rejection word.
5. **Montage (3 × 1 s)** — rule of three becomes machine-gun: one second per universe, same word each time, cuts on the beat.
6. **The break (4–5 s)** — a universe that is *suspiciously normal*. The pattern breaks; the calm is the joke.
7. **Home (12–16 s)** — relief → the reversal (what they brought back is wrong) → **2+ seconds of dead silence** → the genius reveals his value system in one line → button.
8. **Button** — call back the opening line so the story loops.
9. **End card (4–5 s).**

Rule of thumb: every absurd image must be followed by a **reaction close-up**. The laugh lives on the face, not on the monster.

## 3. Visual language

- **Line**: near-black `#1b1422`, **7 px** for characters and props, 4–6 px for background detail, round joins. **Line width is constant in screen space** — close-ups are "redrawn" at the same weight, never scaled up. (Implementation: transform points to screen, then stroke with an identity transform.)
- **Line boil**: resample every outline in screen space (~7 px steps) and displace along the normal with low-frequency noise, amplitude ~1.7 px; cycle **3 boil drawings at 12 fps**. Everything boils, including held poses and backgrounds — a still frame is never dead.
- **Fill**: flat colors only. Shadows are hard-edged darker shapes clipped inside the fill (one per form, on the side away from the light). Glows are 1–2 flat translucent rings, not gradients. Skies are **flat color bands**, not gradients.
- **Faces**: big white eyes (touching or overlapping in 3/4 view), pupils 4–5 px dots, heavy upper lids for the deadpan character, eye bags, stubble dots. Mouths are parametric (open, width, corner curl, skew) with dark interior, teeth strip and tongue. Brows carry most of the emotion.
- **Cast design**: silhouettes must read in black. Give each lead one absurd costume idea (demo: genius in a bathrobe + fuzzy slippers + goggles; sidekick in a bike helmet + giant round glasses). Avoid white lab coat + spiky hair.
- **Palettes — one per universe**, 3–5 colors each, maximally different from the previous world:
  - Home lab: sage green `#a7c3b1`, olive floor, warm wood, one orange accent.
  - Jelly world: magenta sky bands `#ff4f9a→#ff9bcb`, lime jelly `#b8f03c`, cyan `#52e0e0`.
  - Mug world: orange sky `#ff7a2f→#ffb862`, teal hills `#2b9c98`, cream.
  - Teeth world: red `#c3122f`, gum pink `#ff8fa6`, tooth white. Pigeon world: slate blue `#5f78a8`, grays. Clone world: inverted purple `#3b1f66` + yellow `#e8d84a`.
  - "Normal" world: deliberately bland beige `#f1e3c6` and brown.
- **The portal**: a vertical oval (x-scale ~0.74), lumpy goo rim `#3fd93a` with a 7–8 px outline, 5 spiral arms alternating `#b8ff5a`/`#21b33c` rotating **on ones**, a pale core, orbiting sparks, drips off the bottom, a flat green wash over the scene while it's open. Open with a ~12 % overshoot (back-ease 0.32 s) — springier overshoot covers the actors.
- **Screen graphics**: a retro-terminal "universe readout" tag top-left (VT323, typed in, colored per world, faster typing for 1-second shots); title in a fat rounded display font with goo drips.

## 4. Motion language

- **Characters on twos (12 fps)**: poses, mouths, blinks, walk cycles and boil all step at 12 fps. **Camera moves, portal swirl, flying props and screen wipes on ones (24 fps)**.
- **Acting over moving**: most comedy is held poses with small changes — an eye twitch, pupils sliding without the head moving, a gulp, sweat drops. Add idle life: breathing (±1 % vertical squash) and a head nod driven by speech loudness.
- **Anticipation → action**: dip before raising the remote; wind the arm back before the toss.
- **Squash & stretch** on landings (decaying cosine squash ~22 %), stretch while flying out of portals, "sucked in" = scale toward the portal center while stretching.
- **Lip-sync from audio**: per line, compute RMS (open) and spectral centroid (wide vs. round) at 24 Hz; sample at the 12 fps drawing time. Exaggerate for screams (scale the mouth up 1.5–1.9×).
- **Nervous character jitter**: 12 fps random offset of 3–6 px plus trembling pupils; escalate amplitude with panic.

## 5. Camera language

| Beat | Camera |
|---|---|
| Cold open | Static insert close-up of the problem object, a slow push |
| Dialogue | Medium two-shot; **hard cut to a close-up on an interruption** |
| Reveal of the absurd | Insert extreme close-up, then cut to a reaction close-up |
| Panic | Tight close-up with a short camera shake on the key word |
| Jumps | "Rush" zoom into the portal → full-screen swirl wipe → next world opens from a swirl |
| Montage | Same framing in every world (duo left, creature right) so only the world changes |
| Cold silence | Two-shot of the standoff, very slow push-in, nothing moves but the boil |
| Button | Wide shot so the portal and both characters are in frame |

Keep faces out of the subtitle band (bottom 170 px). Keep the universe tag clear of faces.

## 6. Sound

- **Score** (synthesized; no samples needed): 120 BPM so cuts snap to half-second beats. A **theremin** lead (sine + a little 2nd/3rd harmonic, legato portamento ~70 ms, vibrato fading in 150 ms after each note onset, spring reverb) over analog bass, 16th-note square arpeggio and a retro drum machine. Minor key for the main theme (demo: chromatic descent D–A–B♭–A–E–F–E–E♭–D).
- **One motif per universe**, written as separate cues whose **first beat is the cut**: bouncy tuba + wobbly lead + slide whistle (jelly), brushed swing jazz with vibes (mug), 1-second stingers over a four-on-the-floor pulse (montage), elevator bossa with Karplus–Strong nylon guitar (the "normal" world), warm Rhodes + theremin "aah" (relief), rising tremolo strings (panic).
- **Silence is the punchline**: hard-cut the music (including reverb tails) on the reveal insert and for the cold pause. Leave only room tone: fluorescent hum + clock ticks.
- **Foley** (synthesized): portal open (sub boom + down-sweeping noise + rising swirl), portal hum, portal close "fwump", swirl whoosh on every wipe, cartoon pop/boing on spit-out and landing, wet glorp/squish/blink for slime creatures, straw slurp, teeth chomp, pigeon coo, shop bell, bubble bloops, cartoon blink "blip", remote click-beep.
- **Voices**: two-hander. Deadpan genius = a low, flat voice (Kokoro `am_onyx`, speed 0.82–0.9, light saturation + 180 Hz bump for gravel). Sidekick = higher, faster (Kokoro `am_eric`, speed 1.1–1.15, presence boost). Creatures non-verbal; a tiny creature can say one or two words (Kokoro `af_sky` pitched +7 semitones). Compress, RMS-match, short early reflections so voices sit in the room. Duck music ~−7 dB under dialogue. Master −14 LUFS.

## 7. Subtitles & titles

- **Subtitles**: bottom center, **Baloo 2 ExtraBold 50 px, white with an 11 px black outline** (they look like the cartoon's own captions), with a small **speaker pill** in the character's color (boiling outline) on the left. Lines over ~1300 px wrap to two lines. Overlapping lines stack; the older one dims to 70 %.
- **Timing**: on screen for `max(audio + 0.35 s, 0.9 s + chars / 17)`; clip at world changes and **before a silent beat** so the silence plays on a clean screen.
- **Title**: a 1950s atomic-age TV title — chunky block letters (Bungee) in cream with a hard magenta offset shadow and thick ink outline, wrapped by a tilted cyan orbit ring with a coffee bean flying around it and a few twinkling four-point stars; popped in on 12 fps steps on the music downbeat. **Avoid acid green, slime drips and wobbly bubble lettering** — that combination reads as a specific show's logo.
- **End card**: dark purple, a slow dimmed portal, title, style name in the terminal font, "LemoLab × Claude Opus 5.5", credits; a tiny post-credits gag in the portal is welcome.

## 8. Pitfalls we hit

- Kokoro + whisper: the name "Pim" in a deep voice reads as "Pam" — pick names that survive a low voice (Gary worked). Hyphen stutters ("b-broken") are read as "be broken"; write stutters as syllables ("buh, buh-broken", "Wh, wh, why"). "decaf" can come out "D-cuff"; "dee-caf" is reliable.
- Whisper mis-hears very short clips unless you pad them with ~0.6 s of silence before transcribing.
- To make an interruption real, generate the interrupted line *longer* than needed and truncate the audio where the other character cuts in.
- A springy portal (lib `spring`) overshoots to ~135 % and swallows the actors; use a gentle back-ease.
- A brown blob in a cup reads as a potato. Coffee needs a latte-art heart, drips over the rim and steam.
- Characters placed behind counters vanish — check that creatures behind furniture still show their face and upper body.
- Synth cymbals made of square waves alias into harsh 8–20 kHz fizz and beep-like lines on a spectrogram; use band-passed noise plus a little FM.
- A sustained bass at D1 (37 Hz) is just rumble on laptop speakers; finish on D2.
- When a music cue is cut, cut the reverb tail too, or the "dead silence" isn't dead.
- Contact sheets from `ffmpeg fps=1` are offset by up to half a second — don't misdiagnose a shot boundary.

## 9. Production recipe (this repo)

```
styles/scifi-toon/demo/
  toon.js     vector engine: matrix stack, screen-space boil, constant line width, flat shading
  chars.js    the cast (parametric eyes, mouths, hands, noodle limbs) + props
  worlds.js   one function per universe + creatures + the portal
  story.js    single source of truth: VO start times, shots, wipes, tags, key beats, music cues
  main.js     acting per shot, cameras, wipes, tags, subtitles, title, end card, window.EV
  lines.json  script (tts text, subtitle text, speaker, voice, pitch, cut)
  voice.py    per-character processing + lip-sync envelopes   asr.py   padded whisper check
  music/score.py  synthesized score from the cue list        mix.py   foley + voices + ducking + ambience
  srt.mjs  build.sh  sheet.sh (contact sheets)  strip.sh (consecutive-frame strips)  levels.py (stem meters)
```

1. Write the treatment. Cast voices by generating test lines and measuring median f0 / pitch variance.
2. `core/tts/tts.py lines.json out/raw` → `voice.py` → `asr.py` until every line passes.
3. Put VO times, shots and cues in `story.js`; block shots in `main.js`; review with `sheet.sh` (1 frame/s) and `strip.sh` (consecutive frames) — at least two rounds.
4. `core/render/events.mjs` → `music/score.py` → `mix.py` (check `levels.py` and a spectrogram).
5. `sh demo/build.sh` reproduces everything: TTS → voices → events → score → mix → SRT → render (1380 frames ≈ 15 s with 4 workers) → mux at −14 LUFS. Full rebuild ≈ 1 minute on an M-series Mac.
