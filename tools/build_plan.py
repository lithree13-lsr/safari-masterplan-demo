"""画示例总平面图（学习版的虚构园区），输出三种清晰度：
  assets/plan/base-lqip.webp  400 宽，模糊，几 KB —— 打开页面立刻显示
  assets/plan/base-2040.webp  中图
  assets/plan/base-4080.webp  大图，放大看细节
正式项目里这一步换成：从 CAD / 渲染软件导出高清总图，再用同样的方式切成三种尺寸。

运行：python3 tools/build_plan.py
"""
import random, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from geom import ROOT, load_source, zone_outline, catmull

random.seed(7)
src = load_source()
W, H = src["canvas"]
OUT = ROOT / "assets" / "plan"

KIND = {  # 每类分区的底色
    "forest": (142, 165, 104), "plaza": (226, 218, 200), "lush": (160, 186, 116),
    "savanna": (206, 204, 148), "desert": (238, 222, 186), "oasis": (150, 190, 120),
}

img = Image.new("RGB", (W, H), (214, 203, 180))
d = ImageDraw.Draw(img)

# 园外：农田条带和两条公路
for i in range(0, W, 260):
    d.rectangle([i, 0, i + 200, 260], fill=(200, 194, 160))
    d.rectangle([i, H - 230, i + 200, H], fill=(205, 196, 168))
d.line([(4950, 0), (4950, H)], fill=(120, 118, 112), width=70)
d.line([(4950, 0), (4950, H)], fill=(235, 230, 215), width=4)
d.line([(0, 3300), (W, 3300)], fill=(150, 146, 136), width=40)

# 园区底色 + 各分区
d.polygon([tuple(p) for p in zone_outline({"poly": src["boundary"]})], fill=(228, 219, 196))
zones = src["zones"]
zmask = Image.new("L", (W // 4, H // 4), 0)  # 1/4 尺寸的分区编号图，用来判断一个点落在哪个区
zm = ImageDraw.Draw(zmask)
for idx, z in enumerate(zones, start=1):
    outline = zone_outline(z)
    d.polygon([tuple(p) for p in outline], fill=KIND[z["kind"]])
    zm.polygon([(x / 4, y / 4) for x, y in outline], fill=idx)
zmask = np.array(zmask)
zone_of = lambda x, y: zones[zmask[int(y) // 4, int(x) // 4] - 1]["kind"] if 0 <= x < W and 0 <= y < H and zmask[int(y) // 4, int(x) // 4] else None

# 沙丘纹理
for _ in range(900):
    x, y = random.uniform(1500, 4800), random.uniform(1600, 3150)
    if zone_of(x, y) != "desert":
        continue
    r = random.uniform(60, 200)
    d.arc([x - r, y - r * 0.45, x + r, y + r * 0.45], 200, 340, fill=(222, 200, 160), width=6)

# 草原上的草丛斑点
for _ in range(9000):
    x, y = random.uniform(2800, 4800), random.uniform(300, 1800)
    if zone_of(x, y) == "savanna":
        r = random.uniform(3, 9)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(186, 186, 128))

# 水面：步行区的河马湖、绿洲
blocked = Image.new("L", (W, H), 0)  # 不能种树的地方（路、水、建筑）
bd = ImageDraw.Draw(blocked)
lake = catmull([[2050, 1050], [2350, 980], [2560, 1120], [2420, 1300], [2120, 1290], [2050, 1050]], 10)
d.polygon([tuple(p) for p in lake], fill=(118, 172, 186), outline=(92, 140, 150), width=8)
bd.polygon([tuple(p) for p in lake], fill=255)
ox, oy, _ = next(z for z in zones if z["id"] == "OA")["circle"]
d.ellipse([ox - 330, oy - 330, ox + 330, oy + 330], fill=(110, 170, 190), outline=(86, 140, 156), width=10)
d.ellipse([ox - 175, oy - 175, ox + 175, oy + 175], fill=(170, 196, 128))
bd.ellipse([ox - 340, oy - 340, ox + 340, oy + 340], fill=255)

# 道路：先画深色路缘再画浅色路面
for r in src["routes"]:
    line = [tuple(p) for p in catmull(r["pts"])]
    wide = 30 if r["id"] == "walk" else 44
    d.line(line, fill=(190, 172, 140), width=wide + 10, joint="curve")
    d.line(line, fill=(244, 236, 220), width=wide, joint="curve")
    bd.line(line, fill=255, width=wide + 60)

# 建筑：阴影 + 屋顶
for b in src["buildings"]:
    x, y = b["at"]
    w, h = b["size"]
    if b["id"] == "B3":
        continue  # 绿洲亭在下面单独画（圆形）
    d.rectangle([x - w / 2 + 18, y - h / 2 + 22, x + w / 2 + 18, y + h / 2 + 22], fill=(150, 140, 120))
    d.rectangle([x - w / 2, y - h / 2, x + w / 2, y + h / 2], fill=(246, 242, 232), outline=(170, 160, 140), width=5)
    d.line([(x - w / 2, y), (x + w / 2, y)], fill=(222, 214, 198), width=6)
    bd.rectangle([x - w / 2 - 40, y - h / 2 - 40, x + w / 2 + 40, y + h / 2 + 40], fill=255)
d.ellipse([ox - 110, oy - 100, ox + 130, oy + 140], fill=(120, 140, 100))
d.ellipse([ox - 120, oy - 120, ox + 120, oy + 120], fill=(247, 240, 226), outline=(176, 160, 136), width=6)
for a in range(0, 360, 30):
    d.line([(ox, oy), (ox + 120 * math.cos(math.radians(a)), oy + 120 * math.sin(math.radians(a)))], fill=(226, 214, 192), width=4)
bd.ellipse([ox - 200, oy - 200, ox + 200, oy + 200], fill=255)
blocked = np.array(blocked)

# 树：按分区决定密度和颜色，避开路、水、建筑
DENSITY = {"forest": 3600, "lush": 3000, "savanna": 420, "plaza": 260, "desert": 90, "oasis": 0}
GREENS = [(74, 104, 58), (88, 120, 66), (64, 94, 54), (102, 132, 74)]
trees = []
for kind, n in DENSITY.items():
    placed = 0
    for _ in range(n * 12):
        if placed >= n:
            break
        x, y = random.uniform(300, 4800), random.uniform(300, 3150)
        if zone_of(x, y) != kind or blocked[int(y), int(x)]:
            continue
        r = random.uniform(14, 34) if kind in ("forest", "lush") else random.uniform(18, 42)
        trees.append((x, y, r))
        placed += 1
# 绿洲水边一圈棕榈
for a in range(0, 360, 9):
    rr = 360 + random.uniform(-10, 25)
    trees.append((ox + rr * math.cos(math.radians(a)), oy + rr * math.sin(math.radians(a)), random.uniform(16, 24)))
# 枣椰大道
for yy in range(2380, 3100, 70):
    trees += [(860, yy, 20), (980, yy, 20)]

trees.sort(key=lambda t: t[1])
for x, y, r in trees:  # 先阴影后树冠
    d.ellipse([x - r + r * 0.35, y - r + r * 0.45, x + r + r * 0.35, y + r + r * 0.45], fill=(120, 112, 88))
for x, y, r in trees:
    c = random.choice(GREENS)
    d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    d.ellipse([x - r * 0.55, y - r * 0.65, x + r * 0.15, y + r * 0.05], fill=tuple(min(255, v + 26) for v in c))

# 轻微的纸面颗粒
noise = (np.random.default_rng(3).normal(0, 5, (H, W, 1))).astype(np.int16)
arr = np.clip(np.array(img).astype(np.int16) + noise, 0, 255).astype(np.uint8)
img = Image.fromarray(arr).filter(ImageFilter.SMOOTH)

OUT.mkdir(parents=True, exist_ok=True)
img.resize((4080, 2760), Image.LANCZOS).save(OUT / "base-4080.webp", quality=82, method=6)
img.resize((2040, 1380), Image.LANCZOS).save(OUT / "base-2040.webp", quality=80, method=6)
img.resize((400, 271), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2)).save(OUT / "base-lqip.webp", quality=60)
for f in sorted(OUT.glob("*.webp")):
    print(f.name, round(f.stat().st_size / 1024), "KB")
