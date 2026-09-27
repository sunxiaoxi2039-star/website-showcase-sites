# Interactive V8 Engine · Independent Reverse-Engineering Notes

## How I read the original (what it is really selling)

The original's one-line prompt was "highly detailed, interactive visualization of a V8 engine," and press coverage described it as "a hands-on 3D classroom": you can switch between the four strokes in real time and inspect the crankshaft, camshafts, firing order, valve timing and cylinder pressure. I see three layers to its appeal:

1. **Mechanical realism**: not a spinning model, but the genuine kinematic linkage between pistons, connecting rods, crankshaft, cams and valves — it looks like it *has* to move that way.
2. **Making the invisible visible**: firing order, valve overlap and peak cylinder pressure — concepts that normally live in textbook curves — appear in sync with the 3D view.
3. **Hands-on**: the user isn't watching a video; they can switch strokes, change views and take it apart.

So the key to recreating it isn't "build a good-looking V8" but **drive the 3D, the curves and the written explanations from one physical model, so any change shows up everywhere at once**.

## Reverse inference: which key mechanisms I deduced from limited material, and why

There is no demo — just one sentence and the author's style as a reference — so most mechanisms were worked backwards from "how a real V8 works + the five features the description names":

- **Crank type → cross-plane**: the coverage names "firing order," and the most instructive and most common V8 is a 90° bank angle with a cross-plane crank (crankpins at 0°/90°/270°/180°), firing order 1-8-4-3-6-5-7-2 (GM numbering). Rather than hand-writing each cylinder's phase, I specify only "firing order + bank angle" and **solve for each crankpin angle**. The solution puts each left/right pair on a shared pin with the four pins exactly 90° apart, which shows the model is self-consistent. Clockwise rotation with the odd bank on the right as seen from the front matches the real GM layout.
- **"Switch the four strokes in real time" → centred on a single cylinder's cycle angle ψ**: switching strokes really means "turn the focused cylinder to that stroke." I define each cylinder's state as ψ = θ − firing phase (0° = compression TDC), and derive every display from ψ — gas colour in the cylinder, valves, curve cursors, HUD text — so switching simply rotates the crank forward to the target ψ rather than swapping animation clips.
- **"Valve timing" → real timing figures and real cam profiles**: I use typical values of IVO 12° BTDC / IVC 48° ABDC / EVO 52° BBDC / EVC 10° ATDC, with 22° of overlap; the camshafts run at 2:1 reduction. The cam shape isn't drawn by eye: it's generated point by point in polar coordinates from the same lift curve (base circle + lift, 1° of cam = 2° of crank), so the moment the lobe presses the lifter matches the lift curve exactly.
- **"Cylinder pressure" → computed, not a fake curve**: a single-zone thermodynamic model plus a Wiebe heat-release function, integrated from intake valve closing to exhaust valve opening, with exponential decay approximating blowdown. At WOT/3000 rpm it gives a peak of about 68 bar @ 14° ATDC, an IMEP of 13.5 bar and about 470 N·m of torque — all in the range of a real 5 L naturally aspirated V8. That turns "adjust spark advance" into a real physics experiment.
- **The author's taste**: another piece by the same author is "a 2D schematic that transitions naturally into 3D." I inferred a liking for the clarity of engineering drawings and made "schematic ⇄ 3D" one of this piece's view modes.

## Implementation approach and key technical decisions (and why)

- **Three.js (vendored locally, import map, no build)**: the most mature option for procedural modelling in WebGL, and statically hostable. I copied only the 13 files actually used (2.3 MB).
- **All geometry is procedural**: no glTF. The block is built as "cross-section + extrusion" (the bank cross-section includes cylinder bores and head-bolt holes; the crankcase is the front profile extruded along the axis), so every shell is a closed solid — a precondition for the section cut to "fill" correctly. Crank webs and connecting rods are extruded 2D profiles; pistons, valves and spark plugs are lathed; the cams are extrusions of profiles generated from the lift function; the timing chain and serpentine belt follow "tangent paths around the convex hull of the circles."
- **Section cut = clipping planes + back-face fill**: each bank's shell is clipped by a plane through the cylinder axes, removing the valley-side half, and the back faces are rendered with a red cross-hatch shader, giving the classic mechanical section view. In section mode the head is swapped for a "combustion-chamber plate + cam bearing" skeleton so the exhaust valves are visible too.
- **One physical model drives everything**: `physics.js` is pure functions (testable in Node); `computeCycle()` outputs p, V, burned mass fraction, heat-release rate and temperature at 0.5° resolution. In 3D, the gas colour/brightness, the flame front, glowing exhaust pipes, airflow particle speed, the sound and every chart are sampled from it.
- **Schematic transition**: two complementary sets of clipping planes — the solid material keeps what's right of a scan line, the blueprint material keeps what's left — and while the line sweeps across, the camera does a dolly-zoom (interpolating FOV and distance to keep the framing constant), so the perspective naturally flattens into a near-orthographic front view. The blueprint material is "fill + Fresnel outline + EdgesGeometry creases": internal parts are opaque (automatic hidden-line removal), shells are drawn only as outlines (so you can see through them), and SVG dimensions are overlaid at the end (90° bank angle, bore, stroke, centre lines).
- **Visibility via layers, not `visible`**: layers don't cascade to children, so "solid hidden while its blueprint copy still shows" can coexist, and both sides render during the transition.
- **Charts drawn in Canvas 2D**: p–θ (linear/log) with lift overlay, the p–V loop, a valve-timing circle, an 8-cylinder × 720° phase chart and a scrubber with stroke colour bands, all redrawn every frame in sync with the 3D.

## What I tried differently from the "usual approach"

- **The usual approach**: a rotating V8 model + four buttons that play the matching animation + a static valve-timing diagram.
- **What I tried**:
  1. **Adjustable parameters, computed results**: spark advance, throttle, rpm and intake VVT all recompute the pressure cycle in real time; the panel reports where the pressure peak lands and warns of knock risk, and **automatically sweeps to find MBT (minimum advance for best torque) for the current operating point**. Dragging VVT rotates the whole intake cam relative to the crank, and you can watch the valve overlap grow on the timing circle.
  2. **Cam profiles generated from the lift curve**, not a generic "egg" shape.
  3. **The cylinder gas is a stateful volume**: blue on intake → purple and denser on compression → a flame front spreading out from the spark plug → orange-red on power → brown on exhaust, with its height following the piston in real time; when the exhaust valve opens, the matching exhaust manifold briefly glows.
  4. **A scanning 2D schematic ⇄ 3D transition**, with pistons and gas still moving in the line drawing.
  5. **Sound synthesized from physical events**: a pulse is triggered at each cylinder's EVO (exhaust valve opening), with the odd and even banks panned left and right. Because a cross-plane crank fires unevenly within each bank (270°/180°/90°/180°), the V8 "burble" emerges on its own. In slow motion you hear individual thumps; in real time they merge into a roar.
  6. The firing order is expressed three ways at once: a sequence bar (the cylinder on its power stroke lights up), the 8-cylinder × 720° phase chart (where you can see at a glance the "staircase" of power strokes staggered every 90°), and firing flashes on the 3D cylinder-number labels.

## Pitfalls and how I fixed them

- **The first version was a white-out**: the cylinder gas used additive blending with a low bloom threshold, so metal highlights plus gas all overflowed to white. I switched to alpha-blended gas volumes (preserving hue), raised the bloom threshold to 1.9, lowered the RoomEnvironment reflection strength and added a hemisphere light, so only combustion and sparks truly glow.
- **The right bank's pistons were invisible after the section cut**: the clipping plane passes through the cylinder axes, so with the camera front-right, the right bank faces it edge-on. I moved the default camera further toward the front and up, so both banks' valley-side sections face the viewer.
- **In section mode the intake manifold disappeared and the airflow particles were left "floating"**: the manifold now shows as a faint ghost material when sectioned, giving the particles a "duct" for context.
- **The particles were barely visible**: point size used a fixed factor and came out at 1 pixel; it's now a screen-space size derived from canvas height and FOV.
- **Highlighting a part bled colour through shared materials**: one material was shared by several parts, so selecting the crankshaft also lit up the bolts. Materials are now cloned per "material × part," so highlighting and ghosting apply precisely per part.
- **The timing cover started as a hand-drawn fan shape** and looked fake in exterior mode. It's now the convex hull of all the sprockets' outer circles, with bolts spaced evenly along the edge.
- **About 1 fps under headless SwiftShader**: screenshots caught stale composited frames. The test script now waits for loading to finish, disables CSS transitions and uses longer timeouts, and I exposed `__v8.finish()` to jump the transition forward for verification.
- **Mobile**: the panels stack vertically below the stage, with the drivetrain bar right under the 3D view; `camera.zoom` scales by aspect ratio, and there's no horizontal overflow at 390 px wide.

## Self-assessment: where it may match or beat the original, and where it falls short

- **Where it may match or beat the original**:
  - Physical fidelity: firing order, crankpin phasing, valve timing and cylinder pressure are all computed and mutually consistent, and you can tweak parameters to see cause and effect (advance → peak position → knock/MBT).
  - The schematic ⇄ 3D transition and live motion in the line drawing are a dimension the original post doesn't mention.
  - The density of the data panels (p–θ, log scale, p–V, timing circle, 720° phase chart) should make it better at *teaching* than most pieces of its kind.
- **Where it falls short**:
  - Visual fidelity: the procedural geometry has no casting texture, chamfer detail or AO, so the block looks rather "clean" and is some way from photoreal; if the original used finer modelling or textures, its exterior mode will clearly beat mine.
  - There's no true exploded-view animation (parts separating along their axes) — only "highlight the selection, ghost the rest."
  - The airflow is just particles along a path, not a fluid; in-cylinder swirl and tumble aren't shown.
  - I couldn't see the original's video, so the interaction layout is inferred from the description, and the camera language may differ from the original.

## What I'd do if I started over

- Build the "ψ drives everything + physical model" layer before the geometry — I did that this time too and it paid off — but lock down lighting and post-processing parameters earlier to avoid re-tuning the bloom again and again.
- Use SDFs/normal maps to give the block a cast texture and chamfers, and add screen-space AO on the GPU.
- Add an "exploded view" mode: parts separate along their own axes by assembly hierarchy and can be reassembled step by step.
- Use an AudioWorklet for continuous exhaust synthesis (including intake resonance) instead of discrete pulses.
- Extend the schematic mode to a movable section plane (a cross-section through any chosen cylinder).

## Model identifier

claude-opus-5-5
