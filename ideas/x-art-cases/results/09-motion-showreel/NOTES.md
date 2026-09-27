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
