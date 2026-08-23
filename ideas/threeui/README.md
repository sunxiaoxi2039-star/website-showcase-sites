# ThreeUI 精选档案（threeui）

## 简介

Meng To（Design+Code 创始人）开源的 three.js 组件与落地页模板库。全部组件为纯过程化 JS（每个 100–200 KB），可复制为 prompt 交给 agent 改写主题/光照/动效。本站为**精选存档**：220+ 组件中仅收录个人认为好看、值得日后翻阅的条目，不做全量备份。

- 官网：`https://threeui.com`
- 仓库：`https://github.com/MengTo/threeui`（MIT，Community 版免费 160+，Pro 含 MCP/skills）
- 开源推文：2026-08-21（`x.com/MengTo/status/2090817187900780961`）

## 代码备份（防止上游删库）

- **完整备份**：fork 仓库 `https://github.com/sunxiaoxi2039-star/threeui` —— 含全部 50 个 Community 组件完整源码、素材、字体（含 kage.html、inner-green-3d.html、Towers.html 等独立成品页）。上游即使删除，fork 永久保留。
- **精选源码**：`src/` 目录收录 8 个精选组件的**核心可读源码**（场景 wrapper、渲染器、生成脚本），方便快速翻阅学习；超长成品 HTML 与 three.js 运行时不在此重复，统一去 fork 看。
- 协议：MIT（见 `src/THREEUI-LICENSE.md`）。

## 精选清单（值得回头看）

| # | 组件 | 免费? | 为什么值得存 | 链接 | 源码 |
|---|---|---|---|---|---|
| 1 | **Sylva — Living Green**（Hero 落地页） | ✅ | 苔藓覆盖的 3D 枝条 + 蝴蝶 + 漂浮卡片，全站最具代表性的「活的落地页」 | `threeui.com/hero/sylva/living-green` | fork: `public/landing-pages/inner-green-3d.html` |
| 2 | **Sylva Living World**（Three.js 场景） | ✅ 1 变体 | 上面那套的纯场景版，适合拆出来当背景复刻 | `threeui.com/three-js/sylva-living-world/living-green` | `src/sylva-living-world/` |
| 3 | **Landscape**（7 变体全免费） | ✅ | 同一片低多边形风景的 日出/正午/日落/夜/雨/风暴/雪 七态切换，「一套场景多套氛围」的最佳教材 | `threeui.com/three-js/landscape` | `src/landscape/` |
| 4 | **Temple Night** | ✅ 1 变体 | 鸟居 + 夜色的东方意境场景，克制又高级 | `threeui.com/three-js/temple-night` | `src/temple-night/`（渲染器见 fork `src/shaders/temple-night/templeNightRenderer.js`） |
| 5 | **Country Towers**（6 国全免费） | ✅ | 程序化生成各国地标塔楼（日本/中国/越南等），国家主题的落地页好素材 | `threeui.com/three-js/country-towers` | `src/country-towers/`（成品页见 fork `Towers.html`） |
| 6 | **Sketchbook**（落地页） | ✅ | 手账速写风 3D 落地页，风格在整个库里独一份 | `threeui.com/landing-pages/meng-to-sketchbook-landing-page` | fork: `public/landing-pages/meng-to-sketchbook.html` |
| 7 | **Kage**（落地页） | ✅ | 他的成名作「影」——暗调东方美学 + 大字号排版 | `threeui.com/landing-pages/kage-landing-page` | fork: `public/landing-pages/kage.html` |
| 8 | **Structure Flow**（13 变体） | ✅ | 数据流线/点阵/星云式抽象 3D 背景，做技术感 hero 的万能底 | `threeui.com/three-js/structure-flow` | `src/structure-flow/` |

## 备选（Pro 付费，先记账）

- **Sylva Sakura Sunset（漫天桃花瓣那个）** —— Sylva 的樱花日落变体，Pro 专属，免费版没有源码
- Sunset Valley（4 变体：日落/森林晨雾/极光夜/蓝调时刻）
- Sakura Branch（樱花枝）
- Wood Icons（木纹 3D 图标：Gameboy/键盘/椅子等）

## 分类

- 类型：网站设计 - ideas（素材积累型 / 灵感库 / 链接档案 + 代码备份）

## 更新时间

- 2026-08-22 收录；2026-08-23 补充 fork 完整备份 + src/ 精选源码

## 说明

- 本目录为链接档案 + 精选源码，隶属 `website-showcase-sites/ideas/`。
- 若日后复刻其中某个组件，成品进 Kimimotion，GitHub 侧同步 `ideas/kimimotion/`，本条目不搬完整代码。
- 复刻时优先用各组件页的 **Copy Prompt** 按钮，比直接读源码省事。
