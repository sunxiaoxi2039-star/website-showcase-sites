import * as THREE from 'three';
import { proj, groundY, heightM, VB } from './geo.js';

// ---------------------------------------------------------------------------
// 地标资料（中文名 / 韩文 / 英文、坐标、说明、巡游镜头）
// view: [距离 km, 俯角(与天顶夹角) °, 方位角 °（相机所在方位，0=北，180=南）]
// ---------------------------------------------------------------------------
export const LANDMARKS = [
  { id: 'bukhansan', zh: '北汉山 · 白云台', ko: '북한산 백운대', en: 'Bukhansan', lon: 126.9780, lat: 37.6586, cat: '山岳',
    desc: '首尔北侧的花岗岩群峰，最高峰白云台海拔 836 米。裸露的白色岩壁与仁寿峰构成城市北方的天然屏障。',
    facts: [['海拔', '836 m'], ['类型', '国立公园'], ['位置', '江北·恩平·道峰']], view: [5.2, 58, 200] },
  { id: 'gyeongbokgung', zh: '景福宫', ko: '경복궁', en: 'Gyeongbokgung', lon: 126.9770, lat: 37.5793, cat: '宫阙',
    desc: '朝鲜王朝的正宫，1395 年建成。光化门、兴礼门、勤政殿、思政殿沿南北中轴一字排开，西侧庆会楼临池而立，背后是北岳山。',
    facts: [['建成', '1395 年'], ['占地', '约 43 万 ㎡'], ['位置', '钟路区']], view: [1.25, 56, 196] },
  { id: 'changdeokgung', zh: '昌德宫', ko: '창덕궁', en: 'Changdeokgung', lon: 126.9910, lat: 37.5794, cat: '宫阙',
    desc: '顺应山势自由布局的朝鲜离宫，1997 年列入世界文化遗产；北侧的后苑（秘苑）是韩国传统园林的典范。',
    facts: [['建成', '1405 年'], ['遗产', 'UNESCO 1997'], ['位置', '钟路区']], view: [1.5, 55, 170] },
  { id: 'gwanghwamun', zh: '光化门广场', ko: '광화문광장', en: 'Gwanghwamun Square', lon: 126.9769, lat: 37.5722, cat: '广场',
    desc: '首尔的“国家客厅”。世宗大王坐像与李舜臣将军像沿世宗大路排开，北端正对光化门和北岳山。',
    facts: [['长度', '约 550 m'], ['开放', '2009 年'], ['位置', '钟路区']], view: [0.95, 60, 168] },
  { id: 'cheonggyecheon', zh: '清溪川', ko: '청계천', en: 'Cheonggyecheon', lon: 126.9784, lat: 37.5693, cat: '水系',
    desc: '2005 年拆除高架路后复原的城市溪流，从清溪广场向东流淌近 11 公里，汇入中浪川后注入汉江。',
    facts: [['长度', '10.9 km'], ['复原', '2005 年'], ['位置', '钟路区·中区']], view: [2.1, 58, 215] },
  { id: 'sungnyemun', zh: '崇礼门（南大门）', ko: '숭례문', en: 'Sungnyemun', lon: 126.9754, lat: 37.5600, cat: '城门',
    desc: '汉阳都城的正南门，1398 年建成，韩国国宝第 1 号。2008 年焚毁，2013 年按原样修复。',
    facts: [['建成', '1398 年'], ['国宝', '第 1 号'], ['位置', '中区']], view: [0.7, 60, 160] },
  { id: 'seoulstation', zh: '首尔站', ko: '서울역', en: 'Seoul Station', lon: 126.9716, lat: 37.5558, cat: '交通',
    desc: '1925 年的红砖圆顶老站舍与现代玻璃站房并立，是京釜线与 KTX 高铁的起点。',
    facts: [['老站舍', '1925 年'], ['线路', 'KTX · 1/4 号线'], ['位置', '中区·龙山区']], view: [0.85, 58, 230] },
  { id: 'namsan', zh: 'N 首尔塔', ko: 'N서울타워', en: 'N Seoul Tower', lon: 126.98815, lat: 37.55118, cat: '地标',
    desc: '矗立在南山山顶的电视塔，塔身 236.7 米，塔顶海拔约 480 米。夜里塔身会随空气质量换上不同颜色。',
    facts: [['塔高', '236.7 m'], ['建成', '1975 年'], ['南山', '262 m']], view: [2.2, 64, 205] },
  { id: 'heunginjimun', zh: '兴仁之门（东大门）', ko: '흥인지문', en: 'Heunginjimun', lon: 127.0095, lat: 37.5711, cat: '城门',
    desc: '汉阳都城的东门，也是唯一带半圆形瓮城的城门，旁边就是东大门市场商圈。',
    facts: [['建成', '1398 年'], ['重建', '1869 年'], ['位置', '钟路区']], view: [0.75, 58, 140] },
  { id: 'ddp', zh: '东大门设计广场 DDP', ko: '동대문디자인플라자', en: 'DDP', lon: 127.0092, lat: 37.5665, cat: '建筑',
    desc: '扎哈·哈迪德设计的流线形建筑，4.5 万块铝板拼成无缝曲面；入夜后外墙灯点亮，像一条银色的光河。',
    facts: [['开放', '2014 年'], ['设计', 'Zaha Hadid'], ['位置', '中区']], view: [1.05, 57, 205] },
  { id: 'seoulforest', zh: '首尔林', ko: '서울숲', en: 'Seoul Forest', lon: 127.0374, lat: 37.5444, cat: '公园',
    desc: '由赛马场和高尔夫球场改造的城市森林，位于汉江与中浪川交汇处，秋天银杏一片金黄。',
    facts: [['面积', '约 116 万 ㎡'], ['开放', '2005 年'], ['位置', '城东区']], view: [2.0, 56, 190] },
  { id: 'lotte', zh: '乐天世界塔', ko: '롯데월드타워', en: 'Lotte World Tower', lon: 127.1025, lat: 37.5126, cat: '地标',
    desc: '高 555 米、123 层，韩国最高建筑。锥形塔身取意韩国传统瓷器与毛笔，顶部是开放的钢结构冠顶。',
    facts: [['高度', '555 m'], ['楼层', '123 层'], ['建成', '2017 年']], view: [3.4, 72, 225] },
  { id: 'lotteworld', zh: '乐天世界 · 魔幻岛', ko: '롯데월드 매직아일랜드', en: 'Magic Island', lon: 127.1001, lat: 37.5089, cat: '乐园',
    desc: '石村湖西湖中的童话城堡，与乐天世界塔隔路相望，是首尔最有名的室外游乐岛。',
    facts: [['开园', '1989 年'], ['湖泊', '石村湖'], ['位置', '松坡区']], view: [0.9, 55, 200] },
  { id: 'olympicpark', zh: '奥林匹克公园 · 和平之门', ko: '세계평화의문', en: 'World Peace Gate', lon: 127.1215, lat: 37.5205, cat: '公园',
    desc: '为 1988 年汉城奥运会而建，展翼般的巨大屋檐下绘着四神图，门前燃着“和平之火”。',
    facts: [['建成', '1988 年'], ['设计', '金重业'], ['位置', '松坡区']], view: [1.2, 57, 215] },
  { id: 'jamsil', zh: '蚕室奥林匹克主体育场', ko: '잠실올림픽주경기장', en: 'Jamsil Olympic Stadium', lon: 127.0728, lat: 37.5159, cat: '体育',
    desc: '1988 年奥运会主场馆，屋顶曲线取自朝鲜白瓷壶的轮廓；旁边就是蚕室棒球场。',
    facts: [['建成', '1984 年'], ['容量', '约 6.9 万人'], ['位置', '松坡区']], view: [1.4, 55, 200] },
  { id: 'coex', zh: '三成 · COEX', ko: '코엑스', en: 'COEX', lon: 127.0589, lat: 37.5119, cat: '商圈',
    desc: '会展中心、星空图书馆与贸易塔所在的江南商务核心，德黑兰路“德黑兰谷”的东端。',
    facts: [['贸易塔', '228 m'], ['开业', '1988 年'], ['位置', '江南区']], view: [1.5, 60, 235] },
  { id: 'gangnam', zh: '江南站', ko: '강남역', en: 'Gangnam Station', lon: 127.0276, lat: 37.4979, cat: '商圈',
    desc: '首尔最繁忙的换乘站与商圈之一，江南大路与德黑兰路在这里交汇，写字楼群彻夜通明。',
    facts: [['日客流', '约 20 万人次'], ['线路', '2 号线 · 新盆唐线'], ['位置', '江南·瑞草']], view: [1.6, 60, 210] },
  { id: 'banpo', zh: '盘浦大桥 · 月光彩虹喷泉', ko: '반포대교 달빛무지개분수', en: 'Banpo Bridge Fountain', lon: 126.9960, lat: 37.5138, cat: '桥梁',
    desc: '吉尼斯纪录中世界最长的桥梁喷泉（1,140 米），夜里彩色水帘从桥面两侧倾泻入汉江，下层是潜水桥。',
    facts: [['喷泉长', '1,140 m'], ['喷嘴', '约 380 个'], ['位置', '瑞草·龙山']], view: [1.9, 66, 250] },
  { id: 'yongsan', zh: '龙山', ko: '용산', en: 'Yongsan', lon: 126.9651, lat: 37.5301, cat: '城区',
    desc: '首尔的地理中心，龙山站、国立中央博物馆与龙山公园所在，南面就是汉江。',
    facts: [['车站', '龙山站'], ['博物馆', '国立中央博物馆'], ['位置', '龙山区']], view: [2.2, 60, 200] },
  { id: 'yeouido', zh: '汝矣岛 · 63 大厦', ko: '여의도 63빌딩', en: '63 Building', lon: 126.9403, lat: 37.5198, cat: '地标',
    desc: '汉江中的金融岛。金色的 63 大厦高 249 米，1985 年落成时是亚洲最高建筑；岛上还有国会议事堂与 IFC。',
    facts: [['高度', '249 m'], ['建成', '1985 年'], ['位置', '永登浦区']], view: [2.4, 62, 150] },
  { id: 'worldcup', zh: '首尔世界杯体育场', ko: '서울월드컵경기장', en: 'Seoul World Cup Stadium', lon: 126.8972, lat: 37.5683, cat: '体育',
    desc: '2002 年韩日世界杯开幕式球场，屋顶造型取自韩国传统方形风筝与八角盘，旁边是由垃圾山改造的天空公园。',
    facts: [['建成', '2001 年'], ['容量', '约 6.6 万人'], ['位置', '麻浦区']], view: [1.5, 56, 170] },
  { id: 'gimpo', zh: '金浦国际机场', ko: '김포국제공항', en: 'Gimpo Airport', lon: 126.7945, lat: 37.5586, cat: '交通',
    desc: '首尔的城市机场，两条平行跑道沿西北—东南方向铺开，国内线与东亚短程国际线昼夜起降。',
    facts: [['跑道', '2 条 · 3.2/3.6 km'], ['启用', '1939 年'], ['位置', '江西区']], view: [4.2, 58, 225] },
];

export const PEAKS = [
  ['北汉山', 126.9780, 37.6586, 836], ['道峰山', 127.0155, 37.6988, 740], ['水落山', 127.0813, 37.6993, 638],
  ['佛岩山', 127.0952, 37.6636, 508], ['仁王山', 126.9579, 37.5850, 338], ['北岳山', 126.9737, 37.5930, 342],
  ['南山', 126.9880, 37.5522, 262], ['冠岳山', 126.9642, 37.4451, 632], ['清溪山', 127.0432, 37.4219, 618],
  ['牛眠山', 127.0091, 37.4705, 293], ['大母山', 127.0790, 37.4748, 293], ['峨嵯山', 127.1027, 37.5668, 296],
];

export const BRIDGES = [
  ['汉江大桥', 126.9588, 37.5176], ['麻浦大桥', 126.9380, 37.5330], ['元晓大桥', 126.9485, 37.5245],
  ['铜雀大桥', 126.9818, 37.5140], ['盘浦大桥', 126.9965, 37.5143], ['汉南大桥', 127.0133, 37.5270],
  ['东湖大桥', 127.0212, 37.5335], ['圣水大桥', 127.0352, 37.5370], ['清潭大桥', 127.0645, 37.5250],
  ['蚕室大桥', 127.0935, 37.5230], ['奥林匹克大桥', 127.1035, 37.5330], ['杨花大桥', 126.9025, 37.5405],
  ['城山大桥', 126.8925, 37.5480], ['加阳大桥', 126.8605, 37.5720], ['千户大桥', 127.1225, 37.5395],
];

export const DISTRICT_ZH = {
  '종로구': '钟路区', '중구': '中区', '용산구': '龙山区', '성동구': '城东区', '광진구': '广津区', '동대문구': '东大门区',
  '중랑구': '中浪区', '성북구': '城北区', '강북구': '江北区', '도봉구': '道峰区', '노원구': '芦原区', '은평구': '恩平区',
  '서대문구': '西大门区', '마포구': '麻浦区', '양천구': '阳川区', '강서구': '江西区', '구로구': '九老区', '금천구': '衿川区',
  '영등포구': '永登浦区', '동작구': '铜雀区', '관악구': '冠岳区', '서초구': '瑞草区', '강남구': '江南区', '송파구': '松坡区', '강동구': '江东区',
};

// ---------------------------------------------------------------------------
// 材质与夜间灯光注册
// ---------------------------------------------------------------------------
export const nightLit = []; // {mat, k} → emissiveIntensity = night * k
const cache = new Map();
function M(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.8, metalness: o.m ?? 0, flatShading: !!o.flat, side: o.ds ? THREE.DoubleSide : THREE.FrontSide });
  if (o.glow) { m.emissive = new THREE.Color(o.glow); nightLit.push({ mat: m, k: o.gk ?? 0.6 }); }
  if (o.map) m.map = o.map;
  cache.set(key, m); return m;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; return m;
}

// 窗格纹理（map + emissiveMap），用于塔楼
function facadeTexture(opt) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = opt.base; g.fillRect(0, 0, 128, 256);
  const e = document.createElement('canvas'); e.width = 128; e.height = 256;
  const ge = e.getContext('2d'); ge.fillStyle = '#000'; ge.fillRect(0, 0, 128, 256);
  const rows = opt.rows || 32, cols = opt.cols || 8;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = i * 128 / cols, y = j * 256 / rows, w = 128 / cols, h = 256 / rows;
    g.fillStyle = opt.win; g.fillRect(x + 1, y + h * 0.2, w - 2, h * 0.62);
    if (Math.random() < (opt.lit ?? 0.55)) { ge.fillStyle = Math.random() < 0.7 ? opt.litc || '#ffd9a0' : '#e8f0ff'; ge.fillRect(x + 1, y + h * 0.2, w - 2, h * 0.62); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const te = new THREE.CanvasTexture(e); te.colorSpace = THREE.SRGBColorSpace; te.wrapS = te.wrapT = THREE.RepeatWrapping;
  return [t, te];
}
function towerMat(opt, k = 1.2) {
  const [t, te] = facadeTexture(opt);
  const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: te, emissive: 0xffffff, emissiveIntensity: 0, roughness: opt.r ?? 0.35, metalness: opt.m ?? 0.2 });
  nightLit.push({ mat: m, k });
  return m;
}

// 韩式歇山/庑殿屋顶：四角起翘、屋檐下垂
function hipRoof(w, d, h, mat, lift = 0.22) {
  const L = h * lift;
  const r = Math.max(0, (w - d) / 2) * 0.9 + w * 0.04;
  const A = [-w / 2, L, -d / 2], B = [w / 2, L, -d / 2], C = [w / 2, L, d / 2], D = [-w / 2, L, d / 2];
  const Mf = [0, 0, -d / 2], Mb = [0, 0, d / 2], Ml = [-w / 2, L * 0.3, 0], Mr = [w / 2, L * 0.3, 0];
  const R1 = [-r, h, 0], R2 = [r, h, 0];
  const tris = [A, Mf, R1, Mf, R2, R1, Mf, B, R2, C, Mb, R2, Mb, R1, R2, Mb, D, R1, D, Ml, R1, Ml, A, R1, B, Mr, R2, Mr, C, R2];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(m);
  const ridge = box(2 * r + 2, h * 0.08, Math.max(1.2, d * 0.05), M('#2b2e33'), 0, h - h * 0.02, 0);
  grp.add(ridge);
  return grp;
}

const RED = () => M('#9c3a2f', { glow: '#ffb070', gk: 0.25 });
const GREEN_BAND = () => M('#2f7a68');
const ROOF = () => M('#3d4249', { ds: true, r: 0.7 });
const STONE = () => M('#c9c2b4', { glow: '#ffcf96', gk: 0.18 });

// 殿阁：台基 + 红柱墙身 + 丹青带 + 屋顶（可重檐）
function hall(w, d, h, opts = {}) {
  const g = new THREE.Group();
  const plat = opts.plat ?? 1.2;
  if (plat > 0) g.add(box(w * 1.12, plat, d * 1.2, STONE()));
  let y = plat;
  g.add(box(w * 0.86, h, d * 0.74, RED(), 0, y));
  g.add(box(w * 0.9, h * 0.14, d * 0.78, GREEN_BAND(), 0, y + h * 0.86));
  y += h;
  const rh = opts.rh ?? Math.min(w, d) * 0.42;
  const roof1 = hipRoof(w * 1.18, d * 1.35, rh, ROOF()); roof1.position.y = y - rh * 0.05; g.add(roof1);
  if (opts.double) {
    const y2 = y + rh * 0.35;
    g.add(box(w * 0.62, h * 0.55, d * 0.5, RED(), 0, y2));
    g.add(box(w * 0.66, h * 0.1, d * 0.54, GREEN_BAND(), 0, y2 + h * 0.46));
    const roof2 = hipRoof(w * 0.95, d * 1.05, rh * 0.95, ROOF()); roof2.position.y = y2 + h * 0.55 - rh * 0.05; g.add(roof2);
  }
  return g;
}

// 城门：石台 + 拱门 + 重檐门楼
function gate(opts = {}) {
  const g = new THREE.Group();
  const bw = opts.bw ?? 30, bd = opts.bd ?? 14, bh = opts.bh ?? 9;
  g.add(box(bw, bh, bd, STONE()));
  const archs = opts.arches ?? 1;
  const dark = M('#1c1d20');
  for (let i = 0; i < archs; i++) {
    const x = (i - (archs - 1) / 2) * bw * 0.26;
    g.add(box(bw * 0.12, bh * 0.62, bd + 0.6, dark, x, 0));
  }
  const top = hall(bw * 0.72, bd * 0.78, opts.ph ?? 5, { plat: 0, double: opts.double ?? true, rh: opts.rh ?? 6 });
  top.position.y = bh; g.add(top);
  return g;
}

// 超椭圆截面锥形塔身（乐天世界塔）
function taperTower(h, r0, r1, pow, mat, seg = 48, rings = 40) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, y = t * h;
    const r = r0 + (r1 - r0) * Math.pow(t, pow);
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2 + Math.PI / 4;
      const c = Math.cos(a), s = Math.sin(a);
      const n = 3.2;
      const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * r, z = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * r;
      pos.push(x, y, z); uv.push(i / seg * 6, t * 10);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + seg + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}

function lathe(points, mat, seg = 64) {
  const g = new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), seg);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}

// 航空障碍灯
export const beacons = [];
function beacon(g, x, y, z) { beacons.push({ g, p: new THREE.Vector3(x, y, z) }); }

// ---------------------------------------------------------------------------
// 各地标模型（单位：米；x 东，z 南，y 为真实高度，放置时再乘以夸张系数）
// ---------------------------------------------------------------------------
const B = {};

B.namsan = () => {
  const g = new THREE.Group();
  const white = M('#e9e7e1', { r: 0.5 });
  const shaft = new THREE.MeshStandardMaterial({ color: '#efeeea', roughness: 0.45, emissive: '#6a7dff', emissiveIntensity: 0 });
  shaft.userData.tower = true; nightLit.push({ mat: shaft, k: 1.5, tower: true });
  g.add(cyl(13, 15, 18, M('#cfcac0')));
  const s = cyl(4.6, 7.2, 150, shaft, 0, 18); g.add(s);
  g.add(cyl(12, 7, 10, white, 0, 160));
  g.add(cyl(15.5, 12, 6, white, 0, 170));
  g.add(cyl(15.5, 15.5, 11, towerMat({ base: '#51606d', win: '#2a333b', rows: 4, cols: 16, litc: '#ffe2b0', lit: 0.8 }, 1.4), 0, 176));
  g.add(cyl(11, 15.5, 6, white, 0, 187));
  g.add(cyl(7, 9, 5, white, 0, 193));
  const red = M('#d2412f'), wh = M('#f3f1ec');
  for (let i = 0; i < 6; i++) g.add(cyl(2.6 - i * 0.28, 2.9 - i * 0.28, 7, i % 2 ? wh : red, 0, 198 + i * 7));
  g.add(cyl(0.5, 0.9, 12, wh, 0, 240));
  beacon(g, 0, 252, 0);
  return g;
};

B.lotte = () => {
  const g = new THREE.Group();
  const mat = towerMat({ base: '#d4e0e8', win: '#8aa0b0', rows: 64, cols: 6, litc: '#fff1d6', lit: 0.45, r: 0.25, m: 0.2 }, 0.5);
  g.add(taperTower(500, 42, 17, 1.35, mat));
  // 开放式冠顶：四片渐收的钢构鳍
  const steel = M('#e2e6ea', { r: 0.3, m: 0.3, glow: '#dfe9ff', gk: 0.9 });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 62, 12), steel);
    fin.position.set(Math.cos(a) * 13, 530, Math.sin(a) * 13);
    fin.rotation.y = -a; fin.rotation.z = 0; fin.lookAt(0, 530, 0); fin.rotateX(0.13);
    fin.castShadow = true; g.add(fin);
  }
  for (let j = 0; j < 4; j++) g.add(cyl(15 - j * 2.4, 15.5 - j * 2.4, 1.4, steel, 0, 505 + j * 13, 0, 16));
  g.add(cyl(0.6, 1.2, 12, steel, 0, 555));
  beacon(g, 0, 568, 0);
  // 裙楼
  g.add(box(150, 40, 70, towerMat({ base: '#d9dde0', win: '#9aa7b0', rows: 6, cols: 20, lit: 0.8 }, 1.0), 0, 0, 70));
  return g;
};

B.yeouido = () => {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  const P = [[-30, 0], [30, 0], [30, 34], [24, 36], [22, 205], [15, 249], [-15, 249], [-22, 205], [-24, 36], [-30, 34]];
  shape.moveTo(...P[0]); P.slice(1).forEach(p => shape.lineTo(...p));
  const geom = new THREE.ExtrudeGeometry(shape, { depth: 30, bevelEnabled: false });
  geom.translate(0, 0, -15);
  const uvs = geom.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) / 16, uvs.getY(i) / 40);
  const gold = towerMat({ base: '#e8bd62', win: '#b98a36', rows: 32, cols: 8, litc: '#ffe6b0', lit: 0.5, r: 0.3, m: 0.15 }, 0.6);
  const m = new THREE.Mesh(geom, gold); m.castShadow = m.receiveShadow = true; g.add(m);
  g.add(box(90, 16, 60, M('#b9a57c', { glow: '#ffd79a', gk: 0.4 }), 10, 0, 40));
  beacon(g, 0, 252, 0);
  g.rotation.y = -0.6;
  return g;
};

B.ddp = () => {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  const pts = [[-140, -40], [-120, -85], [-60, -100], [10, -88], [70, -95], [130, -60], [150, 5], [120, 60], [60, 85], [0, 70], [-60, 92], [-120, 60], [-150, 10]]
    .map(p => new THREE.Vector2(p[0], p[1]));
  s.setFromPoints(new THREE.SplineCurve([...pts, pts[0]]).getPoints(80));
  const hole = new THREE.Path(); hole.setFromPoints(new THREE.SplineCurve([[-20, -30], [30, -35], [45, 5], [0, 25], [-35, 5], [-20, -30]].map(p => new THREE.Vector2(p[0], p[1]))).getPoints(30));
  s.holes.push(hole);
  const geom = new THREE.ExtrudeGeometry(s, { depth: 14, bevelEnabled: true, bevelThickness: 12, bevelSize: 16, bevelSegments: 5, curveSegments: 40 });
  geom.rotateX(-Math.PI / 2); geom.translate(0, 12, 0);
  // LED 点阵
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { x.fillStyle = `hsl(${195 + Math.random() * 30},70%,${65 + Math.random() * 25}%)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 60, 1 / 60); t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ color: '#d6dadf', metalness: 0.25, roughness: 0.35, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0 });
  nightLit.push({ mat, k: 1.6 });
  const m = new THREE.Mesh(geom, mat); m.castShadow = m.receiveShadow = true; g.add(m);
  // 屋顶绿地
  const lawn = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(new THREE.SplineCurve([[-60, 60], [0, 45], [50, 60], [0, 78]].map(p => new THREE.Vector2(p[0], p[1]))).getPoints(20))), M('#8fb56a'));
  lawn.rotation.x = -Math.PI / 2; lawn.position.y = 38.5; g.add(lawn);
  g.rotation.y = 0.12;
  return g;
};

B.sungnyemun = () => gate({ bw: 30, bd: 14, bh: 9, ph: 5, rh: 6 });
B.heunginjimun = () => {
  const g = gate({ bw: 28, bd: 13, bh: 8.5, ph: 5, rh: 6 });
  const wall = new THREE.Mesh(new THREE.TorusGeometry(26, 3.2, 6, 24, Math.PI), STONE());
  wall.rotation.x = Math.PI / 2; wall.scale.set(1, 1, 2.2); wall.position.set(0, 3, 0); wall.rotation.z = 0;
  wall.castShadow = true; g.add(wall);
  g.rotation.y = Math.PI / 2 + 0.1; // 东门朝东
  return g;
};

B.seoulstation = () => {
  const g = new THREE.Group();
  const brick = M('#9d4f37', { glow: '#ffc58a', gk: 0.45 });
  g.add(box(72, 14, 28, brick));
  g.add(box(70, 3, 26, M('#5d6f66'), 0, 14));
  g.add(box(74, 1.2, 30, M('#e6e0d2'), 0, 13.2));
  g.add(box(26, 20, 30, brick));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M('#6f8f82', { r: 0.5, m: 0.3 }));
  dome.position.y = 20; dome.scale.y = 1.2; dome.castShadow = true; g.add(dome);
  g.add(cyl(0.6, 0.6, 6, M('#6f8f82'), 0, 32));
  for (const sx of [-32, 32]) { const d2 = dome.clone(); d2.scale.set(0.35, 0.45, 0.35); d2.position.set(sx, 14.5, -8); g.add(d2); }
  // 新站房（玻璃）
  g.add(box(160, 22, 70, towerMat({ base: '#9fb6c3', win: '#6d8797', rows: 6, cols: 24, lit: 0.85, litc: '#e8f2ff' }, 0.9), 70, 0, 80));
  g.rotation.y = 0.05;
  return g;
};

B.jamsil = () => {
  const g = new THREE.Group();
  const shell = lathe([[108, 0], [112, 6], [118, 14], [124, 22], [126, 28], [120, 31], [104, 33], [90, 32], [84, 30], [70, 10], [64, 2], [60, 0.6]],
    M('#ecebe6', { ds: true, r: 0.6, glow: '#fff1d0', gk: 0.35 }));
  g.add(shell);
  const field = new THREE.Mesh(new THREE.CircleGeometry(60, 48), M('#5f9a4c'));
  field.rotation.x = -Math.PI / 2; field.position.y = 0.8; g.add(field);
  const track = new THREE.Mesh(new THREE.RingGeometry(46, 60, 48), M('#b5553f'));
  track.rotation.x = -Math.PI / 2; track.position.y = 0.9; g.add(track);
  const pitch = new THREE.Mesh(new THREE.CircleGeometry(44, 48), M('#6aab55'));
  pitch.rotation.x = -Math.PI / 2; pitch.position.y = 1.0; g.add(pitch);
  g.scale.set(1.12, 1, 0.94);
  return g;
};

B.worldcup = () => {
  const g = new THREE.Group();
  const bowl = lathe([[112, 0], [112, 22], [104, 26], [80, 24], [66, 6], [62, 1]], M('#dcdad3', { ds: true, glow: '#fff4d8', gk: 0.3 }), 4 * 12);
  g.add(bowl);
  const roof = lathe([[124, 44], [108, 40], [86, 34]], new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.85, emissive: '#fff4e0', emissiveIntensity: 0 }), 48);
  nightLit.push({ mat: roof.material, k: 0.5 }); g.add(roof);
  const mast = M('#e8e6e0', { r: 0.4, m: 0.3 });
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 66, 6), mast);
    m.position.set(Math.cos(a) * 128, 33, Math.sin(a) * 128); m.rotation.z = -Math.cos(a) * 0.18; m.rotation.x = Math.sin(a) * 0.18;
    m.castShadow = true; g.add(m);
  }
  const f = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), M('#5ea24c')); f.rotation.x = -Math.PI / 2; f.position.y = 0.8; g.add(f);
  g.scale.set(1.05, 1, 0.92);
  return g;
};

B.olympicpark = () => {
  const g = new THREE.Group();
  g.add(box(90, 2, 50, STONE()));
  const pil = M('#d8d2c6');
  for (const x of [-26, -9, 9, 26]) g.add(box(4, 22, 4, pil, x, 2, 0));
  const wg = new THREE.BoxGeometry(92, 3.5, 40, 24, 1, 4);
  const p = wg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / 46; p.setY(i, p.getY(i) + Math.pow(Math.abs(x), 3) * 9); }
  wg.computeVertexNormals();
  const wing = new THREE.Mesh(wg, M('#e9e3d5', { glow: '#ffe2b8', gk: 0.4 })); wing.position.y = 26; wing.castShadow = true; g.add(wing);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(80, 34), M('#3d6f8f')); under.rotation.x = Math.PI / 2; under.position.y = 24.1; g.add(under);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7, 8), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
  flame.position.set(0, 7, -40); g.add(flame); g.add(cyl(3, 4, 4, STONE(), 0, 0, -40));
  return g;
};

B.lotteworld = () => {
  const g = new THREE.Group();
  const wh = M('#f2efe8', { glow: '#ffe7c4', gk: 0.6 }), bl = M('#3f6fb8', { r: 0.4, glow: '#6f9cff', gk: 0.5 });
  const tower = (r, h, x, z) => { g.add(cyl(r, r, h, wh, x, 0, z, 16)); const c = new THREE.Mesh(new THREE.ConeGeometry(r * 1.35, h * 0.55, 16), bl); c.position.set(x, h + h * 0.27, z); c.castShadow = true; g.add(c); };
  g.add(box(46, 12, 36, wh));
  tower(9, 34, 0, 0); tower(5, 22, -18, -12); tower(5, 24, 18, -12); tower(4.5, 20, -18, 14); tower(4.5, 18, 18, 14); tower(3.5, 28, 8, 8);
  return g;
};

// 景福宫：以勤政殿为中心的宫城
B.gyeongbokgung = () => {
  const g = new THREE.Group();
  const [cx, cz] = proj(126.9770, 37.5793);
  const L = (lon, lat) => { const [x, z] = proj(lon, lat); return [(x - cx) * 1000, (z - cz) * 1000]; };
  const wallM = M('#d8cdb8', { glow: '#ffc98a', gk: 0.2 }), cap = M('#3d4249');
  const [wx0, wz0] = L(126.9738, 37.5842), [wx1, wz1] = L(126.9800, 37.5757);
  const addWall = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), w = new THREE.Group();
    w.add(box(len, 5, 2.4, wallM)); w.add(box(len + 1, 1, 3.4, cap, 0, 5));
    w.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); w.rotation.y = -Math.atan2(z1 - z0, x1 - x0); g.add(w);
  };
  addWall(wx0, wz0, wx1, wz0); addWall(wx1, wz0, wx1, wz1); addWall(wx0, wz1, -32, wz1); addWall(32, wz1, wx1, wz1); addWall(wx0, wz0, wx0, wz1);
  // 光化门
  const gw = gate({ bw: 64, bd: 22, bh: 10, arches: 3, ph: 6, rh: 8 }); { const [x, z] = L(126.9769, 37.5759); gw.position.set(x, 0, z); } g.add(gw);
  // 兴礼门
  const hr = hall(46, 14, 7, { rh: 7 }); { const [x, z] = L(126.9770, 37.5771); hr.position.set(x, 0, z); } g.add(hr);
  // 勤政殿 + 回廊 + 月台
  const [qx, qz] = L(126.9770, 37.5786);
  const court = new THREE.Group(); court.position.set(qx, 0, qz);
  court.add(box(56, 2.6, 44, STONE(), 0, 0, -6));
  const gj = hall(34, 22, 9, { double: true, rh: 9, plat: 1.2 }); gj.position.set(0, 2.6, -8); court.add(gj);
  const corr = (w, d, x, z) => { const c = hall(w, d, 4, { plat: 0.5, rh: 4 }); c.position.set(x, 0, z); court.add(c); };
  corr(130, 9, 0, -58); corr(130, 9, 0, 58); corr(9, 108, -62, 0); corr(9, 108, 62, 0);
  const cg = hall(26, 10, 5, { rh: 5 }); cg.position.set(0, 0, 58); court.add(cg);
  g.add(court);
  // 思政殿、康宁殿、交泰殿
  [[126.9770, 37.5801, 30, 16], [126.9770, 37.5812, 36, 16], [126.9770, 37.5820, 30, 15]].forEach(([lo, la, w, d]) => { const h = hall(w, d, 6, { rh: 6 }); const [x, z] = L(lo, la); h.position.set(x, 0, z); g.add(h); });
  // 庆会楼 + 池
  const [px, pz] = L(126.97585, 37.5797);
  const pond = new THREE.Mesh(new THREE.PlaneGeometry(112, 118), new THREE.MeshStandardMaterial({ color: '#3f6f84', roughness: 0.12, metalness: 0.2 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(px, 0.4, pz); g.add(pond);
  const gh = hall(36, 28, 9, { plat: 3, rh: 9 }); gh.position.set(px + 10, 0, pz); g.add(gh);
  // 香远亭
  const [hx, hz] = L(126.9771, 37.5826);
  const hp = new THREE.Mesh(new THREE.CircleGeometry(30, 32), pond.material); hp.rotation.x = -Math.PI / 2; hp.position.set(hx, 0.4, hz); g.add(hp);
  const hj = new THREE.Group(); hj.add(cyl(5, 5, 5, RED(), 0, 1, 0, 6)); const hr2 = new THREE.Mesh(new THREE.ConeGeometry(9, 7, 6), ROOF()); hr2.position.y = 9.5; hj.add(hr2); hj.add(cyl(5, 5, 1, STONE(), 0, 0, 0, 6));
  hj.position.set(hx, 0, hz); g.add(hj);
  // 东西两侧小殿阁
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // 东宫（资善堂一带）、西侧殿阁、北侧兴福殿/乾清宫：按院落成组排列
  const courts = [[120, 60], [120, -40], [150, -150], [-120, 160], [-150, -60], [60, -260], [-70, -250], [140, 170], [-40, -330], [60, -350], [150, 260], [-150, 260]];
  for (const [cx2, cz2] of courts) {
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const w = 14 + rnd() * 14, d = 8 + rnd() * 4;
      const ox = (k % 2 ? 1 : -1) * (6 + rnd() * 18), oz = (k - n / 2) * 20 + rnd() * 6;
      const x = cx2 + ox, z = cz2 + oz;
      if (x < wx0 + 16 || x > wx1 - 16 || z < wz0 + 16 || z > wz1 - 30) continue;
      if (Math.hypot(x - px, z - pz) < 80) continue;
      const h = hall(w, d, 4.2, { rh: 5, plat: 0.8 }); h.position.set(x, 0, z); if (rnd() < 0.35) h.rotation.y = Math.PI / 2; g.add(h);
    }
    // 院墙
    const cw = new THREE.Group(); cw.position.set(cx2, 0, cz2);
    [[0, -48, 90, 2], [0, 48, 90, 2], [-45, 0, 2, 96], [45, 0, 2, 96]].forEach(([x, z, w, d]) => cw.add(box(w, 3, d, wallM, x, 0, z)));
    if (cx2 - 45 > wx0 && cx2 + 45 < wx1 && cz2 - 48 > wz0 && cz2 + 48 < wz1 - 20 && Math.hypot(cx2 - px, cz2 - pz) > 110) g.add(cw);
  }
  for (let i = 0; i < 0; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (95 + rnd() * 120), z = -260 + rnd() * 560;
    if (x < wx0 + 20 || x > wx1 - 20 || z < wz0 + 20 || z > wz1 - 40) continue;
    if (Math.hypot(x - px, z - pz) < 90) continue;
    const w = 14 + rnd() * 16, d = 8 + rnd() * 5;
    const h = hall(w, d, 4.5, { rh: 5, plat: 0.8 }); h.position.set(x, 0, z); if (rnd() < 0.3) h.rotation.y = Math.PI / 2; g.add(h);
  }
  // 中轴御道
  const path = new THREE.Mesh(new THREE.PlaneGeometry(10, Math.abs(wz1 - wz0) * 0.55), M('#e3d8c0', { r: 1 }));
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.2, wz1 * 0.45); path.receiveShadow = true; g.add(path);
  return g;
};

B.gwanghwamun = () => {
  const g = new THREE.Group();
  const gold = M('#c9a14a', { m: 0.6, r: 0.35, glow: '#ffcc66', gk: 0.8 }), bronze = M('#5d6b5a', { m: 0.4, r: 0.5, glow: '#9fd4b0', gk: 0.4 });
  // 世宗大王像（坐像）
  g.add(box(10, 3, 12, STONE(), 0, 0, 0));
  g.add(box(5, 5, 5, gold, 0, 3, 0)); g.add(box(3.4, 3, 3, gold, 0, 8, 0.3));
  // 李舜臣像（立像，南侧约 250 m）
  g.add(box(5, 10, 5, STONE(), 0, 0, 200)); g.add(cyl(1.3, 1.6, 7, bronze, 0, 10, 200, 8));
  // 广场绿带与水道
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(34, 520), M('#b9ad92', { r: 1 })); lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.2, 90); lawn.receiveShadow = true; g.add(lawn);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3, 480), new THREE.MeshStandardMaterial({ color: '#4d86a3', roughness: 0.1, emissive: '#88c8ff', emissiveIntensity: 0 }));
  nightLit.push({ mat: water.material, k: 0.6 });
  water.rotation.x = -Math.PI / 2; water.position.set(-14, 0.3, 90); g.add(water);
  return g;
};

// 放置参数：[建造器, 水平缩放, 垂直缩放, 额外离地]
export const PLACEMENT = {
  namsan: ['namsan', 1.8, VB, 0], lotte: ['lotte', 1.6, VB, 0], yeouido: ['yeouido', 1.6, VB, 0], ddp: ['ddp', 1.0, 2.2, 0],
  sungnyemun: ['sungnyemun', 1.6, 2.2, 0], heunginjimun: ['heunginjimun', 1.6, 2.2, 0], seoulstation: ['seoulstation', 1.3, 2.2, 0],
  jamsil: ['jamsil', 1.0, 2.2, 0], worldcup: ['worldcup', 1.0, 2.2, 0], olympicpark: ['olympicpark', 1.3, 2.2, 0],
  lotteworld: ['lotteworld', 1.5, 2.2, 0], gyeongbokgung: ['gyeongbokgung', 1.0, 2.2, 0], gwanghwamun: ['gwanghwamun', 1.0, 2.2, 0],
};
// 位置修正（模型中心与标签点不同的情况）
const POS = { gwanghwamun: [126.97690, 37.5728], seoulstation: [126.9713, 37.5560], lotteworld: [127.1001, 37.5088], jamsil: [127.0728, 37.5159] };

export function buildLandmarkModels(scene) {
  const groups = {};
  for (const L of LANDMARKS) {
    const p = PLACEMENT[L.id]; if (!p) continue;
    const [bname, hs, vs] = p;
    const inner = B[bname]();
    const [lon, lat] = POS[L.id] || [L.lon, L.lat];
    const [x, z] = proj(lon, lat);
    let y = groundY(x, z);
    if (L.id === 'namsan') { // 塔落在山顶：取周围最低点避免悬空
      for (let a = 0; a < 6; a++) y = Math.min(y, groundY(x + Math.cos(a) * 0.03, z + Math.sin(a) * 0.03));
    }
    const outer = new THREE.Group();
    outer.position.set(x, y - 0.002, z);
    outer.scale.set(hs / 1000, vs / 1000, hs / 1000);
    outer.add(inner);
    outer.userData = { id: L.id, top: y };
    scene.add(outer);
    groups[L.id] = outer;
  }
  return groups;
}

// 地标“视觉焦点高度”（km），用于相机目标
export function focusY(L, groups) {
  const [x, z] = proj(L.lon, L.lat);
  const gy = groundY(x, z);
  const extra = { lotte: 0.42, namsan: 0.22, yeouido: 0.2, bukhansan: 0.1, gimpo: 0.05 }[L.id] ?? 0.04;
  return gy + extra;
}
