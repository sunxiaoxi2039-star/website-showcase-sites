/* Astra vs Opus — 首页数据（中英双语）。原始 prompt 见 prompts.js（保持原文）。 */
(function () {
  'use strict';

  /* ---------------- 第一轮：Opus 5 按描述临摹的 6 件 ---------------- */
  const WORKS = [
    {
      slug: 'abyssal',
      name: { zh: '深渊：活着的深海', en: 'ABYSSAL: The Living Deep' },
      author: '@emollick',
      post: 'https://x.com/emollick/status/2095673885605630429',
      demo: 'https://abyssal-living-deep.netlify.app',
      repo: 'https://github.com/emollick/abyssal-living-deep',
      originDesc: {
        zh: '把一个开源的「海面风暴生成器」交给 Astra，让它补出海面之下的世界：一路潜到 1400 米，礁盘、海藻林、大陆坡、热液区连成一整片按种子生成的生态。',
        en: 'An open-source "ocean storm generator" was handed to Astra to build the world beneath the waves: a dive all the way to 1,400 m, with reef, kelp forest, continental slope and hydrothermal vents stitched into one seed-generated ecosystem.'
      },
      copyTitle: { zh: '一次 1400 米的下潜', en: 'A 1,400-metre dive' },
      did: [
        { zh: '按种子生成的世界：礁盘 → 海藻林 → 大陆坡 → 深渊热液区，换种子整片海重长', en: 'A seeded world: reef → kelp forest → continental slope → abyssal vents; a new seed regrows the whole ocean' },
        { zh: '深度驱动的雾、光与配色，五个分区各自的色温；浅水区做了垂直夸张让礁区可逛', en: 'Depth-driven fog, light and palette with a colour temperature per zone; the shallows are vertically exaggerated so the reef is explorable' },
        { zh: '鱼群沿环形巡游、蝠鲼扇动胸鳍、热液喷口脉动、海藻在顶点着色器里随洋流摆', en: 'Fish schools circle, mantas flap their fins, vents pulse, and kelp sways with the current in the vertex shader' }
      ],
      gap: [
        { zh: '原作有真实的物种分层（鮟鱇、管虫、章鱼各归各的深度），我只做了体型与配色的分层', en: 'The original layers real species by depth (anglerfish, tube worms, octopus); mine only layers body size and colour' },
        { zh: '没有做水下体积光与焦散，靠加性光柱近似', en: 'No volumetric light or caustics — approximated with additive light shafts' }
      ],
      tags: [
        { zh: '程序化地形', en: 'Procedural terrain' },
        { zh: '顶点着色器摆动', en: 'Vertex-shader sway' },
        { zh: '种子可复现', en: 'Reproducible seeds' },
        { zh: '加性粒子', en: 'Additive particles' }
      ],
      row: {
        sell: { zh: '一个连续可下潜、按种子生成的整片海洋生态', en: 'A whole seeded ocean ecosystem you can dive through continuously' },
        mine: { zh: '径向地形函数 + 深度分区雾光 + 沿斜坡的螺旋下潜路线', en: 'Radial terrain function + per-zone fog and light + a spiral dive path down the slope' },
        score: 72,
        gap: { zh: '物种细分与体积光', en: 'Species detail and volumetric light' }
      },
      promptEn: `Write a procedural ocean as a single HTML file with Three.js, diving from the surface all the way down to 1,400 m.

Generate the terrain with a radial function: a coral reef platform at the centre, falling away across the continental slope into a trench. The camera dives automatically along a spiral path that hugs the slope; the mouse wheel / W S also control depth manually, and dragging looks around.

Split the depth into five zones (open water column / sunlit coral reef / kelp forest / continental slope / abyssal hydrothermal field), each with its own fog colour, fog density and light intensity; when you cross into a zone, fade its name in at the centre of the screen. Exaggerate the vertical scale in the shallows so the reef is explorable and the abyss still feels truly deep.

Content: coral growing in patches (three procedural forms: staghorn, brain coral, tube sponge); kelp swaying with the current in the vertex shader; schools of fish circling and manta rays flapping their pectoral fins; pulsing hydrothermal vents and tube worms in the depths; marine snow and bioluminescent particles through the full depth; sunbeams visible below the surface.

Panel: a seed input (a new seed regenerates the entire ocean), current strength, creature density, an auto-dive toggle; a live depth readout (metres) in the bottom-right corner. All flat-shaded low-poly geometry — no external models or textures.`
    },
    {
      slug: 'v8-engine',
      name: { zh: 'V8 四冲程剖面', en: 'Interactive V8 Engine' },
      author: '@DilumSanjaya',
      post: 'https://x.com/DilumSanjaya/status/2096280244663775423',
      demo: '',
      originDesc: {
        zh: '一句「做一个高度精细的 V8 发动机可视化」，Astra 直接给出完整的四冲程演示：进气、压缩、做功、排气可实时切换，曲轴、凸轮轴、点火顺序、气门正时与缸压都能查。',
        en: 'From one line — "make a highly detailed V8 engine visualization" — Astra produced a full four-stroke demo: intake, compression, power and exhaust switchable in real time, with crankshaft, camshafts, firing order, valve timing and cylinder pressure all inspectable.'
      },
      copyTitle: { zh: '按真实几何跑的四冲程', en: 'A four-stroke cycle on real geometry' },
      did: [
        { zh: '曲柄连杆按公式解算：s = r·cosψ + √(L² − r²sin²ψ)，十字平面曲轴四个曲拐相位 0/90/270/180', en: 'Slider-crank solved analytically: s = r·cosψ + √(L² − r²sin²ψ), cross-plane crank with throws at 0/90/270/180' },
        { zh: '点火顺序 1-8-4-3-6-5-7-2，每缸相位差 90°，面板实时高亮正在做功的那一缸', en: 'Firing order 1-8-4-3-6-5-7-2, 90° apart; the panel highlights whichever cylinder is on its power stroke' },
        { zh: '气门升程曲线、缸压曲线、火花塞点火闪光、可切换的剖切缸体与冲程配色', en: 'Valve-lift and cylinder-pressure curves, spark flashes, a toggleable cutaway block and stroke colour-coding' }
      ],
      gap: [
        { zh: '原作的机械细节（摇臂、气门弹簧、正时链）建模精度高得多，我这边是盒子与圆柱拼的示意', en: 'The original models rockers, valve springs and the timing chain in far more detail; mine is a schematic of boxes and cylinders' },
        { zh: '没有做进排气歧管与冷却水道的走向', en: 'No intake/exhaust manifolds or coolant passages' }
      ],
      tags: [
        { zh: '运动学解算', en: 'Kinematics' },
        { zh: '四冲程时序', en: 'Four-stroke timing' },
        { zh: '剖切视图', en: 'Cutaway view' },
        { zh: '实时仪表', en: 'Live gauges' }
      ],
      row: {
        sell: { zh: '把复杂机械拆成可操作的 3D 课堂', en: 'Turns a complex machine into a hands-on 3D lesson' },
        mine: { zh: '曲柄连杆运动学 + 720° 循环相位 + DOM 仪表联动', en: 'Slider-crank kinematics + a 720° phase cycle + linked DOM gauges' },
        score: 78,
        gap: { zh: '零件建模精度', en: 'Part-level modelling detail' }
      },
      promptEn: `Write an interactive V8 engine cutaway as a single HTML file with Three.js; the mechanism must run on real kinematics.

Geometry and motion: a cross-plane crankshaft with four crank throws phased at 0/90/270/180; two banks at 90°; piston travel solved with s = r·cosψ + √(L² − r²·sin²ψ), with each connecting rod re-oriented every frame between the crank pin and the wrist pin; camshafts turning at half speed.

Run the four strokes on a 720° phase cycle with firing order 1-8-4-3-6-5-7-2 (90° between cylinders). Compute valve lift from phase (exhaust 140–380°, intake 340–580°) to drive both valves; at the start of the power stroke, light a decaying flame in the combustion chamber and flash the spark plug at top dead centre.

UI: an rpm slider 0–6500, single-step slow motion, a cutaway block (block / head / rocker covers turn translucent), pistons coloured by stroke; a right-hand panel shows the firing order (highlighting the cylinder on its power stroke) and eight cylinder-pressure bars; click any cylinder to lock onto it, with its current stroke shown at the top; crank angle in the bottom-right corner.`
    },
    {
      slug: 'seoul-atlas',
      name: { zh: '首尔立体地图', en: 'Seoul 3D Atlas' },
      author: '@synabreu',
      post: 'https://x.com/synabreu/status/2096557555086725159',
      demo: 'https://seoul-3d-atlas.synabreu.chatgpt.site/',
      originDesc: {
        zh: '微缩版首尔：地标飞行穿越，加上从白天到夜晚的光照变化。',
        en: 'A miniature Seoul: fly-throughs between landmarks, with lighting that shifts from day to night.'
      },
      copyTitle: { zh: '微缩首尔与五处地标', en: 'Miniature Seoul, five landmarks' },
      did: [
        { zh: '汉江沿曲线铺开、三座桥、六个城区按密度长出上千栋楼，楼身窗格是运行时生成的贴图', en: 'The Han River laid along a curve, three bridges, and a thousand-plus buildings grown by density across six districts, with window textures generated at runtime' },
        { zh: 'N 首尔塔、乐天世界塔、景福宫、东大门 DDP、63 大厦五处地标，点击或用下方胶囊按钮飞过去', en: 'Five landmarks — N Seoul Tower, Lotte World Tower, Gyeongbokgung, Dongdaemun DDP, the 63 Building — reachable by clicking or via the capsule buttons' },
        { zh: '一条时间轴从正午推到凌晨：天色、日照角度、窗灯、桥灯、江面反射一起变', en: 'One timeline from noon to the small hours: sky, sun angle, window lights, bridge lights and river reflections all change together' }
      ],
      gap: [
        { zh: '地标是按印象做的示意体块，不是实测比例；城市肌理也不对应真实路网', en: 'Landmarks are impressionistic massings, not surveyed proportions; the urban fabric doesn’t follow the real street grid' },
        { zh: '没有做地面街道与车流', en: 'No streets or traffic at ground level' }
      ],
      tags: [
        { zh: '程序化城市', en: 'Procedural city' },
        { zh: 'Canvas 贴图窗灯', en: 'Canvas window lights' },
        { zh: '相机补间', en: 'Camera tweening' },
        { zh: '昼夜循环', en: 'Day–night cycle' }
      ],
      row: {
        sell: { zh: '微缩城市 + 地标飞行 + 昼夜切换', en: 'Miniature city + landmark fly-throughs + day/night' },
        mine: { zh: '密度分区生成楼群 + 五处手工地标 + 时间轴驱动全场光照', en: 'Density-zoned building generation + five hand-made landmarks + a timeline driving all lighting' },
        score: 68,
        gap: { zh: '真实地形与路网', en: 'Real terrain and street network' }
      },
      promptEn: `Write a miniature 3D map of Seoul as a single HTML file with Three.js.

City: lay the Han River across the view as a ribbon of water along a Catmull-Rom curve, with three bridges (towers + a string of bridge lights); procedurally generate over a thousand buildings across six districts by density, with window grids painted on a Canvas at runtime and used as an emissiveMap that only lights up at night; add blinking aviation lights on top of the tallest towers.

Hand-build five landmarks: Namsan + N Seoul Tower, Lotte World Tower (a cone tapering on all four sides), Gyeongbokgung (a main hall with a double roof + palace walls + Gwanghwamun), Dongdaemun DDP (a silver shell without a single straight edge), and the 63 Building. Both the capsule buttons below and the landmarks in the scene are clickable; the camera tweens over, and a card on the right shows the Chinese and English names, height, year completed and a one-line introduction.

A time slider runs from noon to 2 a.m.: sky colour, sun angle and colour, window lights, bridge lights, aviation lights and river reflections all change together. Add an auto-tour mode that moves to a new landmark every 7 seconds.`
    },
    {
      slug: 'van-gogh-town',
      name: { zh: '可以走进去的梵高小镇', en: 'Walk Through Van Gogh' },
      author: '@petergostev',
      post: 'https://x.com/petergostev/status/2095776685807346105',
      demo: 'https://van-goghs-town.surge.sh/',
      originDesc: {
        zh: '把六幅画重新想象成一座可以走进去的、带笔触感的小镇。',
        en: 'Six paintings reimagined as a painterly town you can walk into.'
      },
      copyTitle: { zh: '把四幅画拼成一座镇子', en: 'Four paintings stitched into one town' },
      did: [
        { zh: '星夜的天穹：两次域扭曲的噪声卷成旋涡笔触，分格的星点与月亮各自带厚颜料似的光晕', en: 'A Starry Night sky: twice domain-warped noise curled into swirling strokes, with grid-sampled stars and a moon wearing thick-paint halos' },
        { zh: '黄房子、夜间露天咖啡座、奥维尔教堂、罗纳河的星夜四处场景，走近会亮出对应画作的标签', en: 'Four scenes — the Yellow House, Café Terrace at Night, the Church at Auvers, Starry Night Over the Rhône — each revealing its painting’s label as you approach' },
        { zh: '一万八千根笔触草与麦浪（InstancedMesh），柏树随风，昼夜滑杆可以把夜色推回白天', en: '18,000 brushstroke blades of grass and wheat (InstancedMesh), wind-blown cypresses, and a slider that pushes night back to day' }
      ],
      gap: [
        { zh: '原作是六幅画，我只搭了四处；且没有做真正的笔触后期（我用的是叠加纹理与顶点色）', en: 'The original has six paintings; I built four, and with no true brushstroke post-processing (overlay texture and vertex colours instead)' },
        { zh: '建筑是体块化的，没有画里那种扭曲透视', en: 'Buildings are blocky, without the paintings’ warped perspective' }
      ],
      tags: [
        { zh: '旋涡天空 shader', en: 'Swirling-sky shader' },
        { zh: 'InstancedMesh 笔触', en: 'InstancedMesh strokes' },
        { zh: '第一人称漫游', en: 'First-person walk' },
        { zh: '昼夜滑杆', en: 'Day/night slider' }
      ],
      row: {
        sell: { zh: '六幅画长成一座可步行的小镇', en: 'Six paintings grown into a walkable town' },
        mine: { zh: '噪声旋涡天穹 + 四处地标建筑 + 实例化笔触植被', en: 'Swirling noise sky + four landmark buildings + instanced brushstroke vegetation' },
        score: 63,
        gap: { zh: '画面的笔触后期与画作数量', en: 'Brushstroke post-processing and number of paintings' }
      },
      promptEn: `Write a walkable Van Gogh town as a single HTML file with Three.js, with first-person W A S D movement + drag to look around.

The sky is the centrepiece: in the sky dome’s fragment shader, run fbm noise with two passes of domain warping to curl it into the swirling brushstrokes of The Starry Night; draw the stars by sampling one point per grid cell as bright dots with thick-paint halos, and add a moon.

Carpet the ground with ten thousand or more instanced little colour patches as brushstroke grass and waves of wheat (InstancedMesh, with per-instance random colour, size and tilt).

Four scenes for four paintings: the Yellow House (mustard walls + blue-green shutters), the Café Terrace at Night (a lamp under a warm yellow awning lighting up the square, with tables, chairs and cobblestones), the Church at Auvers (blue-violet tower and spire), and Starry Night Over the Rhône (a few golden reflections on the river). Walk up to any of them and the painting’s Chinese name, original title and year fade in at the bottom. Cypresses sway gently in the wind.

Panel: a night slider (able to push night back to day), brushstroke flow speed, auto-wander and sprint. Finally, overlay very faint diagonal stripes as a canvas texture.`
    },
    {
      slug: 'orbital-core',
      name: { zh: '轨道核心', en: 'Orbital Core Showcase' },
      author: '@oneruofeng',
      post: 'https://x.com/oneruofeng/status/2096551010089263181',
      demo: 'https://orbital-core-showcase.wangruofeng007.workers.dev',
      originDesc: {
        zh: '在 Blender 里建出的双环能量核心，放进网页里可以自由旋转和推近观察。',
        en: 'A dual-ring energy core modelled in Blender, placed in a web page where you can orbit and zoom in freely.'
      },
      copyTitle: { zh: '双环能量核心产品页', en: 'A product page for a dual-ring core' },
      did: [
        { zh: '菲涅尔辉光壳 + 等离子丝 + 呼吸式的核心脉动，能量滑杆同时驱动亮度、灯光与粒子', en: 'Fresnel glow shells + plasma filaments + a breathing core pulse; one energy slider drives brightness, lights and particles together' },
        { zh: '两组反向自转的环与十二枚约束模块，悬停高亮并弹出模块名称', en: 'Two counter-rotating ring sets with twelve containment modules that highlight and show their names on hover' },
        { zh: '爆炸视图把模块沿半径推开、两环上下分离，产品页式的左栏文案与参数表', en: 'An exploded view pushes modules outward and splits the rings; product-page copy and a spec sheet in the left column' }
      ],
      gap: [
        { zh: '原作的核心是 Blender 建模导入，材质与倒角精度不是程序化几何能追平的', en: 'The original core is a Blender import; procedural geometry can’t match its materials and bevels' },
        { zh: '没有做真正的辉光后期（Bloom），靠加性壳体近似', en: 'No real bloom pass — approximated with additive shells' }
      ],
      tags: [
        { zh: '菲涅尔 shader', en: 'Fresnel shader' },
        { zh: '加性粒子', en: 'Additive particles' },
        { zh: '爆炸视图', en: 'Exploded view' },
        { zh: '产品页排版', en: 'Product-page layout' }
      ],
      row: {
        sell: { zh: 'Blender 精度的模型放进网页里自由观察', en: 'A Blender-grade model you can inspect freely in the browser' },
        mine: { zh: '纯程序化几何 + 菲涅尔辉光壳 + 手写轨道相机', en: 'Purely procedural geometry + Fresnel glow shells + a hand-written orbit camera' },
        score: 70,
        gap: { zh: '建模精度与 Bloom 后期', en: 'Modelling fidelity and bloom' }
      },
      promptEn: `Write a "dual-ring energy core" product showcase as a single HTML file with Three.js — purely procedural geometry, no imported models.

At the centre sits a flat-shaded polyhedral core wrapped in two Fresnel glow shells (rendered with BackSide, so take abs() of the normal dot product to get bright edges and a see-through centre); a few jittering plasma filaments wind through the core, and the whole thing pulses with a breathing rhythm.

Two ring sets counter-rotate, each with a glowing strip along its inner edge and six white containment modules spaced evenly around it; hovering a module highlights it and pops up its name and spec (e.g. "Containment Coil A · superconducting magnetic cage 4.2 K"). Scatter a thousand-plus additively blended sparks orbiting the core.

The left column follows product-page typography: kicker, headline, a paragraph of description and four specs (output power / ring speed / module count / coolant), with power and speed updating live with the sliders. Controls: energy output, ring speed, exploded view (modules pushed out radially, the two rings separated vertically), auto-rotate. A hand-written orbit camera: drag to rotate, wheel to zoom.`
    },
    {
      slug: 'brandenburg-piano',
      name: { zh: '勃兰登堡键盘', en: 'Brandenburg Piano' },
      author: '@DeryaTR_',
      post: 'https://x.com/DeryaTR_/status/2096090915790069857',
      demo: 'https://brandenburg-piano.vercel.app/',
      originDesc: {
        zh: '一架虚拟钢琴，内置巴赫《勃兰登堡协奏曲》的演奏。',
        en: 'A virtual piano with a built-in performance of Bach’s Brandenburg Concertos.'
      },
      copyTitle: { zh: '会自己弹巴赫式织体的键盘', en: 'A keyboard that plays Bach-style textures' },
      did: [
        { zh: 'WebAudio 合成的羽管键琴音色（锯齿波 + 包络滤波 + 延迟混响），明亮度可调', en: 'A WebAudio-synthesised harpsichord (sawtooth + enveloped filter + delay reverb) with adjustable brightness' },
        { zh: '照 BWV 1048 第一乐章的写法生成乐句：右手连绵十六分音符的分解和弦压在行走低音上，八小节和声循环', en: 'Phrases generated in the manner of BWV 1048, movement I: running sixteenth-note arpeggios over a walking bass on an eight-bar harmonic loop' },
        { zh: 'Synthesia 式的音符河流从上方落到琴键上，落点触发按键下沉与光晕；也可以自己点键盘弹', en: 'A Synthesia-style river of notes falls onto the keys, pressing them with a glow on impact; you can also play it yourself' }
      ],
      gap: [
        { zh: '原作内置的是真实的协奏曲演奏，我这边是按织体生成的巴赫风格段落，<b>不是原谱转录</b>', en: 'The original plays the actual concerto; mine generates Bach-style passages from the texture — <b>not a transcription of the score</b>' },
        { zh: '音色是合成器近似，没有采样钢琴的层次', en: 'A synthesised approximation, without the depth of a sampled piano' }
      ],
      tags: [
        { zh: 'WebAudio 合成', en: 'WebAudio synthesis' },
        { zh: '前瞻调度器', en: 'Look-ahead scheduler' },
        { zh: '音符河流', en: 'Falling-note river' },
        { zh: '巴洛克织体生成', en: 'Baroque texture generator' }
      ],
      row: {
        sell: { zh: '虚拟键盘 + 内置巴赫演奏', en: 'Virtual keyboard + built-in Bach performance' },
        mine: { zh: 'WebAudio 羽管键琴音色 + 按织体规则生成的 G 大调乐句', en: 'WebAudio harpsichord + G-major phrases generated from texture rules' },
        score: 65,
        gap: { zh: '原谱转录与采样音色', en: 'Real score and sampled sound' }
      },
      promptEn: `Write a single HTML file: Three.js draws a 3D keyboard from E2 to C6 (white and black keys, a wooden case, a red felt strip), with a harpsichord tone synthesised in WebAudio.

Tone: sawtooth + triangle overtones → an enveloped low-pass filter → a fast-decaying amplitude envelope, plus a delay-feedback send for a sense of room; make brightness an adjustable slider.

Generate the built-in passage after the texture of the first movement of Bach’s Brandenburg Concerto No. 3: an eight-bar harmonic loop G–D/F#–Em–Bm–C–G/B–Am7–D7, the right hand running continuous sixteenth notes over the chord tones (rotating among several figures), the left hand playing a walking bass note on every beat. Use a look-ahead scheduler that schedules about 2.2 seconds ahead.

Visuals: Synthesia-style note bars fall from above onto the keys; the instant one lands, the key presses down, its surface glows and a ring of light spreads out; the top-right corner shows the current chord and bar number.

Interaction: a tempo slider from 52 to 184 BPM, a sustain toggle, pause; users can also play by clicking keys or with the computer keyboard. On first visit, an overlay takes one click before starting the AudioContext.`
    }
  ];

  /* ---------------- 第二轮：Opus 5.5 隔离记忆独立逆向 ---------------- */
  const V2 = [
    {
      slug: 'abyssal', name: { zh: '深渊：活着的深海', en: 'ABYSSAL: The Living Deep' },
      summary: { zh: '一套水体光学模型统一处理颜色衰减、焦散、光柱与头灯；32 种程序化动物会成群、惊散、觅食；同一个种子长出海面到 1400 米的连续海洋。', en: 'One water-optics model handles colour falloff, caustics, light shafts and headlamp; 32 procedural species school, scatter and feed; one seed grows a continuous ocean from surface to 1,400 m.' },
      base: { zh: '读过原作仓库 README 与截图，未读源码', en: 'Read the repo README and screenshots, not the source' }, higher: true
    },
    {
      slug: 'v8-engine', name: { zh: 'V8 四冲程剖面', en: 'Interactive V8 Engine' },
      summary: { zh: '一套物理模型同时驱动 3D 与所有图表：改点火提前角、节气门、凸轮相位会实时重算缸压峰值与爆震风险；外观 / 剖切 / 透视 / 原理图四视图。', en: 'One physics model drives the 3D and every chart: change ignition advance, throttle or cam phasing and peak pressure and knock risk are recomputed live; exterior, cutaway, X-ray and schematic views.' },
      base: { zh: '只有文字描述（原作无 demo）', en: 'Text description only (no public demo)' }, higher: false
    },
    {
      slug: 'seoul-atlas', name: { zh: '首尔立体地图', en: 'Seoul 3D Atlas' },
      summary: { zh: '真实地理数据的首尔沙盘：约 40 万栋建筑（Overture / OSM）+ 真实地形 + 25 个区；22 处地标巡游、昼夜与季节、雨雪、车流。', en: 'A Seoul diorama on real geodata: ~400,000 buildings (Overture / OSM) + real terrain + 25 districts; 22-landmark tour, day/night and seasons, rain, snow and traffic.' },
      base: { zh: '读过原作仓库 README 文字，未读源码', en: 'Read the repo README text, not the source' }, higher: true
    },
    {
      slug: 'van-gogh-town', name: { zh: '可以走进去的梵高小镇', en: 'Walk Through Van Gogh' },
      summary: { zh: '全手写着色器：笔触固定在世界空间逐像素生成，光照按笔触量化；六个画区缝成一块地理，走进哪幅画，天色就变成哪幅画。', en: 'All hand-written shaders: brushstrokes anchored in world space and generated per pixel, lighting quantised per stroke; six painting zones sewn into one landscape — the sky becomes whichever painting you walk into.' },
      base: { zh: '只有文字描述 · 最干净的盲测', en: 'Text description only — the cleanest blind test' }, higher: false
    },
    {
      slug: 'orbital-core', name: { zh: '轨道核心', en: 'Orbital Core Showcase' },
      summary: { zh: '程序化扫掠的硬表面 + PBR + 辉光后期；两道环做成可独立转动的万向节，四种模式（轨道 / 脉冲 / 静止 / 拆解）外加 WebAudio 声音。', en: 'Procedurally swept hard surfaces + PBR + bloom; the two rings are an independently rotating gimbal, with four modes (orbit / pulse / still / disassemble) plus WebAudio sound.' },
      base: { zh: '读过并本地跑过原作公开源码，未复用', en: 'Read and ran the public source locally; reused none of it' }, higher: true
    }
  ];

  /* ---------------- 第三轮：20 道同题对打 ---------------- */
  const BATTLE = [
    ['form-editorial', 'FORM 编辑排版', 'FORM', 'FORM — The Shape Issue', 'batch', 30.5, 46.0],
    ['abyss-sonar', '深海声呐', 'Abyss', 'Abyss — Listen to the Deep', 'batch', 32.0, 46.5],
    ['jellyfish-ballet', '水母芭蕾', 'Pelagia', 'Pelagia — A Ballet Without Gravity', 'batch', 27.5, 44.5],
    ['chroma-field', '色彩场', 'Chroma Field', 'Chroma Field — Soft Collisions', 'batch', 32.0, 45.5],
    ['aero-form', '气动造型', 'Aeroform', 'Aeroform — Built for What’s Next', 'batch', 29.5, 44.5],
    ['pollen-atlas', '花粉图谱', 'Small Is Spectacular', 'Small Is Spectacular', 'batch', 23.5, 46.0],
    ['eclipse-chamber', '日全食', 'Totality', 'Totality', 'batch', 28.5, 45.5],
    ['prism-studio', '棱镜工作室', 'One Light', 'One Light, Infinite Color', 'batch', 26.0, 44.5],
    ['solar-garden', '黄金角花园', 'Golden Angle', 'Follow the Golden Angle', 'batch', 31.5, 47.0],
    ['ink-diffusion', '墨水扩散', 'Where Ink Goes', 'Where Ink Goes', 'batch', 30.0, 46.0],
    ['hydraulic-balance', '液压平衡', 'Equal', 'Equal — A Study in Pressure', 'batch', 29.0, 44.5],
    ['fourth-dimension', '第四维', 'Beyond', 'Beyond — Think Outside the Cube', 'batch', 29.0, 46.0],
    ['kinetic-balance', '悬挂平衡', 'Equilibrium', 'Equilibrium / Mobile Study', 'batch', 28.5, 44.5],
    ['golden-repair', '金继', 'Tsugi', 'Tsugi — The Beauty of Repair', 'batch', 30.5, 45.5],
    ['ring-world', '环之世界', 'Ringworld', 'Ringworld — The Geometry of Saturn', 'batch', 25.0, 45.0],
    ['ink-mountains', '水墨山', 'Between Mountains', 'Between Mountains', 'batch', 25.0, 45.5],
    ['magnetic-matter', '磁性物质', 'Ferro', 'Ferro — Invisible Forces', 'batch', 31.0, 45.0],
    ['melon-lab', '瓜体实验室', 'Melon Lab', '瓜体实验室 (Melon Lab)', 'heavy', 40.5, 43.5],
    ['mosswing', '苔翼', 'Mosswing', 'Mosswing', 'heavy', 39.0, 43.5],
    ['thunderfall', '雷霆战机', 'Thunderfall', '雷霆战机 · 天穹远征 / THUNDERFALL', 'heavy', 40.0, 45.5]
  ].map(r => ({ slug: r[0], zh: r[1], en: r[2], full: r[3], group: r[4], astra: r[5], opus: r[6] }));

  /* 可拖动对比滑块用的几对截图 */
  const SLIDES = ['mosswing', 'thunderfall', 'melon-lab', 'eclipse-chamber', 'ring-world', 'pollen-atlas'];

  window.AVO = { WORKS, V2, BATTLE, SLIDES };
})();
