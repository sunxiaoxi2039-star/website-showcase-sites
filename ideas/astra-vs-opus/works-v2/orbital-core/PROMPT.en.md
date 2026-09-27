# One-Shot Generation Prompt: Orbital Energy Core (Orbital Core)

> Purpose: have a code model generate the complete static site for this piece in a single reply.

---

Using **Three.js (r181, ES modules + an import map, a local `vendor/` directory, no CDN, no build tools)**, build a single-page 3D product showcase whose hero is a "dual-ring energy core." The goal: it should look like a hard-surface product finely modelled in Blender and rendered in Cycles/Eevee, not a sphere with two doughnuts. All UI text in Chinese.

## File structure
```
index.html        entry point (importmap: "three" → ./vendor/three/three.module.min.js, "three/addons/" → ./vendor/three/addons/)
css/style.css
js/model.js       procedural modelling: exports buildOrbitalCore() → { root, parts, uniforms, materials }
js/main.js        renderer, environment lighting, post-processing, camera, interaction, mode state machine, UI wiring
js/audio.js       the core's hum, synthesized with WebAudio
vendor/           three.module.min.js + three.core.min.js + OrbitControls / EffectComposer / RenderPass / UnrealBloomPass / OutputPass / ShaderPass and their dependencies; woff2 fonts
```

## The model (fully procedural; no external models loaded)
Write a `sweepProfile(profile, {phi0, phi1, steps, closed, caps})`: sweep a 2D profile `[(r, y)…]` around the Y axis (equivalent to Blender's Spin/Screw modifier). **Generate a separate band of faces with its own normals for each profile edge**, so bevel faces become crisp highlight lines; optionally cap the ends at phi0/phi1 with `ShapeUtils.triangulateShape`; correct triangle winding automatically from the vertex normals. UV u runs around the circumference, for "turned metal" brushing.

1. **Plasma core**: a sphere of radius 0.5 with a ShaderMaterial — 3D simplex noise + domain-warped fbm to create convection cells, layered with bright filaments from `pow(1-|noise|, 9)`; a three-stop palette of deep blue → cobalt → white-hot, output as HDR (>1) to feed the bloom; a slight corona rim at the edge. Wrap it in two additively blended BackSide Fresnel halo spheres (0.86, 1.35).
2. **Geodesic containment cage**: `IcosahedronGeometry(0.66, 1)`, dedupe the vertices and extract the 120 edges → thin cylindrical struts as an InstancedMesh + 42 octahedral titanium nodes + small LEDs on the 12 five-valent vertices. The whole cage slowly rotates.
3. **Gyroscopic double ring (the key part)**: the outer ring, R=1.42, stands vertical and turns about Y with the gimbal (azimuth α); the inner ring, R=1.16, hangs from the outer ring at ±X on two stepped titanium pins and flips about the X axis (pitch β) — a gimbal that really turns, not two intersecting tori. Each ring:
   - has a rectangular section with a 0.014 bevel and a groove cut into its outer face;
   - is cut into 12/10 segments with 0.03 rad gaps between them, each segment capped at both ends;
   - has a continuous glowing rail in the groove and a glowing "spine" strip at the ring's core that **shows only through the slits**, so every slit is a line of blue light;
   - carries thickened titanium clamps at 0°/90°/180°/270°, each with three LEDs (two cool, one warm amber accent).
   - The whole gimbal also tilts by ~0.2 rad, with a slow precession.
4. **Levitation base**: one profile with steps, bevels and a ring groove, swept into a single body; a glowing ring in the groove; a Fresnel-patterned emitter lens at the centre (a concentric-step shader); on the deck, a dial drawn on a Canvas (fine 2° ticks, long 10°/30° ticks, a ring of micro-text `ORBITAL CORE · SPECIMEN 01 …`, 4 triangular index marks), additively blended and slowly turning with α; 72 cooling fins around the side (InstancedMesh); 24 status-light slits on the step risers; and an additive beam with flowing stripes from the lens up to the core.
5. **Floor**: a large round dark floor + a radial-gradient "baked AO" contact-shadow decal + an additively blended floor-effects shader (a pool of light under the base, a dashed measuring ring every 1.45 units, fine ticks on the outer ring, and an expanding shockwave in Pulse mode).

## Materials and lighting (the key to the "Blender look")
- A procedural brushed texture: draw a few thousand random grey lines along u on a Canvas → use as the roughnessMap; rings and base use `MeshPhysicalMaterial` with `metalness 1`, the rings with clearcoat, the base with `anisotropy` enabled, for the radial highlights of turned metal.
- Build your own mini "HDRI studio": in a scene, place a dark gradient sky sphere + a big overhead softbox + a cool-blue light strip on the left + a white light strip on the right + a blue horizon glow behind + a small warm bounce card, and bake it with `PMREMGenerator.fromScene` into `scene.environment`.
- Put a shadow-casting point light inside the core (intensity following energy), so the rings and cage cast shadows onto the base; add a cool-white key light and a blue rim light.
- The background is a sky-dome shader the same colour as a FogExp2, with the floor dissolving seamlessly into it in the distance — no hard horizon line.
- Post: `EffectComposer` (a HalfFloat, MSAA 4x render target) → `UnrealBloomPass` (strength ~0.45, radius 0.4, threshold 0.95, so only HDR emitters bloom) → `OutputPass` (ACES) → a custom ShaderPass: slight chromatic aberration at the edges + vignette + film-grain dithering (which also removes banding in the darks).

## Interaction and state machine
- OrbitControls: damping, panning disabled, pitch limited so you can't go under the floor; distance computed automatically from the viewport aspect ratio (further in portrait); use `camera.setViewOffset` to push the model slightly right on desktop to make room for the headline, and slightly down on phones.
- Opening: the camera eases in from a distant low angle over 3.4 seconds, and the core "ignites" between 0.35 and 2 seconds (timed by the real clock so it completes even on slow devices); control is handed over as soon as the user drags. Double-click or R to reset smoothly.
- Four modes (buttons + keys 1–4):
  - **Orbit**: α and β turn slowly, the camera orbits automatically, the core breathes slightly;
  - **Pulse**: rotation speeds up, energy beats with a "lub-dub" double-peaked heartbeat envelope (1.25 s period), and each beat sends a shockwave ring across the floor and a low thump through the audio;
  - **Still**: all rotation speeds damp to zero, the core idles with a faint glow, and the status lights turn amber;
  - **Exploded**: the gimbal returns to neutral, the outer ring lifts above and the inner ring drops below, both rotating flat; the cage expands, the core floats up, the camera target rises; 5 HTML callouts with leader lines appear (plasma core / geodesic containment cage / outer ring · azimuth ring / inner ring · pitch ring / levitation base, with dimensions), their anchors projected every frame, ring callouts automatically taking the outermost on-screen point, and callouts clamped inside the viewport on phones.
- All speeds, energy and explode progress are smoothed with exponential damping, so switching modes never jumps.
- Adaptive resolution: below 30 fps, step pixelRatio down toward 1.

## UI (layered over the canvas)
- A thin 34 px top bar at the very top: 「← 三方对照」 on the left, 「轨道能量核心」 + a small pill tag in the middle, 「原作 @author ↗」 on the right.
- Brand 「ORBITAL / OBJECTS」 + a small orbit icon top-left; 「样本 01 / DUAL-RING CONTAINMENT」 (Specimen 01) top-right.
- A large headline on the left (serif, the second line in italic gradient type): 「两道轨道 / 一颗恒星。」 ("Two orbits / one star.") + a short description.
- A live spec table on the right: status, core frequency (THz), outer-ring azimuth α, inner-ring pitch β, field output %, with a small oscilloscope below plotting energy history.
- Four mode buttons bottom-left (with small glyphs and key hints), a footer with controls hints + a sound toggle (WebAudio: two slightly detuned sawtooth waves through a resonant low-pass + a sub-bass sine + a high shimmering tremolo, with the filter cutoff following energy and rotation speed).
- A 76 px fine grid in the background (with a fading mask) and SVG noise grain.
- ≤740 px: the headline moves to the top and the description is hidden, the spec table becomes a three-column strip, and the four buttons share one row equally; no horizontal overflow at 390 px wide.
- Fonts: Instrument Serif (headline) + IBM Plex Mono (data), woff2 files in vendor, with Chinese falling back to system serif/sans.

## Quality requirements
- Zero console errors; show a Chinese notice if WebGL creation fails.
- All glow colours use HDR values and "glow" through bloom, not by brightening the diffuse colour.
- Darks must be deep (cobalt to near-black); the image must not wash out to white or grey overall.
