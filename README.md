# 网站灵感合集：website-showcase-sites

这个仓库用于放「素材积累 / 临摹 / 实验」类型网站，统一按子目录管理，不塞进仓库根目录。

## 目录结构

```text
website-showcase-sites/
├─ index.html               # 仓库主页入口（可选站点列表）
├─ ideas/
│  ├─ motion-sites-ai/      # 示例：临摹站 / 素材聚合站
│  └─ ...
└─ 其他灵感站子目录...
```

## 分类规则（项目路由）

- **网站设计 - ideas**：素材积累型、临摹型、灵感库用途，统一放到 `ideas/<slug>/`。
  - 例：`motion-sites-ai`
- **长期维护型**：持续迭代、对外主项目形态，保留独立仓库。
  - 例：`AI Immigrant`（已发布）、`holo-gallery`（未发布）

> 默认先入 `ideas`，确认长期维护后再升格成独立项目。

## 每个 `ideas/<slug>/` 要求

每个子站建议都放一个 `README.md`，包括：

- 简短介绍（这个站是做什么的）
- 技术栈（如果有）
- 发布链接（GitHub Pages）
- 最近更新日期
- 备注（素材来源、使用方式、后续动作）

## 聚合站对接

`website-gallery` 作为展示入口（聚合站）只需要在 `index.html` 的 `EXHIBITIONS` 里新增一条卡片：

- `title`：站点名称
- `sub`：副标题
- `desc`：一句介绍
- `cover`：封面图 URL
- `intl`：GitHub Pages 链接（国际）
- `china`：可选，中国入口
