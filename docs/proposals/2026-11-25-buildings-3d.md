# 方案：建筑 3D 卡片（2026-11-25）

## 目标
在总平面图上点击建筑名，弹出一张卡片，背景是这栋建筑的 3D 模型在缓慢旋转；点「进入 3D」可以全屏查看，提供「重置 / 俯视 / 正面」三个视角。

## 做法
- 3D 组件用 Google 的 `<model-viewer>`（底层是 three.js），文件放在 `assets/vendor/model-viewer/`，不依赖外部 CDN。
- **按需加载**：第一次打开建筑卡片时才加载 model-viewer 脚本，首页和总图不受影响。
- 模型格式 `.glb`，每个模型控制在 2 MB 以内。正式项目流程：
  Revit / SketchUp / Rhino → 导出 → Blender 清理（删内部构件、合并材质、减面）→ glTF → `gltf-transform` 压缩（Draco + WebP 贴图）。
- 学习版用 `tools/build_models.py` 生成简单的体块模型代替。

## 改动的文件
- 新增 `js/bcard.js`
- `js/app.js`：建筑图钉点击时调用 `BCard.open(id)`
- `tools/park_source.json`：建筑增加 `model` 字段
- `css/app.css`：卡片样式

## 风险
- 手机性能：模型太大时会卡顿 → 控制面数和贴图尺寸。
- 不支持 WebGL 的设备 → 显示提示文字，不报错。
