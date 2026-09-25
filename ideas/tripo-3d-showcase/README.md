# 原文 → 成品：Tripo 3D 提示词复刻

把 Tripo「3D Prompts」里 7 条 Three.js 提示词，原样交给 Claude Code（Opus 5.5）生成，再逐条修到能看、能交付，
最后再做一版 v3：第 6 条换上 AI 生成并绑骨加动作的真 3D 模型，第 5 条照 AI 参考图重做，第 1～4 条只靠自写着色器和后期提升画面（帆布透光、谷底薄雾与月光光束、铆接钢梁与镜头光纹、空气透视与山口光柱）。每一章都能对照看三版：原作者成品（只放文字描述和原页面链接）、
我们的一次成型版（黑屏和报错也如实保留）、精细加工版（修正版 + v3 真模型版），并附一份给新手的逐步教程。

- 在线查看：https://sunxiaoxi2039-star.github.io/website-showcase-sites/ideas/tripo-3d-showcase/
- 最近更新：2026-09-25

## 技术栈

- 展示页：原生 HTML/CSS/JS（ES modules）、GSAP ScrollTrigger、Lenis 平滑滚动、Three.js（开场场景与模型查看器）
- 成品页：Three.js r180（CDN importmap），第 6 条是 Vite 项目（这里放的是可直接运行的源码版，three 走本地 vendor）
- 3D 资产：参考图 qwen-image / wan2.7 / Seedream 4.0 → 图生 3D Tripo H3.1、Seed3D 2.0 → Blender 与 gltf-transform 减面、压贴图；主角和独眼巨人用腾讯 TokenHub 自动绑骨配动作，再用 Blender 把多段动作合进一个 GLB
- 验证：本机无头 Chrome（CDP 脚本）逐章截图、查控制台、限制同时只跑 1 个 WebGL 场景

## 展示页本身做了什么（都是自己写的代码，没花钱）

- **开场展厅**（`js/hero.js`，全页唯一的 WebGL 画布）：中央是第 6 章那位奥德修斯，绑过骨、在底座上呼吸待机，
  抛光石地里有他的倒影（倒影用 SkeletonUtils 单独克隆骨骼，两边动作同步）；底座上方的体积光锥和浮尘是自写着色器，
  大理石和地面粗糙度贴图用噪声在 canvas 上现画。镜头随滚动沿一条路线走：远景 → 靠近雕塑 → 依次停在六幅作品前 → 升起俯瞰。
- **自写的最后一道调色**：开场噪声溶解、按滚动速度加重的色散、暗角、胶片颗粒，在色调映射前的线性空间里做。
- **章节转场**（`js/fx.js`）：每章舞台进场时，9 条百叶从中间向两边依次收起，章节号放大淡出，跟着滚动走、往回滚会合上。
  故意用 DOM / CSS 做而不是第二个 WebGL，保证全页同一时间只有 1 个三维画布。
- **资产区查看器**（`viewer.html`）：主角和独眼巨人加载绑过骨的版本，左上角按钮切换动作（待机、走、跑、闪避、蓄力砸地……），
  切换时 0.35 秒交叉淡入淡出。
- **排版与微交互**：标题逐字错峰出场、小标题进视口时乱码解码成原文、桌面端跟随光标的圆环、磁吸按钮、
  卡片随指针倾斜并带高光。
- **约束**：同一时间最多 1 个 iframe / WebGL（实时场景点了才加载，滚出画面自动卸载）；375px 手机可用；
  系统开了「减弱动效」时关掉视差、转场和全部微交互；CDN 加载不到时开场退回静态拼图，文字照常可读。

## 目录

- `index.html`：展示页入口；`viewer.html`：资产区的单模型查看器
- `results/<章>/oneshot|fixed|v3/`：各章可运行的成品页
- `tutorials/`：7 份新手教程（Markdown）和配图
- `media/`：展示页用的截图、录屏、转台视频、开场模型

## 提示词出处

提示词原文版权归原作者，展示页里全文引用并附出处；本目录不含原作者的成品视频、图片或模型，
「原版」一栏只有文字描述和跳回 Tripo 原页面的按钮。

| 章 | 标题 | 作者 | 类型 | 出处 |
|---|---|---|---|---|
| 01 | Cinematic interactive pirate ship at sunset | Vib3Coded | 原话 prompt | [Tripo 页面](https://www.tripo3d.ai/3d-prompts/claude-opus-5-5-2102533729746882985) |
| 02 | Interactive 3D Japanese Cherry Blossom Valley Web Experience | 宝玉 | 原话 prompt | [Tripo 页面](https://www.tripo3d.ai/3d-prompts/claude-opus-5-5-2102565403109085669) |
| 02b | Interactive 3D Prehistoric Island | Vib3Coded | 原话 prompt | [Tripo 页面](https://www.tripo3d.ai/3d-prompts/claude-opus-5-5-2102450239923720440) |
| 03 | Procedural Three.js 3D main menu background from an image | Majid Manzarpour | 原话 prompt | [Tripo 页面](https://www.tripo3d.ai/3d-prompts/claude-opus-5-5-2102544196808667471) |
| 04 | Photorealistic Three.js landscape | Alix Ollivier | 整理 brief | [Tripo 页面](https://www.tripo3d.ai/3d-prompts/photorealistic-three-js-landscape-2094871858206191667) |
| 05 | Reference-driven Three.js portfolio | Meng To | 整理 brief | [Tripo 页面](https://www.tripo3d.ai/3d-prompts/reference-driven-three-js-portfolio-2095104073590808644) |
| 06 | The Cyclops' Island | Jared（remix from Jason Chew） | 整理 brief | [Tripo 页面](https://www.tripo3d.ai/3d-prompts/cyclops-island-threejs-game) |

## 新手教程

- [01-pirate-ship-sunset.md](tutorials/01-pirate-ship-sunset.md)
- [02-cherry-blossom-valley.md](tutorials/02-cherry-blossom-valley.md)
- [02b-prehistoric-island.md](tutorials/02b-prehistoric-island.md)
- [03-main-menu-from-image.md](tutorials/03-main-menu-from-image.md)
- [04-photorealistic-landscape.md](tutorials/04-photorealistic-landscape.md)
- [05-reference-driven-portfolio.md](tutorials/05-reference-driven-portfolio.md)
- [06-cyclops-island.md](tutorials/06-cyclops-island.md)

## 素材来源

- 截图、录屏、转台视频：全部由本项目自己的成品页和模型渲染而来。
- 第 6 章 6 个模型、第 5 章参考图：由本项目付费调用生成模型得到（模型名和花费写在展示页「模型资产」区）。
- 字体与库走公共 CDN（Google Fonts、jsDelivr、cdnjs）；CDN 打不开时展示页退回静态版，文字仍可读。
