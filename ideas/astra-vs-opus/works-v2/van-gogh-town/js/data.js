// Paintings, their zones in the town, their "look" profiles and the painter's viewpoints.

export const PAINTINGS = [
  {
    id: 'cafe', key: '1',
    cn: '夜间露天咖啡座', orig: 'Terrasse du café le soir', year: '1888 年 9 月',
    place: '阿尔勒 · 广场论坛', museum: '克勒勒-米勒博物馆，奥特洛',
    quote: '这是一幅没有黑色的夜景，只有美丽的蓝、紫和绿。',
    quoteSrc: '致妹妹威尔的信，1888',
    aspect: 65.5 / 81,
    swatch: ['#f2c43a', '#e58a2c', '#2b3f8f', '#6f86b8', '#1b2250'],
    center: [0, 6], inner: 14, outer: 30,
    vp: { pos: [1.9, 13.2], look: [-2.2, 3.3, -8], fov: 64 },
  },
  {
    id: 'starry', key: '2',
    cn: '星月夜', orig: 'De sterrennacht', year: '1889 年 6 月',
    place: '圣雷米 · 从疗养院窗口望出', museum: '现代艺术博物馆，纽约',
    quote: '我对任何事都没有把握，但星星的景象总让我做梦。',
    quoteSrc: '致弟弟提奥的信，1888',
    aspect: 92.1 / 73.7,
    swatch: ['#1c3f8c', '#6f93c9', '#f3de6a', '#1f3a2e', '#c9d8e8'],
    center: [-76, 78], inner: 20, outer: 52,
    vp: { pos: [-74, 82], look: [2, 26, -60], fov: 66 },
  },
  {
    id: 'rhone', key: '3',
    cn: '罗纳河上的星夜', orig: 'La Nuit étoilée', year: '1888 年 9 月',
    place: '阿尔勒 · 罗纳河岸', museum: '奥赛博物馆，巴黎',
    quote: '我常常觉得，夜晚比白天更有生命，色彩也更丰富。',
    quoteSrc: '致弟弟提奥的信，1888',
    aspect: 92 / 72.5,
    swatch: ['#1d3566', '#3f6f8f', '#f0b83c', '#9ab87a', '#e8e0b0'],
    center: [86, 12], inner: 12, outer: 32,
    vp: { pos: [80.8, 11.5], look: [140, 6.5, 14], fov: 62 },
  },
  {
    id: 'yellow', key: '4',
    cn: '黄房子（街道）', orig: 'Het gele huis (De straat)', year: '1888 年 9 月',
    place: '阿尔勒 · 拉马丁广场 2 号', museum: '梵高博物馆，阿姆斯特丹',
    quote: '硫黄色的阳光下，纯钴蓝的天空下——这是个难画的题材！正因如此我想征服它。',
    quoteSrc: '致弟弟提奥的信，1888',
    aspect: 91.5 / 72,
    swatch: ['#f0c43c', '#1c3a9e', '#3f7a4a', '#d88f7a', '#e8d9a8'],
    center: [50, -26], inner: 14, outer: 30,
    vp: { pos: [61.5, -16.5], look: [52.5, 5.2, -46], fov: 62 },
  },
  {
    id: 'bedroom', key: '5',
    cn: '阿尔勒的卧室', orig: 'De slaapkamer', year: '1888 年 10 月',
    place: '黄房子二楼（此处移到了一楼）', museum: '梵高博物馆，阿姆斯特丹',
    quote: '看着这幅画，应该让头脑得到休息，或者说，让想象休息。',
    quoteSrc: '致弟弟提奥的信，1888',
    aspect: 90 / 72,
    swatch: ['#9fb0d8', '#e0a53a', '#d8402f', '#b07a5a', '#6a8ac0'],
    center: [52.8, -46.5], inner: 3.2, outer: 5.2, box: [50.4, -47.8, 56.2, -41.3],
    vp: { pos: [52.7, -42.2], look: [53.4, 0.2, -50.5], fov: 66 },
  },
  {
    id: 'wheat', key: '6',
    cn: '麦田群鸦', orig: 'Korenveld met kraaien', year: '1890 年 7 月',
    place: '瓦兹河畔奥维尔', museum: '梵高博物馆，阿姆斯特丹',
    quote: '动荡天空下的大片麦田，我不必刻意去表达悲伤与极度的孤独。',
    quoteSrc: '致弟弟提奥的信，1890',
    aspect: 103 / 50.5,
    swatch: ['#e0b040', '#1a2d6e', '#4d79c7', '#b4563a', '#3f7a3a'],
    center: [-72, -8], inner: 20, outer: 44,
    vp: { pos: [-49, -8], look: [-120, 4, -6], fov: 70 },
  },
];

// Atmosphere profiles. 'town' is the base (night, like the café).
const c = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

export const PROFILES = {
  town: {
    night: 1, zen: c('#15286e'), hor: c('#2f4f9a'), swirl: 0.45, stars: 1, moon: 1, dipper: 0.5, clouds: 0, turb: 0.15,
    sunDir: [0.3, 0.8, 0.4], sunCol: [0, 0, 0], ambSky: [0.3, 0.36, 0.74], ambGround: [0.17, 0.16, 0.33],
    fog: c('#22356e'), fogDen: 0.0065, lampK: 1, under: c('#1a2458'),
  },
  cafe: null, // same as town
  starry: {
    night: 1, zen: c('#10286a'), hor: c('#5d86c0'), swirl: 1.0, stars: 1, moon: 1, dipper: 0.2, clouds: 0, turb: 0.25,
    sunDir: [0.3, 0.8, 0.4], sunCol: [0, 0, 0], ambSky: [0.36, 0.46, 0.8], ambGround: [0.16, 0.2, 0.34],
    fog: c('#2b4a8a'), fogDen: 0.0048, lampK: 1, under: c('#12204e'),
  },
  rhone: {
    night: 1, zen: c('#13285a'), hor: c('#3f6f8a'), swirl: 0.22, stars: 1, moon: 0.4, dipper: 1, clouds: 0, turb: 0.1,
    sunDir: [0.3, 0.8, 0.4], sunCol: [0, 0, 0], ambSky: [0.34, 0.46, 0.72], ambGround: [0.18, 0.22, 0.3],
    fog: c('#23406a'), fogDen: 0.0055, lampK: 1, under: c('#132448'),
  },
  yellow: {
    night: 0, zen: c('#10277e'), hor: c('#2a5cc0'), swirl: 0.05, stars: 0, moon: 0, dipper: 0, clouds: 0, turb: 0.05,
    sunDir: [0.45, 0.72, 0.55], sunCol: [0.7, 0.62, 0.45], ambSky: [0.62, 0.66, 0.78], ambGround: [0.48, 0.42, 0.34],
    fog: c('#5f7fc8'), fogDen: 0.0042, lampK: 0, under: c('#3a3a6a'),
  },
  bedroom: {
    night: 0, zen: c('#10277e'), hor: c('#2a5cc0'), swirl: 0.05, stars: 0, moon: 0, dipper: 0, clouds: 0, turb: 0.05,
    sunDir: [-0.3, 0.6, -0.75], sunCol: [0.35, 0.33, 0.26], ambSky: [0.86, 0.86, 0.9], ambGround: [0.66, 0.6, 0.55],
    fog: c('#8090c0'), fogDen: 0.001, lampK: 0, under: c('#4a4a78'),
  },
  wheat: {
    night: 0.12, zen: c('#0f1f5e'), hor: c('#2e56a8'), swirl: 0.1, stars: 0, moon: 0, dipper: 0, clouds: 1, turb: 1,
    sunDir: [-0.5, 0.55, 0.3], sunCol: [0.62, 0.52, 0.3], ambSky: [0.5, 0.55, 0.78], ambGround: [0.4, 0.34, 0.24],
    fog: c('#34539a'), fogDen: 0.0048, lampK: 0.1, under: c('#2a2850'),
  },
};
PROFILES.cafe = PROFILES.town;

export const PROFILE_KEYS = ['night', 'zen', 'hor', 'swirl', 'stars', 'moon', 'dipper', 'clouds', 'turb', 'sunDir', 'sunCol', 'ambSky', 'ambGround', 'fog', 'fogDen', 'lampK', 'under'];
