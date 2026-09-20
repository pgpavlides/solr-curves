"""Turn T.A.R.G.E.T.'s Sol-R 3D model into a .glb the app can draw.

Source: C:\\Program Files (x86)\\Thrustmaster\\TARGET\\DevCfg\\Handle_SolR.xaml -
WPF 3D (Viewport3D of MeshGeometry3D), shipped with T.A.R.G.E.T. and used here
on the same machine it came from.

Every ModelVisual3D that has a name (btn_1 ... btn_21, HAT_UP, MS_LR, ROCKER,
the body) becomes one glTF node + mesh keeping that name, so the app can
highlight a button by name. Transforms are baked into the vertices: we only
recolour parts, never move them.

    python tools/solr_model.py [Handle_SolR.xaml] [public/solr.glb]
    python tools/solr_model.py Falcon_Base.xaml public/solr_base.glb
"""

import json
import pathlib
import struct
import sys
import xml.etree.ElementTree as ET

DEVCFG = pathlib.Path(r"C:\Program Files (x86)\Thrustmaster\TARGET\DevCfg")
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEVCFG / "Handle_SolR.xaml"
if not SRC.is_absolute():
    SRC = DEVCFG / SRC
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "public/solr.glb")
P = "{http://schemas.microsoft.com/winfx/2006/xaml/presentation}"
X = "{http://schemas.microsoft.com/xaml}"
XN = "{http://schemas.microsoft.com/winfx/2006/xaml}Name"

# The model's own materials (<Grid.Resources>, MaterialGroup per x:Key) are
# read from the file - see read_materials. This is only the fallback.
FALLBACK = (0.5, 0.5, 0.5, 1.0)

NAMED = {"black": "#FF000000", "white": "#FFFFFFFF", "orange": "#FFFFA500", "red": "#FFFF0000", "gray": "#FF808080", "grey": "#FF808080"}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def brush(value):
    """WPF brush text -> linear rgba. '#AARRGGBB', 'sc#a,r,g,b' (already
    linear) or a colour name."""
    if not value:
        return None
    v = value.strip()
    v = NAMED.get(v.lower(), v)
    if v.lower().startswith("sc#"):
        n = [float(x) for x in v[3:].replace(",", " ").split()]
        return (n[1], n[2], n[3], n[0]) if len(n) == 4 else (n[0], n[1], n[2], 1.0)
    if v.startswith("#"):
        h = v[1:]
        if len(h) == 6:
            h = "FF" + h
        a, r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4, 6))
        return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), a)
    return None


def read_materials(root):
    """x:Key -> what glTF needs: base colour, emissive, roughness."""
    out = {}
    for group in root.iter(f"{P}MaterialGroup"):
        key = group.get(XN.replace("Name", "Key"))
        if not key:
            continue
        base, emissive, rough = FALLBACK, (0.0, 0.0, 0.0), 0.6
        for m in group:
            name = tag(m)
            col = brush(m.get("Brush")) or brush(m.get("Color"))
            if name == "DiffuseMaterial" and col:
                base = col
            elif name == "EmissiveMaterial" and col:
                # the model bakes its ambient light in here; keep it faint so
                # our own lights do the shaping
                emissive = tuple(c * 0.35 for c in col[:3])
            elif name == "SpecularMaterial":
                power = float(m.get("SpecularPower", 20) or 20)
                rough = max(0.12, min(0.9, 1.0 - power / 40.0))
        out[key] = {"base": base, "emissive": emissive, "rough": rough}
    return out


def tag(e):
    return e.tag.split("}")[-1]


def mat_identity():
    return [1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0]


def mat_mul(a, b):
    """row-major 4x4, point * a * b order (a applied first)."""
    out = [0.0] * 16
    for r in range(4):
        for c in range(4):
            out[r * 4 + c] = sum(a[r * 4 + k] * b[k * 4 + c] for k in range(4))
    return out


def translate(x, y, z):
    m = mat_identity()
    m[12], m[13], m[14] = x, y, z
    return m


def scale(x, y, z):
    m = mat_identity()
    m[0], m[5], m[10] = x, y, z
    return m


def rotate(axis, angle_deg, centre=(0, 0, 0)):
    import math

    x, y, z = axis
    n = math.sqrt(x * x + y * y + z * z) or 1.0
    x, y, z = x / n, y / n, z / n
    a = math.radians(angle_deg)
    c, s, t = math.cos(a), math.sin(a), 1 - math.cos(a)
    r = [
        t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0,
        t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
        t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0,
        0, 0, 0, 1,
    ]
    if centre == (0, 0, 0):
        return r
    return mat_mul(mat_mul(translate(-centre[0], -centre[1], -centre[2]), r), translate(*centre))


def nums(s):
    return [float(x) for x in s.replace(",", " ").split()] if s else []


def read_transform(e):
    """The <X.Transform> child of a visual or model, as a 4x4."""
    m = mat_identity()
    for child in e:
        if not tag(child).endswith(".Transform"):
            continue
        for t in child.iter():
            name = tag(t)
            if name == "TranslateTransform3D":
                m = mat_mul(m, translate(float(t.get("OffsetX", 0)), float(t.get("OffsetY", 0)), float(t.get("OffsetZ", 0))))
            elif name == "ScaleTransform3D":
                m = mat_mul(m, scale(float(t.get("ScaleX", 1)), float(t.get("ScaleY", 1)), float(t.get("ScaleZ", 1))))
            elif name == "AxisAngleRotation3D":
                axis = nums(t.get("Axis", "0 1 0")) or [0, 1, 0]
                centre = (0.0, 0.0, 0.0)
                m = mat_mul(m, rotate(axis, float(t.get("Angle", 0)), centre))
    return m


def apply(m, x, y, z, w=1.0):
    return (
        x * m[0] + y * m[4] + z * m[8] + w * m[12],
        x * m[1] + y * m[5] + z * m[9] + w * m[13],
        x * m[2] + y * m[6] + z * m[10] + w * m[14],
    )


def material_of(geom, materials):
    """'{StaticResource inchis}' -> 'inchis'."""
    ref = geom.get("Material") or ""
    for key in materials:
        if key in ref:
            return key
    return next(iter(materials), "default")


def collect(e, parent_m, name, out, materials):
    """Walk the tree, baking transforms, grouping meshes under the nearest name."""
    m = mat_mul(read_transform(e), parent_m)
    if e.get(XN) and tag(e) == "ModelVisual3D":
        name = e.get(XN)
    if tag(e) == "GeometryModel3D":
        mesh = e.find(f".//{P}MeshGeometry3D")
        if mesh is not None:
            pos = nums(mesh.get("Positions"))
            nor = nums(mesh.get("Normals"))
            idx = [int(i) for i in (mesh.get("TriangleIndices") or "").replace(",", " ").split()]
            gm = mat_mul(read_transform(e), m)
            verts = [apply(gm, *pos[i : i + 3]) for i in range(0, len(pos), 3)]
            norms = [apply(gm, *nor[i : i + 3], 0.0) for i in range(0, len(nor), 3)] or [(0, 0, 1)] * len(verts)
            out.setdefault(name or "part", []).append((verts, norms, idx, material_of(e, materials)))
    for c in e:
        collect(c, m, name, out, materials)


def build_glb(parts, materials):
    buf = bytearray()
    views, accessors, meshes, nodes, out_materials = [], [], [], [], []
    mat_index = {}

    def view(data, target):
        while len(buf) % 4:
            buf.append(0)
        off = len(buf)
        buf.extend(data)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data), "target": target})
        return len(views) - 1

    for name, chunks in parts.items():
        prims = []
        for verts, norms, idx, matkey in chunks:
            if not verts or not idx:
                continue
            if matkey not in mat_index:
                spec = materials.get(matkey, {"base": FALLBACK, "emissive": (0, 0, 0), "rough": 0.6})
                r, g, b, a = spec["base"]
                out_materials.append({
                    "name": matkey,
                    "emissiveFactor": list(spec["emissive"]),
                    "pbrMetallicRoughness": {
                        "baseColorFactor": [r, g, b, a],
                        "metallicFactor": 0.15,
                        "roughnessFactor": spec["rough"],
                    },
                })
                mat_index[matkey] = len(out_materials) - 1
            pdata = b"".join(struct.pack("<3f", *v) for v in verts)
            ndata = b"".join(struct.pack("<3f", *n) for n in norms[: len(verts)])
            idata = b"".join(struct.pack("<I", i) for i in idx)
            lo = [min(v[i] for v in verts) for i in range(3)]
            hi = [max(v[i] for v in verts) for i in range(3)]
            pv, nv, iv = view(pdata, 34962), view(ndata, 34962), view(idata, 34963)
            accessors.append({"bufferView": pv, "componentType": 5126, "count": len(verts), "type": "VEC3", "min": lo, "max": hi})
            accessors.append({"bufferView": nv, "componentType": 5126, "count": len(verts), "type": "VEC3"})
            accessors.append({"bufferView": iv, "componentType": 5125, "count": len(idx), "type": "SCALAR"})
            n = len(accessors)
            prims.append({"attributes": {"POSITION": n - 3, "NORMAL": n - 2}, "indices": n - 1, "material": mat_index[matkey]})
        if prims:
            meshes.append({"name": name, "primitives": prims})
            nodes.append({"name": name, "mesh": len(meshes) - 1})

    gltf = {
        "asset": {"version": "2.0", "generator": "solr_model.py (from T.A.R.G.E.T. Handle_SolR.xaml)"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": out_materials,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(buf)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    bn = bytes(buf) + b"\0" * (-len(buf) % 4)
    total = 12 + 8 + len(js) + 8 + len(bn)
    return (
        struct.pack("<III", 0x46546C67, 2, total)
        + struct.pack("<II", len(js), 0x4E4F534A) + js
        + struct.pack("<II", len(bn), 0x004E4942) + bn
    )


def main():
    root = ET.fromstring(SRC.read_text(encoding="utf-8-sig"))
    materials = read_materials(root)
    parts = {}
    collect(root, mat_identity(), None, parts, materials)
    glb = build_glb(parts, materials)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(glb)
    print(f"{OUT}: {len(glb) / 1024:.0f} KB, {len(parts)} named parts, materials: " + ", ".join(
        f"{k} rgb({', '.join(f'{c:.2f}' for c in v['base'][:3])}) rough {v['rough']:.2f}" for k, v in materials.items()))
    lo = [min(v[i] for c in parts.values() for vs, *_ in c for v in vs) for i in range(3)]
    hi = [max(v[i] for c in parts.values() for vs, *_ in c for v in vs) for i in range(3)]
    print("  bounds", [round(x, 2) for x in lo], "to", [round(x, 2) for x in hi])
    for n, chunks in parts.items():
        print(f"  {n}: {sum(len(c[0]) for c in chunks)} verts")


main()
