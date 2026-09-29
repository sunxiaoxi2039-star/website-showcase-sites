# X 艺术案例十则

在 X 上找了 10 条作者公开的艺术向网页提示词，原样交给 Claude Code（Opus 5.5）一次生成，
再逐条复评、精修。每一条都能对照看三版：一次成型（黑屏和报错也如实保留）、修正版（有才有）、精修版。
全程只写代码：贴图、几何、声音都由程序现场生成，没有调用任何付费生成接口，额外花费为零。

- 在线查看：https://sunxiaoxi2039-star.github.io/website-showcase-sites/ideas/x-art-cases/
- 上一个作品（Tripo 3D 提示词复刻）：https://sunxiaoxi2039-star.github.io/website-showcase-sites/ideas/tripo-3d-showcase/
- 最近更新：2026-09-29

## 案例与出处

提示词原文版权归原作者，页面和 `prompts/` 里仅作对照引用，每条都附原帖链接。

| # | 标题 | 作者 | 作者所用模型 | 出处 |
|---|---|---|---|---|
| 01 | 没粘牢的玻璃金箔马赛克 | @LCSlates | Claude Opus 5.5（作者原话“Opus 5.5 by itself”） | [原帖](https://x.com/LCSlates/status/2102503028859211905) |
| 02 | 余白：彩窗之光铺满大教堂 | @AGIOyaZ | Claude Opus 5.5 + three.js | [原帖](https://x.com/AGIOyaZ/status/2103145567945986461) |
| 03 | 奇点：程序化电音三维可视化 | @chetaslua | Claude Opus 5 | [原帖](https://x.com/chetaslua/status/2080534915494645997) |
| 04 | 磁流体雕塑 | @free_ai_guides | Claude Fable 5.1 与 GPT-6 Astra（同一 prompt 对比） | [原帖](https://x.com/free_ai_guides/status/2098184876692533475) |
| 05 | 霓虹烟雾流体 | @theailoser | Claude Opus 5.5（一次成型） | [原帖](https://x.com/theailoser/status/2102565612874596411) |
| 06 | 无尽的太阳朋克之城 | @danveloper | Claude Fable 5 | [原帖](https://x.com/danveloper/status/2064470654074691912) |
| 07 | 焦散光下的锦鲤池 | @vib3coded | GPT-6 Astra（帖中写 ChatGPT-6 Astra） | [原帖](https://x.com/vib3coded/status/2098494241852784980) |
| 08 | 稻浪：风过稻田 | @YouWareAI | GPT-6 Astra 与 Claude Opus 5（同一 prompt 对比） | [原帖](https://x.com/YouWareAI/status/2097604012497650125) |
| 09 | 动态设计师的 15 秒作品集 | @shneural | Claude Opus 5.5 与 GPT-6 Astra（同一 prompt 对比） | [原帖](https://x.com/shneural/status/2103151003272962130) |
| 10 | 画风流转：水墨、木版与水彩 | @takamasa045 | Claude Opus 5.5 与 GPT-6 Sol（均 Extra High） | [原帖](https://x.com/takamasa045/status/2102619012798746665) |

## 目录

- `index.html`、`site/`：展示页
- `results/<NN-slug>/oneshot|fixed|final/`：各案例可运行的成品页；`NOTES.md` 是生成记录、复评和精修说明
- `prompts/`：提示词原文存档（含原帖链接、作者、抓取日期）
