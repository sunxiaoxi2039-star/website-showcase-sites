# 网站灵感合集 当前状态
> 最后更新　2026-09-21　ZCode

## 已实现与验证

- 第一站 Moonlit Forge 已实现 Blender 模型、Three.js 六场景、拖动旋转、滚动切换、暂停与重置。
- 2026-09-05 本地类型、lint、构建通过；浏览器六场景、拖动、暂停、重置、滚动通过；390×844 视图无横向溢出、控制台无错误。模型通过独立 Blender 导入。
- Sites 第一版于 2026-09-05 返回部署成功： https://xiaoxi-moonlit-forge.sun-xiaoxi.chatgpt.site ，仅拥有者访问。后续光照与切换修正已入源码；不把源码版本等同于当前已部署版本。本轮只收藏，不改 Sites。
- 2026-09-19 小茜要求“放到 git 上收藏”，已保存到 GitHub 私有仓库 https://github.com/sunxiaoxi2039-star/moonlit-forge 。main 远端 SHA 与本地一致：`29602baec31f1d53799c82a4dc5d33b19a78bbbf`。
- 收藏包含网站代码、运行 GLB、可编辑 .blend、模型重建/校验脚本和预览图。原微博视频、node_modules、构建缓存与临时凭据未上传。

## 尚未完成

- 第二站尚缺第二条微博链接，未建立第二个复刻成品。
- 原站只有视频参考，无源码/原模型；本项目是重新建模的复刻，非逐像素副本。

## 唯一下一步

收到第二条微博链接后确认对应网站，继续第二站复刻。

## 恢复

本地子站：`ideas/moonlit-forge/`，独立 Git；GitHub remote 名 `github`，Sites remote 名 `sites`，互不覆盖。
异机恢复：`git clone https://github.com/sunxiaoxi2039-star/moonlit-forge.git`，按子站 README 运行。
父项目公开 origin 本轮没有推送；源视频和本地取证原件仍在 `reference/guizang-20260905/`。

## 2026-09-19 今日网站并入展示页

- SELENE：成品加入 `ideas/selene/`，真实子目录加载、纹理与车辆行驶通过；统一画廊点击进入通过。已公开发布，正式页面行驶与纹理加载验证通过。
- Habitat：已由原任务发布至同一仓库 `ideas/habitat/`；远端发布提交 `1539de387bafd36a7f9cea4d6074476099dfe07b`。画廊已发布提交 `19068dbb5a820a8141b198be0b8ba80746c5a094`。
- Moonlit Forge：沿用现有 Sites 网页；原任务负责按其授权公开小屋展卡。私有源码与 Blender 快照只保存于本地 `sources/moonlit-forge/`，已 Git 忽略，绝不随公开网页提交。原私有仓库与历史保留。
- 本地可编辑源码还在 `ideas/selene/source/`、`ideas/habitat/source/`，均不随公开仓库推送。没有新建网站独立仓库。
- 合集预览：http://127.0.0.1:5180/website-gallery/ 。启动：`python3 -m http.server 5180 --bind 127.0.0.1 --directory "/Volumes/X10 Pro/site-repos"`。

## 2026-09-21 公开上线验收

SELENE 及统一画廊全部已 push，并通过 GitHub Pages 部署。子站发布版本 7548860；画廊发布版本 827b326。正式入口 https://sunxiaoxi2039-star.github.io/website-gallery/ 。从首页进入月面车、车辆持续行驶、地球纹理 200、三个 Prompt 显示与完整复制、手机无横向溢出均验证通过，无页面运行错误。Kimimotion 链接已改到有效 Kimi 站。没有新建独立仓库，私有源码及 Blender 快照未公开。

## 2026-09-21 Astra 对照站两 PR 并入（ZCode）

- 按小茜指令合并两仓 PR#1（分支 claude/astra-portfolio-website-917idn，Claude 的 Astra×Opus 临摹站）。两 PR 均与 main 冲突：本仓撞首页列表，画廊撞 EXHIBITIONS 同一插入位。
- 本仓：入口五条全保留（Motion / Moonlit Forge / Habitat / SELENE / Astra），PR 分支解冲突 merge 提交 `ba4a7d1`，合并提交 `fa203f3`。
- 画廊：以 main 最新渲染（Callen 的 prompt-box 系统）为底收入 8 条 Astra 展览，每条补 `promptLabel`；PR 自带的旧渲染（pwrap/exhibit-row）弃用以免倒退覆盖。PR 分支 merge 提交 `24ba266`，合并提交 `5968800`，画廊现为 14 条展览。
- 验证：两 PR GitHub 状态 MERGED；线上画廊 14 条、Astra 封面与入口加载正常。过程与截图见 `log/2026-09-21.md`。
- 小茜预期为 11 条，实际 14 条 = main 侧 6 条（她在 PR 开出后又收入 Habitat、SELENE、四季小屋）+ Astra 8 条，已当面说明。
