"""生成学习版的 3D 建筑体块模型（.glb）。
正式项目里这一步换成：Revit / SketchUp / Rhino 导出 → Blender 清理 → glTF → gltf-transform 压缩，
例如：npx @gltf-transform/cli optimize in.glb out.glb --compress draco --texture-compress webp

运行：python3 tools/build_models.py   （需要 pip install trimesh）
单位：米。Y 轴朝上（glTF 的约定）。
"""
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual import TextureVisuals
from geom import ROOT

OUT = ROOT / "assets" / "models"
OUT.mkdir(parents=True, exist_ok=True)

MAT = {
    "ground": PBRMaterial(baseColorFactor=[214, 200, 170, 255], roughnessFactor=1.0, metallicFactor=0),
    "wall":   PBRMaterial(baseColorFactor=[238, 230, 214, 255], roughnessFactor=0.9, metallicFactor=0),
    "roof":   PBRMaterial(baseColorFactor=[120, 92, 70, 255], roughnessFactor=0.8, metallicFactor=0),
    "glass":  PBRMaterial(baseColorFactor=[120, 160, 170, 255], roughnessFactor=0.15, metallicFactor=0.3),
    "wood":   PBRMaterial(baseColorFactor=[150, 108, 72, 255], roughnessFactor=0.85, metallicFactor=0),
    "leaf":   PBRMaterial(baseColorFactor=[86, 118, 64, 255], roughnessFactor=1.0, metallicFactor=0),
    "water":  PBRMaterial(baseColorFactor=[96, 160, 182, 255], roughnessFactor=0.1, metallicFactor=0.2),
}


def part(mesh, mat, x=0, y=0, z=0, ry=0):
    if ry:
        mesh.apply_transform(trimesh.transformations.rotation_matrix(np.radians(ry), [0, 1, 0]))
    mesh.apply_translation([x, y, z])
    mesh.visual = TextureVisuals(material=MAT[mat])
    return mesh


def box(w, h, d, mat, x=0, y=0, z=0, ry=0):          # y = 底面高度
    return part(trimesh.creation.box([w, h, d]), mat, x, y + h / 2, z, ry)


def cyl(r, h, mat, x=0, y=0, z=0, sections=32):
    m = trimesh.creation.cylinder(radius=r, height=h, sections=sections)
    m.apply_transform(trimesh.transformations.rotation_matrix(np.radians(-90), [1, 0, 0]))
    return part(m, mat, x, y + h / 2, z)


def ball(r, mat, x=0, y=0, z=0):
    return part(trimesh.creation.icosphere(subdivisions=2, radius=r), mat, x, y, z)


def save(name, parts):
    scene = trimesh.Scene()
    for i, p in enumerate(parts):
        scene.add_geometry(p, node_name=f"{name}-{i}")
    path = OUT / f"{name}.glb"
    scene.export(path)
    print(path.name, round(path.stat().st_size / 1024), "KB")


# 游客中心：长条体量 + 大挑檐屋顶 + 玻璃立面
vc = [box(80, 0.4, 44, "ground")]
vc += [box(56, 9, 18, "wall", y=0.4), box(30, 6, 12, "glass", x=-6, y=0.4, z=9.2)]
vc += [box(68, 0.9, 30, "roof", y=9.4)]
vc += [cyl(0.5, 9, "wall", x=x, y=0.4, z=13.5, sections=12) for x in range(-30, 31, 6)]
vc += [box(14, 5, 10, "wall", x=22, y=9.4 + 0.9, z=-3), box(16, 0.6, 12, "roof", x=22, y=15.3, z=-3)]
vc += [ball(3.2, "leaf", x=x, y=4, z=-18) for x in (-30, -18, -6, 6, 18, 30)]
save("visitor-center", vc)

# 树屋酒店：一棵大树，周围架着几个木屋，用步道相连
th = [box(60, 0.4, 60, "ground")]
th += [cyl(1.6, 22, "wood", y=0.4, sections=16), ball(12, "leaf", y=24), ball(8, "leaf", x=7, y=20, z=5), ball(8, "leaf", x=-8, y=19, z=-4)]
for i, (r, h) in enumerate([(14, 7), (15, 10), (13, 13), (16, 8)]):
    a = np.radians(i * 90 + 20)
    x, z = r * np.cos(a), r * np.sin(a)
    th += [cyl(0.35, h, "wood", x=x + dx, y=0.4, z=z + dz, sections=8) for dx in (-2.5, 2.5) for dz in (-2.5, 2.5)]
    th += [box(7, 0.4, 7, "wood", x=x, y=h + 0.4, z=z, ry=-np.degrees(a)), box(5.5, 3.8, 5.5, "wall", x=x, y=h + 0.8, z=z, ry=-np.degrees(a)),
           box(6.6, 0.5, 6.6, "roof", x=x, y=h + 4.6, z=z, ry=-np.degrees(a))]
    th += [box(r - 3, 0.25, 1.2, "wood", x=x / 2, y=h + 0.4, z=z / 2, ry=-np.degrees(a))]
save("tree-house", th)

# 绿洲亭：水面中央的圆形穹顶 + 一圈柱廊
oa = [cyl(34, 0.3, "ground", sections=64), cyl(30, 0.35, "water", y=0.05, sections=64), cyl(15, 0.6, "wall", y=0.3, sections=48)]
oa += [cyl(9.6, 5, "glass", y=0.9, sections=48)]
oa += [cyl(0.45, 5.5, "wall", x=12 * np.cos(a), y=0.9, z=12 * np.sin(a), sections=10) for a in np.radians(np.arange(0, 360, 20))]
oa += [cyl(13.2, 0.7, "wall", y=6.4, sections=48)]
dome = trimesh.creation.icosphere(subdivisions=3, radius=9)
dome.apply_scale([1, 0.75, 1])          # 压扁的球，下半部分藏在玻璃筒里，看起来就是穹顶
oa += [part(dome, "roof", y=7.1)]
oa += [box(3, 0.4, 16, "wood", x=0, y=0.3, z=22)]
oa += [ball(2.4, "leaf", x=27 * np.cos(a), y=4, z=27 * np.sin(a)) for a in np.radians(np.arange(10, 360, 30))]
save("oasis-pavilion", oa)

# 狮子岩观景台（重点景点）：几块不规则的岩石，上面悬挑出一个木平台
MAT["rock"] = PBRMaterial(baseColorFactor=[176, 140, 104, 255], roughnessFactor=1.0, metallicFactor=0)
MAT["grass"] = PBRMaterial(baseColorFactor=[196, 190, 128, 255], roughnessFactor=1.0, metallicFactor=0)
rng = np.random.default_rng(11)


def rock(r, sx, sy, sz, x, y, z):
    m = trimesh.creation.icosphere(subdivisions=2, radius=r)
    m.vertices *= 1 + rng.normal(0, 0.09, (len(m.vertices), 1))     # 每个顶点随机推拉，球就变成了石头
    m.apply_scale([sx, sy, sz])
    return part(m, "rock", x, y, z)


lr = [cyl(28, 0.4, "grass", sections=48)]
lr += [rock(10, 1.4, 1.0, 1.0, -5, 5, 0), rock(8, 1.0, 1.35, 0.9, 4, 7, -3), rock(5, 1.2, 0.8, 1.1, -14, 2, 9), rock(4, 1.0, 0.7, 1.0, 13, 1.5, 10)]
deck_y = 13
lr += [box(14, 0.6, 9, "wood", x=15, y=deck_y, z=-3)]                                  # 悬挑平台
lr += [box(14, 1.1, 0.15, "wood", x=15, y=deck_y + 0.6, z=z) for z in (-7.4, 1.4)]         # 栏杆
lr += [box(0.15, 1.1, 9, "wood", x=22, y=deck_y + 0.6, z=-3)]
lr += [cyl(0.3, deck_y, "wood", x=x, y=0.4, z=z, sections=8) for x in (16, 21.5) for z in (-7, 1)]   # 斜下方的支撑柱
lr += [ball(2.6, "leaf", x=x, y=3, z=z) for x, z in ((-20, -12), (-23, 6), (16, 17), (-6, 19), (22, -16))]
save("lion-rock", lr)
