# ABYSSAL: The Living Deep — Independent Reverse-Engineering Notes

## How I read the original (what it is really selling)

What makes ABYSSAL: The Living Deep so striking isn't any single effect — it's **continuity**:
you start from a camera bobbing on the waves and dive straight down — the sunlit reef, the kelp forest, the blue at the shelf edge, the twilight zone in the canyon, all the way to the hydrothermal gardens at 1,400 m — with no loading and no scene cuts. It's one ocean grown from one seed. The site buttons are a *journey*, not a *teleporter*.

The second selling point is that it's **alive**: the animals aren't props pasted into the scene but communities with anatomy and behavior. Schools keep their spacing, scatter from predators or the diver and then regroup; reef fish dip their heads to feed; crabs sidle a few steps and pause; dolphins and seals surface periodically to breathe; squid jet backwards. The deeper you go, the less light there is, and the animals start making their own.

The third is that it's **a recipe you can play with**: seed, terrain, cover, populations, water optics and weather are all live controls, and the whole setup can be copied as a reproducible link. Add an observation mode and a field guide, and "looking at scenery" becomes "running a dive survey."

## Reverse inference: which key mechanisms I deduced from limited material, and why

I read only the README, the upstream README (UPSTREAM.md) and a few documentation screenshots in the repository. I did not look at any implementation source.

| Inference | Evidence |
| --- | --- |
| The terrain is a **continuous seabed heightfield**; sites are just coordinates in it, and the distance is streamed as "bounded neighbourhood" tiles | README: "All four habitats exist together in one generated landscape", "Detailed seabed tiles … follow a bounded neighbourhood around the camera. Tile seeds depend on world coordinates" |
| It needs **CPU terrain sampling that matches rendering exactly** (for collision, grounding animals and route planning) | The test list mentions "agreement between rendered terrain and collision height" |
| Layout: coral ridges and sandy channels to the west, kelp forest and clearings to the east, slope and canyon to the south, vent belts scattered across the abyssal plain; a navigable radius of 2.2 km | The README's biome section and the names of the 11 place ids (reef-ridges / kelp-clearings / canyon-wall / vent-belt / far-vents…) |
| "Descend" **follows the canyon**, and the depth stations are points along that route | "Descend follows the canyon from the shelf, or dives directly when you are already over the trench", and `depth=200` "starts on the canyon route" |
| Water optics are **wavelength-dependent attenuation** + caustics + light shafts + dive lights; in the deep, only what the lights reach is visible | "wavelength-dependent attenuation, wave-driven caustics, shadows, light shafts", "paired dive lights … the water beyond the lights is dark" |
| Animals run a **fixed-step steering simulation with interpolated rendering**; pausing freezes both positions and appendages | "The steering runs at a fixed time step, with smooth rendering between updates; pausing holds both animal positions and appendages" |
| Animals are **communities loaded near the camera by habitat suitability**, not a simulation of the whole ocean | "The lab's population readout counts animals currently loaded" |
| Field-guide identification considers distance, framing, terrain occlusion and **whether the animal is lit** | "Identification respects distance, the camera frame, rock and terrain occlusion, and available light" |
| The surface and the underwater view share one wave field; at the waterline the two views are blended **on the actual wave surface** | "The waterline samples all three FFT cascades … Crossing the surface blends the two views at the moving wave boundary" |
| UI: brand top-left, a large serif title plus a "Nearby" line bottom-left, four habitat tabs along the bottom, a depth scale on the right (0/200/600/1000/≈1400), Drift/Swim/Pause/Lights/Camera bottom-right | Screenshots in the repo's docs/media |

## Implementation approach and key technical decisions (and why)

- **Three.js (r186, vendored locally) + ShaderMaterials with entirely hand-written GLSL.** No standard materials, because every material — terrain, props, animals, particles, sea surface — has to go through the same "underwater optics" functions to stay consistent at every depth. No build step: ES modules + an import map.
- **Terrain = a baked heightmap + tileable detail noise, with hand-written `texelFetch` interpolation on the GPU.** The CPU samples the same Float32 data with exactly the same interpolation formula, so collision, animal grounding and route planning agree with the picture exactly (the point the README's tests stress). The render mesh is a 257×257 grid centered on the camera, dense near and sparse far (0.75 m up close, about 9 m in the distance).
- **One analytic water model**: downwelling irradiance `E(d)=E0·e^{-Kd·d}` (per channel), with in-scattering along the view ray integrated analytically as `b·phase·E0·e^{-Kd·d0}·(e^{aL}-1)/a`. So "brighter looking up, darker looking down, the distance melting into water colour" all fall out of one formula; underwater, the sky dome is simply that integral with L→∞. Clarity, upwelling, distance offshore and sediment only change three sets of coefficients: Kd, Kv and b.
- **Partial white balance, like a dive camera**: in the shallows it compensates red along the sunlight's downward path; in the deep it compensates along the dive lights' ~12 m round trip. This is a deliberate artistic choice — the reef keeps its colour, and the deep looks neutral under the lights like ROV footage instead of a wash of teal.
- **Auto-exposure + "exposure-normalized bioluminescence"**: in the deep, exposure climbs by tens of times, so emissive bioluminescence is scaled by 1/exposure. A lanternfish's belly photophores look equally bright at 600 m and at 1,000 m, and are all but invisible in the shallows by day.
- **Post-processing pipeline**: HDR scene → half-resolution volumetric light (ray-marched along the view, integrating both sun shafts and the beams of the two dive lights) → two-level bloom → ACES → vignette/grain. Near the waterline the scene is rendered twice (above/below), and a per-pixel Gerstner wave height in GLSL decides whether the near clip plane is underwater, producing a split screen that moves with the waves.
- **Sea surface**: 12 Gerstner waves (wind sea + swell, with peak wavelength and significant wave height estimated from wind speed), sharing one parameter set between JS and GLSL. When the camera floats, the CPU iteratively solves for the true wave height and tilts with the surface. Event waves (ring-shaped wave trains from seabed tremors, rogue-wave packets) are written into both sides. From below you get a Snell's window and total internal reflection.
- **Sky**: inside the dome, a 14-step "2.5D volumetric cloud" layer between 1,300 and 2,200 m (a 2D coverage field + a threshold that rises with altitude → cumulus domes), with one sample toward the sun for self-shadowing; reflections use a cheap 2D version. At night there are stars, the moon and a Milky Way band.
- **Props**: rocks (terraced shelves, boulders, pillars, basalt), staghorn coral, brain coral, table coral, sea fans, sea whips, tube/barrel sponges, giant kelp, seagrass, mineral chimneys and tubeworms are all procedural meshes, a few variants each, drawn with InstancedMesh. They are scattered per 32 m tile, seeded by world coordinates, expanded around the camera, and frustum- and distance-culled every frame. Corals "grow" on top of the shelves. Kelp bends with height in the vertex shader, layered with current and wave surge.
- **Underwater sun shadows**: a 2048² orthographic depth map along the refracted sun direction, covering only the 64 m in front of the camera, texel-snapped to prevent shimmering, and softer and fainter with depth.
- **Animals**: 32 species groups, each with its own procedural anatomy (lofted body + fins + arms + photophores + eyes). Vertex attributes store "spine coordinate / flap weight / arm index / glow / contraction", and one shared vertex shader uses per-species parameters for body undulation, fin beats (with spanwise phase lag), arm curling, alternating legs and bell contraction. Behavior runs at a fixed 30 Hz step: the three boids rules, group goal wandering, look-ahead terrain avoidance, boulder avoidance, scattering and regrouping, reef fish dipping to feed, predators occasionally chasing a nearby school, air-breathers surfacing periodically, benthic animals that move-and-pause (crabs walking sideways), squid jetting backwards, jellyfish pulsing and drifting, vent shrimp circling the chimneys.
- **Community management**: each species periodically samples "suitability" around the camera to set a target count; animals spawn out of view and are recycled when far away; on first arrival most groups are placed in front of the camera. In the deep, the community radius shrinks with depth to the reach of the dive lights.
- **The UI is entirely in Chinese**, with the original's information architecture: the title fades between regions (The Breathing Sea / Coral Cathedral / The Sunken Forest / Into the Blue / Twilight Zone / The Long Twilight / Midnight Waters / Midnight Garden / Basalt Plain), the depth scale is clickable as depth stations, and there are the four World Lab tabs, a sea chart, observation, the field guide, help and touch buttons.

## What I tried differently from the "usual approach"

1. **No fog — an "analytic water" model instead.** The usual approach is `scene.fog` or blending in a water colour by distance. Here every pixel analytically integrates in-scattering by view direction, starting depth and length, so one function naturally produces the brightness looking up, the darkness looking down, the forward-scattering halo toward the sun, and the pitch black of the deep.
2. **One heightmap serves both GPU and CPU**, with hand-written interpolation guaranteeing bit-for-bit agreement, instead of "one version for rendering and an approximation for collision."
3. **"Exposure-normalized bioluminescence" and "white balance along the dive-light path"** — to keep the deep beautiful under extreme exposure, these two small decisions matter more than any post-processing.
4. **The sea chart is rendered straight from world data**: hillshading + habitat colouring + depth contours (50/200/600/1000 m) + canyon lines + live position and heading + the journey route. Besides the 11 destinations, you can click any point on the chart to set off from there (the original doesn't mention this).
5. **Field-guide identification does real visibility testing**: in frame, distance, terrain occlusion (sampling the heightmap along the line of sight), and lighting (sunlight exposure threshold / dive-light cone / self-luminescence) — not "inside the radius counts as seen."
6. I added **damselfish shoals**, which aren't on the original's list (small fish hovering above coral heads), to make the reef feel full.

## Pitfalls and how I fixed them

- **The first underwater screenshot was a flat sheet of teal.** It looked as if the terrain wasn't drawing, but the scattering coefficient was too large and red attenuated too hard, so the ground was "drowned" in water colour. Only after bringing the b/Kv ratio down to real open-ocean values and adding partial white balance did the sand and caustics appear.
- **InstancedMesh + my hand-built tube geometry came out entirely inside-out.** Under a parallel-transport frame `T×B = -N`, so the quad winding was reversed: corals showed only back faces and table corals became black blotches on the ground. Fixing the winding sorted it out.
- **The shelves looked like mushrooms floating in the air**: the undercut bottom and burial depth were wrong. After working out the geometry's y-range, I switched to a slight inset positioned with the lower edge "slightly buried."
- **A row of small black dots along the horizon**: the outermost ring of the polar sea-surface mesh is a polygon, and the chord midpoints exposed the dome's deep-water colour. Fixed by having the far sea surface and the dome use the same `seaHorizon()` colour near the horizon, plus denser segments.
- **The clouds looked like squashed stratus**: a purely 2D cloud layer is foreshortened into stripes at low elevation angles. Switching to 14 steps inside a thin layer, with a threshold rising with height, gave the clouds sides and domes; the grain from temporal jitter was replaced with static interleaved gradient noise.
- **In the deep, the whole screen was smeared teal by the dive-light beams**: the beam in-scattering borrowed the sun shafts' gain and used the bluish scattering coefficient. I split it into a separate, neutral lamp-scattering term, applied a 4-tap blur to the volumetric light to suppress the dither pattern, and raised the lamps' weight in the exposure formula so lit objects no longer blow out.
- **Not a single animal visible at the "Into the Blue" site**: habitat suitability sampling clamped mid-water fish to "20–200 m above the bottom," but the seabed there is below 470 m, so everything was judged unsuitable. I changed it to sample twice within the depth window and take the larger value, and relaxed the height-above-bottom cap for oceanic species.
- **The animals were all behind the camera or too far away**: initial spawning now puts most groups in front of the camera, small reef fish use a smaller spawn radius biased toward the near field, and deep communities shrink to the reach of the lights.
- **Headless SwiftShader ran at only 1–2 fps**, so every screenshot took over ten seconds; I wrote a batch screenshot script and tested the CPU-side animal simulation separately in Node (about 1.5–3 ms per step).

## Self-assessment: where it may match or beat the original, and where it falls short

**Where it may match or beat the original**
- It implements the full experience skeleton the original's README describes: surface opening → continuous journey → one ocean with four habitats and 11 destinations, descending along the canyon, depth stations, "stay here," drift/swim, the four World Lab tabs, copy link, observe and follow, field guide, synthesized sound, tremors/rogue waves/lightning, the waterline split, and night-time bloom glow.
- The reef, kelp forest and twilight zone come quite close in mood to the original's documentation screenshots, and the reef has somewhat richer fish species and coral forms.
- The field guide's visibility testing, clicking anywhere on the chart, and exposure-normalized bioluminescence are what I consider solid extras.
- About 6,900 lines of code in total, with no textures, models or audio assets; the first screen needs only one dependency, three.js.

**Where it falls short**
- The sea surface is 12 Gerstner waves rather than the original's multi-cascade FFT; there are no hurricanes, waterspouts, whirlpools or tsunamis — only tremors, rogue waves, lightning and rain.
- The clouds are "2.5D volumetric" and still show dither at the edges up close; no TAA, no depth of field, no motion blur.
- The animals are low-poly procedural forms and less refined than the original up close; the whale doesn't necessarily appear in frame at the "Into the Blue" site.
- The deep seabed's colour and sand ripples are still flat, with far less detail than the original's limestone.
- I could only verify in a software renderer; frame rates on a real GPU are estimates from experience (with adaptive resolution as a fallback).

## What I'd do if I started over

1. Build the "screenshots + numeric probes" verification scaffolding first, then write the renderer — a lot of early time went into "why is the picture solid teal."
2. Go straight to a GPU FFT ocean (two or three cascades) and share one displacement texture with the underwater view; the waterline and caustics would be more realistic.
3. Add TAA and let temporal accumulation handle the jitter in clouds, volumetric light and shadows, instead of relying on blur.
4. Give the animals a second level of detail: denser meshes with normal-perturbed scales/skin up close, keeping the current low-poly models in the distance.
5. Make community spawning "tiles seeded by world coordinates," so animals, like the coral, are "still there when you come back."

## Model identifier

claude-opus-5-5
