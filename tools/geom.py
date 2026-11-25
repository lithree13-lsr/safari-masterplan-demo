"""共用的几何函数：把设计数据里的粗糙折线变成平滑曲线。
build_plan.py（画底图）和 build_data.py（生成网页数据）都用它，保证图上的形状和网页叠加的线条完全对齐。"""
import json, math, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_source():
    return json.loads((ROOT / "tools" / "park_source.json").read_text(encoding="utf-8"))


def chaikin(poly, rounds=3):
    """闭合多边形的 Chaikin 平滑：每轮把每条边切掉两头的 1/4，角就变圆了。"""
    pts = [tuple(p) for p in poly]
    for _ in range(rounds):
        out = []
        n = len(pts)
        for i in range(n):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
            out.append((0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1))
            out.append((0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1))
        pts = out
    return [[round(x), round(y)] for x, y in pts]


def circle(cx, cy, r, n=64):
    return [[round(cx + r * math.cos(2 * math.pi * i / n)), round(cy + r * math.sin(2 * math.pi * i / n))] for i in range(n)]


def catmull(pts, steps=12):
    """穿过每个点的平滑曲线（Catmull-Rom）。首尾相同则视为闭合环线。"""
    closed = pts[0] == pts[-1]
    p = [tuple(q) for q in (pts[:-1] if closed else pts)]
    n = len(p)
    out = []
    segs = n if closed else n - 1
    for i in range(segs):
        p0 = p[(i - 1) % n] if closed else p[max(i - 1, 0)]
        p1, p2 = p[i], p[(i + 1) % n]
        p3 = p[(i + 2) % n] if closed else p[min(i + 2, n - 1)]
        for s in range(steps):
            t = s / steps
            t2, t3 = t * t, t * t * t
            out.append([
                round(0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)),
                round(0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)),
            ])
    out.append(list(p[0]) if closed else list(p[-1]))
    return out


def zone_outline(z):
    if "circle" in z:
        return circle(*z["circle"])
    return chaikin(z["poly"])
