// 物种表：生境、深度、行为类型、动画参数与野外笔记。
// fit(ctx) 返回 0..1 的适宜度；ctx = { x, y, z, depth, floor, fdepth, above, hab }
const between = (v, a, b, soft = 0.15) => {
  const w = (b - a) * soft + 1e-3;
  if (v < a - w || v > b + w) return 0;
  if (v < a) return (v - (a - w)) / w;
  if (v > b) return ((b + w) - v) / w;
  return 1;
};

export const SPECIES = [
  // ——— 珊瑚礁 ———
  {
    id: 'butterflyfish', zh: '蝴蝶鱼', en: 'Butterflyfish', move: 'reef', size: [0.22, 0.3], speed: [0.5, 2.2], group: [4, 10], count: 70, near: true, school: true, prey: true,
    fit: (c) => (c.fdepth < 50 ? c.hab.reef * between(c.above, 0.4, 5) : 0), clear: [0.5, 5],
    anim: { lat: 0.06, k: 5, freq: 3.2, flapV: 0.08, lag: 0.5 }, spec: 0.35,
    desc: '侧扁如盘的小型礁鱼，黄底黑带，一道黑纹遮住眼睛。成对或小群沿礁石巡游，用尖吻啄食珊瑚虫与缝隙里的小动物。',
    descEn: 'A small, disc-shaped reef fish, yellow with dark bands and a black stripe masking the eye. Pairs and small groups patrol the reef, picking at coral polyps and tiny animals in the crevices with a pointed snout.',
  },
  {
    id: 'parrotfish', zh: '鹦嘴鱼', en: 'Parrotfish', move: 'reef', size: [0.5, 0.8], speed: [0.5, 2.5], group: [2, 5], count: 18, near: true, school: true, prey: true,
    fit: (c) => (c.fdepth < 50 ? Math.max(c.hab.reef, c.hab.grass * 0.4) * between(c.above, 0.5, 6) : 0), clear: [0.5, 6],
    anim: { lat: 0.07, k: 5, freq: 2.2, flapV: 0.14, lag: 0.3 }, spec: 0.3,
    desc: '用熔合成“鸟喙”的牙齿刮食礁石表面的藻类，头朝下啃咬时会发出清脆的声响。珊瑚礁上的白沙有相当一部分出自它们。',
    descEn: 'Scrapes algae off the reef with teeth fused into a \'beak\', making an audible crunch as it bites head-down. Much of the white sand on a coral reef comes out of parrotfish.',
  },
  {
    id: 'damselfish', zh: '雀鲷', en: 'Damselfish', move: 'swarm', hoverCoral: true, size: [0.12, 0.16], speed: [0.2, 1.4], group: [14, 28], count: 110, prey: true, shoal: true, near: true,
    fit: (c) => (c.fdepth < 45 ? c.hab.reef * between(c.above, 0.4, 4) : 0), clear: [0.4, 4],
    anim: { lat: 0.08, k: 6, freq: 4.5 }, spec: 0.6,
    desc: '成群悬停在珊瑚丛上方的小鱼，蓝绿色的身体闪闪发亮。有危险时整群一齐缩回珊瑚枝杈之间，过一会儿再慢慢浮出来。',
    descEn: 'Small blue-green fish that hover in glittering clouds above the coral heads. At any hint of danger the whole group ducks back into the branches, then slowly drifts out again.',
  },
  {
    id: 'reefshark', nearR: 40, zh: '礁鲨', en: 'Reef shark', move: 'cruise', size: [1.4, 2.0], speed: [0.9, 3.5], group: [1, 1], count: 3, hunter: true,
    fit: (c) => (c.fdepth < 120 ? Math.max(c.hab.reef, 0.35) * between(c.above, 2, 16) * between(c.depth, 4, 60) : 0), clear: [2, 14],
    anim: { lat: 0.09, k: 5.5, freq: 0.9, flapV: 0.02 }, spec: 0.2,
    desc: '灰色背部、白色腹部的流线型掠食者，背鳍尖端带黑斑。在礁坡上缓慢巡弋，靠侧线与嗅觉感知远处的动静。',
    descEn: 'A streamlined predator, grey above and white below, with a black tip on the dorsal fin. It cruises slowly along the reef slope, sensing distant movement through its lateral line and sense of smell.',
  },
  {
    id: 'manta', nearR: 40, zh: '蝠鲼', en: 'Manta ray', move: 'glide', size: [2.8, 4.2], speed: [0.8, 2.2], group: [1, 2], count: 2,
    fit: (c) => (c.fdepth < 400 ? between(c.depth, 5, 30) * (c.fdepth < 60 ? Math.max(c.hab.reef, 0.4) : 0.7) * between(c.above, 4, 60) : 0), clear: [4, 5000],
    anim: { lat: 0.0, k: 0, freq: 0.32, flapV: 0.28, lag: 1.3 }, spec: 0.2,
    desc: '翼展可达数米的滤食者，以缓慢的扑翼“飞”过水层，间歇滑翔。头前一对卷曲的头鳍用来把浮游生物导入口中。',
    descEn: 'A filter feeder whose wings can span several metres. It \'flies\' through the water with slow wingbeats and long glides, using the two curled cephalic fins on its head to funnel plankton into its mouth.',
  },
  {
    id: 'octopus', zh: '章鱼', en: 'Octopus', move: 'benthic', size: [0.6, 1.0], speed: [0.15, 0.5], group: [1, 1], count: 3, benthos: true,
    fit: (c) => (c.fdepth < 60 ? Math.max(c.hab.reef, c.hab.kelp * 0.8, 0.15) : 0),
    anim: { arm: 0.07, armSpeed: 1.3, freq: 1 }, spec: 0.25,
    desc: '八条腕在礁石与沙地间缓慢探索，皮肤能在瞬间改变颜色与纹理。一次“行走”之后常停下来，用腕尖伸进缝隙摸索猎物。',
    descEn: 'Eight arms slowly explore rock and sand, and the skin can change colour and texture in an instant. After each short \'walk\' it often pauses to probe crevices for prey with its arm tips.',
  },
  {
    id: 'crab', zh: '螃蟹', en: 'Crab', move: 'benthic', sideways: true, size: [0.16, 0.28], speed: [0.2, 0.7], group: [1, 1], count: 14, benthos: true,
    fit: (c) => (c.fdepth < 60 ? 0.5 + 0.5 * Math.max(c.hab.reef, c.hab.kelp) : 0),
    anim: { arm: 0.06, legs: true, freq: 5.5 }, spec: 0.3,
    desc: '横着走路的甲壳动物。短促地疾走一段，然后停下，钳子与步足慢慢放回地面。潜水员靠近时会侧身躲进石缝。',
    descEn: 'A crustacean that walks sideways: a quick scuttle, a pause, then claws and legs settle back onto the sand. When a diver gets close it slips sideways into a crack in the rock.',
  },
  {
    id: 'seastar', zh: '海星', en: 'Sea star', move: 'benthic', slow: true, size: [0.2, 0.34], speed: [0.01, 0.03], group: [1, 1], count: 16, benthos: true,
    fit: (c) => (c.fdepth < 60 ? 0.4 + 0.6 * Math.max(c.hab.reef, c.hab.kelp, c.hab.grass) : 0),
    anim: { arm: 0.01, armSpeed: 0.3, freq: 0.2 }, spec: 0.1,
    desc: '靠腕下数百只管足缓慢爬行，几乎察觉不到的移动。许多种类以贝类为食，能把胃翻出体外进行消化。',
    descEn: 'Crawls on hundreds of tube feet beneath its arms, moving almost imperceptibly. Many species eat shellfish and can push their stomach outside the body to digest them.',
  },
  {
    id: 'urchin', zh: '海胆', en: 'Sea urchin', move: 'benthic', slow: true, size: [0.14, 0.22], speed: [0.005, 0.015], group: [1, 1], count: 22, benthos: true,
    fit: (c) => (c.fdepth < 60 ? 0.3 + 0.7 * Math.max(c.hab.reef, c.hab.kelp) : 0),
    anim: { arm: 0.015, armSpeed: 0.5, freq: 0.2 }, spec: 0.3,
    desc: '浑身长刺的草食者，啃食藻类。数量失控时会把整片海藻林啃成“海胆荒原”，海獭与大型鱼类是它们的天敌。',
    descEn: 'A spiny grazer that feeds on algae. When their numbers run unchecked they can strip a kelp forest down to an \'urchin barren\'; sea otters and large fish are their natural enemies.',
  },
  // ——— 海藻林 ———
  {
    id: 'seal', nearR: 35, zh: '海豹', en: 'Harbor seal', move: 'cruise', breathes: true, size: [1.3, 1.7], speed: [1, 3.2], group: [1, 2], count: 4,
    fit: (c) => (c.fdepth < 60 ? Math.max(c.hab.kelp, 0.1) * between(c.depth, 1, 25) : 0), clear: [1, 20],
    anim: { lat: 0.14, k: 5, freq: 1.2, flapV: 0.1 }, spec: 0.35,
    desc: '在海藻之间灵巧穿行的哺乳动物。游泳时主要靠后肢左右摆动推进，前肢掌舵；每隔一段时间回到水面换气。',
    descEn: 'A mammal that weaves nimbly between the kelp. It swims mostly by sweeping its hind flippers side to side, steering with the fore flippers, and returns to the surface every so often to breathe.',
  },
  {
    id: 'sardine', nearR: 40, zh: '银色鱼群', en: 'Silver shoal', move: 'school', size: [0.16, 0.22], speed: [0.8, 3], group: [60, 110], count: 160, school: true, prey: true, shoal: true,
    fit: (c) => (c.fdepth < 600 ? between(c.depth, 3, 40) * between(c.above, 2, 5000) * (c.fdepth < 60 ? 0.5 + 0.5 * Math.max(c.hab.kelp, c.hab.reef * 0.6) : 0.8) : 0), clear: [2, 5000],
    anim: { lat: 0.1, k: 6, freq: 4.2, flapV: 0.05 }, spec: 1.0,
    desc: '成百上千条小型银鱼组成的鱼群，彼此保持间距，一起转向。掠食者或潜水员靠近时，鱼群会瞬间裂开，再在身后重新合拢。',
    descEn: 'Hundreds or thousands of small silver fish that keep their spacing and turn as one. When a predator or diver comes close, the school splits apart in an instant, then closes up again behind them.',
  },
  {
    id: 'turtle', nearR: 35, zh: '海龟', en: 'Sea turtle', move: 'glide', breathes: true, size: [0.9, 1.2], speed: [0.4, 1.4], group: [1, 1], count: 2,
    fit: (c) => (c.fdepth < 60 ? between(c.depth, 1, 30) * (0.4 + 0.6 * Math.max(c.hab.reef, c.hab.kelp, c.hab.grass)) : 0), clear: [0.8, 20],
    anim: { lat: 0, k: 0, freq: 0.45, flapV: 0.24, lag: 0.6, flapH: 0.1 }, spec: 0.25,
    desc: '以长长的前鳍“飞行”，强力划水与安静滑行交替。它们会回到水面换气，也会在海草床与珊瑚礁之间长距离往返。',
    descEn: 'It \'flies\' on long front flippers, alternating strong strokes with quiet glides. Turtles come up to breathe and travel long distances between seagrass beds and coral reefs.',
  },
  // ——— 蔚蓝 ———
  {
    id: 'whale', nearR: 55, zh: '座头鲸', en: 'Humpback whale', move: 'glide', breathes: true, size: [11, 13.5], speed: [1.2, 2.6], group: [1, 1], count: 1,
    fit: (c) => (c.fdepth > 60 ? between(c.depth, 8, 55) * between(c.above, 20, 5000) : 0), clear: [20, 5000],
    anim: { lat: 0, vert: 0.05, k: 4, freq: 0.22, flapV: 0.12, lag: 0.8 }, spec: 0.25,
    desc: '体长十余米的须鲸，长达身长三分之一的白色胸鳍是它的标志。尾叶上下缓慢摆动，巨大的身体几乎无声地滑过。',
    descEn: 'A baleen whale more than ten metres long, recognisable by white pectoral fins up to a third of its body length. Its flukes beat slowly up and down as the enormous body slides by almost without a sound.',
  },
  {
    id: 'dolphin', nearR: 45, zh: '海豚', en: 'Dolphin', move: 'school', breathes: true, size: [1.9, 2.4], speed: [1.5, 5], group: [4, 7], count: 6, school: true, hunter: true,
    fit: (c) => (c.fdepth > 40 ? between(c.depth, 2, 40) * between(c.above, 8, 5000) : 0), clear: [8, 5000],
    anim: { lat: 0, vert: 0.08, k: 5, freq: 1.3 }, spec: 0.5,
    desc: '成群活动的齿鲸，尾叶上下拍打推进。它们会周期性地一同升到水面呼吸，然后重新潜回巡游深度。',
    descEn: 'A toothed whale that travels in groups, driven by up-and-down strokes of its flukes. The pod periodically rises together to breathe at the surface, then dives back to cruising depth.',
  },
  {
    id: 'tuna', nearR: 40, zh: '金枪鱼', en: 'Tuna', move: 'school', size: [1.1, 1.6], speed: [1.5, 5], group: [8, 14], count: 14, school: true, hunter: true,
    fit: (c) => (c.fdepth > 60 ? between(c.depth, 10, 120) * between(c.above, 10, 5000) : 0), clear: [10, 5000],
    anim: { lat: 0.05, k: 7, freq: 2.6, flapV: 0.02 }, spec: 0.9,
    desc: '身体几乎不动，只靠新月形尾鳍高频摆动推进的远洋快泳者。深蓝色的背部与银白色的腹部在水中形成反荫蔽。',
    descEn: 'A fast ocean swimmer that holds its body almost rigid and drives itself with rapid beats of a crescent tail. The deep-blue back and silvery belly act as countershading.',
  },
  {
    id: 'sunfish', nearR: 35, zh: '翻车鱼', en: 'Ocean sunfish', move: 'cruise', size: [1.6, 2.2], speed: [0.4, 1.2], group: [1, 1], count: 2,
    fit: (c) => (c.fdepth > 60 ? between(c.depth, 8, 120) * between(c.above, 10, 5000) : 0), clear: [10, 5000],
    anim: { lat: 0, k: 0, freq: 0.75, flapH: 0.2 }, spec: 0.2,
    desc: '世界上最重的硬骨鱼之一，身体像被截去了尾巴。靠高高的背鳍与臀鳍同步左右划动前进，常在温暖的表层晒太阳。',
    descEn: 'One of the heaviest bony fishes in the world, shaped as if its tail had been cut off. It moves by sculling its tall dorsal and anal fins from side to side, and often basks in warm surface water.',
  },
  {
    id: 'squid', nearR: 30, zh: '鱿鱼', en: 'Squid', move: 'jet', size: [0.4, 0.6], speed: [0.2, 3], group: [3, 6], count: 10, school: true, prey: true,
    fit: (c) => (c.fdepth > 50 ? between(c.depth, 25, 650) * between(c.above, 5, 5000) : 0), clear: [5, 5000],
    anim: { lat: 0, k: 0, freq: 1.4, flapV: 0.12, lag: 0.3, arm: 0.03, armSpeed: 1.5, pulse: 0.28 }, spec: 0.4,
    desc: '用鳍缓慢悬停，受惊时收缩外套膜喷水，向后急退。十条腕中两条特别长的触腕用来捕捉猎物。',
    descEn: 'Hovers on gentle fin movements; when startled it contracts its mantle and jets backwards. Two of its ten arms are extra-long tentacles used to snatch prey.',
  },
  // ——— 暮光带（200–1000 米）———
  {
    id: 'lanternfish', nearR: 30, zh: '灯笼鱼', en: 'Lanternfish', move: 'school', size: [0.1, 0.14], speed: [0.3, 1.5], group: [18, 30], count: 45, school: true, prey: true, glow: true, shoal: true,
    fit: (c) => between(c.depth, 180, 1000) * between(c.above, 3, 5000), clear: [3, 800],
    anim: { lat: 0.08, k: 6, freq: 3 }, spec: 0.6,
    desc: '腹部排列着成行的发光器，光的图案因种而异。它们每晚从数百米深处游向表层觅食，是地球上规模最大的迁徙之一。',
    descEn: 'Rows of light organs line the belly in patterns that differ by species. Every night they swim up from hundreds of metres down to feed near the surface, one of the largest migrations on Earth.',
  },
  {
    id: 'hatchetfish', nearR: 28, zh: '斧头鱼', en: 'Hatchetfish', move: 'school', size: [0.1, 0.14], speed: [0.2, 1], group: [10, 18], count: 28, school: true, prey: true, glow: true, shoal: true,
    fit: (c) => between(c.depth, 200, 900) * between(c.above, 3, 5000), clear: [3, 800],
    anim: { lat: 0.07, k: 5, freq: 2.8 }, spec: 1.0,
    desc: '身体极薄、侧面像一把斧头，镜面般的银色侧身反射四周的微光。腹部朝下的发光器抹掉自己的剪影，这种伪装叫作“反照明”。',
    descEn: 'Paper-thin and shaped like a hatchet in profile, with mirror-silver flanks that reflect the faint light around it. Downward-facing light organs erase its silhouette, a camouflage called counter-illumination.',
  },
  {
    id: 'mwshrimp', nearR: 25, zh: '中层水虾', en: 'Midwater shrimp', move: 'swarm', size: [0.09, 0.13], speed: [0.1, 0.6], group: [14, 24], count: 40, prey: true, shoal: true,
    fit: (c) => between(c.depth, 200, 1100) * between(c.above, 3, 5000), clear: [3, 800],
    anim: { lat: 0.04, k: 5, freq: 4.5, arm: 0.02, armSpeed: 5 }, spec: 0.4,
    desc: '通体鲜红。在没有红光的深处，红色等于隐形——只有带着潜水灯的人，才会看见它们真正的颜色。',
    descEn: 'Bright red all over. In the deep, where no red light reaches, red means invisible; only someone carrying a dive light ever sees their true colour.',
  },
  {
    id: 'vampire', nearR: 22, zh: '吸血鬼乌贼', en: 'Vampire squid', move: 'jet', size: [0.26, 0.34], speed: [0.05, 0.6], group: [1, 1], count: 3, glow: true,
    fit: (c) => between(c.depth, 560, 1250) * between(c.above, 3, 5000), clear: [3, 800],
    anim: { lat: 0, k: 0, freq: 0.55, flapV: 0.14, lag: 0.3, arm: 0.03, armSpeed: 0.6, pulse: 0.3 }, spec: 0.3,
    desc: '并不吸血，而是收集下沉的“海洋雪”为食。八腕之间连着黑红色的蹼，受威胁时会把整张蹼翻过来罩住自己。',
    descEn: 'It drinks no blood: it feeds on sinking \'marine snow\'. Its eight arms are joined by a black-red web, and when threatened it turns the whole web inside out over itself like a cloak.',
  },
  {
    id: 'dragonfish', nearR: 24, zh: '龙鱼', en: 'Dragonfish', move: 'hover', size: [0.3, 0.45], speed: [0.1, 1.2], group: [1, 1], count: 5, hunter: true, glow: true,
    fit: (c) => between(c.depth, 560, 1350) * between(c.above, 3, 5000), clear: [3, 800],
    anim: { lat: 0.1, k: 8, freq: 1.2 }, spec: 0.35,
    desc: '漆黑细长的伏击者，颏下垂着一根末端发光的颏须。有些种类能发出多数深海动物看不见的红光，像是只有自己能用的探照灯。',
    descEn: 'A jet-black, slender ambush predator with a glowing lure on a barbel beneath its chin. Some species make red light that most deep-sea animals cannot see, a searchlight only they can use.',
  },
  // ——— 午夜带（1000 米以下）———
  {
    id: 'anglerfish', nearR: 22, zh: '鮟鱇', en: 'Anglerfish', move: 'hover', size: [0.3, 0.5], speed: [0.03, 0.5], group: [1, 1], count: 4, hunter: true, glow: true,
    fit: (c) => between(c.depth, 950, 1460) * between(c.above, 1.5, 300), clear: [1.5, 60],
    anim: { lat: 0.05, k: 5, freq: 0.8, flapV: 0.1 }, spec: 0.3,
    desc: '头上的钓竿末端挂着一枚发光饵球，光来自共生的细菌。它几乎不动，只等猎物被光吸引到那张巨口前。',
    descEn: 'A glowing lure dangles from the \'fishing rod\' on its head, lit by symbiotic bacteria. It barely moves, waiting for prey drawn by the light to come within reach of its huge mouth.',
  },
  {
    id: 'gulper', nearR: 25, zh: '宽咽鱼', en: 'Gulper eel', move: 'hover', size: [0.8, 1.2], speed: [0.05, 0.6], group: [1, 1], count: 3, hunter: true, glow: true,
    fit: (c) => between(c.depth, 950, 1460) * between(c.above, 3, 400), clear: [3, 200],
    anim: { lat: 0.16, k: 10, freq: 0.7 }, spec: 0.3,
    desc: '身体大半是一条细鞭般的尾巴，尾尖会发出粉红色的光。松垮的口囊能张得比身体还大，一口吞下与自己差不多大的猎物。',
    descEn: 'Most of its body is a thin, whip-like tail whose tip glows pink. Its loose, pouch-like mouth can open wider than its body and swallow prey nearly as large as itself.',
  },
  {
    id: 'flapjack', zh: '烟灰蛸', en: 'Flapjack octopus', move: 'hover', nearFloor: true, size: [0.3, 0.42], speed: [0.03, 0.3], group: [1, 1], count: 5, benthos: true,
    fit: (c) => (c.fdepth > 950 ? between(c.above, 0.3, 4) : 0), clear: [0.3, 4],
    anim: { lat: 0, k: 0, freq: 0.9, flapH: 0.35, pulse: 0.08, pulseRim: true }, spec: 0.3,
    desc: '橙色的“煎饼”章鱼，腕间有蹼，头顶一对像耳朵的鳍。贴着海底缓缓漂浮，偶尔扇动耳鳍或收拢蹼膜向上一跃。',
    descEn: 'An orange \'pancake\' octopus with webbed arms and a pair of ear-like fins on top of its head. It drifts slowly just above the seafloor, now and then flapping its fins or pulling its web closed to spring upward.',
  },
  {
    id: 'isopod', zh: '大王具足虫', en: 'Giant isopod', move: 'benthic', size: [0.42, 0.6], speed: [0.05, 0.2], group: [1, 1], count: 10, benthos: true,
    fit: (c) => (c.fdepth > 900 ? 1 : 0),
    anim: { arm: 0.04, legs: true, freq: 4 }, spec: 0.4,
    desc: '潮虫的深海亲戚，体长可达数十厘米。以沉到海底的动物尸体为食，能靠体内储存的能量熬过很久不进食的日子。',
    descEn: 'A deep-sea relative of the woodlouse that can grow to tens of centimetres long. It scavenges the carcasses that sink to the seafloor and can live for long stretches on stored energy without eating.',
  },
  {
    id: 'brittlestar', zh: '蛇尾', en: 'Brittle star', move: 'benthic', size: [0.36, 0.5], speed: [0.02, 0.1], group: [1, 1], count: 40, benthos: true,
    fit: (c) => (c.fdepth > 140 ? 0.7 + 0.3 * (c.fdepth > 900 ? 1 : 0) : 0),
    anim: { arm: 0.1, armSpeed: 1.0, freq: 0.5 }, spec: 0.2,
    desc: '中央小盘上伸出五条细长灵活的腕，像蛇一样扭动着前进。深海的软泥上，它们常常成片分布。',
    descEn: 'Five long, flexible arms reach out from a small central disc and wriggle it along like snakes. On deep-sea mud they often gather in dense carpets.',
  },
  {
    id: 'seacucumber', zh: '海参', en: 'Sea cucumber', move: 'benthic', slow: true, size: [0.35, 0.5], speed: [0.01, 0.04], group: [1, 1], count: 10, benthos: true,
    fit: (c) => (c.fdepth > 950 ? 1 : 0),
    anim: { lat: 0.02, k: 4, freq: 0.4, arm: 0.02, armSpeed: 0.6 }, spec: 0.6,
    desc: '半透明的粉色身体，背上竖着几只“腿”样的突起。在深海软泥上缓慢移动，一边走一边吞食沉积物里的有机碎屑。',
    descEn: 'A translucent pink body with a few leg-like projections standing up on its back. It creeps across the deep-sea mud, swallowing sediment and digesting the organic debris in it as it goes.',
  },
  {
    id: 'seapen', zh: '海鳃', en: 'Sea pen', move: 'sessile', size: [0.4, 0.7], speed: [0, 0], group: [1, 1], count: 18, benthos: true,
    fit: (c) => (c.fdepth > 140 && c.fdepth < 1250 ? 1 : 0),
    anim: { lat: 0.05, k: 0.5, freq: 0.25 }, spec: 0.2,
    desc: '看似一支羽毛笔，其实是一整个珊瑚虫群体。插在陆坡的软泥里，羽枝迎着水流展开，过滤漂过的食物颗粒。',
    descEn: 'It looks like a quill pen but is really an entire colony of polyps. Anchored in the mud of the continental slope, it spreads its feathery branches into the current to filter passing food particles.',
  },
  {
    id: 'ventshrimp', zh: '热泉虾', en: 'Vent shrimp', move: 'swarm', vent: true, size: [0.05, 0.08], speed: [0.05, 0.4], group: [18, 32], count: 70, benthos: true, shoal: true,
    fit: (c) => (c.fdepth > 1100 ? c.hab.vent * between(c.above, 0.1, 6) : 0), clear: [0.1, 6],
    anim: { lat: 0.04, k: 5, freq: 5, arm: 0.02, armSpeed: 6 }, spec: 0.5,
    desc: '成群挤在热液喷口附近，靠与化能细菌的共生获得能量。这里的食物链不依赖阳光，而依赖从地底涌出的化学物质。',
    descEn: 'Crowds of them cluster around hydrothermal vents, getting their energy through partnerships with chemosynthetic bacteria. The food web here runs not on sunlight but on chemicals welling up from the Earth.',
  },
  // ——— 漂流者 ———
  {
    id: 'jelly', nearR: 35, zh: '水母', en: 'Jellyfish', move: 'drift', size: [0.25, 0.45], speed: [0.05, 0.25], group: [1, 1], count: 5, jelly: true, glow: true, translucent: true,
    fit: (c) => between(c.depth, 4, 1400) * between(c.above, 2, 5000) * 0.8, clear: [2, 5000],
    anim: { lat: 0, k: 0, freq: 0.8, arm: 0.05, armSpeed: 0.8, pulse: 0.22 }, spec: 0.2,
    desc: '伞体一张一合地推动自己，更多时候只是随水漂流。在深处，许多水母受到碰触时会沿伞缘亮起一圈冷光。',
    descEn: 'It pulses its bell to push itself along, but mostly it just drifts with the water. In the deep, many jellyfish light up a ring of cold light around the bell\'s rim when touched.',
  },
  {
    id: 'siphonophore', zh: '管水母', en: 'Siphonophore', move: 'drift', chain: true, size: [5, 11], speed: [0.02, 0.12], group: [1, 1], count: 2, jelly: true, glow: true, translucent: true,
    fit: (c) => between(c.depth, 150, 1400) * between(c.above, 5, 5000), clear: [5, 5000],
    anim: { lat: 0.02, k: 7, freq: 0.25, arm: 0.004, armSpeed: 0.5 }, spec: 0.2,
    desc: '一条由许多个体分工合作组成的“群体生物”：前端的泳钟负责推进，后面一串负责进食与繁殖，垂下的触手像一张拖网。',
    descEn: 'A \'colonial organism\' made of many specialised individuals: swimming bells at the front do the propulsion, the chain behind feeds and reproduces, and the trailing tentacles hang down like a fishing net.',
  },
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
