# Living Screencast — Style Prompt

> A product walkthrough that looks like a real screen recording, where a low-resolution mascot lives inside a high-resolution interface and acts out what the software is doing.
> Demo: *Clawd Moves In* (59.4 s) · `living-screencast.mp4` · source in `demo/` · Claude Code in the Claude app, with Clawd (the Claude Code pixel mascot) as the protagonist. Unofficial fan film.
> **References (grammar only):**
> - **Screen Studio-style product recordings:** auto-zoom to the cursor, cursor smoothing, click push-ins, and a window floating on wallpaper.
> - **Apple "Guided Tour" videos:** real interface, calm narration, one feature per sentence.
> - **Duolingo and Headspace mascot motion:** squash and stretch, anticipation, a character that performs inside the UI.
> - **The Browser Company (Arc) launch films:** playful tone and fast cutting.
>
> Never copy their characters, UI, music or footage.

You are directing a 45–75 second walkthrough of a piece of software in the **Living Screencast** style. The user gives you the product and the features to show. You decide the story, shots, choreography, sound and music, and you deliver a finished film.

---

## 1. What this style is

The film looks like a **screen recording of the real product**, but it is not a recording. Every window, menu, diff line and button is **redrawn in 2D (HTML/CSS/SVG)**, so the camera can go anywhere and every pixel is controllable. Text stays sharp at any zoom.

A **mascot made of big square pixels** lives in that high-resolution world. The clash of two resolutions, a hard-edged 18×10 sprite against anti-aliased UI, is the look.

The mascot is the software's agency made visible. When the software reads files, it runs along the file tree. When it writes a plan, it holds a pixel pencil. When it tests the app, it stomps the button.

**Two actors, never a hand:**
- The **cursor** is the user.
- The **mascot** is the software.

Keep every interaction truthful. Only show buttons, modes and shortcuts that exist, and check them against the product's documentation.

## 2. The six rules

| Rule | Why |
|---|---|
| **Real UI, redrawn** | Every label, mode name and shortcut matches the real product. No screenshots, no lorem ipsum. The demo code, diff and test output are coherent, and the "app under test" really changes. |
| **Recording-software camera** | One continuous take inside the screen. Push in on the action, drift slightly, and whip-pan between panes. Zoom never drops below 1, so we never see outside the monitor. Cuts happen only under chapter transitions. |
| **Pixel grid is sacred** | The mascot, its props (pencil, "!", sparkles, heart, dust) and its trails share one square-pixel grid with crisp edges. It scales with the camera. Its position snaps to half-pixels, so its motion feels stepped. |
| **Gravity = top edges of UI** | The mascot only ever stands on the top edge of a real element: input box, menu, file row, diff line, button, CI bar, the title's letters. Position comes from **measuring the live DOM** every frame, never hand-placed coordinates. |
| **Cause and effect** | Every mascot action triggers a real UI state change, and every user action is a cursor move, click or keystroke shown on a KeyCastr-style HUD. |
| **Information layers** | A chapter pill (01–04), the keystroke HUD, frosted-glass caption pills, and an optional "▶▶ 4×" time-lapse tag. Nothing else overlays the screen. |

## 3. Director's toolkit (all used in the demo)

1. **Match-cut origin story.** The terminal logo's quadrant block characters (`▐▛███▜▌`) are the mascot's pixels 1:1. Each tall quadrant morphs into a square pixel, and the character climbs out of the terminal, leaving a dashed outline behind.
2. **Diegetic title.** The product name drops in as the app's empty-state heading, and the mascot lands on its letters on the downbeat.
3. **Staging on a moving floor.** The mascot follows the typing caret, jumps onto the @-mention popup, and rides the sent message as it flies up the chat.
4. **Time-lapse with a tag.** Reading files runs at 4× with a flashing tag and rack focus: the chat is blurred and the pane is sharp.
5. **Spotlight freeze.** On the key promise ("nothing changes until you say go") the camera pushes in and a vignette isolates the *No files changed* badge.
6. **Directional motion blur only on whips.** It is derived from camera speed and applied as an anisotropic Gaussian on an **untransformed wrapper**. Slow moves stay sharp.
7. **The film itself changes state.** The dark-mode toggle's reveal doesn't stop at the preview. The circle keeps growing over the whole app and desktop, and the rest of the film is in dark mode. At the end, the mascot's last stomp brings the light back from its own feet.
8. **Cell division.** The new session splits the window, and the mascot splits into two with a pixel burst.
9. **Karaoke-ball end card.** The mascot hops from word to word of the slogan, landing on each word as it is spoken.
10. **The cursor and the mascot are characters.** The cursor "pets" the mascot on the head: it squashes, closes its eyes, and a heart pops up.

## 4. Mascot acting

- **Jumps:** anticipation crouch (0.14 s, squash 0.28), stretch on take-off, tucked legs in the air, a landing squash with a damped bounce, and dust puffs.
- **Idle:** a tiny squash on every beat of the score, so the character breathes in time with the music. It blinks at irregular intervals.
- **Walk:** 9 steps/s leg alternation. The direction flips the sprite.
- **Eyes carry the acting:** n / l / r / u / d / wide / happy / shut / blink. They look at what matters: the popup, the cursor, the line being revised.
- **Arms:** down / up (cheer) / wave. Props sit on the same grid.

## 5. Sound

- **Score in two resolutions.** The hi-fi layer (piano, upright bass, drum kit, glockenspiel, real samples) is the world. The chiptune square wave is the mascot's voice.
- **Score structure:**
    - The band enters when the mascot lands on the title.
    - Each chapter transition gets a tom fill and a crash.
    - The last chapter drops the drums to build tension.
    - The dark-mode stomp crossfades the whole band into a low-passed "night" version.
    - The split screen becomes a left/right duet (piano left, chiptune right).
    - The end-card words are chiptune notes; the final stomp opens the filter on a big major-9 chord.
- **Foley:** keyboard (a thock plus a click, with human timing jitter), trackpad clicks, pane swishes, popup pops, CI ticks, a shutter for screenshots. Mascot steps, jumps and landings are 8-bit.
- **VO:** calm, one feature per line, product names verified with whisper. Keep effects off word onsets: a keypress landing on "Start" masked the word.

## 6. Build

- `demo/film.js` is the timeline. VO lines are placed at fixed times, and every visual beat hangs off a spoken word (`W(id, word)`). It holds the camera moves, the `Actor` (mascot) segments, the `Cursor`, and the sound events.
- `demo/ui.js` turns state into HTML for the terminal and the Claude app.
- `demo/clawd.js` holds the sprite grid, poses and pixel props.
- `demo/main.js` handles the light and dark layers, DOM anchor measurement, motion blur, and the HUD (captions, keys, pixel wipes, spotlight).
- `demo/sound.py` builds the score, foley and VO from `events.json`, with ducking.
- Run everything with `sh styles/living-screencast/demo/build.sh`. The full render takes about 30 s.

## 7. Don'ts

- Don't invent features or rename modes. If a button isn't in the docs, it isn't in the film.
- Don't let the mascot float in empty space, cover text the viewer should read, or sit under a caption.
- Don't use screenshots, blur-filter "fake depth" on text you want read, or zoom out past the screen.
- Don't put a hand, arm or finger on screen. The cursor is the user.
