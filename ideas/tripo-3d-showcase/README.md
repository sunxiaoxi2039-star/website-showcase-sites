# 原文 → 成品：Tripo 3D 提示词复刻

把 Tripo「3D Prompts」里 7 条 Three.js 提示词，原样交给 Claude Code（Opus 5.5）生成，再逐条修到能看、能交付，
最后给其中几条换上 AI 生成的真 3D 模型（v3）。每一章都能对照看三版：原作者成品（只放文字描述和原页面链接）、
我们的一次成型版（黑屏和报错也如实保留）、精细加工版（修正版 + v3 真模型版），并附一份给新手的逐步教程。

- 在线查看：https://sunxiaoxi2039-star.github.io/website-showcase-sites/ideas/tripo-3d-showcase/
- 最近更新：2026-09-25

## 技术栈

- 展示页：原生 HTML/CSS/JS（ES modules）、GSAP ScrollTrigger、Lenis 平滑滚动、Three.js（开场场景与模型查看器）
- 成品页：Three.js r180（CDN importmap），第 6 条是 Vite 项目（这里放的是可直接运行的源码版，three 走本地 vendor）
- 3D 资产：参考图 qwen-image / wan2.7 / Seedream 4.0 → 图生 3D Tripo H3.1、Seed3D 2.0 → Blender 与 gltf-transform 减面、压贴图
- 验证：本机无头 Chrome（CDP 脚本）逐章截图、查控制台、限制同时只跑 1 个 WebGL 场景

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
