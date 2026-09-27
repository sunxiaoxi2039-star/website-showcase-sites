// 英文界面用的地名与地标资料（与 landmarks.js 的中文资料一一对应）。
// 地名采用韩国官方罗马字（Revised Romanization）与通行英文名。

export const CAT_EN = {
  '山岳': 'Mountain', '宫阙': 'Palace', '广场': 'Square', '水系': 'Stream', '城门': 'City gate', '交通': 'Transport',
  '地标': 'Landmark', '建筑': 'Architecture', '公园': 'Park', '乐园': 'Theme park', '体育': 'Stadium', '商圈': 'Business district',
  '桥梁': 'Bridge', '城区': 'District',
};

// name：卡片与列表用全名；short：地图标签用短名；desc / facts：卡片正文
export const LANDMARK_EN = {
  bukhansan: {
    name: 'Bukhansan · Baegundae', short: 'Bukhansan',
    desc: 'The granite peaks north of Seoul. The highest, Baegundae, stands 836 m tall; its bare white rock faces and neighbouring Insubong form a natural wall along the city\'s northern edge.',
    facts: [['Elevation', '836 m'], ['Type', 'National park'], ['Location', 'Gangbuk · Eunpyeong · Dobong']],
  },
  gyeongbokgung: {
    name: 'Gyeongbokgung Palace', short: 'Gyeongbokgung',
    desc: 'The main royal palace of the Joseon dynasty, completed in 1395. Gwanghwamun, Heungnyemun, Geunjeongjeon and Sajeongjeon line up along a north–south axis, Gyeonghoeru pavilion stands over its pond to the west, and Bugaksan rises behind.',
    facts: [['Built', '1395'], ['Area', 'c. 430,000 m²'], ['Location', 'Jongno-gu']],
  },
  changdeokgung: {
    name: 'Changdeokgung Palace', short: 'Changdeokgung',
    desc: 'A Joseon secondary palace laid out freely to follow the hills, inscribed as a UNESCO World Heritage Site in 1997. Its rear garden to the north, the Secret Garden, is a model of traditional Korean landscape design.',
    facts: [['Built', '1405'], ['Heritage', 'UNESCO 1997'], ['Location', 'Jongno-gu']],
  },
  gwanghwamun: {
    name: 'Gwanghwamun Square', short: 'Gwanghwamun',
    desc: 'Seoul\'s "national living room". Statues of King Sejong and Admiral Yi Sun-sin stand along Sejong-daero, and the north end faces Gwanghwamun Gate with Bugaksan beyond.',
    facts: [['Length', 'c. 550 m'], ['Opened', '2009'], ['Location', 'Jongno-gu']],
  },
  cheonggyecheon: {
    name: 'Cheonggyecheon Stream', short: 'Cheonggyecheon',
    desc: 'An urban stream restored in 2005 after an elevated highway was torn down. It runs east for almost 11 km from Cheonggye Plaza, joins Jungnangcheon and flows into the Han River.',
    facts: [['Length', '10.9 km'], ['Restored', '2005'], ['Location', 'Jongno · Jung-gu']],
  },
  sungnyemun: {
    name: 'Sungnyemun (Namdaemun)', short: 'Sungnyemun',
    desc: 'The main south gate of the Hanyang city wall, built in 1398 and designated National Treasure No. 1. It burned in 2008 and was faithfully restored in 2013.',
    facts: [['Built', '1398'], ['Nat. Treasure', 'No. 1'], ['Location', 'Jung-gu']],
  },
  seoulstation: {
    name: 'Seoul Station', short: 'Seoul Station',
    desc: 'The domed red-brick station of 1925 stands beside a modern glass terminal: the starting point of the Gyeongbu Line and the KTX high-speed rail.',
    facts: [['Old station', '1925'], ['Lines', 'KTX · Lines 1/4'], ['Location', 'Jung · Yongsan']],
  },
  namsan: {
    name: 'N Seoul Tower', short: 'N Seoul Tower',
    desc: 'A broadcast tower on the summit of Namsan: the tower is 236.7 m tall and its top sits about 480 m above sea level. At night it changes colour with the air quality.',
    facts: [['Tower', '236.7 m'], ['Built', '1975'], ['Namsan', '262 m']],
  },
  heunginjimun: {
    name: 'Heunginjimun (Dongdaemun)', short: 'Heunginjimun',
    desc: 'The east gate of the Hanyang city wall and the only one with a semicircular outer enclosure (ongseong). The Dongdaemun market district starts right beside it.',
    facts: [['Built', '1398'], ['Rebuilt', '1869'], ['Location', 'Jongno-gu']],
  },
  ddp: {
    name: 'Dongdaemun Design Plaza (DDP)', short: 'DDP',
    desc: 'Zaha Hadid\'s flowing building, its seamless curves pieced together from 45,000 aluminium panels. After dark the facade lights up like a silver river of light.',
    facts: [['Opened', '2014'], ['Design', 'Zaha Hadid'], ['Location', 'Jung-gu']],
  },
  seoulforest: {
    name: 'Seoul Forest', short: 'Seoul Forest',
    desc: 'An urban forest made from a former racecourse and golf course, where Jungnangcheon meets the Han River. In autumn its ginkgo trees turn solid gold.',
    facts: [['Area', 'c. 1.16 km²'], ['Opened', '2005'], ['Location', 'Seongdong-gu']],
  },
  lotte: {
    name: 'Lotte World Tower', short: 'Lotte World Tower',
    desc: 'At 555 m and 123 floors, the tallest building in Korea. The tapering form draws on traditional Korean ceramics and the calligraphy brush, crowned by an open steel lattice.',
    facts: [['Height', '555 m'], ['Floors', '123'], ['Completed', '2017']],
  },
  lotteworld: {
    name: 'Lotte World · Magic Island', short: 'Lotte World',
    desc: 'A fairy-tale castle on Seokchon Lake\'s west basin, facing Lotte World Tower across the road: Seoul\'s best-known outdoor amusement island.',
    facts: [['Opened', '1989'], ['Lake', 'Seokchon Lake'], ['Location', 'Songpa-gu']],
  },
  olympicpark: {
    name: 'Olympic Park · World Peace Gate', short: 'Peace Gate',
    desc: 'Built for the 1988 Seoul Olympics. The Four Guardian Deities are painted beneath its vast wing-like roof, and the Flame of Peace burns in front of the gate.',
    facts: [['Built', '1988'], ['Architect', 'Kim Chung-up'], ['Location', 'Songpa-gu']],
  },
  jamsil: {
    name: 'Jamsil Olympic Stadium', short: 'Olympic Stadium',
    desc: 'The main stadium of the 1988 Olympics; its roofline follows the profile of a Joseon white porcelain jar. Jamsil Baseball Stadium sits right next door.',
    facts: [['Built', '1984'], ['Capacity', 'c. 69,000'], ['Location', 'Songpa-gu']],
  },
  coex: {
    name: 'Samseong · COEX', short: 'COEX',
    desc: 'Gangnam\'s business core: the convention centre, the Starfield Library and the Trade Tower, at the eastern end of Teheran-ro\'s "Teheran Valley".',
    facts: [['Trade Tower', '228 m'], ['Opened', '1988'], ['Location', 'Gangnam-gu']],
  },
  gangnam: {
    name: 'Gangnam Station', short: 'Gangnam Station',
    desc: 'One of Seoul\'s busiest interchanges and shopping districts, where Gangnam-daero meets Teheran-ro and the office towers stay lit all night.',
    facts: [['Daily riders', 'c. 200,000'], ['Lines', 'Line 2 · Shinbundang'], ['Location', 'Gangnam · Seocho']],
  },
  banpo: {
    name: 'Banpo Bridge · Moonlight Rainbow Fountain', short: 'Banpo Fountain',
    desc: 'Listed by Guinness as the world\'s longest bridge fountain (1,140 m). At night coloured curtains of water pour from both sides of the deck into the Han River; the lower deck is Jamsu Bridge.',
    facts: [['Fountain', '1,140 m'], ['Nozzles', 'c. 380'], ['Location', 'Seocho · Yongsan']],
  },
  yongsan: {
    name: 'Yongsan', short: 'Yongsan',
    desc: 'The geographic centre of Seoul, home to Yongsan Station, the National Museum of Korea and Yongsan Park, with the Han River just to the south.',
    facts: [['Station', 'Yongsan Stn'], ['Museum', 'National Museum'], ['Location', 'Yongsan-gu']],
  },
  yeouido: {
    name: 'Yeouido · 63 Building', short: '63 Building',
    desc: 'The financial island in the Han River. The golden 63 Building, 249 m tall, was the tallest building in Asia when it opened in 1985; the island also holds the National Assembly and IFC Seoul.',
    facts: [['Height', '249 m'], ['Completed', '1985'], ['Location', 'Yeongdeungpo-gu']],
  },
  worldcup: {
    name: 'Seoul World Cup Stadium', short: 'World Cup Stadium',
    desc: 'Venue of the opening match of the 2002 Korea–Japan World Cup; the roof takes its shape from a traditional Korean shield kite and an octagonal tray. Next to it, Haneul Park rises from a former landfill.',
    facts: [['Built', '2001'], ['Capacity', 'c. 66,000'], ['Location', 'Mapo-gu']],
  },
  gimpo: {
    name: 'Gimpo International Airport', short: 'Gimpo Airport',
    desc: 'Seoul\'s city airport. Two parallel runways run northwest–southeast, busy day and night with domestic flights and short-haul routes across East Asia.',
    facts: [['Runways', '2 · 3.2/3.6 km'], ['Opened', '1939'], ['Location', 'Gangseo-gu']],
  },
};

export const PEAK_EN = {
  '北汉山': 'Bukhansan', '道峰山': 'Dobongsan', '水落山': 'Suraksan', '佛岩山': 'Buramsan', '仁王山': 'Inwangsan', '北岳山': 'Bugaksan',
  '南山': 'Namsan', '冠岳山': 'Gwanaksan', '清溪山': 'Cheonggyesan', '牛眠山': 'Umyeonsan', '大母山': 'Daemosan', '峨嵯山': 'Achasan',
};

export const BRIDGE_EN = {
  '汉江大桥': 'Hangang Bridge', '麻浦大桥': 'Mapo Bridge', '元晓大桥': 'Wonhyo Bridge', '铜雀大桥': 'Dongjak Bridge', '盘浦大桥': 'Banpo Bridge',
  '汉南大桥': 'Hannam Bridge', '东湖大桥': 'Dongho Bridge', '圣水大桥': 'Seongsu Bridge', '清潭大桥': 'Cheongdam Bridge', '蚕室大桥': 'Jamsil Bridge',
  '奥林匹克大桥': 'Olympic Bridge', '杨花大桥': 'Yanghwa Bridge', '城山大桥': 'Seongsan Bridge', '加阳大桥': 'Gayang Bridge', '千户大桥': 'Cheonho Bridge',
};

export const RIVER_EN = { '汉 江': 'HAN RIVER', '中浪川': 'Jungnangcheon', '炭川': 'Tancheon', '安养川': 'Anyangcheon' };

export const DISTRICT_EN = {
  '종로구': 'Jongno-gu', '중구': 'Jung-gu', '용산구': 'Yongsan-gu', '성동구': 'Seongdong-gu', '광진구': 'Gwangjin-gu', '동대문구': 'Dongdaemun-gu',
  '중랑구': 'Jungnang-gu', '성북구': 'Seongbuk-gu', '강북구': 'Gangbuk-gu', '도봉구': 'Dobong-gu', '노원구': 'Nowon-gu', '은평구': 'Eunpyeong-gu',
  '서대문구': 'Seodaemun-gu', '마포구': 'Mapo-gu', '양천구': 'Yangcheon-gu', '강서구': 'Gangseo-gu', '구로구': 'Guro-gu', '금천구': 'Geumcheon-gu',
  '영등포구': 'Yeongdeungpo-gu', '동작구': 'Dongjak-gu', '관악구': 'Gwanak-gu', '서초구': 'Seocho-gu', '강남구': 'Gangnam-gu', '송파구': 'Songpa-gu', '강동구': 'Gangdong-gu',
};
