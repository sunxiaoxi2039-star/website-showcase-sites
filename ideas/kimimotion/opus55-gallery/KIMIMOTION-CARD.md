# Kimimotion 首页卡片 · 待粘贴代码

## 1. Kimimotion 首页 EXHIBITIONS 数组新增条目

路径：`opus55-gallery/index.html`（请按实际部署路径调整 intl/china 地址）

```js
{
  title: "OPUS 5.5 灵感展厅",
  sub: "代码做 3D 与视频",
  desc: "Claude Opus 5.5 出圈案例精选：鹈鹕骑单车 3D、39 种代码短片风格、$3000 实测 301 支视频，提示词全开源。",
  cover: "opus55-gallery/assets/1_Pelican_Bike_a_browser_3D_cycling.jpg",
  intl: "https://<你的GitHub Pages域名>/opus55-gallery/",
  china: "https://<你的ok.kimi.link域名>/opus55-gallery/"
}
```

## 2. website-gallery（聚合站）EXHIBITIONS 卡片（可选）

```js
{
  title: "OPUS 5.5 灵感展厅",
  sub: "AI · 灵感收藏",
  desc: "Claude Opus 5.5 案例画廊：3D 交互 + 39 种代码生成短片风格 + 实测工作流资源索引。",
  cover: "ideas/kimimotion/opus55-gallery/assets/1_Pelican_Bike_a_browser_3D_cycling.jpg",
  intl: "https://<你的GitHub Pages域名>/opus55-gallery/",
  china: "https://<你的ok.kimi.link域名>/opus55-gallery/"
}
```

## 3. 部署清单

- [ ] 拷贝 `opus55-gallery/` 整个目录到 Kimimotion 站点根目录
- [ ] 在 Kimimotion 首页 EXHIBITIONS 数组粘贴卡片 1，重新发布
- [ ] GitHub 侧同步到 `website-showcase-sites/ideas/kimimotion/opus55-gallery/`
- [ ] （可选）在 website-gallery 聚合站粘贴卡片 2
