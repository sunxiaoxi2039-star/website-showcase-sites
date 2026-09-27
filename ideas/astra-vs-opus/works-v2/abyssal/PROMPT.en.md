# The Prompt to Generate This Piece in One Shot

> Build a statically hostable web piece, *深渊：活的深海* (a tribute remake of ABYSSAL: The Living Deep). It is a procedural ocean you can explore continuously: starting from a camera floating on the waves at the surface and diving all the way to 1,400 m, all generated from a single seed, with the entire UI in Chinese.

## Technical constraints

- Use only three.js (put `three.module.js` and `three.core.js` in `vendor/` and load them with an import map), ES modules, no build step, relative paths only, no CDN dependencies.
- No texture, model, font or audio files; terrain, corals, animals, sky and sound are all generated in code.
- Every material is a `ShaderMaterial` with hand-written GLSL, all sharing one "underwater optics" GLSL chunk so the style stays consistent at any depth.
- Requires WebGL2; show a Chinese-language notice when it isn't supported. The page must not overflow horizontally on a 390 px-wide phone.

## Page frame

- A thin top bar: on the left `← 三方对照` (linking to `../../compare/index.html`), in the middle "深渊：活的深海" plus a small tag "Opus 5.5 · 独立逆向" (independent reverse-engineering), on the right `原作 @emollick ↗` (linking to https://x.com/emollick/status/2095673885605630429). Hide the top bar with `?shot=1` and the UI with `?ui=0`.
- A HUD layered over the canvas (style: dark translucent square buttons, off-white ink, large serif titles, small monospace labels, a pale-green primary button):
  - Top-left "ABYSSAL / 活的深海"; top-right: Surface, Descend, Explore (chart), World Lab, ?.
  - Depth gauge on the right: a large number + "below/above the surface", and beneath it a clickable depth scale — 0 surface / 200 twilight zone / 600 lower twilight / 1,000 midnight zone / ≈1,400 vents — with a marker that moves with depth.
  - Title area bottom-left: a large title and subtitle that fade in as the region changes (The Breathing Sea, Coral Cathedral, The Sunken Forest, Into the Blue, Twilight Zone, The Long Twilight, Midnight Waters, Midnight Garden, Basalt Plain), plus a line "Nearby · species · species…"; at the surface, show a "Dive into the reef" button.
  - Four habitat tabs along the bottom (Coral Reef / Kelp Forest / Open Ocean / The Deep, shortcuts 1–4), with the current region underlined.
  - Toolbar bottom-right: Drift, Swim, Pause, Dive Lights, Observe, Field Guide, Screenshot (a PNG without UI), with a hint line below.
  - During a journey, show a "Heading to · X" progress bar and "Stay here" at the top.

## World generation (one ocean)

- Seed (a number or text; text is hashed to a stable integer; default 713) → bake a 768² RG32F heightmap (height + detail amplitude) and an RGBA habitat map over a 4.8 km square, plus a 256² tileable detail noise. The GPU vertex shader does hand-written bilinear sampling with `texelFetch`; the CPU samples with exactly the same formula, for collision, grounding animals and route planning.
- Layout: a shelf to the north (-15 to -30 m); to the west, coral ridges running northeast with sandy channels; to the east, a rocky kelp forest with clearings; the shelf edge drops abruptly onto the slope, and a winding canyon cuts from the shelf down to the abyss; to the south, a rolling abyssal plain at about -1,400 m, scattered with vent belts. Navigable radius 2.2 km.
- The four sites (reef / kelp / blue / deep) and 11 destinations (reef-ridges, reef-channels, reef-gardens, kelp-avenues, kelp-clearings, kelp-outer, shelf-edge, canyon-wall, vent-belt, basalt-plain, far-vents) are just coordinates in this ocean.
- Terrain around the camera uses a camera-centered grid, dense near and sparse far (about 0.75 m per cell up close), sampling the heightmap in real time, with sand ripples, rock relief, algal crust and habitat colouring added in the fragment shader.

## Light and water

- Per-channel downwelling attenuation Kd, view attenuation Kv and scattering coefficient b; in-scattering along the view ray uses an analytic integral (start depth, direction, length), and the underwater dome is that integral with L→∞. Clarity, upwelling (greener), distance offshore (clearer) and sediment only change these three sets of coefficients.
- Caustics: two layers of time-drifting "absolute-value noise nets," projected along the refracted sun direction, weaker and blurrier with depth.
- A 2048² orthographic shadow map along the refracted sun direction, covering only about 64 m in front of the camera.
- Auto-exposure; dive-camera-style partial white balance (compensating red along the sunlight path in the shallows, and along the dive lights' round trip in the deep).
- Two dive lights (switching on automatically with depth, with manual override). Bioluminescence intensity is scaled by 1/exposure.
- Post: half-resolution volumetric light (sun shafts + lamp beams), two-level bloom, ACES, vignette and fine grain. When the camera nears the waterline, render the scene twice and decide above/below per pixel from the GLSL wave height, producing a split screen that moves with the waves and a dark water-film line.

## Sea surface and sky

- 12 Gerstner waves (peak wavelength and wave height estimated from wind speed, plus swell), with the same parameters on CPU and GPU; the floating camera iteratively solves for the true wave height on the CPU and tilts with the waves. From the air the sea shows sky reflection + sun glint + subsurface scattering on crests + Jacobian foam; from below, Snell's window and total internal reflection. Event waves: ring-shaped wave trains from seabed tremors, rogue-wave packets.
- Sky: an analytic atmospheric gradient + cumulus ray-marched in 14 steps inside a thin cloud shell (a threshold rising with height forms domes, with one sample toward the sun for self-shadowing and silver linings) + stars, moon and a Milky Way band at night; rain streaks and forked lightning. At night, a surface bloom fed by upwelling glows blue-green where wave crests disturb it.

## Scenery (procedural + instanced)

- Terraced limestone shelves (with coral growing on top), boulders, slope pillars, basalt, staghorn coral, brain coral, table coral, sea fans, sea whips, tube and barrel sponges, giant kelp (height following water depth and a "kelp height" control, bent in the vertex shader and surging with the waves), seagrass clumps, cold-water corals, mineral chimneys (with plume particles rising from the top) and tubeworm clusters.
- Scattered per 32 m tile, seeded by world coordinates; expand only the tiles near the camera, with per-frame frustum and distance culling; returning to the same spot gives the same community.

## Animals (about 30 species groups)

- Reef: butterflyfish, parrotfish, damselfish, reef sharks, manta rays, octopus, crabs, sea stars, sea urchins; kelp forest: seals, silver schools, sea turtles; the blue: humpback whales, dolphins, tuna, ocean sunfish, squid; 200–1,000 m: lanternfish, hatchetfish, midwater shrimp, vampire squid, dragonfish; below 1,000 m: anglerfish, gulper eels, dumbo octopus; the deep seafloor: giant isopods, brittle stars, sea cucumbers, sea pens, vent shrimp; drifters: jellyfish, siphonophores.
- Each species gets its own procedural anatomy (lofted body; caudal, dorsal, anal and pectoral fins; arms; eyes; photophores). Vertex attributes record spine coordinate, flap weight, arm index, glow and contraction; a shared vertex shader handles body undulation, fin beats, arm curling, alternating legs and bell contraction.
- 30 Hz fixed step + interpolated rendering: schools separate/align/cohere, look ahead to avoid terrain and boulders, scatter from predators or a swimming diver and regroup; reef fish swim to the rock face and dip to feed; predators occasionally chase a nearby school; dolphins, seals, turtles and humpbacks surface periodically to breathe; benthic animals move and pause, crabs walk sideways; squid jet backwards; jellyfish pulse and drift; vent shrimp circle the chimneys; animals bank into turns. Pausing freezes positions and appendages together; in Drift mode the camera doesn't disturb the animals.
- Communities are loaded and recycled by habitat suitability around the camera, with initial spawns mostly in front of the camera; in the deep, the community radius shrinks to the dive lights' range. The lab shows the currently loaded count.

## Interaction

- Drift / Swim (WASD to swim along the view, drag to look around, Q/E to sink/rise, Shift to speed up, scroll to zoom); Surface, Descend along the canyon (sinking straight down if already over deep water), depth stations, 1–4 habitat journeys, chart destinations or any point on the chart; journeys follow the terrain smoothly and can "Stay here."
- The World Lab's four tabs: World (seed, new seed, terrain relief, cover, kelp height, habitat scale, reset recipe, copy world link), Life (animal abundance, predators, benthos, jellies and drifters, school size, currently loaded count), Water (clarity, current, bioluminescence, deep upwelling, dive lights auto/on/off, ocean sound and volume), Weather (day/dusk/storm/night, sun elevation, cloud cover, wind speed, swell, storm intensity; expand for more: wind direction, swell period, crest steepness, rain, haze, cloud density; events: seabed tremor, rogue wave, lightning); at the bottom, "View & controls": float at the waterline, quality, frame rate, instructions. Terrain controls rebuild on release; weather and water controls apply live while dragging.
- Observe (O): select a clearly visible animal in view and track it on screen with corner brackets; a card shows name, description, distance and depth, with "Follow" (the camera eases to a comfortable distance) and "Next"; clicking an animal in the picture also selects it.
- Field Guide (J): an animal is recorded only after staying in frame for about 1 second, close enough, not hidden by terrain, and lit by sunlight / dive lights / its own glow; record the first depth and seed, stored in localStorage (reads and writes wrapped in try/catch).
- Ocean sound (M, off by default): WebAudio synthesizes surge, underwater drone, reef crackle, distant whale song, vent hiss and tremor rumble in real time.
- Shortcuts: G lab, R new seed, C chart, L dive lights, P pause, H hide UI, F drift/swim, Esc close.
- URL parameters: `site`, `place`, `seed`, `light` (day/dusk/storm/night), `surface` (1 / waterline), `depth` (200/600/1000/vent), `relief`, `cover`, `height`, `habitatScale`, `life`, `predators`, `benthos`, `jellies`, `shoal`, `clarity`, `current`, `glow`, `upwelling`, `lamp`, `preset`, `adaptive=0`.
- Adaptive internal resolution to hold frame rate; low quality by default on phones (shadows off).

## Deliverables

`index.html`, `css/`, `js/` (split into modules: noise, world, optics, sky, surface, terrain, post, geom, scenery, fauna-geo, species, fauna, particles, explore, sound, ui, main), `vendor/`. When done, use a headless browser to screenshot the surface, reef, kelp forest, the blue, 600 m, the vent garden, night, storm, the waterline and a 390 px phone viewport one by one, and confirm there are no console errors.
