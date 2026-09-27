# Walk Through Van Gogh's Town · Independent Reverse-Engineering Notes

## How I read the original (what it is really selling)

Peter Gostev's *Walk Through Van Gogh*, made with GPT-6 Astra, can be summed up in one sentence: six Van Gogh paintings "stitched" into a town you can walk into. I think what really moves people works on three levels:

1. **From "looking at a painting" to "standing where the painter stood."** A famous painting's composition has only one viewpoint; the original turns it into a space you can walk around. You can step behind the café terrace, or back out of the bedroom door to look at the Yellow House's outside wall.
2. **A town, not a gallery.** The six paintings aren't six rooms with pictures on the walls; they're sewn into one geography — streets, a square, a riverbank, fields, a hillside. The author later used the same town for a shooter, *Gogh Strike*, which shows it has streets you can really walk and real occlusion, not a collage of painted backdrops.
3. **"Painterly."** The 3D scene has to look as though it was made with a palette knife and bristle brushes, not low-poly with a filter on top. This is the hardest part, and the one that makes or breaks the piece.

## Reverse inference: which key mechanisms I deduced from limited material, and why

All I had to go on: the title; "Six paintings reimagined as one walkable, painterly Three.js town"; *The Starry Night*, *The Bedroom* and *Café Terrace at Night*, named in community write-ups; and *Gogh Strike* ("12 painters, two teams, fighting in Van Gogh's town"). Neither x.com nor surge was reachable from my network, so everything below is inference:

- **First-person walking + collision**: *Gogh Strike* is a 5v5 FPS, so the map must have working collision, streets, alleys and cover. On that basis I built the town as a genuinely walkable neighbourhood: every building has collision, you can enter the bedroom through a door, and you can't walk into the river from the bank.
- **Three.js, single page, no build**: the post says Three.js, and it's a static page hosted on surge.
- **How the six paintings were chosen**: three are confirmed (The Starry Night, The Bedroom, the café terrace); I chose the other three by asking "can they be stitched into the same town?":
  - **The Yellow House (The Street)**: the bedroom *is* in the Yellow House. Exterior and interior can be joined by a single door — the most natural seam of the six.
  - **Starry Night Over the Rhône**: in the real Arles, Place Lamartine, where the Yellow House stood, is only a few minutes' walk from the Rhône embankment. It gives the town a waterfront, and brings a second, different night sky from the "starry night" series (with the Big Dipper and gaslight reflections).
  - **Wheatfield with Crows**: it gives the town an "outside of town," and it's the only one of the six with a turbulent daytime sky, contrasting with the night scenes.
  - I didn't choose *The Church at Auvers* or *Sunflowers*: the church would duplicate the role of the steeple in *The Starry Night*, so I put the Starry Night steeple at the end of the main street as a landmark serving both; *Sunflowers* is a still life and can't be sewn into a street.
  - Four of the paintings are from Arles (1888); *The Starry Night* is from Saint-Rémy and *Wheatfield with Crows* from Auvers. Putting those two on the hillside and fields outside town makes geographic sense.
- **"Painterly" probably isn't a texture**: if you just put Van Gogh brushstroke textures on models, they blur and repeat as you get close. I reasoned that a good version must bind the strokes to the lighting (light quantized at the unit of the brushstroke), and the sky needs strokes that follow the direction of the swirls. That became my core technical goal.

## Implementation approach and key technical decisions (and why)

**Stack**: Three.js r186 (`three.module.js` and `three.core.js` pulled from npm into `vendor/`), ES modules plus an import map, no build. Every shader is a hand-written `ShaderMaterial`; none of three's built-in lighting or materials are used.

1. **Per-pixel procedural brushstrokes (the core)**
   Every surface is diced into a grid by triplanar projection, and each cell "owns" one stroke: a random position, length and angle, with the width tapering along its length. The fragment shader searches two interleaved 3×3 grids for the topmost stroke covering the pixel, and also remembers the stroke beneath it.
   - **Lighting is computed at the centre of the stroke, not at the pixel.** So the pool of light from the café lamp on the cobblestones, and the transition from light to shade on a wall, are quantized into blocks of solid-colour strokes. That's exactly how an oil painting looks, and it's the biggest difference from "stroke texture + smooth lighting."
   - Each stroke has a raised highlight, bristle marks and a "thick at the start, thin at the end" variation, so it reads as impasto.
   - The cobblestones use low-aspect-ratio strokes with dark outlines, recreating the individually outlined stones of the café painting.
2. **Two-level stroke LOD**
   Fine strokes turn into noise in the distance, so at the distance where they fade out, a layer of strokes four times larger is added on top. The result: distant roofs, grass and hills keep their "painted" feel. The logic is that a painter doesn't use a finer brush for the background than the foreground — a stroke stays roughly the same size on the canvas.
3. **The sky: painted in two steps**
   - First, compute the sky's "design" on a 1024×512 equirectangular map: a colour field (gradients, swirling bands, concentric halos around stars, the moon, the white clouds over the wheatfield) and a direction field. The direction field is stored as double-angle vectors, so axial stroke directions blend smoothly instead of cancelling out when opposed. It's recomputed only when the atmosphere parameters change.
   - Then lay strokes across the sky sphere: rows by latitude, with the number of cells per row varying with cos(latitude) so they don't bunch up overhead, and a modulo in longitude so the seam closes naturally. Each stroke takes its colour from the colour field at its centre and its angle from the direction field, so the strokes spiral on their own along the swirls and the halos around the stars.
4. **"Walk into a painting, and it becomes that painting"**
   Each painting has a zone of influence. The player's position sets the blend weights for a set of atmosphere parameters: how much it's night, the two sky colours, swirl strength, stars, the Big Dipper, clouds, turbulence, sun direction and colour, ambient light, fog, street-lamp strength and ground colour.
   - So as you walk from the café toward the Yellow House, night slowly fades into a cobalt-blue day; enter the wheatfield and the sky darkens and starts to churn.
   - Night colours go through a "night without black" transform: colours under ambient light are pushed toward blue, violet and green, while the parts lit by lamps stay warm. The phrase comes from Van Gogh's letter describing the café terrace.
5. **The whole town in one draw**
   All static buildings and props (about 135,000 vertices) are merged into one mesh, with two more meshes for the terrain (a 1.5 m grid near, an 8 m grid far). Palettes and stroke parameters are written into vertex attributes (3 colours, cell size, aspect ratio, angle, jitter, emission, flow field, outline), so every building takes a single draw call, and the terrain uses the same shader.
6. **Plants, people and lamp halos are all "brushstroke sprites"**
   - Wheat, grass, cypresses and olive trees are instanced stroke quads, tiered by device: about 98,000 on desktop, about 49,000 under software rendering or on phones. They're cylindrical billboards that sway in the wind. Cypresses are arranged in a flame-shaped silhouette, with strokes writhing in an S-curve.
   - People are silhouettes built from a dozen or so strokes — deliberately not little geometric figures.
   - Lamp halos are segmented concentric arcs of strokes, yellow inside and green outside — the way the café lamp is painted.
7. **The Rhône**
   The water is laid with strokes too, but each stroke's colour has two parts: the reflection from the sky colour field, plus gaslight reflection columns computed by "azimuth alignment." So the reflections break naturally into short horizontal strokes — exactly the columns of short yellow-orange dashes in the original painting.
8. **Post-processing**
   - Prussian-blue outlines drawn from the Laplacian and discontinuities of depth, with noise jitter on the lines so they look hand-drawn.
   - Plus a canvas texture, slight saturation and contrast adjustments, and a vignette.
9. **The experience layer**
   - An opening in which "the town paints itself": first a beige canvas, then the strokes land one by one.
   - Number keys 1–6 or the colour swatches at the bottom "fly you to the painter's easel": you sweep over the rooftops and land lined up with the original's composition.
   - An auto tour; a frame mode on F (a gold frame and nameplate at the painting's true aspect ratio); museum labels with quotations; a minimap; a mobile joystick; and ambient sound synthesized with WebAudio (wind, river, crickets, café chatter, all mixed by zone).
   - An easel stands beside each painter's viewpoint, its canvas showing that painting's palette.

## What I tried differently from the "usual approach"

- **The usual approach**: ordinary PBR or toon shading plus a full-screen Kuwahara or oil-paint filter, or a brushstroke texture on the models. The former suffers from an obvious "shower-door effect" (the strokes are stuck to the screen and slide across the image as the camera moves); the latter blurs and repeats up close, and the lighting is smooth.
- **My approach**: strokes fixed in world space, generated procedurally per pixel, with "one lighting value per stroke." They don't slide on the screen, don't blur up close, and lamplight, daylight and night all land on the image stroke by stroke.
- The sky isn't a picture of *The Starry Night*; it's a parametric "swirls and stars" system that can be blended. In different painting zones you're seeing different ways of painting the same sky.
- Time of day and weather follow "which painting you're in," not a global setting.
- People, plants and lamp halos are all made of strokes; no realistic geometry is left bare anywhere in the frame (except things like furniture that are blocky to begin with).

## Pitfalls and how I fixed them

1. **The walls looked like masonry, not brushstrokes**: in the first version, the gaps between strokes exposed a very dark ground colour, so walls looked like cobblestone walls.
   - I lightened the ground colour and made the strokes longer and more parallel.
   - Then I had the shader track one more layer — "the stroke underneath" — so a stroke's antialiased edge blends into the paint below rather than into a dark gap.
2. **Warm walls turned brown at night**: a warm wall multiplied by blue ambient light becomes a muddy brown.
   - I added a "night grade": a hue shift toward blue-violet applied only to the ambient part, while the lamp-lit part keeps its colour. Only after that did the right side of the street get the blue-violet night of the original painting.
3. **The bedroom ceiling went black**: I spent a long time adjusting the lighting before comparing with two debug switches, `?nopost` and `?dbgedge`, which showed the lighting was fine and the problem was in post.
   - I had added noise jitter to the depth sampling, but the depth texture is nearest-neighbour sampled, so the Laplacian picked up asymmetric offsets and planes seen at an angle were misread as edges.
   - Snapping to texel centres and jittering only the colour sampling made the problem go away.
4. **Distant ground and grazing angles turned into flat colour**: the LOD used the larger of the two directional derivatives, and at grazing angles the compression in depth made whole stretches of ground count as "too far."
   - I switched to the geometric mean of the two derivatives, then added the second level of coarse strokes. From then on the distance had brushstrokes too.
5. **The café didn't look like the café**: the first viewpoint was too far away, and the awning's outer edge was backlit and black.
   - I moved the viewpoint forward to the edge of the terrace, made the awning semi-emissive (in the painting it does glow on its own), and gave the lamp a steeper falloff so the wall across the street isn't lit orange too.
6. **Flights went backwards**: yaw was interpolated straight from start to end, so the camera faced backwards while flying.
   - I split it into three phases: turn toward the direction of flight, look ahead during the flight, then turn to the original's composition at the end.
   - At altitude the fog washed out the picture and the reflection columns became giant pillars of light, so fog and reflections are attenuated by camera height.
7. **The white clouds over the wheatfield looked like moons**: an isotropic distance field draws discs; I switched to shapes stretched horizontally and broken up with fbm.
8. **Slanted strokes rotated around one end**: horizontal strokes like a hat brim stuck out to one side. I added a lateral offset so they pivot around their midpoint.
9. **Headless SwiftShader took 0.2–0.9 s per frame**: for screenshots, a `?frames=N` parameter stops the render loop before capturing; otherwise Playwright's screenshots time out. The live site has adaptive resolution (downsampling when frame time exceeds 38 ms) and isn't designed around that frame rate.

## Self-assessment: where it may match or beat the original, and where it falls short

**Where it may match or beat the original**
- The "authenticity" of the brushwork: world space, per pixel, lighting quantized per stroke, two-level LOD. It stays painterly up close, at a distance and in a fly-over. This is what I'm most confident about.
- The sky: one parametric system of swirls and stars that transforms smoothly across the six zones, with concentric halos around the stars and the Big Dipper only above the Rhône.
- Narrative and "painter's viewpoints": number keys fly you to the easel and land you lined up with the original's composition; the frame mode and museum labels with Van Gogh's own words make "comparing with the original" part of the play.
- Zoned time and weather, and a real, walkable door between the bedroom and the Yellow House.

**Where it falls short**
- Coarse geometric detail: buildings are all boxes with pitched roofs and the furniture is blocky, without the "skewed perspective" of *The Bedroom*. I made only one wall slanted.
- No images of the original paintings were used, so the compositions only capture the spirit; proportions and positions differ from the originals. The Starry Night village is too big and too close.
- Performance: the fragment shader is heavy (18 candidate stroke lookups per pixel, plus 3 light loops). Low-end integrated GPUs rely on adaptive resolution, which softens the image.
- I can't see which six paintings the original actually chose, or how it does its brushwork — I can only infer.

## What I'd do if I started over

- Replace the stroke lookup with a "two-pass" method: first generate a stroke list per cell at low resolution (written into a Voronoi-style ID texture), then look up only 1–2 candidates at full resolution. That would cut the cost by an order of magnitude and allow 3–4 stroke layers.
- Give each painting its own "composition snapping": near the painter's viewpoint, warp the camera slightly to the original's perspective — the tilted floor of the bedroom, the high eye level of the café — so the matched views feel more like the originals.
- Use SDFs or procedural modelling for more organic roofs, window frames and furniture, so strokes can follow a curved surface's principal directions (right now they follow the triplanar axes).
- Let the sky's swirls slowly "breathe." For now the sky is static to avoid stroke jitter; flow could be achieved by cross-fading between an old and a new set of strokes.
- Add the morning star from *The Starry Night*, and a smoking train crossing the viaduct behind the Yellow House.

## Model identifier

claude-opus-5-5
