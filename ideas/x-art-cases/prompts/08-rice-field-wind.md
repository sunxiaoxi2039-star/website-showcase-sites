# 08 · A Sea of Green — Wind Through the Rice Fields（稻浪：风过稻田）

- 原帖：https://x.com/YouWareAI/status/2097604012497650125
- 作者：@YouWareAI（YouWare）
- 发帖日期：2026-09-09
- 作者所用模型：GPT-6 Astra 与 Claude Opus 5（同一 prompt 对比）
- 原文性质：原话
- 抓取日期：2026-09-25
- 艺术方向：风吹稻浪的宁静景观：前中远景层次分明，灰蓝天空，深绿、橄榄绿、黄绿配色，晨、午、黄金时刻三种光，衬线标题“A sea of green”。

## 提示词原文

```
Build an immersive 3D rice-field website that runs in the browser, with the theme:
“A sea of green / Wind through the rice fields.”
Complete the code, install the necessary dependencies, and launch a preview. Do not stop at a proposal or implementation plan.

1. Visual Direction

The overall atmosphere should feel natural, peaceful, and refined, like an interactive landscape website with cohesive art direction.

The scene should include:

Foreground: clearly distinguishable slender leaves, curved stems, and a few drooping rice panicles.

Midground: a continuous rice field extending into the distance, with sufficient density and natural variations in spacing.
Background: an irregular tree line, layered low hills, and subtle atmospheric perspective.
Sky: soft gray-blue tones, subtle cloud variation, and a natural transition at the horizon.
Position the default camera slightly above the rice panicles, looking across the field toward the distant hills.
The sky should occupy approximately one-third of the frame, with the rice field dominating the composition.
Use primarily deep green, olive green, and yellow-green vegetation colors. Avoid fluorescent green.
Vary the height, orientation, curvature, and color of the rice plants naturally.

2. Animation Requirements
Wind must appear as continuous waves traveling laterally across the field:
Keep the roots mostly fixed, with progressively stronger movement toward the leaf tips and panicles.
Plants in the same area should move coherently while retaining individual variation.

Combine slow, large-scale wind waves with subtle local disturbances.

Avoid making all plants sway in perfect synchronization. Avoid translating entire plants or causing leaves to flicker.

Use a gentle default breeze that remains comfortable to watch over time.
3. Interaction Requirements
Provide simple controls that genuinely affect the scene:
Wind-speed slider: smoothly adjust the strength and speed of the wind animation.
Lighting modes: Morning, Afternoon, and Golden Hour. Coordinate changes to the sky, light direction, color temperature, and fog color.

View modes: Open Field and Among the Rice, with smooth camera transitions.

Pause/Resume: pause and resume the environmental animation.

Mouse movement may produce a very subtle camera response, but it should not cause dizziness.
Do not continuously rotate the camera through large angles by default.
4. Interface Design
Use a full-screen scene with an interface overlaid on top:
Top left: a small VERDANT wordmark.

Bottom left: the serif heading “A sea of green.”
Below it, the smaller subtitle “Nothing to do. Just follow the breeze.”
Bottom right: a compact, semi-transparent dark-green control panel.

Keep text legible, provide generous spacing, and avoid obstructing the main landscape with controls.

Controls must remain usable on narrow screens without overlapping.

5. Technology and Performance
Use Three.js. If an existing project is available, retain its build environment.
Use instancing and GPU vertex animation to handle large amounts of vegetation.
Avoid creating a separate draw object for every plant or updating every plant on the CPU each frame.
Reduce vegetation detail at greater distances and apply a reasonable pixel-ratio cap.
Prefer procedural geometry and materials to ensure reliable asset loading.
The scene must render in real time. Do not use a full landscape image or video as the main scene.
Model names and comparison labels will be added in post-production; do not include them in the scene.
6. Completion Criteria
After implementation, use the available browser tools to verify that:
The initial view renders correctly, with no obvious console errors.

Every control genuinely affects the scene.

The foreground, midground, and background have distinguishable depth and layering.
The rice plants are more than simple upright green lines.
Wind movement is continuous and natural, without obvious uniform repetition.
Camera transitions are smooth, and the interface remains usable on narrow screens.
If you cannot perform a particular check, state that clearly.
Finally, provide startup instructions and a summary of the features actually implemented.
```

## 备注

- 主帖 https://x.com/YouWareAI/status/2097602565110419781，prompt 在官方号自回复里；回复开头的“1、Try it Free”推广链接和“2、Prompt：”标签不属于 prompt，没收。
- 账号是 YouWare 官方，帖子带平台推广。
- prompt 里“安装依赖、启动预览、用浏览器工具自检”是 agent 指令；我们这里改成单页，用 jsDelivr 锁定版本的 Three.js。
- 核对：2026-09-25 经 api.fxtwitter.com 重新取回原帖，上面的提示词是从原帖正文按首尾锚点程序截取的，逐字一致。
