# 09 · 动效设计师 Showreel（Motion Designer Showreel）

## 来源
- 原帖：@shneural（kirill sh），https://x.com/shneural/status/2103151003272962130（2026-09-24 发，2026-09-25 抓取）
- 原提示词：*make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out.*
- 本次模型：Claude Opus 5.5（Claude Code），独立生成，未参考其他案例代码。

## 时间
- 开始：2026-09-26 10:52:09
- 结束：2026-09-26 11:51:14
- 用时：约 59 分钟（含一次上下文压缩；首版因单次输出过长，分三段写入草稿区后一次性拼接成 oneshot/index.html）

## 一次成型情况
- **一次成型：是。** oneshot/index.html 写出后未做任何修改，未建 fixed/。
- 规定自检（1440×900 与 375×812，--wait 7000）两份 console 均为空，0 错误，画面正常。
- 额外自检：
  - `?board=1` 分镜总览，横屏 4×2、竖屏 2×4，8 个场景都能实时渲染
  - `?t=13.2&freeze=1` 转场中帧、`?t=14.2&freeze=1` 片尾卡
  - 程序化点击“Sound”后跑满 16.5 秒：音频时钟接管，画面随之推进到 t≈21.2s，已循环一轮以上，按钮变为“Sound on”，无脚本错误
- 证据截图全部在 `evidence/`。

## fixed 改了什么
- 无（未建 fixed/）。

## 已知问题
1. 长时间音频测试那次 console 多出一条 `favicon.ico 404`。原因是静态服务器根目录没有 favicon，不是页面脚本错误；两次规定自检中都没有出现。
2. 进入分镜模式后，前 12 秒的顶部操作提示（Click for sound…）会压住第一行分镜的标题文字；提示约 12 秒后自动淡出。
3. 字体只用系统字体（Helvetica Neue 系列 + 等宽栈）。在没有 Helvetica Neue Condensed 的系统上会退回普通 Helvetica/Arial，粗压缩字形的冲击力会弱一些。
4. 截图环境是软件渲染，实际帧率低于真机，画面时间以实时时钟为准，所以截图里的时刻比 --wait 略晚或略早；真机 60fps 无此问题。
5. 声音须点击后才开启（按要求不自动播放），无头截图里听不到，只验证了音频图能正常运行。

## 用到的技术
- **纯 Canvas2D + WebAudio**：零外部库、零外部字体、零素材。所有图形、字形动画、颗粒、声音都由代码生成。devicePixelRatio 上限 2。
- **时间线**：128 BPM，8 小节 × 4 拍，正好 15.0 秒，一小节一个场景，首尾无缝循环。
  - 01 HELLO：点 → 线 → 带 → 满屏
  - 02 KINETIC TYPE：挤压拉伸弹跳球 + 逐字动效标题 “I MAKE THINGS / MOVE”
  - 03 SHAPE MORPH：按弧长重采样的多边形，弹性缓动变形 圆 → 方 → 三角 → 星 → 圆，带矢量编辑器外框、锚点手柄和尺寸读数
  - 04 RHYTHM：斜线阵列随节拍涟漪翻转 + 16 步音序器
  - 05 DEPTH：透视隧道 + 穿镜头飞字
  - 06 TYPE AS TEXTURE：变速跑马灯文字墙 + 反相圆形遮罩
  - 07 MONTAGE：半拍一切的 8 个快切，difference 混合字，每切带小图示（缓动曲线、秒表等）
  - 08 END CARD：署名卡 + 墨色光圈收束成点，衔接回开头
- **转场**：按小节配置的遮罩转场（斜切 / 光圈 / 百叶 / 对开门 / 条带），用强调色遮罩接延迟裁切露出下一场；另有两处硬切。
- **镜头与后期**：底鼓同步的微震和 1.4% 缩放冲击；暗角；4 张程序化颗粒纹理轮换；difference 混合的取景器 HUD，包括 REC 点、24fps 时间码、场景名、BPM 拍点和进度条。
- **缓动库**：expo / cubic / back / elastic，外加逐字错峰（stagger）和遮罩显字。
- **声音**：WebAudio 实时合成的 128 步配乐，用 25ms 前瞻调度器排音。
  - 鼓组：底鼓、拍手、闭镲
  - 旋律与和声：贝斯、失谐锯齿和弦、琶音、提示音
  - 效果：噪声扫频、上升音、片尾冲击
  - 混音链：反馈延迟发送 + 压缩器总线
  - 开声后以 AudioContext 时钟为主时钟，音画严格对齐
- **交互与可访问性**：
  - 按键：空格暂停，M 静音，S 分镜，←/→ 切场景，Home 回到开头；分镜里点任一格即可跳转
  - URL 参数：`?t=`、`?freeze`、`?board`，另有 `window.__reel` 测试接口
  - 系统开启“减少动态效果”时，关闭镜头抖动和颗粒动画

## 复评

评的是一次成型版（oneshot/），逐条对着 prompt 看。截图在 evidence/critique-*.png。

| prompt 里的要求 | 做到没有 | 说明 |
|---|---|---|
| dynamic（动感） | 做到 | 128 BPM，一小节一个镜头，镜头内部也一直在动 |
| 15-second | 做到 | 正好 8 小节，合 15.0 秒，首尾能无缝接上 |
| motion graphics video | 部分 | 是能播的动态图形，但导不出视频文件，进度条也不能拖动，只算“能播的网页”，还不算“视频” |
| incredible motion designer | 做到 | 可变字、形状变形、遮罩转场、隧道、字墙、蒙太奇，覆盖了动效设计的常用手艺 |
| showreel for a résumé | 大体做到 | 有署名和年份，但缺求职信息（例如 available for work），片尾不像一份简历 |
| go all out | 部分 | 光影是平的：形状、隧道、放大镜都没有体积和光；切点只是硬切，没有剪辑后期；DEPTH 一场偏弱；控制按钮和提示条一直压着画面 |

另外查到的问题：
- favicon 404，控制台报 1 个资源错误。
- DOM 提示条有 12 秒压在画面上，打开分镜时还和分镜标题重叠。
- 蒙太奇和 HUD 用 difference 混合，混出了调色板以外的青色和黄色。
- 播放控件始终显示，挡住画面右下角。
- 片尾 CLAUDE 几个字母在窄屏上相撞。
- 减少动态模式下仍自动播放每秒约 4.3 次的快切，没有真正减少动态。
- 形状和隧道每帧都新建数组，产生 GC 抖动。
- 字体用系统字体栈，里面没有真正的窄体，所以“字宽变化”只是横向缩放。

**复评分：6 / 10。** 概念和节奏是对的，完成度和“go all out”那股劲还不够。

升级计划（按优先级）：
1. 先修错：favicon、提示条、difference 混色、控件遮挡、字母相撞、减少动态、每帧分配。
2. 补“视频”这层：一键录制导出 WebM（画面加声音），进度条可拖动。
3. 字体换成真正的可变字体，用 fontStretch 驱动字宽轴，让 HELLO、MOVE 和蒙太奇的字宽变化是真的。
4. 剪辑后期：切点的缩放拖影和色差，镜头内慢推，底鼓冲击缩放。
5. 补光：形状加辉光、渐变体积和高光；隧道加泛光、雾和曲速线；RHYTHM 音序器面板和放大镜加投影。
6. 简历感：片尾加 AVAILABLE FOR WORK — 2026 胶囊和一行定位语，光圈收尾加朱红镶边。

## 精修

final/ 从 oneshot/ 复制后改写，oneshot/ 一个字没动。

改了什么：
- **修错**
  - 加 `<link rel="icon" href="data:,">`，favicon 404 消失。
  - 删掉 DOM 提示条，改成 HUD 里的一行小字，不再压画面，也不再和分镜标题重叠。
  - 去掉所有 difference 混合。蒙太奇的反相改用调色板内的配对色（OV 映射），HUD 按每个场景的明暗在墨色和纸色之间渐变。
  - 控件 2.6 秒无操作后自动淡出，动鼠标、触摸或按键就回来；?clean=1 和录制时整套 HUD 与控件都不显示。
  - 片尾 CLAUDE 按实测字宽排版，字母不再相撞；分镜格子里的胶囊按格子高度夹住位置，不再压住定位语。
  - 减少动态模式下打开就是 8 张英雄帧的联系表，不自动播放。点格子或 Play 才开始，播放时去掉震动、推镜、拖影和冲击缩放，颗粒改为静态。
  - 形状和隧道的数组全部改成预先分配的 Float32Array，循环里不再新建对象。
- **视频化**
  - 新增 Rec 按钮：从头录满 15 秒，用 MediaRecorder 同时录画布 captureStream(60) 和合成器总线（MediaStreamDestination），结束后自动下载 claude-showreel-2026.webm。按 Esc 取消。不支持 MediaRecorder 的浏览器上隐藏这个按钮。
  - 进度条可以拖动（pointer capture），方向键按一拍前后跳，暂停时也能定位。
  - 有声时以 AudioContext 时钟为准，没声时用 performance.now；每次换时钟源都重新对齐时间轴，避免跳帧。
- **字体**
  - 换成 Archivo 可变字体（@fontsource-variable/archivo@5.3.0，jsDelivr 锁定版本），HUD 改用 JetBrains Mono（@fontsource/jetbrains-mono@5.3.0）。
  - 用 ctx.fontStretch 驱动 62% 到 125% 的字宽轴。HELLO 逐拍变宽，MOVE 用最窄，蒙太奇 8 个词各用一种字宽。
  - 字体 2.5 秒内没加载完就先用系统字体开播，不会卡住。
- **剪辑后期**
  - 切点后 0.18 秒内叠多层缩放拖影，加 multiply/lighter 做的红青分离；蒙太奇每半拍做一次，强度降到 0.65。
  - 每个镜头内慢推 3%，底鼓落下时再加 1.4% 的冲击缩放。
  - 暗角降到 0.26，加一层胶片颗粒。
- **光影**
  - I MAKE 的小球：径向渐变体积，加随高度缩放的接触阴影。
  - SHAPE MORPH：外发光、渐变体、高光。
  - DEPTH：双通道泛光、钴蓝距离雾、随车速拉长的曲速线。
  - RHYTHM 面板：四层叠加的软投影。
  - 放大镜：径向渐变投影。
  - 大面积的 shadowBlur 全部换成廉价写法，片尾小形状上的少量 shadowBlur 保留。
- **简历感**
  - 片尾加 AVAILABLE FOR WORK — 2026 胶囊和定位语。
  - 光圈收尾加朱红镶边，最后缩成一个点，接回开头的 HELLO。
- **无障碍**
  - 画布旁有 .sr 说明文字，aria-live 播报当前场景，REC 状态胶囊用 role=status。
  - 四个按钮都有 aria-label，并跟随 aria-pressed 状态。

怎么验证的：
- **截图**：用 tools/snap.mjs（同一套 CDP 截图脚本），截了 evidence/final-desktop.png（1440×900，4 秒）、final-desktop-late.png（11 秒，和前一张不同）、final-mobile.png（375×812）、final-reduced.png（--reduced 1，联系表）。对应的 console.txt 全部为空，即 0 报错、0 资源错误。
- **交互**：通过 `window.__reel` 在无头浏览器里逐项调用 seek、pause/play、board、exportStart/cancelExport 和方向键，检查 t 和状态都符合预期，控制台无报错。
- **海报**：`?t=…&freeze=1&clean=1` 定帧、1600×900 截图得到 poster.png，再用 sips 生成 poster.jpg 和 thumb.jpg。
- **性能**：这台机器上的无头 Chrome 走 SwiftShader 软件渲染，负载常在 350 以上，一次成型版和精修版都只有每场景约 4 到 6 帧，没法可靠比较。这里只能说明做过的事：每帧分配已经去掉，大面积 shadowBlur 已经换掉。真实 GPU 上的帧率要在正常浏览器里复测。
- **导出**：导出流程在无头环境下能正常开始和取消，但没有真的下载一份完整的 webm，所以录出来的画质和音画同步还没实测。
