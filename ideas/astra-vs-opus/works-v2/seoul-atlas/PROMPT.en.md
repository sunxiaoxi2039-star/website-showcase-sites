# The One-Shot Generation Prompt

> You are a front-end engineer who does both GIS data engineering and real-time graphics. Build a web page called **"首尔 3D 地图集" (Seoul 3D Atlas)**: a miniature sand-table model of Seoul that can be rotated and zoomed. The data must be real, it should look like a tabletop model, and it should include a guided landmark fly-through and continuous day/night lighting. The deliverable is a directory that needs no build and can be statically hosted as-is.

## 1. Deliverables and constraints
- Directory structure: `index.html`, `css/style.css`, `js/{main,geo,landmarks}.js`, `data/*`, `vendor/three/*`.
- Relative paths only; no CDN. Get three.js r170 via `npm pack three@0.170.0` and copy it into `vendor/three/` (`three.module.min.js`, plus OrbitControls, EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass and their dependencies from addons), mapping `three` and `three/addons/` with an import map.
- All UI in Chinese, with Korean alongside place names. A thin 36 px top bar at the top of the page: `← 三方对照` (back to the three-way comparison) on the left, the work's name plus a small tag in the middle, a link to the original on the right.
- No horizontal overflow at 390 px phone width; panels become a bottom drawer.

## 2. Offline data pipeline (Python: pyarrow, shapely, numpy, Pillow, scipy)
1. **Extent and projection**: an equidistant projection with Seoul City Hall (126.978E, 37.5665N) as the origin, 1 unit = 1 km, x east, z south. Model extent x∈[-21.8, 21.8], z∈[-18.6, 18.9].
2. **Fetching**: read Overture Maps' GeoParquet on S3 (`overturemaps-us-west-2/release/<latest>/theme=*/type=*`). First read each file's footer, filter by the row groups' bbox statistics, then use HTTP Range requests to pull only the intersecting row groups. Layers needed: buildings/building, transportation/segment (including the is_bridge / is_tunnel ranges in road_flags), base/water, base/land_use, base/land_cover, base/land, divisions/division_area (taking Seoul's 25 counties).
3. **Terrain**: AWS Terrain Tiles, Terrarium z12, resampled into a 728×626 grid (int16, in units of 0.1 m). Inside the water mask, push terrain below water level (3 m); keep land no lower than 5.5 m; flatten the broad Han River, and carve tributaries down to their neighbourhood minimum.
4. **Buildings**: discard buildings under 60 m², underground buildings, and those in water or inside landmark reserves. Take the minimum-area rotated rectangle and shrink it by area ratio. For height, prefer `height`, then `num_floors×3.3+2`; when both are missing, estimate by rules: slab blocks on residential land with aspect ratio ≥1.9 and a short side of 9–24 m are apartments, 36–70 m tall; small houses 5–9 m; large commercial masses 18–42 m; schools and factories kept low. Type codes: detached, mid-rise, apartment, glass tower, industrial, public, hanok (around the palaces); the top bit marks "outside the Seoul city limits." Store 14 bytes per building: x and z each quantized to uint16; width, depth, height and base elevation each uint16 (in 0.1 m); angle uint8; type uint8. Sort everything by volume, descending.
5. **Baked textures (4096×3524)**:
   - `ground.jpg`: land cover and land-use colours, desaturated outside the city limits; minor roads and railways as thin lines; all building footprints as roof-colour patches with a soft ring of contact shadow; water filled with riverbed colour.
   - `night.jpg`: roads drawn as warm orange light lines by class, with a blurred glow on top, plus a glow by building density; dimmed outside the city limits, black on water.
   - `water.png` (water mask, slightly blurred); `mask.png` (R = water, G = green space, B = inside the Seoul city limits).
6. **meta.json**: polylines for the main roads (motorways, expressways, arterials, collectors) densified every 40 m, each point flagged (0 normal, 1 bridge, 2 tunnel) and clipped to the model extent; polygons for the 25 districts (simplified to 25 m), with a representative point and area; the Seoul city limits.
7. **trees.bin**: scatter 70,000 trees by probability inside the forest, park, cemetery, golf course and similar masks, storing x, z, size and type for each.

## 3. Rendering
- **Terrain**: an indexed mesh with normals from central differences. Use MeshStandardMaterial and inject the following via `onBeforeCompile`:
  - Decide water per pixel from `water.png`: water colour varies over time, roughness 0.16, normals perturbed by three sets of sine ripples (faded out in the distance by `fwidth`), and a Fresnel term reflecting the sky colour;
  - Night emission = `pow(night.jpg, 2.3) × night factor × a falloff with camera distance`; the water samples the light map with a mip bias of 5 as a blurry reflection;
  - Seasonal colour multiplied onto the green-space mask; white cover when it snows; darker overall and lower roughness when it rains.
- **Model base**: four side walls sample the terrain's edges with a soil-layer stripe texture; underneath, a dark wooden plinth with brass trim, and a nameplate on the south face.
- **Buildings**: 12×10 blocks, one InstancedMesh each (a unit box with the bottom face removed, base at y=0), with the instance attribute `aInfo = (width, exaggerated height, depth, type)`. Within each block, sort descending by `max(width, depth, height×1.6)`; every frame compute the minimum visible size `1.3px × distance / focal length`, binary-search it, and set `mesh.count`. Fragment shader:
  - Wall and roof colours by type and hash, with about 40% of roofs in green waterproof paint;
  - Window cells divided by storey height × window width, antialiased with `fwidth`; fading to the average when a cell is smaller than a pixel;
  - AO darkening at the base of the walls;
  - At night, windows lit by hash and lit-ratio, mixing warm and cool white; in the distance, reduced to 25% and unified to warm; light bands on top of glass towers.
- **Bridges**: generate geometry only for bridge segments. Deck height is interpolated between the approach heights at each end with a slight camber, ensuring clearance above the water; night light strips along the sides; a pier every 3 points over water.
- **Traffic**: 14,000 Points driving on the right along the main-road polylines, with time scaled. By day, assorted body colours; at night, white headlights in one direction and red taillights in the other (HDR values that feed the bloom).
- **Sky**: a sky-sphere shader interpolating between 7 keyframes by solar elevation, with a sun disc and halo, horizon glow, stars (hash + twinkle) and the moon.
- **Lighting**: sun direction from a formula using Seoul's latitude and the solar declination; when the sun is below -2°, the key light switches to moonlight. The shadow camera follows the viewpoint every frame, with radius = camera distance × 0.75, texel-snapped.
- **Post**: a HalfFloat + 4×MSAA RenderTarget → UnrealBloom (stronger at night) → two separable tilt-shift blur passes (strength varying with pitch) → vignette and saturation → OutputPass (ACES).
- **Adaptive quality**: below 28 fps, lower the pixel ratio and raise the LOD threshold; above 55, bring them back up.

## 4. Landmarks (22, modelled procedurally, with real coordinates)
Baegundae on Bukhansan, Gyeongbokgung, Changdeokgung, Gwanghwamun Square, Cheonggyecheon, Sungnyemun, Seoul Station, N Seoul Tower, Heunginjimun, DDP, Seoul Forest, Lotte World Tower, Lotte World Magic Island (on the island in Seokchon Lake), the Olympic Park World Peace Gate, Jamsil Olympic Stadium, COEX, Gangnam Station, the Banpo Bridge Moonlight Rainbow Fountain, Yongsan, the 63 Building on Yeouido, Seoul World Cup Stadium, and Gimpo Airport.

Modelling notes:
- Lotte World Tower: a tapered loft of superellipse sections, with an open steel crown at the top.
- N Seoul Tower: on the summit of Namsan, with the tower cycling through colours at night.
- 63 Building: a golden trapezoidal extrusion.
- DDP: a curved profile extruded with large fillets, with an LED dot matrix on its surface.
- City gates: a stone base with an arched gateway, topped by a double-eaved gate pavilion; Heunginjimun also gets its semicircular enceinte.
- Gyeongbokgung: palace walls, Gwanghwamun, Heungnyemun, Geunjeongjeon (double eaves plus cloister), Sajeongjeon and other halls, Gyeonghoeru and its pond, Hyangwonjeong, and several courtyards. Korean roofs are built from 10 triangles to give the upturned corners.
- The two stadiums are Lathe solids of revolution.
- Fountain: nozzles placed along both sides only on the bridge section over water; GPU particles trace parabolas, rainbow-coloured at night, additively blended.
- Gimpo: 3 aircraft cycling through approaches and take-offs along the 136° runway heading, with navigation lights at night.
- Blinking red aviation warning lights on supertall rooftops.

Each landmark gets a card: Chinese name, Korean and English names, a short description, three facts, coordinates, and tour-shot parameters (distance, pitch, heading).

## 5. Interaction and UI
- **OrbitControls**: drag to rotate, right-drag or two fingers to pan, scroll to zoom toward the cursor, pitch capped at 82°. Keyboard: arrow keys to pan, +/- to zoom, H back to overview, T to start the tour, N to toggle day/night.
- **Flight**: interpolate target, heading and pitch; interpolate distance in log space, rising mid-flight in proportion to the distance travelled to form an arc; cubic easing.
- **Tour**: fly through the 22 stops in order, pausing 7.5 seconds at each with a slow orbit, updating the card and progress bar in sync; any manual input pauses the tour.
- **Labels**: landmark labels are numbered pills with a leader line and a dot, and are clickable; district, peak, bridge and river labels fade in and out with distance; landmark labels avoid collisions in screen space by priority.
- **Panels**: on the left, the brand, stats and landmark list; on the right, time (slider, flow button, dawn/noon/dusk/night presets), season, weather and layer toggles (district boundaries, place names, traffic, trees, buildings, tilt-shift); bottom-left, a clickable minimap showing the projected frustum, current district name and coordinates; a bottom dock with Overview, Tour and North-up.
- **Districts**: hovering shows the district name, area and elevation (picked by stepping through the heightfield), and the district's boundary curtain rises; clicking flies there.
- **Loading**: a loading screen with a progress bar; the opening swoops down from high altitude to the overview. Default time 17:15, season autumn.
- **Visual style**: dark translucent frosted panels, a gold-orange primary (#f2b35e) and a cyan secondary (#74c7cf), no web fonts.
