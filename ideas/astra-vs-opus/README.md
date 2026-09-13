# Astra 作品 × Opus 临摹（astra-vs-opus）

## 简短介绍

GPT-6 Astra（OpenAI，2026-09-03 发布）发布周里，X 上出现了一批「一句话生成一个能跑的 3D 网页」的作品。
本站从这些公开作品里挑了 **6 件**，用 Claude Opus 5 各自**重写一遍**，做成左右对照：左边是原作出处与作者，右边是临摹版本，可直接点开跑。

> **这是「按描述重写」，不是 1:1 像素复刻。**
> 制作时运行环境的出口网络屏蔽了 `x.com` 与各 demo 域名，无法逐帧对着原作改。
> 每件临摹依据的是原帖文字描述与社区整理（`magiccreator-ai/awesome-gpt-6-astra`）里的作品说明，代码全部重写。
> 页面上的「自评还原度」是对自己实现完成度的判断，不是对原作的评分。

## 六件对照

| 临摹页面 | 原作 | 原作者 | 原帖 |
|---|---|---|---|
| `works/abyssal/` 深渊：活着的深海 | ABYSSAL: The Living Deep | @emollick | `x.com/emollick/status/2095673885605630429` |
| `works/v8-engine/` V8 四冲程剖面 | Interactive V8 Engine | @DilumSanjaya | `x.com/DilumSanjaya/status/2096280244663775423` |
| `works/seoul-atlas/` 首尔立体地图 | Seoul 3D Atlas | @synabreu | `x.com/synabreu/status/2096557555086725159` |
| `works/van-gogh-town/` 可以走进去的梵高小镇 | Walk Through Van Gogh | @petergostev | `x.com/petergostev/status/2095776685807346105` |
| `works/orbital-core/` 轨道核心 | Orbital Core Showcase | @oneruofeng | `x.com/oneruofeng/status/2096551010089263181` |
| `works/brandenburg-piano/` 勃兰登堡键盘 | Brandenburg Piano | @DeryaTR_ | `x.com/DeryaTR_/status/2096090915790069857` |

## 技术栈

- three.js **r128**，已 vendored 到 `assets/vendor/three.min.js`（无 CDN 依赖、无构建步骤）
- 每件作品是一个**独立的单文件 HTML**，共用 `assets/work.css` 的外壳样式（顶栏 / 控制面板 / 读数）
- 纯程序化几何：没有任何外部模型或贴图，窗灯贴图是运行时用 Canvas 画的
- 音频部分（勃兰登堡键盘）用 WebAudio 合成，前瞻调度器排程

### 每件作品支持的 URL 参数（截图与外链用）

| 作品 | 参数 |
|---|---|
| abyssal | `?depth=<米>&seed=<字符串>&azim=<弧度>` |
| v8-engine | `?rpm=<转速>&yaw=<弧度>&spin=0` |
| seoul-atlas | `?time=<0-1>&tour=0&go=<地标序号>` |
| van-gogh-town | `?x=&z=&yaw=&auto=0` |
| orbital-core | `?yaw=<弧度>&explode=1` |
| brandenburg-piano | `?silent=1`（只看画面，不发声） |

## 发布链接

GitHub Pages：`https://sunxiaoxi2039-star.github.io/website-showcase-sites/ideas/astra-vs-opus/`
（仓库根已有 `.nojekyll`，静态文件直出。）

## 最近更新

2026-09-13 —— 建站，完成 6 件临摹、对照总览页与封面图。

## 备注

- **素材来源**：原作标题 / 作者 / 原帖 / demo 链接均来自 `github.com/magiccreator-ai/awesome-gpt-6-astra`；作品描述来自原帖公开文字。
- **版权**：临摹代码全部为重写，原作版权归各原作者所有，本站仅作学习对照用途。
- **勃兰登堡键盘的说明**：内置乐句是按 BWV 1048 第一乐章的织体（连绵十六分音符 + 行走低音）生成的巴赫风格段落，**不是原谱转录**，页面上也已标注。
- **后续动作**：想继续加的候选 —— @ashebytes 的 Exploded Male Anatomy（人体解剖爆炸图）、@blueemi99 的 iPhone 编年史、@ashebytes 的 Navier–Stokes 可视论文。

## 分类

- 类型：网站设计 - ideas（临摹型 / 对照研究）
