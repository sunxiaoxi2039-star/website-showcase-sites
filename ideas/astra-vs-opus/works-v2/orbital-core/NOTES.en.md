# Orbital Energy Core · Independent Reverse-Engineering Notes

## How I read the original (what it is really selling)

Orbital Core Showcase is really a workflow demo dressed up as a product page: GPT-6 Astra built an "energy core" model in Blender by itself, exported a GLB, wrote a Three.js viewer and deployed it to Cloudflare Workers. What viewers remember comes down to three things:

1. **A convincing "object"**: a glowing sphere, two mutually perpendicular rings and a metal base. It isn't complicated, but it came out of Blender and feels like an asset.
2. **Product-showcase layout**: deep navy night, a fine grid, film grain, a very large serif headline on the left — 「能量不被容纳。」 ("Energy will not be contained.") — a spec table on the right (Status / Core frequency / Orbital offset), and three mode buttons bottom-left (Orbit / Pulse / Still). The overall tone is an editorial magazine.
3. **You can play with it**: drag to rotate, scroll to zoom, the model slowly turns by itself, and switching to "Pulse" makes it throb.

So what has to be recreated isn't just the model, but the feeling of "a carefully made physical object on a quiet, restrained display stand."

## Reverse inference: which key mechanisms I deduced from limited material, and why

Sources (neither the original post nor the workers.dev demo would open in this environment):

- The community-maintained awesome-gpt-6-astra README (reachable via raw.githubusercontent.com) says: "Blender, Three.js, GLB", "modeling an energy core, two rings and a metal base … rotation, zoom, automatic orbit and pulse controls", and links to **the author's public code repository**.
- The README, `index.html`, `src/main.js`, `src/style.css` and `public/model.glb` from the author's repo `wangruofeng/orbital-core-showcase` could all be fetched from raw.githubusercontent.com. They are the original work's own public material, not someone else's copy, so I read them. I also ran the original locally with a three.js I had fetched myself and took screenshots as a reference baseline (kept only in /tmp, not in the output directory).

Conclusions drawn from this material:

| Inference | Evidence |
|---|---|
| The model has only 4 nodes: `Energy_Core` (a sphere, r=0.8), `Ring_X` / `Ring_Y` (tori with a major radius of about 1.23 and a tube radius of 0.075, set perpendicular to each other with a 90° quaternion) and `Platform` (a cylinder, r=1.65, height 0.32) | Parsing the GLB's JSON chunk in Node: nodes, rotation quaternions, and the min/max bounds of each accessor |
| There are only three materials: `Blue_Emission` (emissive (0.005,0.22,1), KHR emissive_strength 4) and `Dark_Metal` / `Platform_Metal` (a dark blue-grey with metalness 0.8, roughness 0.25) | The GLB's materials section |
| In the viewer, the emissive material is replaced wholesale with `MeshStandardMaterial(emissive 0x0068ff, 1.85)`; **no environment map, no bloom post-processing**; ACES at exposure 1.3; four lights (hemisphere, key, a blue rim point light, a bottom underglow) | main.js |
| "Pulse" = the whole model scales ±4.2% by sin(4.8t) and spins faster; "Still" = auto-rotation off; the numbers in the spec table are driven by sin | `tick()` in main.js |
| The `SIGNAL / OFF` button only toggles its label; there is no sound at all | The click handler in main.js |
| Running the original, the core is crushed by ACES into a washed-out pale-blue disc, and the rings are featureless black tubes | Local render screenshots |

The conclusion: the original's "Blender feel" comes mainly from the **asset pipeline**; the rendering itself is fairly plain. That's exactly where I could surpass it.

## Implementation approach and key technical decisions (and why)

**1. No GLB — a "Blender modifier stack" in JS instead.** There's no Blender in this environment, and the essence of hard-surface modelling (bevels, segmentation, caps, clamps, grooves) can actually be done more finely with procedural sweeps. I wrote `sweepProfile()`: a 2D profile swept around the Y axis, the equivalent of Blender's Spin/Screw. Three key points:
   - **Every profile edge becomes its own band with its own normals**: bevel faces aren't smoothed away and become crisp highlight lines. That's precisely where the hard-surface look of Blender's "Bevel + Auto Smooth" comes from.
   - **An angular range can be specified, with automatic caps** (`ShapeUtils.triangulateShape`), so the rings can be cut into 12 / 10 segments with gaps between them.
   - **Triangle winding is corrected automatically from the vertex normals**, so no profile, whatever its orientation, ends up with flipped faces.

**2. "Two intersecting tori" turned into a real gimbal.** In the original, the two rings share a radius and pass through each other, so they can only turn together. My outer ring (R 1.42) turns about the vertical axis (azimuth α); the inner ring (R 1.16) hangs from the outer ring at ±X on two stepped titanium pins and flips about the horizontal axis (pitch β); and the whole gimbal carries a 0.2 rad tilt and a slow precession. The two rings keep crossing at different rhythms, so the motion itself has mechanical logic.

**3. Energy expressed as "light leaking through the seams."** Each ring has a groove in its outer surface, with a continuous HDR light rail at the bottom; a glowing "spine" is also buried in the ring's core, hidden by the segmented shell and **showing only through 22 slits**. So the metal is dark and the light leaks out of the structure — much more like a real object than painting the whole ring emissive.

**4. The core is "living" plasma, not an emissive sphere.** 3D simplex noise, with fbm domain warping to create convection cells, and `pow(1-|n|, 9)` to create bright filaments; a three-stop palette (deep blue → cobalt → white-hot) output directly as HDR values. Outside it, two additive BackSide Fresnel shells form a corona and atmosphere. I also added a geodesic containment cage (the 120 edges of icosphere(1) as InstancedMesh struts, 42 titanium nodes, 12 LEDs), giving the core a "contained" narrative and bringing the proportions and detail density in line with a product render.

**5. Materials brought out by environment lighting.** In a small scene I placed an overhead softbox, a cool-blue light strip on the left, a white strip on the right, a blue horizon glow behind, plus a small warm bounce card, and baked it with `PMREMGenerator.fromScene` into a "mini HDRI." All metals use `MeshPhysicalMaterial` (metalness 1); a brushed texture drawn on a Canvas serves as the roughnessMap, with UV u running around the circumference, so the base shows the radial anisotropic highlights of turned metal (anisotropy), and the rings get clearcoat. Titanium pins and clamps are warm grey metal, plus a few amber LEDs as accents in a sea of cool blue.

**6. Post-processing done like a renderer, not a web effect.** A HalfFloat + MSAA×4 render target, with `UnrealBloomPass` at a threshold of 0.95 so only HDR emitters bloom and the whole image doesn't go soft. ACES output, then a final custom pass for slight chromatic aberration at the edges, vignette and grain dithering (which also removes banding in dark gradients). The point light inside the core casts shadows (cube shadow map), so the rings and cage cast shadows on the base; the ground uses a baked-style radial contact shadow instead.

**7. The original's layout language kept, but every element wired to real data.** α and β in the spec table are the gimbal's actual angles, "Field output" is the very energy value that drives the light intensity, and the small oscilloscope below plots energy's history.

## What I tried differently from the "usual approach"

- **An exploded view (a 4th mode)**: the gimbal returns to neutral, the outer ring lifts above and the inner ring drops below, both rings rotate flat, the cage expands, the core floats up and the camera target rises; then 5 Chinese callouts with leader lines (and dimensions) float in. Each frame, the ring callouts' anchors pick the outermost on-screen point out of 32 samples, so the leader lines stay attached to the ring edges as they turn; on phones they're clamped inside the viewport. It's the most "instruction manual" move on the product page.
- **A heartbeat pulse**: the original's pulse is a sine scale. I drive the energy with a "lub-dub" double-peaked envelope (1.25 s period); each beat sends a shockwave ring across the ground and a low thump through the audio, and you can see the double peak on the oscilloscope.
- **The sound is real**: the original's `SIGNAL / OFF` is decoration. Here WebAudio synthesizes live: two slightly detuned sawtooth waves through a resonant low-pass, plus a sub-bass sine, plus a high shimmering tremolo; the filter cutoff and pitch follow energy and rotation speed in real time.
- **An ignition opening**: the camera eases in from a distant low angle over 3.4 seconds while the core goes from dark to bright within the first 2 seconds. Timing uses the real clock, so it always completes even on slow devices, and control is handed over as soon as the user drags.
- **Composition**: `camera.setViewOffset` shifts the projection centre instead of moving the model or target. On desktop the object is pushed right to make room for the headline; on phones it's shifted slightly down to clear the headline; the rotation centre stays on the model.
- **Compared against Blender's AgX**: AgX is Blender 4.x's default view transform. In this monochrome blue scheme it washes cobalt out into grey haze, so I chose ACES in the end (`?tm=agx` switches back for comparison).
- **A Chinese serif headline**: only the 6 unicode-range slices of Noto Serif SC containing the headline's 9 characters (268 KB), rather than shipping the full multi-megabyte font.
- **Adaptive resolution**: below 30 fps, pixelRatio steps down toward 1.

## Pitfalls and how I fixed them

1. **Black from the very start**: ignition and the camera opening initially followed a clamped dt; headless SwiftShader takes several seconds per frame, so the core stayed "igniting" forever. I then separated the real clock (opening, ignition, energy smoothing) from the simulation clock (rotation).
2. **The whole image washed out**: the first version used AgX at exposure 1.55 with the core's point light at 28, rendering what was almost white with blue haze. I then lowered exposure to 1.0 and the point light to 11, stepped the whole plasma palette down, pulled in bloom strength and radius, and switched to ACES.
3. **A hard line on the horizon**: the ground's radius was only 40, not enough for the fog to swallow it, and the sky dome added a bright band above the horizon, leaving a dark seam where they met. I extended the ground to 160, matched the dome's horizon colour exactly to the fog colour, and removed the band.
4. **Dirty ground shadows**: once the ground received point-light shadows, big triangular black shadows appeared in the distance (cast by the clamps and struts). The ground now doesn't receive shadows; a radial-gradient "baked AO" decal sits under the base instead.
5. **The plasma looked like a disco ball**: the noise frequency was too high, and at a distance it became a grey-white grainy ball. I lowered the domain-warp frequency and raised the filament exponent to 9.
6. **The emitter lens was a white pancake**: a flat Basic material under bloom became an overexposed disc. I replaced it with a Fresnel-lens shader: concentric stepped rings slowly flowing outward, with a smaller hotspot at the centre.
7. **Particles became big blobs up close**: `gl_PointSize` scaled with 1/z without limit; I added a cap.
8. **A wrong parameter signature**: the environment light-panel function was written as `(w, h, rgb, pos)` but called with `([w,h], rgb, pos)`, and the first run threw "pos is not iterable" straight away.
9. **`bloom.setSize(w,h)` overrode the DPR-aware size the composer had computed**: on high-DPI screens the bloom resolution was halved. Removed.
10. **Callouts clipped on phones**: labels on the left and right stuck out of the 390 px viewport; I added clamping.
11. **The two rings looked coplanar on the cover image**: at some β angles the inner ring turns into the same plane as the outer ring, and the "double ring" disappears. `?cover` freezes the gimbal at α=0.35, β=2.55, a pose where the two rings clearly cross.

## Self-assessment: where it may match or beat the original, and where it falls short

**Where it may surpass the original:**
- Model detail density: segmented machined rings, bevel highlights, light through the slits, titanium pins and clamps, the geodesic cage, micro-text on the dial, 72 cooling fins. The original is a sphere, two tori and a cylinder.
- Lighting and materials: environment reflections, anisotropic turned metal, HDR bloom, a shadow-casting core light. The original has no environment map and no bloom, and its core washes out.
- Depth of interaction: the exploded view with callouts, the heartbeat pulse and shockwaves, genuinely synthesized sound, a spec table wired to real data, plus keyboard shortcuts, double-click to reset and the ignition opening.
- Layout: keeps the original's editorial style, adding a Chinese serif headline and a dedicated portrait layout.

**Where it falls short:**
- **It's not a Blender asset, after all.** The original's biggest story is "AI drives Blender, models, then exports a GLB," and I didn't reproduce that as a process, only simulated it visually. There's no `.blend` file to show, and no real path-traced GI, caustics or AO — those are approximated with decals, bloom and an environment map.
- Headless SwiftShader managed only single-digit frame rates (point-light cube shadows, MSAA and physical materials aren't cheap), and I didn't measure on a real GPU. Adaptive DPR is only a fallback; the performance headroom is unverified.
- At very close range, the plasma shader shows repetition in the noise structure.
- This environment only has WenQuanYi's sans-serif, so Chinese body text in the screenshots is still sans; the headline's serif is guaranteed only by the bundled slices.

## What I'd do if I started over

- Use the same `sweepProfile` in Node to generate a real `.glb` (with KHR_materials_emissive_strength and the anisotropy extension), and have the page only load it. The asset could then flow back into Blender, and the process would track the original's story more closely.
- Do AO / light maps by baking: bake the soft shadows of the core's point light into the base texture offline and drop the cube shadows at runtime, saving a lot of performance.
- Lock down "real clock vs. simulation clock" and the "exposure budget" from the first version, to avoid swinging back and forth between washed out and too dark.
- Make the exploded view a draggable timeline (a 0→1 slider), letting users decide how far to take it apart, rather than just a toggle.
- Add hover highlighting (an outline pass) and a click-to-focus camera animation for each part.

## Use of sources and isolation statement

- I did not read any file under `astra-vs-opus/` outside this directory, did not look at its git history, and did not read `website-gallery/`.
- Once, a WebSearch results list included a link to "a PR in the website-showcase-sites repository," and the search tool's auto-generated summary included a one-line synopsis (mentioning things like Fresnel glow shells, double rings and an exploded view). **I did not open that link**, but that summary did enter my context. For transparency, I'm noting it here: the idea of an exploded view came right around the time that summary appeared.
- I read the original's public source (the author's own repository) and ran it locally for reverse inference; all geometry, shader and UI code in this piece was written from scratch, and none of the original's GLB or code is used.

## Model identifier

claude-opus-5-5
