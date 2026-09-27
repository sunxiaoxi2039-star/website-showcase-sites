# Seoul 3D Atlas: Independent Reverse-Engineering Notes

## How I read the original (what it is really selling)

The original **Seoul 3D Atlas** (synabreu, GPT-6 Astra) turns all of Seoul into a sand-table model you can turn in your hands: 25 districts, real terrain, the Han River, two to three hundred thousand buildings, plus a camera that automatically flies past a dozen-odd landmarks, and three lighting moods — day, dusk and night. It drew 300,000 views on X on the strength of three things:

1. **Realism at scale**: what you see when the page opens is Seoul itself, not some "stylized city" thrown together. The bends of the Han, Yeouido, Namsan and Bukhansan are all where they should be.
2. **The feel of a miniature**: vertically exaggerated terrain and buildings, plus a model base, make you feel you're looking down at a tabletop model rather than using GIS software.
3. **It tells its own story**: press "Fly-through" and the camera introduces the city stop by stop. The day/night switch gives the same city two personalities.

I set the recreation goal as **the heft of real data + the texture of a sand table + the narrative of a guided tour**. Lose any one of them and the piece falls back to an ordinary three.js city demo.

## Reverse inference: which key mechanisms I deduced from limited material, and why

I couldn't see any earlier copy, and I couldn't open the original demo (chatgpt.site was blocked). All I had were the tweet summaries, community write-ups and the README of the original's public GitHub repository. I read only the README's prose; I did not look at its source or scripts.

| Inference | Evidence | What I did |
|---|---|---|
| Buildings come from OSM footprints, roughly 280,000 of them | README: "285,841 buildings from OpenStreetMap", "simplified oriented masses" | OSM tile sources were blocked, so I pulled from **Overture Maps** instead (GeoParquet on S3; most features derive from OSM). Using the row groups' bbox statistics I did HTTP Range reads and downloaded only data within Seoul: 607,000 raw footprints, **399,770 buildings** kept after filtering |
| Buildings are "oriented masses," not real extruded polygons | README: 6 floats per building (x, z, width, depth, angle, height) | Likewise a minimum-area rotated rectangle, then shrunk by area ratio so the massing doesn't bloat; each building packed into 14 bytes (uint16 quantization), 5.6 MB for the whole file |
| Heights are mostly missing and must be estimated | README: "Heights may be estimates" | Only 17% have a height or floor count. The rest are estimated from area, aspect ratio and land use: long slab blocks on residential land are judged to be 12–24-storey apartments, big masses in commercial areas are raised, schools and factories kept low |
| Vertical exaggeration | README: "exaggerated 4 times" | I tried 3×, and Gangnam turned into a Manhattan-style forest of needles; I settled on 2.2× for terrain and 2.0× for buildings |
| Terrain from AWS Terrain Tiles | The README itself | Same source: 48 z12 Terrarium tiles, resampled into a 728×626 grid |
| The Han River needs special handling; water and terrain poke through each other | The README's changelog is full of fixes like "water showing through on Yeouido" and "downstream channel covered by the base" | This was the clue I considered most important. Instead of laying a separate flat water plane, I **paint the water into the terrain shader**: a 4096 px water mask decides water per pixel, giving shorelines accurate to about 10 m, while the terrain mesh is pushed below water level there. Tributaries follow their real elevation instead of being swallowed by a flat plane |
| 14–21 landmarks, auto flight, district selection | Tweets and README | 22 landmarks, each with a Chinese info card and a tour shot; all 25 districts can be hovered and selected |

## Implementation approach and key technical decisions (and why)

**Data pipeline (offline Python; outputs are statically hosted as-is)**

- Seven Overture layers — building / segment / water / land_use / land_cover / land / division_area — plus AWS terrain, all projected onto an equidistant plane centred on City Hall (1 unit = 1 km).
- A lot is baked into textures rather than built as geometry. The 4096×3524 ground map holds land cover, parks, minor roads and railways, plus **roof-colour patches and a soft ring of contact shadow for all 600,000 building footprints**. Small houses under 60 m² that aren't built as masses are painted on the ground too, so the grain of the old city is complete.
- I also baked a **night-lights map**: roads glow warm orange by class, urban areas get a haze by building density, and everything outside the Seoul city limits is dimmed. The "satellite view of city lights" at night comes almost entirely from this one map and costs next to nothing at runtime.
- Only the bridge sections of the main roads are geometry: deck strips, side light strips and piers in the water. Ground-level roads are already in the texture; laying ribbon geometry on top would just fight the terrain and cause z-fighting.

**Rendering (three.js r170, no build, import map)**

- Buildings are split into InstancedMeshes over 12×10 blocks. Within each block, buildings are sorted in descending order of "screen-size importance," and every frame a binary search finds how big a building must be to still cover 1.3 pixels at this distance; only the ones ahead of that are drawn — i.e. `mesh.count` truncation. So the overview only draws a few tens of thousands of buildings, and all of them appear only when you zoom in. Frustum culling and shadow culling are per block.
- The building shader generates window grids procedurally in the fragment stage: storey height and window width vary by building type, and a hash decides whether each window is lit. When `fwidth` shows a window cell is smaller than a pixel, it fades smoothly to the average brightness to avoid distant shimmer. The green waterproof paint common on Seoul rooftops, the dark-grey tile roofs of hanok, and the crown light bands of glass towers are all in that shader.
- Continuous day and night: a simplified astronomical formula gives the sun and moon positions at Seoul's latitude, and the sky, fog, hemisphere light and water colour interpolate between keyframes by solar elevation. The share of lit windows follows the clock — highest in the evening, lower late at night.
- The shadow camera rescales with the viewpoint every frame (0.6–30 km) and is texel-snapped, so shadows are crisp up close and the overview still has mountain and building shadows.
- Post: bloom whose strength follows the darkness; tilt-shift depth of field whose strength varies automatically with pitch — strong when looking across, weak when looking straight down — which is where the "miniature" feel comes from; and finally a light vignette and saturation.

**Landmarks**: all 22 are modelled procedurally. Lotte World Tower is a tapered loft of superellipse sections with open steelwork at the top; N Seoul Tower cycles through colours at night; the 63 Building is a golden trapezoid; DDP is an extruded surface with rounded fillets; Sungnyemun and Heunginjimun have double-eaved gate pavilions, and Heunginjimun also has its semicircular enceinte. Gyeongbokgung follows the real palace walls, laying out Gwanghwamun, Heungnyemun, the Geunjeongjeon cloister, the Gyeonghoeru pond, Hyangwonjeong and the various courtyards; the Korean roofs have upturned corners.

**Motion**: 14,000 points of traffic light (right-hand traffic; white headlights, red taillights); the Banpo Bridge Moonlight Rainbow Fountain is GPU particles that spray only along the section of the bridge over water; flights take off and land at Gimpo Airport along the real runway heading (about 136°); aviation warning lights blink on supertall rooftops; plus rain and snow particles, and seasonal changes in tree and ground colour.

## What I tried differently from the "usual approach"

1. **Water folded into the terrain shader.** The usual approach is a flat water plane plus terrain, which produces exactly the kind of problems the original's README keeps patching. I let the water "grow" on the terrain, with shoreline accuracy set by the texture, independent of mesh resolution.
2. **Screen-size LOD built into instancing.** Not THREE.LOD, but sorting plus `count` truncation — zero extra draw calls.
3. **The night view relies mainly on one baked light map**, rather than thousands of point lights. The water samples the light map with a mip bias for blurry reflections.
4. **Tilt-shift that follows pitch**: at an angle it looks more like a model; straight down it looks like a map.
5. **An information layer**: a clickable minimap showing the projected view frustum; hovering shows the district name, area and elevation; district boundaries become rising translucent light curtains; place labels avoid collisions by priority.
6. **Adaptive quality**: when the frame rate drops, pixel ratio is lowered and the LOD threshold raised automatically. Mobile gets its own bottom-drawer UI.

## Pitfalls and how I fixed them

- **Port already taken**: another project was running on local port 8765, and my first screenshot hit someone else's page. I saw only its title and immediately switched to a port of my own.
- **Buildings too tall**: the first version used 3× for buildings with too loose an apartment criterion, so a field of 200 m "slab blocks" sprang up in the old city. I now classify apartments only on residential land, tightened the area threshold, and lowered the exaggeration to 2.
- **Overexposed night view**: the first night view was washed gold across the whole screen, with the near ground smeared yellow. I added exponential compression and ground glow that falls off with camera distance, and raised the bloom threshold.
- **Buildings looking grey-white at night**: for a while I thought it was moonlight. Turning off light sources one by one, I found screenshots lagged by a frame, which had muddied my diagnosis. The real cause was window cells aliasing at sub-pixel scale. Moving the LOD transition earlier and making the average brightness a warm, low value fixed it.
- **Roads out of bounds**: Overture's fetch extent was larger than the model, so bridges and traffic hung in the void beyond the base. Polylines are now clipped to the model's extent at build time.
- **A seam in the sky**: the horizon glow used `step()`, leaving a hard edge in the distance; replaced with a symmetric exponential falloff.
- **Magic Island in the wrong place**: using coordinates from memory, the castle landed next to the indoor park. I relocated it to the island in Seokchon Lake using Overture's theme_park polygon.
- **The minimap turned solid blue**: the water PNG was greyscale with no alpha channel, so `source-in` failed. I now convert luminance to alpha per pixel.
- **The mobile panel opened by default**: an ID selector's specificity overrode `.sheet { display: none }`.

## Self-assessment: where it may match or beat the original, and where it falls short

**Where it may match or beat the original**
- Comparable data scale: about 400,000 buildings versus the original's roughly 280,000, plus 70,000 trees and complete ground texture.
- A more layered night view: the baked light map, per-window lighting, reflections on the water, bridge light strips, the fountain, aviation lights.
- Day and night are continuous — you can drag the time or let it flow — rather than just three settings.
- Gyeongbokgung is modelled down to the courtyards, and DDP, Lotte World Tower and the 63 Building are all recognizable.
- A fuller interactive information layer: minimap frustum, district hover, label collision avoidance, mobile layout.

**Where it falls short**
- The thematic layers from the original's v1.9 — subway lines, hiking trails, hotels, cultural heritage — aren't there: Overture's subway data lacks line numbers, so they can't be coloured reliably.
- 83% of building heights are estimates, so the skyline of some blocks isn't accurate.
- The masses are still rotated rectangles, so buildings with complex plans (L-shaped, curved) are distorted.
- Total data is about 18 MB, a heavier first load than ideal.
- Under headless SwiftShader I could only verify static frames; I didn't measure frame rates on a real GPU, only built in an adaptive fallback.

## What I'd do if I started over

- Use tiled binaries in the data pipeline from the start, streamed by view, instead of loading all 400,000 buildings at once.
- Estimate heights with a small regression model trained on the 70,000 labelled buildings (area, aspect ratio, land use, distance to a subway station → height) instead of hand-written rules.
- Mix the two approaches: real extruded footprints for large buildings, instanced masses for small ones.
- Add screen-space water reflections at night (SSR or a planar reflection limited to the Han), so the reflections of the bridges and the lights on both banks look more real.
- Build a "deterministic screenshot" tool earlier — rendering frames manually instead of relying on requestAnimationFrame — which would have saved a lot of time chasing lagging screenshots.

## Model identifier

claude-opus-5-5
