// 「资产」区：v3 为第 6 条生成的 6 个模型。
// 数字来源：assets/v3/models.json（生成模型、原始面数、单价）、tools/model-stats.py（成品面数、贴图）、costs/ledger.md（金额）。
// 金额 = 参考图 + 图生 3D（+ 绑骨）；Seed3D 查不到公开单价，按 ¥6.0 预记（账本同口径）；绑骨每段动作按 hy-3d-rigging 上限 ¥7.2 记。
// rig：绑过骨的版本（腾讯 TokenHub hy-3d-rigging，每段动作一个 FBX，tools/rig-merge.py 用 Blender 合进一个 GLB）。查看器加载这一份并能切换动作。
window.ASSETS = [
  { key: 'odysseus', zh: '奥德修斯', role: '主角', gen: 'Tripo H3.1', via: '阿里百炼 · 图生 3D', ref: 'qwen-image-2.0-pro', cost: 47.9, costNote: '参考图 ¥0.5 + 3D ¥4.2 + 绑骨 6 段 ¥43.2',
    tris: 29998, rawTris: 1459832, bytes: 1397156, tex: '2K WebP × 3', post: 'gltf-transform 减面 + 贴图转 WebP', yaw: -90,
    rig: { file: 'odysseus-rigged.glb', yaw: 0, bytes: 2186540, clips: '待机、走、跑、闪避、倒下、欢呼', bones: 28 } },
  { key: 'polyphemus', zh: '独眼巨人', role: '反派', gen: 'Seed3D 2.0', via: '火山方舟 · 图生 3D', ref: 'wan2.7-image-pro', cost: 36.3, costNote: '参考图 3 张 ¥1.5 + 3D ¥6.0（预记）+ 绑骨 4 段 ¥28.8',
    tris: 64025, rawTris: 499989, bytes: 4084116, tex: '2K WebP × 2', post: 'Blender 把生成出的双眼盖成皮肤、额头补一只眼，合并顶点后减面；贴图转 WebP', yaw: 0,
    rig: { file: 'polyphemus-rigged.glb', yaw: 90, bytes: 6514924, clips: '待机、跑、蓄力砸地、怒吼', bones: 28 } },
  { key: 'ship', zh: '船', role: '逃生船', gen: 'Tripo H3.1', via: '阿里百炼 · 图生 3D', ref: 'qwen-image-2.0-pro', cost: 4.7, costNote: '参考图 ¥0.5 + 3D ¥4.2',
    tris: 30000, rawTris: 1455829, bytes: 1460652, tex: '2K WebP × 3', post: 'gltf-transform 减面 + 贴图转 WebP', yaw: 0 },
  { key: 'cave', zh: '山洞', role: '补给点', gen: 'Seed3D 2.0', via: '火山方舟 · 图生 3D', ref: 'qwen-image-2.0-pro', cost: 6.5, costNote: '参考图 ¥0.5 + 3D ¥6.0（预记）',
    tris: 30000, rawTris: 500000, bytes: 1994124, tex: '2K WebP × 2', post: 'Blender 合并顶点 + 减面；贴图转 WebP', yaw: 0 },
  { key: 'olive', zh: '橄榄树', role: '种 25 棵', gen: 'Tripo H3.1', via: '阿里百炼 · 图生 3D', ref: 'qwen-image-2.0-pro', cost: 4.7, costNote: '参考图 ¥0.5 + 3D ¥4.2',
    tris: 5000, rawTris: 1373978, bytes: 603468, tex: '1K WebP × 3', post: 'gltf-transform 减面（要种 25 棵，压到 5 千面）+ 贴图转 WebP', yaw: 0 },
  { key: 'cypress', zh: '柏树', role: '种 9 棵', gen: 'Tripo H3.1', via: '阿里百炼 · 图生 3D', ref: 'qwen-image-2.0-pro', cost: 4.7, costNote: '参考图 ¥0.5 + 3D ¥4.2',
    tris: 3002, rawTris: 1443888, bytes: 327112, tex: '1K WebP × 3', post: 'gltf-transform 减面（要种 9 棵，压到 3 千面）+ 贴图转 WebP', yaw: 0 },
];
