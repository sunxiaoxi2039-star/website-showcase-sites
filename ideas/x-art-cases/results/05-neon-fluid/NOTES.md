# 05 · Eulerian Neon Fluid Simulation（霓虹烟雾流体）

## 来源
- 原帖：https://x.com/theailoser/status/2102565612874596411 （@theailoser，2026-09-23；主帖 https://x.com/theailoser/status/2102565611473661963）
- 原作者标注：Claude Opus 5.5 一次生成
- 提示词原文：`x-art/prompts/05-neon-fluid.md`（2026-09-25 经 api.fxtwitter.com 取得原文）

## 时间
- 开始：2026-09-26 05:24:10 PDT（本次重试；上一轮因用量上限中断，未留下成品）
- 结束：2026-09-26 06:20:12 PDT
- 用时：约 56 分钟（含写代码、6 轮无头截图自检、fixed 修补）

## 是否一次成型
- `oneshot/index.html` 首版就能跑：桌面、手机两张截图控制台都是 0 报错，画面正常（霓虹烟雾 + 泛光 + 色差，#050508 底，HUD 按时自动隐藏）。
- 但自检发现两个问题，所以另开了 `fixed/`（oneshot 原样保留，没有改动）：
  1. **HUD 底栏文字溢出卡片**（桌面必现）：底栏"帧率/分辨率"和"快捷键提示"挤在一行且不换行，总宽约 290px，而卡片内宽只有 224px，"T theme · C clear"跑出玻璃卡片边框。证据：`evidence/oneshot-hud.png`。
  2. **触屏拖动/甩动的最后一段丢失**（交互 bug）：触屏 `pointerup` 时立刻把指针从 Map 删掉，最后一帧还没被 `processInput` 处理的位移直接丢弃。真机 60fps 下丢的是每次手势最后约 16ms，恰好是"甩"（flick）速度最快、冲量最大的那段；无头软件渲染帧率低，丢得更明显：S 形拖动的后三分之一完全没有染料。证据：`evidence/drag-before-fix.png`（修前）与 `evidence/fixed-drag.png`（修后，轨迹完整走到终点）。

## fixed/ 改了什么
与 oneshot 的差异共 5 处，一处 CSS，四处 JS：
- CSS `.foot`：加 `flex-wrap:wrap`，间距改为 `gap:3px 8px`；`.foot .keys{margin-left:auto}`。放不下时快捷键提示换到第二行并右对齐，不再溢出。手机宽度下这一栏本来就隐藏，不受影响。
- JS 指针：对象加 `ended` 标记；`pointerdown` 时清零；触屏/笔的 `pointerup`/`pointercancel` 改为只置 `ended=true`；`processInput` 先把最后一段画完，再删除该指针。鼠标逻辑不变。
- 修后复测：桌面（HUD 展开）、手机、拖动三张截图，控制台都是 0 报错；`node --check` 语法通过。

## 已知问题 / 限制
- 无头 Chrome 走软件 WebGL（SwiftShader），实测 12–25 fps，真 GPU 会快很多；截图里的 HUD 淡入、提示条淡出这类 CSS 过渡在软件渲染下会被拖慢，所以个别截图里提示条还没完全消失、HUD 首次截图没赶上。经类名日志确认，这是截图时机问题，不是 bug。
- 开场几秒的 intro/auto burst 染料团偏"圆球状"，要等涡量把它们卷开才出现细丝（手机截图和交互后的截图细丝更明显）。
- "CLEAR CANVAS"按钮文字在 256px 卡片里折成两行，可读，未改。
- 只在无头 Chrome 的 WebGL2 + RGBA16F 路径实测过；WebGL1 / 全 float32 / 手动双线性插值（MANUAL_FILTERING）的回退路径只做了代码层面的检查，没有真机验证。
- 没有声音（原提示词不要求；页面不发任何音频）。
- 项目级收尾（规程里的 NOW.md、日志、git）没有做：任务限定只能写本案例文件夹、禁止 git，所以留给编排方统一处理。

## 用到的技术
- 单文件、零依赖；WebGL2 优先，自动回退 WebGL1。着色器统一用 GLSL ES 1.00，两种上下文都能用。
- 欧拉网格流体（Stam 稳定流体）：半拉格朗日平流、curl + 涡量约束（CURL=30）、可选隐式粘度 Jacobi（14 次）、散度（壁面反射）、压力衰减 + 24 次 Jacobi 压力迭代、减梯度投影。染料耗散按 `/(1+d·dt)`；"染料保留度"映射为 `0.04 + 3.2·(1−p)²`。
- 浮点纹理格式探测：WebGL2 依次试 R/RG/RGBA16F，再试 32F；WebGL1 依次试 half_float，再试 float 扩展，每种都用 `checkFramebufferStatus` 实测；不支持线性过滤时启用着色器内 bilerp。
- 双分辨率：模拟 176、染料 1024、泛光 320（低端设备 128 / 640 / 224）；DPR 上限 2；窗口缩放时用 copy 着色器重投影场并按比例换算速度，画面不拉伸、不清空；处理 WebGL 上下文丢失与恢复。
- 后期：软膝阈值预滤 + 双 Kawase 下采样/上采样泛光（最多 6 级）、按染料亮度梯度与径向的色差、由染料高度场算出的光泽高光、饱和度 ×1.18、ACES 色调映射、暗角、线性空间叠加 #050508 底色、gamma、胶片颗粒。
- 染料注入：HDR 高斯 splat + 值噪声打碎成丝状；三套主题（Cyberpunk / Thermal Inferno / Bioluminescent Deep），每套 4 色，线性空间停留-平滑循环，切换时调色板按帧插值并触发一次环形爆发。
- 闲置氛围：三个 Lissajous 游走源 + curl-noise 环境力（强度随闲置程度增加）+ 1.4–3.2 s 随机自动爆发（单点、对撞、环形）。
- 交互：Pointer Events 统一鼠标和触屏；路径插值（每帧最多 12 段）、速度映射与钳制；轻点 = 环形爆发 + 中心点。
- HUD：玻璃拟态面板，三个滑杆（粘度、染料保留度、喷溅半径）+ 清屏、切主题；3 s 自动隐藏（悬停、按住、键盘焦点时保持），隐藏后留小圆点入口；快捷键 H / T / C / 空格；顶部提示条 6.5 s 后淡出；fps 与格式信息显示在底栏。

## 证据文件（evidence/）
- `oneshot-desktop.png`、`oneshot-phone.png`：oneshot 首版，控制台 0 报错。
- `oneshot-hud.png`：oneshot 的 HUD 展开，可见底栏溢出。
- `drag-before-fix.png`：修前的触屏拖动测试（仅改了 CSS、输入逻辑与 oneshot 相同的中间版），轨迹后段丢失。
- `fixed-interact.png`：中间版上测清屏 + 切 Thermal Inferno 主题 + 拖动，0 报错。
- `fixed-desktop.png`、`fixed-phone.png`、`fixed-drag.png`：最终 fixed 版，控制台 0 报错，底栏不溢出，拖动轨迹完整。
