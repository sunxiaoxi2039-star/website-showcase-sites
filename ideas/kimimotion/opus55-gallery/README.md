# OPUS 5.5 案例墙

> 一览无余的案例驾驶舱：519 个 Claude Opus 5.5 真实案例全部平铺在一个页面，每张卡 = 缩略图 + 原作者标签 + Prompt 全文 + 一键复制 + 批注

## 构成（519 个案例）

| 合集 | 数量 | 来源 | Prompt |
|---|---|---|---|
| 3D 神作 | 5 | riba2534（鹈鹕/QQ飞车/CF运输船）、SilentFleetKK（清明上河图）、X 原帖（水体模拟） | 4 个有作者原文，水体未公开（如实标注，不编造） |
| Lemomo 39 风格 | 39 | [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) | STYLE.md 原文完整 |
| Yihui 实测合集 | 475 | [yihui-dev/awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos)（$3000 / 301→475 支） | 279 完整 + 196 部分公开（逐条标注） |

## 页面规则

- **一览无余**：单页全平铺 + 无限滚动，不做二级目录；合集/类型/技术只是卡片上的标签和顶部筛选
- **每张卡**：缩略图（点击看原作/复刻对照）→ 名称 → 作者标签（可点）→ 类型与技术标签 → Prompt 盒（滚动即读 + 一键复制 + 公开程度徽标）→ 批注 → 链接
- **知识讲解**单独成页：`learn.html`（拆解课堂），案例卡上只留小批注
- **Prompt 诚实标注**：原文完整 / 部分公开 / 逆向整理 / 未公开，四档徽标

## 数据与结构

```
index.html          # 案例墙（唯一入口）
learn.html          # 拆解课堂：名词速通 + 案例精读 + 九段式写作法
pk-battle.html      # PK 擂台：Opus 5.5 vs Kimi 2.8 同屏对跑
catalog.html        # Lemomo 88 帧海洋（旧案例库，保留）
data/cases.json     # 519 个案例的统一数据（唯一事实源，加案例=加一行）
assets/posters/     # 475 张 Yihui 合集封面（本地化）
opuscar-styles/     # Lemomo 39 风格 poster + 88 帧静画
prompts/            # 39 个风格 STYLE.md 本地化
opus-demos/         # art-deco / blueprint 可播放代码短片
assets/             # 3D 案例截图（QQ飞车/CF 为 demo 实跑截图，清明上河图来自作者仓库，水体为原文视频封面）
```

## 技术

- 纯静态零依赖：原生 HTML/CSS/JS，数据驱动渲染（cases.json + fetch）
- 图片全部本地化，GitHub Pages / ok.kimi.link 直接部署
- 深色电影感配色，移动端单列自适应

## 部署

整个目录拷入 Kimimotion 站点（如 `kimimotion/opus55-gallery/`）。
GitHub 侧同步至 `website-showcase-sites` 仓库 `ideas/kimimotion/opus55-gallery/`。
