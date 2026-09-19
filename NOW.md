# 网站灵感合集 当前状态
> 最后更新　2026-09-19　Callen

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
