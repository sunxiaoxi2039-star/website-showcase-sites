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

## 案例集（`cases/`）

`cases/index.html` 是发布周作品的索引页：**128 件**（游戏 48 / 网页 51 / Blender·3D 23 / 视频 4 / 绘画 2，其中 52 件有 live demo），
可按分类筛选、按关键词搜索，已临摹的 6 件带角标直接跳到本站版本。数据内联在页面里，纯静态、无请求。

- 数据来源：`github.com/magiccreator-ai/awesome-gpt-6-astra`（该仓库自述 171 条，本次转录 128 条），标题与描述经中文改写，链接原样保留、**未逐条人工核对**。
- 页内另有「官方公开演示」一栏（财务建模 / 模板演示稿 / 建站与前端 QA / Blender→UE5 / 日常 computer use）：
  **转述自公开报道，不是 openai.com 原文** —— 本环境的出口网络屏蔽了 `openai.com`，抓不到官方页面。拿到官方链接或正文可随时按原文替换这一栏。

## Prompt

每件产出旁边都挂着生成它需要的 prompt，可一键复制：

- **6 件临摹**：总览页每张卡片底部的「生成这件临摹用的 prompt」折叠块 —— 是我实际用来写这件作品的完整提示词（几何做法、交互、面板参数都写在里面）。
- **128 件案例**：案例集每张卡片的「复刻 prompt」—— **按作品描述反推的起手式，不是原作者的原始 prompt**（绝大多数原作者没有公开），按分类（游戏 / Blender·3D / 网页 / 视频 / 绘画）套不同模板生成。
- 聚合站 `website-gallery` 的每条展览卡片下面也挂了同一份 prompt。

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
