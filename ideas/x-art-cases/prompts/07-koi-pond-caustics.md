# 07 · Interactive Koi Pond with Caustics（焦散光下的锦鲤池）

- 原帖：https://x.com/vib3coded/status/2098494241852784980
- 作者：@vib3coded（Vib3Coded）
- 发帖日期：2026-09-11
- 作者所用模型：GPT-6 Astra（帖中写 ChatGPT-6 Astra）
- 原文性质：原话
- 抓取日期：2026-09-25
- 艺术方向：俯视的青绿清水，池底焦散光流动，折射和景深让锦鲤沉在水下；涟漪、雨和漩涡，WebAudio 做水声。

## 提示词原文

```
Build a beautiful, full-screen interactive koi pond using Three.js + WebGL. Use a top-down view with clear turquoise water, sunlight, animated caustics on the pond floor, and a convincing sense of depth.

Place an elegant translucent selection panel at the bottom with four koi varieties: Kohaku, Showa, Golden Ogon, and Platinum. Clicking a card releases that fish into the pond. Dragging a fish from its card lets the user choose exactly where to drop it.

Make each landing feel satisfying: a splash with droplets, a brief depression in the water surface, and expanding ripples. The fish should then dive beneath the surface. Use refraction and depth cues so the koi clearly look submerged.

Create detailed 3D koi with eyes, scales, fins, and flowing tails. Animate their bodies, tails, and fins together. Each fish should independently change direction and speed, turn smoothly near boundaries, and avoid other fish.

Let users touch and drag across the water to create ripples. Add rain and a movable whirlpool whose current affects the fish. Include Calm, Clear pond, and a control to hide the interface for screen recording.

Use Web Audio to create landing splashes, soft musical droplets, gentle swimming water sounds, rain, and a whirlpool sound. Enable audio through a Sound button, fade it smoothly when muted, and pause it when the browser tab is hidden.

Keep all labels and buttons in English. Make the layout responsive for mobile. Optimize rendering and animation for smooth performance with several dozen fish.

Deliver a complete, working website with polished visuals and functional interactions.
```

## 备注

- 主帖 https://x.com/vib3coded/status/2098492771170722032（写“Prompt below👇”），prompt 是作者本人回复的全文。
- 核对：2026-09-25 经 api.fxtwitter.com 重新取回原帖，上面的提示词是从原帖正文按首尾锚点程序截取的，逐字一致。
