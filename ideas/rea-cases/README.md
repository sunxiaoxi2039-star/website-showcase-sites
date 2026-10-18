# REA 逆向案例展厅（rea-cases）

## 简介

GitHub 两周冲到 30 万 Star 的逆向工程开源神器 **REA（reverse-engineer-anything）** 的可视化存档页。源自信源公众号「逛逛GitHub」2026-10-18 的文章，做成 CRT 终端磷光绿风格的案例展厅：9 个网友实战案例 + 封号风险提示 + 原理拆解（Ghidra / JADX / Wakaru / MCP）+ 安装教程。

- 预览（GitHub Pages）：`https://sunxiaoxi2039-star.github.io/website-showcase-sites/ideas/rea-cases/`
- 源文章：`https://mp.weixin.qq.com/s/j99L5qfSPSMB9L8-25Qjdg`
- REA 仓库：`https://github.com/morluto/rea`（MIT）

## 收录内容

| 区块 | 内容 |
|---|---|
| Hero | 项目数据条（300K+ Star / Trending #1 / v6.5.0 / MIT）+ 项目截图 |
| 风险提示 | 网友用 Codex 接 REA 做逆向，2022 年注册的 OpenAI 老号被封（@Vincent_AINotes） |
| 案例 01–09 | 智能马桶状态栏遥控 / 大富翁4 进 iPhone / Claude 背景动画复刻 / 录屏自动缩放 / 电视控制面板 / BaoCut 接入幻灯片编辑器 / ClearSpace（CleanMyMac 平替）/ 离线语音输入 / 网页唤起 Codex 评论框 |
| 原理 | Ghidra（二进制）、JADX（APK）、Wakaru（JS 重建）、Hopper/IDA；REA 以 MCP 接给 Agent 的调查循环 |
| 安装 | `npx rea-agents@latest setup`（页面带一键复制） |

## 技术说明

- 纯手写单文件 HTML，无框架无构建；等宽字体 + CRT 扫描线 + 荧光绿辉光 + 开机引导动画。
- 图片为原文微信图床（mmbiz.qpic.cn）外链；本地完整资产版（图片已下载打包、不怕失效）在 Kimi 侧交付。
- 原文小标题写「网友 12 个案例」，正文实际只有 9 个，页面按实际收录。

## 分类

- 类型：网站设计 - ideas（内容存档型 / 文章可视化 / 案例展厅）

## 更新时间

- 2026-10-18 收录
