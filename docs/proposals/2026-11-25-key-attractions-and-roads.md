# 方案：重点景点（带 3D 模型）+ 道路系统分析图（2026-11-25）

## 一、重点景点

### 目标
在总图上用醒目的星形图钉标出重点景点，点击后弹出和建筑一样的 3D 卡片，展示自己的模型。

### 做法
- `tools/park_source.json` 新增 `attractions` 列表，每项：`id, zone, name, en, at, model, facts, desc`。
  - `model`：模型文件名（不含 .glb），文件放在 `assets/models/`。
  - `facts`：卡片上显示的几项数据，如 `[["高度", "14 m"], ["容量", "60 人"]]`。
- 3D 卡片（`js/bcard.js`）改成通用：建筑和景点共用。没有 `facts` 时显示面积和层数。
- 图层面板新增「重点景点」，默认打开；分区卡片里新增「重点景点」列表。

### 换成自己的模型
1. 从 SketchUp / Rhino / Revit / Blender 导出 glTF（.glb）。
2. 压缩：`npx @gltf-transform/cli optimize in.glb out.glb --compress draco --texture-compress webp`，目标 2 MB 以内。
3. 放进 `assets/models/`，在 `park_source.json` 里把 `model` 改成文件名，重跑 `tools/build_data.py`。

## 二、道路系统分析图

### 目标
像参考网站底部的「总图 / 建筑 / 景观 …」一样，加一个视图切换。切到「道路」时，底图压暗，按道路等级画出不同颜色、粗细、虚线的道路，并显示图例和关键节点（出入口、车站）。

### 做法
- `park_source.json` 新增：
  - `road_classes`：道路等级的样式（名称、颜色、线宽、虚线）。
  - `roads`：每条道路的 `class` 和折线点。
  - `nodes`：关键节点（出入口、车站）。
- SVG 相机层里新增：一张压暗底图的半透明矩形（`#wash`）和道路组（`#roads`）。线条全部 `non-scaling-stroke`，缩放时粗细不变。
- 节点用 HTML 图钉（不缩放），只在道路视图显示。
- 底部新增视图切换条；网址记录视图：`#v=roads`。

## 改动的文件
`park_source.json`、`build_data.py`、`build_models.py`、`index.html`、`css/app.css`、`js/app.js`、`js/bcard.js`、`CLAUDE.md`
