"""把 park_source.json 转成网页直接能用的 data/park.js（window.PARK = {...}）。
用 .js 而不是 .json，是为了双击 index.html 在本地打开时也能读到数据（file:// 下 fetch 会被浏览器拦）。
平滑后的坐标与 build_plan.py 画图用的完全一致，所以网页上的轮廓线能和底图严丝合缝。

运行：python3 tools/build_data.py
"""
import json
from geom import ROOT, load_source, zone_outline, catmull

src = load_source()

zones = []
for z in src["zones"]:
    o = zone_outline(z)
    xs, ys = [p[0] for p in o], [p[1] for p in o]
    zones.append({
        "id": z["id"], "name": z["name"], "en": z["en"], "parent": z.get("parent"),
        "tagline": z["tagline"], "desc": z["desc"], "tags": z["tags"],
        "outline": o[::2] if len(o) > 60 else o,              # 隔点取样，数据更小，肉眼看不出区别
        "bbox": [min(xs), min(ys), max(xs), max(ys)],
        "label": z.get("label") or [round(sum(xs) / len(xs)), round(sum(ys) / len(ys))],   # 默认放在中心，可在源数据里指定
    })

routes = [{**{k: r[k] for k in ("id", "name", "sub", "color")}, "path": catmull(r["pts"], 8)} for r in src["routes"]]

park = {
    "canvas": src["canvas"],
    "zones": zones,
    "experiences": src["experiences"],
    "routes": routes,
    "buildings": [b for b in src["buildings"] if b.get("model")],
    "attractions": src.get("attractions", []),
    # 道路分析图：每条路按等级给样式，折线平滑成曲线（两点的直路保持直线）
    "road_classes": src.get("road_classes", {}),
    "roads": [{"id": r["id"], "class": r["class"], "path": catmull(r["pts"], 8) if len(r["pts"]) > 2 else r["pts"]} for r in src.get("roads", [])],
    "nodes": src.get("nodes", []),
}

out = ROOT / "data" / "park.js"
out.write_text("// 由 tools/build_data.py 生成 —— 不要手改，改 tools/park_source.json 后重新运行\nwindow.PARK = "
               + json.dumps(park, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(out.relative_to(ROOT), round(out.stat().st_size / 1024, 1), "KB")
