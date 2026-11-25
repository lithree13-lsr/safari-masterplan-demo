# Safari Park 总规划 · 学习版

一个可交互的园区总规划展示网站的最小完整版本，用来学习「交互式总规划网站」是怎么做出来的。园区是虚构的。

功能：首页 → 可拖动、缩放的总平面图 → 分区（点开看详情）→ 图层（游线、体验点）→ 建筑 3D 卡片（model-viewer，底层是 three.js）。

## 项目结构

```
index.html                 页面骨架
css/app.css                全部样式
js/camera.js               相机：拖动、缩放、惯性、飞行动画
js/app.js                  首页、分区、图层、详情卡、网址状态
js/bcard.js                3D 建筑卡片（按需加载 model-viewer）
data/park.js               网页数据（脚本生成，不要手改）
assets/plan/               底图三种清晰度（脚本生成）
assets/models/             3D 模型 .glb（脚本生成）
assets/vendor/model-viewer 3D 组件（来自 npm 包 @google/model-viewer）
tools/park_source.json     设计原始数据 ← 改内容改这里
tools/build_*.py           把原始数据变成底图、网页数据、3D 模型
docs/proposals/            每个大功能的方案文档
CLAUDE.md                  给 AI 编程助手看的项目说明
```

数据流：

```
park_source.json ──build_plan.py──▶ assets/plan/*.webp   （底图）
                 ──build_data.py──▶ data/park.js         （分区轮廓、游线、建筑）
                 ──build_models.py▶ assets/models/*.glb  （3D 模型）
                                         │
                         index.html + js/*.js 读取并显示
```

## 在自己电脑上运行

```bash
git clone https://github.com/lithree13-lsr/safari-masterplan-demo.git
cd safari-masterplan-demo
python3 -m http.server 8000      # 然后浏览器打开 http://localhost:8000
```

改了 `tools/park_source.json` 之后重新生成：

```bash
pip install pillow numpy trimesh
./tools/build_all.sh
```

## 部署（GitHub Pages）

纯静态网站，不需要打包。仓库 Settings → Pages → Source 选 `Deploy from a branch`，分支 `main`，目录 `/ (root)`，保存后一两分钟生成网址：

`https://lithree13-lsr.github.io/safari-masterplan-demo/`

之后每次 `git push`，网站会自动更新。

## 缩放不闪烁的关键

- 只有底图在缩放层里（CSS `transform`）。
- 线条在屏幕大小的 SVG 里，用 `vector-effect: non-scaling-stroke`。
- 文字和图钉是普通 HTML 元素，每次相机变化时按屏幕坐标重新摆放，本身不缩放。

## 下一步可以加什么（由易到难）

1. 换成真实的总平面图和分区数据（从 CAD/PDF 导出）。
2. 照片：分区卡片里的图片轮播、全屏看图。
3. 网页内标注工具：在图上点选坐标，直接生成 JSON。
4. 游客旅程模式：按站点顺序自动飞行讲解。
5. 登录：GitHub Pages 只能放静态文件，做不了真正的服务端密码。需要私密访问时换到 Cloudflare Pages（加 Functions 校验密码）或 Vercel。
6. 真实建筑模型：Revit/SketchUp → Blender 清理 → glTF → `npx @gltf-transform/cli optimize in.glb out.glb --compress draco`。
7. 整园 3D：直接用 three.js（或 React Three Fiber），加地形和成片的树。
