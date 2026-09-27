# data/ 目录的数据来源与授权

本目录里的文件（`buildings.bin`、`meta.json`、`ground.jpg`、`night.jpg`、`mask.png` 等）是离线生成的**派生数据**，不是手工绘制的。

## 建筑、道路、水系、用地、行政区

- 来源：[Overture Maps Foundation](https://overturemaps.org/) 发布的数据（building / segment / water / land_use / land_cover / land / division_area 图层），其中大部分要素源自 [OpenStreetMap](https://www.openstreetmap.org/copyright)。
- 源自 OpenStreetMap 的数据采用 [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/)；Overture 其余来源的数据采用 [CDLA-Permissive-2.0](https://cdla.dev/permissive-2-0/)。
- **按 ODbL 的相同方式共享要求，本目录中由上述数据派生的数据库，同样以 ODbL 1.0 提供。**
- 署名：© OpenStreetMap 贡献者；© Overture Maps Foundation。

## 地形

- 来源：[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)（Mapzen Terrarium 格式，z12，48 块瓦片），其底层数据包括 SRTM 等公开高程数据集；各来源的署名要求见 [Terrain Tiles 的数据来源说明](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)。

## 说明

- 约 83% 的建筑没有高度或层数记录，高度按面积、长宽比与用地类型**估算**，不代表真实楼高。
- 生成这些数据的处理步骤记录在同级目录的 `NOTES.md` 中。
