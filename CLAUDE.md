# Safari Park 总规划演示（学习版）

给 AI 编程助手看的项目说明。每次开始工作前先读这份文件，改动必须遵守这里的约定。

## 这是什么
一个可交互的园区总规划展示网站：可缩放的总平面图、分区卡片、图层（游线）、带 3D 模型的建筑卡片。
纯静态网站（原生 HTML/CSS/JS，没有框架、没有打包步骤），直接部署在 GitHub Pages。

## 坐标系（最重要）
- 所有位置都用「底图像素」：画布 5100 × 3450，原点在左上角。
- 分区边界、游线、建筑、体验点都用这个坐标，不使用经纬度。

## 渲染规则（缩放不闪烁的关键）
- 只有底图放在缩放层 `#world` 里，用 CSS `transform: translate() scale()` 缩放。
- 线条画在与屏幕一样大的 SVG（`#overlay`）里，统一用一个相机 `<g>`，线条加 `vector-effect: non-scaling-stroke`。
- 文字标签和图钉是普通 HTML 元素，每帧按屏幕坐标重新定位，本身不缩放。
- 缩放层里不放文字、不加模糊、不加每帧变化的样式。

## 文件结构
- `index.html`：页面结构
- `css/app.css`：全部样式
- `js/camera.js`：相机（拖动、缩放、惯性、飞行动画）
- `js/app.js`：首页、分区、图层、详情卡、网址状态
- `js/bcard.js`：3D 建筑卡片（model-viewer 按需加载）
- `data/park.js`：**由 `tools/build_data.py` 生成，不要手改**
- `assets/plan/`：**由 `tools/build_plan.py` 生成**（模糊小图 → 中图 → 大图）
- `assets/models/`：**由 `tools/build_models.py` 生成**的 .glb 模型
- `tools/park_source.json`：设计原始数据（相当于从 CAD/Excel 导出的资料），改内容就改这里，然后重跑脚本
- `docs/proposals/`：每个大功能先写方案（文件名：日期-功能.md），确认后再实现

## 风格
- 深色底 `#0f0d0a`，强调色 `#d9774a`
- 标题字体 Cormorant Garamond，正文 Albert Sans / Noto Sans SC
- 动画缓动统一用 `cubic-bezier(.2,.7,.2,1)`

## 工作方式
- 一个功能一个 JS 文件，通过 `window.XXX` 暴露给其他文件。
- 改动的原因写进注释，尤其是业主或评审的意见（注明日期）。
- 每完成一个小功能就 git 提交一次。
