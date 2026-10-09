# Builds the FSCHOOLAI campus in Blender: terraced hillside, pool, pavilion, trees, lights, golden-hour sky.
# Run:  blender -b -P build_mansion.py            (writes mansion.blend and ../models/mansion/mansion.glb)
# Coordinates follow the website (world3d/Exterior.js, Entrance.js): metres, x right, y up, z downhill toward the camera, school glass front at z = 0.
# Blender is Z-up, so a site point (x, y, z) becomes Blender (x, -z, y); the glTF exporter turns that back into the site's Y-up frame.
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, 'tex')
OUT_GLB = os.path.normpath(os.path.join(HERE, '..', 'world3d', 'models', 'mansion', 'mansion.glb'))
OUT_BLEND = os.path.join(HERE, 'mansion.blend')
rng = random.Random(7)

def P(x, y, z): return Vector((x, -z, y))

# terrace levels (top surfaces) and wall lines, same names as Exterior.js
T = dict(L0=0.0, L1=-2.6, L2=-5.2, W1=14.4, W2=26.4, deckEnd=62.0, halfW=37.0, stairW=4.0)
POOL = dict(x=0.0, z=42.0, len=26.0, wid=10.0)
GF, ROOF = 4.3, dict(y=4.6, t=0.42, front=3.4, back=-22.0, x0=-37.0, x1=37.0)
UP = dict(x0=-8.0, x1=14.0, z=-3.0, y0=ROOF['y'] + ROOF['t'], h=3.8)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materials
def tex(name, suffix, colorspace='sRGB'):
    img = bpy.data.images.load(os.path.join(TEX, f'{name}_{suffix}.jpg'), check_existing=True)
    img.colorspace_settings.name = colorspace
    return img

MATS = {}
def pbr(name, tex_name=None, color=(0.8, 0.8, 0.8, 1), rough=0.8, metal=0.0, emit=None, emit_strength=0.0, alpha=1.0, vcol=False, normal=1.0, tint=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(bsdf.outputs[0], out.inputs[0])
    bsdf.inputs['Roughness'].default_value = rough; bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Base Color'].default_value = color
    if tex_name:
        d = nt.nodes.new('ShaderNodeTexImage'); d.image = tex(tex_name, 'diff')
        if tint:
            mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
            mix.inputs[7].default_value = tint; nt.links.new(d.outputs[0], mix.inputs[6]); nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
        else: nt.links.new(d.outputs[0], bsdf.inputs['Base Color'])
        r = nt.nodes.new('ShaderNodeTexImage'); r.image = tex(tex_name, 'rough', 'Non-Color'); nt.links.new(r.outputs[0], bsdf.inputs['Roughness'])
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = tex(tex_name, 'nor', 'Non-Color')
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal
        nt.links.new(n.outputs[0], nm.inputs['Color']); nt.links.new(nm.outputs[0], bsdf.inputs['Normal'])
    if vcol:
        a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Color'; nt.links.new(a.outputs[0], bsdf.inputs['Base Color'])
    if emit:
        bsdf.inputs['Emission Color'].default_value = emit; bsdf.inputs['Emission Strength'].default_value = emit_strength
    if alpha < 1:
        bsdf.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'surface_render_method'): m.surface_render_method = 'BLENDED'    # 4.2+
        else: m.blend_method = 'BLEND'                                                 # 4.0 / 4.1
    MATS[name] = m; return m

pbr('concrete', 'concrete_layers_02', rough=0.9, normal=1.2)
pbr('paver', 'concrete_pavers_02', rough=0.8, normal=0.8)
pbr('plaster', 'beige_wall_001', rough=0.9, tint=(1.0, 0.93, 0.84, 1))
pbr('stone', 'rock_wall_08', rough=0.95, tint=(0.82, 0.7, 0.62, 1))
pbr('wood', 'wood_planks_grey', rough=0.55, tint=(0.95, 0.62, 0.38, 1))
pbr('coping', None, color=(0.78, 0.72, 0.64, 1), rough=0.7)
pbr('fascia', None, color=(0.17, 0.11, 0.09, 1), rough=0.45, metal=0.55)
pbr('bronze', None, color=(0.42, 0.27, 0.13, 1), rough=0.4, metal=0.85)
pbr('soffit', None, color=(0.55, 0.32, 0.16, 1), rough=0.7, emit=(1, 0.6, 0.3, 1), emit_strength=0.35)
pbr('white', None, color=(0.92, 0.89, 0.84, 1), rough=0.6)
pbr('glass', None, color=(0.05, 0.07, 0.09, 1), rough=0.02, alpha=0.28)
pbr('warm_emit', None, color=(1, 0.75, 0.45, 1), emit=(1.0, 0.68, 0.35, 1), emit_strength=6.0)
pbr('lamp', None, color=(1, 0.8, 0.5, 1), emit=(1.0, 0.7, 0.35, 1), emit_strength=25.0)
pbr('interior_wall', None, color=(0.95, 0.78, 0.55, 1), rough=0.9, emit=(1.0, 0.66, 0.34, 1), emit_strength=0.8)
pbr('interior_floor', None, color=(0.7, 0.42, 0.2, 1), rough=0.5, emit=(0.9, 0.5, 0.2, 1), emit_strength=0.25)
pbr('books', None, vcol=True, rough=0.8)
pbr('grass', None, vcol=True, rough=1.0)
pbr('hedge', None, color=(0.1, 0.17, 0.08, 1), rough=1.0)
pbr('bark', None, color=(0.2, 0.13, 0.09, 1), rough=1.0)
pbr('leaf', None, vcol=True, rough=0.85)
pbr('pine', None, color=(0.025, 0.055, 0.03, 1), rough=1.0)
pbr('pot', None, color=(0.85, 0.8, 0.72, 1), rough=0.55)
pbr('water', None, color=(0.02, 0.35, 0.42, 1), rough=0.03, emit=(0.0, 0.5, 0.6, 1), emit_strength=0.7)
pbr('pool_tile', None, color=(0.3, 0.7, 0.75, 1), rough=0.3)

# ---------------------------------------------------------------- mesh builder (one object per material)
class Builder:
    def __init__(self): self.bms = {}
    def bm(self, mat):
        if mat not in self.bms:
            b = bmesh.new(); b.loops.layers.uv.new('UVMap'); b.loops.layers.color.new('Color'); self.bms[mat] = b
        return self.bms[mat]

    def finish_faces(self, bm, faces, tile, color=None):
        uvl = bm.loops.layers.uv.active; cl = bm.loops.layers.color.active
        for f in faces:
            n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
            for l in f.loops:
                c = l.vert.co
                if ax == 0: u, v = c.y, c.z
                elif ax == 1: u, v = c.x, c.z
                else: u, v = c.x, c.y
                l[uvl].uv = (u / tile, v / tile)
                if color is not None: l[cl] = color

    def box(self, mat, cx, cy, cz, sx, sy, sz, tile=3.0, rot=None, color=None):
        """Axis-aligned box centred on a site point with site-space size (x, y, z)."""
        bm = self.bm(mat)
        r = bmesh.ops.create_cube(bm, size=1.0)
        verts = r['verts']
        m = Matrix.Translation(P(cx, cy, cz))
        if rot: m = m @ rot
        m = m @ Matrix.Diagonal((sx, sz, sy, 1))     # site (x,y,z) sizes -> Blender (x, y, z) = (x, z, y)
        bmesh.ops.transform(bm, matrix=m, verts=verts)
        faces = {f for v in verts for f in v.link_faces}
        self.finish_faces(bm, faces, tile, color)

    def poly(self, mat, pts, y0, y1, tile=3.0, color=None):
        """Prism from a closed 2D outline of site (x, z) points, spanning heights y0..y1."""
        bm = self.bm(mat)
        bot = [bm.verts.new(P(x, y0, z)) for x, z in pts]
        f = bm.faces.new(bot)
        if f.normal.z > 0: f.normal_flip()
        res = bmesh.ops.extrude_face_region(bm, geom=[f])
        top = [e for e in res['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0, 0, y1 - y0), verts=top)
        bmesh.ops.recalc_face_normals(bm, faces=list({f2 for v in bot + top for f2 in v.link_faces}))
        faces = {f2 for v in bot + top for f2 in v.link_faces}
        self.finish_faces(bm, faces, tile, color)

    def cyl(self, mat, cx, y0, cz, r, h, seg=10, tile=2.0, color=None, r2=None):
        bm = self.bm(mat)
        res = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=(r if r2 is None else r2), depth=h)
        bmesh.ops.translate(bm, vec=P(cx, y0 + h / 2, cz), verts=res['verts'])
        faces = {f for v in res['verts'] for f in v.link_faces}
        self.finish_faces(bm, faces, tile, color)

    def commit(self, collection, bevel=None, name_prefix=''):
        objs = {}
        for mat, bm in self.bms.items():
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            me = bpy.data.meshes.new(name_prefix + mat); bm.to_mesh(me); bm.free()
            ob = bpy.data.objects.new(name_prefix + mat, me); collection.objects.link(ob); me.materials.append(MATS[mat])
            for p in me.polygons: p.use_smooth = False
            if bevel and mat in bevel:
                mod = ob.modifiers.new('Bevel', 'BEVEL'); mod.width = bevel[mat]; mod.segments = 2; mod.limit_method = 'ANGLE'; mod.angle_limit = math.radians(35)
            objs[mat] = ob
        self.bms = {}; return objs

def new_coll(name):
    c = bpy.data.collections.new(name); scene.collection.children.link(c); return c

# ---------------------------------------------------------------- terrain
def fbm(x, z):
    s, a, f = 0.0, 1.0, 0.012
    for i in range(4):
        s += a * (math.sin(x * f + i * 1.7) * math.cos(z * f * 1.3 - i) + math.sin((x + z) * f * 0.7 + i * 2.1)) * 0.5; a *= 0.5; f *= 2.1
    return s
def sstep(a, b, v):
    t = min(max((v - a) / (b - a), 0.0), 1.0); return t * t * (3 - 2 * t)
def ground_y(x, z):
    y = T['L0'] + (T['L1'] - T['L0']) * sstep(12, 17, z) + (T['L2'] - T['L1']) * sstep(24, 29, z)
    y += -max(0, z - T['deckEnd']) * 0.16 - max(0, z - 120) * 0.05
    y += min(max(0, -z - 24) * 0.11, 16) + max(0, -z - 120) * 0.04
    ax = abs(x); y += max(0, ax - 60) * 0.12 * sstep(-40, 20, -z + 20)
    wild = sstep(38, 50, ax) + sstep(-24, -34, z) + sstep(64, 74, z)
    return y + fbm(x, z) * 3.2 * min(1, wild)

def build_terrain(coll):
    segx, segz = 220, 190
    bm = bmesh.new(); uv = bm.loops.layers.uv.new('UVMap'); cl = bm.loops.layers.color.new('Color')
    verts = []
    for j in range(segz + 1):
        row = []
        for i in range(segx + 1):
            x = -280 + 560 * i / segx; z = -320 + 520 * j / segz     # z from -320 (far hill) to 200 (valley)
            in_campus = abs(x) < T['halfW'] + 1 and -23 < z < T['deckEnd'] + 1
            y = ground_y(x, z) - (0.6 if in_campus else 0.0)
            row.append(bm.verts.new(P(x, y, z)))
        verts.append(row)
    for j in range(segz):
        for i in range(segx):
            bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
    cA, cB, cC = Vector((0.36, 0.46, 0.2)), Vector((0.24, 0.34, 0.14)), Vector((0.52, 0.45, 0.25))   # sRGB, lifted so the lawn survives the dusk light
    for f in bm.faces:
        f.smooth = True
        for l in f.loops:
            p = l.vert.co; x, z = p.x, -p.y
            n = 0.5 + 0.5 * math.sin(x * 0.09 + math.cos(z * 0.07) * 2)
            c = cA.lerp(cB, n).lerp(cC, max(0, 0.35 - abs(fbm(x * 3, z * 3)) * 0.6))
            l[cl] = (c.x ** 2.2 * 1.0, c.y ** 2.2 * 1.0, c.z ** 2.2 * 1.0, 1)   # vertex colours are linear
            l[uv].uv = (x / 40, z / 40)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('terrain'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('terrain', me); coll.objects.link(ob); me.materials.append(MATS['grass'])
    return ob

# ---------------------------------------------------------------- campus structure
def stadium_pts(length, width, n=28):
    r = width / 2; a = length / 2 - r; pts = []
    for i in range(n + 1):                      # right cap, bottom to top
        t = -math.pi / 2 + math.pi * i / n; pts.append((a + r * math.cos(t), r * math.sin(t)))
    for i in range(n + 1):                      # left cap, top to bottom
        t = math.pi / 2 + math.pi * i / n; pts.append((-a + r * math.cos(t), r * math.sin(t)))
    return pts

def boolean_cut(target, cutter_pts, y0, y1):
    bm = bmesh.new()
    verts = [bm.verts.new(P(POOL['x'] + x, y0, POOL['z'] + z)) for x, z in cutter_pts]
    f = bm.faces.new(verts); res = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=(0, 0, y1 - y0), verts=[e for e in res['geom'] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('cutter'); bm.to_mesh(me); bm.free()
    cut = bpy.data.objects.new('cutter', me); scene.collection.objects.link(cut)
    mod = target.modifiers.new('cut', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cut)

def build_campus(coll):
    B = Builder(); W, sw = T['halfW'], T['stairW']
    # plaza in front of the school
    B.box('paver', 0, T['L0'] - 0.2, (T['W1'] - 0.4 - 2) / 2, 2 * W + 4, 0.4, T['W1'] - 0.4 + 2, 3)
    gaps = [(-33.4, -28.6), (-sw - 0.4, sw + 0.4), (28.6, 33.4)]
    def wall(zf, top, bottom):
        h = top - bottom; segs = []; x0 = -W
        for a, b in gaps + [(W, W)]:
            if a > x0: segs.append((x0, a))
            x0 = b
        for a, b in segs:
            B.box('concrete', (a + b) / 2, bottom + h / 2, zf - 0.4, b - a, h, 0.8, 3.2)
            B.box('coping', (a + b) / 2, top + 0.06, zf - 0.42, b - a, 0.12, 0.9, 2)
    wall(T['W1'], T['L0'], T['L1'])
    B.box('paver', 0, T['L1'] - 0.2, (T['W1'] + T['W2']) / 2 - 0.4, 2 * W, 0.4, T['W2'] - T['W1'], 3)
    for a, b in ((-W + 1, -sw - 1.2), (sw + 1.2, W - 1)):
        B.box('grass', (a + b) / 2, T['L1'] + 0.03, T['W1'] + 1.8, b - a, 0.06, 3.4, 3, color=(0.12, 0.2, 0.07, 1))
    wall(T['W2'], T['L1'], T['L2'])
    def stair(cx, width, ztop, top, bottom):
        n = 15; rise = (top - bottom) / n; run = 0.36
        for i in range(n - 1):
            y = top - (i + 1) * rise; h = y - bottom + 0.4
            B.box('coping', cx, y - h / 2, ztop + i * run + run / 2, width, h, run + 0.02, 1.5)
        ang = math.atan2(top - bottom, n * run); length = math.hypot(n * run, top - bottom)
        for s in (-1, 1):   # cheek walls follow the slope: rotate about the site x axis (Blender X)
            B.box('concrete', cx + s * (width / 2 + 0.22), (top + bottom) / 2 + 0.25, ztop + n * run / 2, 0.45, 1.2, length + 0.4, 3.2, rot=Matrix.Rotation(ang, 4, 'X'))
    for cx, w in ((0, 2 * sw), (-31, 4.2), (31, 4.2)):
        stair(cx, w, T['W1'], T['L0'], T['L1']); stair(cx, w, T['W2'], T['L1'], T['L2'])
    # pool deck (cut for the pool below) + loungers + grass strip
    B.box('paver', 0, T['L2'] - 0.25, (T['W2'] - 0.4 + T['deckEnd']) / 2, 2 * W, 0.5, T['deckEnd'] - T['W2'] + 0.4, 3)
    B.box('grass', 0, T['L2'] + 0.03, T['deckEnd'] - 4.6, 2 * W - 2, 0.06, 6, 3, color=(0.12, 0.2, 0.07, 1))
    for i in range(8):
        x = -12.6 + i * 3.6; z = POOL['z'] + POOL['wid'] / 2 + 2.6
        B.box('white', x, T['L2'] + 0.38, z, 0.8, 0.12, 2.0, 1); B.box('white', x, T['L2'] + 0.75, z - 1.05, 0.8, 0.1, 0.8, 1)
        for s in (-1, 1): B.box('bronze', x + s * 0.36, T['L2'] + 0.16, z, 0.06, 0.32, 1.8, 1)
    objs = B.commit(coll, bevel={'concrete': 0.03, 'paver': 0.015, 'coping': 0.02, 'white': 0.02, 'bronze': 0.01, 'grass': 0.0})
    # pool: cut the deck, add cope, basin, water
    deck = objs['paver']
    boolean_cut(deck, stadium_pts(POOL['len'] + 1.4, POOL['wid'] + 1.4), T['L2'] - 2.0, T['L2'] + 0.2)
    B2 = Builder()
    outer = [(POOL['x'] + x, POOL['z'] + z) for x, z in stadium_pts(POOL['len'] + 1.4, POOL['wid'] + 1.4)]
    B2.poly('coping', outer, T['L2'] - 0.26, T['L2'] + 0.04, 1.5)
    inner = [(POOL['x'] + x, POOL['z'] + z) for x, z in stadium_pts(POOL['len'], POOL['wid'])]
    B2.poly('pool_tile', inner, T['L2'] - 1.5, T['L2'] - 1.4, 3)
    o2 = B2.commit(coll)
    boolean_cut(o2['coping'], stadium_pts(POOL['len'], POOL['wid']), T['L2'] - 2, T['L2'] + 0.5)
    B3 = Builder(); B3.poly('water', inner, T['L2'] - 0.1, T['L2'] - 0.09, 3); B3.commit(coll)

# ---------------------------------------------------------------- the pavilion
def build_school(coll):
    B = Builder()
    door_hw = 4.85
    # ground-floor glass bays with a lit interior behind them
    bays = [(-14.0, -door_hw, 4.0, 0.0), (door_hw, 24.0, 4.0, 0.0), (24.0, 36.6, 5.4, -1.5)]
    for a, b, d, zf in bays:
        w = b - a; cx = (a + b) / 2
        B.box('interior_floor', cx, 0.02, zf - d / 2, w, 0.04, d, 2)
        B.box('interior_wall', cx, GF / 2, zf - d, w, GF, 0.1, 3)
        B.box('warm_emit', cx, GF - 0.04, zf - d / 2, w - 0.6, 0.04, d - 0.6, 2)                 # ceiling light panel
        for s in (a + 0.1, b - 0.1): B.box('plaster', s, GF / 2, zf - d / 2, 0.2, GF, d, 3)
        B.box('plaster', cx, GF + 0.0, zf - d / 2, w, 0.08, d, 3)
        n = max(1, round(w / 1.9))
        for i in range(n + 1): B.box('bronze', a + i * w / n, GF / 2, zf + 0.05, 0.09, GF, 0.16, 1)
        B.box('bronze', cx, 0.05, zf + 0.05, w, 0.1, 0.16, 1); B.box('bronze', cx, GF - 0.04, zf + 0.05, w, 0.08, 0.16, 1)
        B.box('glass', cx, GF / 2, zf + 0.02, w, GF, 0.02, 1)
        # shelves along the back wall: carcass + coloured books
        sx = a + 1.0
        while sx + 2.0 < b:
            B.box('wood', sx + 1.0, 1.6, zf - d + 0.4, 2.0, 3.2, 0.7, 2)
            for row in range(5):
                y = 0.5 + row * 0.62
                x = sx + 0.1
                while x < sx + 1.9:
                    bw = rng.uniform(0.04, 0.09); bh = rng.uniform(0.28, 0.46)
                    h = rng.uniform(0.02, 0.1); col = (0.4 + h * 3 * rng.random(), 0.15 + rng.random() * 0.2, 0.08 + rng.random() * 0.1, 1)
                    B.box('books', x + bw / 2, y + bh / 2 + 0.03, zf - d + 0.72, bw, bh, 0.28, 1, color=col); x += bw + 0.01
            sx += 3.2 + rng.uniform(0, 1.5)
    # solid stone wing, stepped forward, with three deep windows
    B.box('stone', -25.7, (GF + 0.3) / 2, 0.5, 22.6, GF + 0.3, 1.4, 3)
    for x in (-31.5, -25.7, -19.9):
        B.box('interior_wall', x, 2.0, 1.1, 2.6, 2.3, 0.04, 2)       # glowing recess
        B.box('bronze', x, 0.8, 1.3, 2.9, 0.12, 0.3, 1); B.box('bronze', x, 3.2, 1.3, 2.9, 0.12, 0.3, 1)
        B.box('glass', x, 2.0, 1.22, 2.6, 2.3, 0.02, 1)
    # back and side walls so the volume reads from the hills
    B.box('plaster', 0, GF / 2, ROOF['back'] + 0.4, 74, GF, 0.4, 3)
    for s in (-1, 1): B.box('plaster', s * 36.8, GF / 2, ROOF['back'] / 2, 0.4, GF, -ROOF['back'], 3)
    # vestibule: portal columns, canopy, floor, a recessed glass door wall with the hallway beyond
    for s in (-1, 1):
        B.box('bronze', s * 4.55, 1.9, 0.1, 0.5, 3.8, 0.5, 1); B.box('plaster', s * 5.3, GF / 2, -1.5, 0.9, GF, 3.5, 3)
    B.box('fascia', 0, 3.95, 0.1, 10.2, 0.4, 0.7, 1)
    B.box('paver', 0, 0.01, -3.0, 9.4, 0.06, 6.0, 2)
    for s in (-1, 1): B.box('interior_wall', s * 4.7, GF / 2, -3.0, 0.2, GF, 6.0, 3)
    B.box('warm_emit', 0, GF - 0.04, -3.0, 8, 0.04, 5.4, 2)
    for x in (-2.3, 0, 2.3): B.box('bronze', x, 1.8, -0.5, 0.08, 3.6, 0.16, 1)
    B.box('glass', 0, 1.8, -0.5, 4.6, 3.6, 0.02, 1)
    # cantilevered main roof, soffit, metal edge, downlights
    rl = ROOF['x1'] - ROOF['x0']; rd = ROOF['front'] - ROOF['back']; rz = (ROOF['front'] + ROOF['back']) / 2
    B.box('fascia', 0, ROOF['y'] + ROOF['t'] / 2, rz, rl, ROOF['t'], rd, 2)
    B.box('soffit', 0, ROOF['y'] - 0.02, rz, rl - 0.2, 0.05, rd - 0.2, 2)
    B.box('bronze', 0, ROOF['y'] + ROOF['t'] - 0.012, ROOF['front'] + 0.025, rl + 0.08, 0.055, 0.09, 1)
    x = ROOF['x0'] + 1.6
    while x < ROOF['x1'] - 1:
        B.cyl('lamp', x, ROOF['y'] - 0.06, 1.7, 0.16, 0.05, 12); x += 3.2
    # raised glass studio with a floating roof
    uw = UP['x1'] - UP['x0']; ucx = (UP['x0'] + UP['x1']) / 2; ud = 12
    B.box('interior_floor', ucx, UP['y0'] + 0.02, UP['z'] - ud / 2, uw, 0.04, ud, 2)
    B.box('interior_wall', ucx, UP['y0'] + UP['h'] / 2, UP['z'] - ud, uw, UP['h'], 0.1, 3)
    B.box('warm_emit', ucx, UP['y0'] + UP['h'] - 0.05, UP['z'] - ud / 2, uw - 1, 0.04, ud - 1, 2)
    xx = UP['x0']
    for i in range(12): B.box('bronze', UP['x0'] + i * uw / 11, UP['y0'] + UP['h'] / 2, UP['z'] + 0.05, 0.08, UP['h'], 0.14, 1)
    B.box('glass', ucx, UP['y0'] + UP['h'] / 2, UP['z'] + 0.02, uw, UP['h'], 0.02, 1)
    for s in (UP['x0'] + 0.2, UP['x1'] - 0.2): B.box('plaster', s, UP['y0'] + UP['h'] / 2, UP['z'] - ud / 2, 0.4, UP['h'], ud, 3)
    B.box('plaster', ucx, UP['y0'] + UP['h'] / 2, UP['z'] - ud, uw, UP['h'], 0.4, 3)
    B.box('fascia', ucx + 0.4, UP['y0'] + UP['h'] + 0.17, UP['z'] - ud / 2 + 1.6, uw + 3.4, 0.34, ud + 3.6, 2)
    B.box('soffit', ucx + 0.4, UP['y0'] + UP['h'] - 0.01, UP['z'] - ud / 2 + 1.6, uw + 3.2, 0.04, ud + 3.4, 2)
    # roof balcony rail and the service block
    B.box('bronze', ucx, UP['y0'] + 1.05, UP['z'] + 2.4, uw, 0.05, 0.05, 1)
    x = UP['x0']
    while x <= UP['x1']: B.box('bronze', x, UP['y0'] + 0.52, UP['z'] + 2.4, 0.03, 1.05, 0.03, 1); x += 1.1
    B.box('stone', -24, ROOF['y'] + ROOF['t'] + 0.8, -6, 1.4, 1.6, 1.4, 2)
    B.commit(coll, bevel={'plaster': 0.02, 'stone': 0.03, 'fascia': 0.015, 'bronze': 0.008, 'wood': 0.01, 'paver': 0.01})

# ---------------------------------------------------------------- site furniture and planting
def build_details(coll):
    B = Builder(); W, sw = T['halfW'], T['stairW']
    def xs(a, b, step, skip):
        out = []; x = a
        while x <= b + 1e-3:
            if not skip(x): out.append(x)
            x += step
        return out
    not_stairs = lambda x: abs(x) < sw + 1.2 or abs(abs(x) - 31) < 3
    rows = [(T['W1'] - 0.9, T['L0'], xs(-W + 2, W - 2, 4.2, not_stairs)), (T['W2'] - 0.9, T['L1'], xs(-W + 2, W - 2, 4.2, not_stairs)),
            (POOL['z'] - POOL['wid'] / 2 - 3.2, T['L2'], xs(-24, 24, 6, lambda x: abs(x) < 3))]
    for z, y, X in rows:
        for x in X: B.cyl('bronze', x, y, z, 0.075, 0.75, 8); B.cyl('lamp', x, y + 0.68, z, 0.075, 0.08, 8)
    # planters + bare ornamental trees along the plaza and middle terrace
    trees = [(x, T['L0'], T['W1'] - 2.2, 1.15 + rng.random() * 0.2) for x in xs(-28, 28, 5.6, lambda x: abs(x) < sw + 1)]
    trees += [(x + 1.4, T['L1'], T['W1'] + 1.6, 0.95 + rng.random() * 0.2) for x in xs(-26, 26, 8.6, lambda x: abs(x) < sw + 2)]
    for x, y, z, s in trees:
        B.box('coping', x, y + 0.22, z, 1.4, 0.45, 1.4, 2); tree_branches(B, x, y + 0.45, z, s)
    # hedges along the deck edge, terrace wall foot and plaza flanks
    for x in [-W + 1 + 3.1 * i for i in range(int(2 * W / 3.1))]:
        B.box('hedge', x, T['L2'] + 0.6, T['deckEnd'] - 0.8, 3.2, 1.25, 1.4, 1.5)
        if not not_stairs(x): B.box('hedge', x, T['L1'] + 0.42, T['W2'] - 2.1, 3.0, 0.85, 1.0, 1.5)
    for sd in (-1, 1):
        for z in [1 + 2.6 * i for i in range(5)]: B.box('hedge', sd * (W - 1.2), T['L0'] + 0.55, z, 2.2, 1.1, 2.7, 1.5)
    # topiary pots at the doors
    for s in (-1, 1):
        B.cyl('pot', s * 6.3, 0.0, 1.0, 0.35, 0.5, 12)
    objs = B.commit(coll, bevel={'hedge': 0.18, 'coping': 0.02, 'bronze': 0.01})
    return objs

def tree_branches(B, x, y, z, s):
    """Bare ornamental tree: tapered trunk, forked limbs, a few autumn leaf clusters on the twigs. Works in Blender space."""
    def limb(p0, d, length, r, depth):
        p1 = p0 + d * length
        bm = B.bm('bark')
        res = bmesh.ops.create_cone(bm, cap_ends=False, segments=6, radius1=r, radius2=r * 0.6, depth=length)
        rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=Matrix.Translation((p0 + p1) / 2) @ rot, verts=res['verts'])
        B.finish_faces(bm, {f for v in res['verts'] for f in v.link_faces}, 1.0)
        if depth == 0:
            for _ in range(3):
                c = p1 + Vector((rng.uniform(-.3, .3), rng.uniform(-.3, .3), rng.uniform(-.1, .3)))
                col = rng.choice([(0.55, 0.15, 0.05, 1), (0.6, 0.3, 0.05, 1), (0.5, 0.08, 0.04, 1), (0.55, 0.38, 0.08, 1)])
                lb = B.bm('leaf'); sp = bmesh.ops.create_icosphere(lb, subdivisions=2, radius=rng.uniform(0.14, 0.26) * s)
                bmesh.ops.translate(lb, vec=c, verts=sp['verts']); B.finish_faces(lb, {f for v in sp['verts'] for f in v.link_faces}, 1.0, col)
            return
        for _ in range(2 + (depth > 1)):
            nd = (d + Vector((rng.uniform(-.7, .7), rng.uniform(-.7, .7), rng.uniform(-.1, .5)))).normalized()
            limb(p1, nd, length * rng.uniform(.55, .75), r * 0.62, depth - 1)
    limb(P(x, y, z), Vector((0, 0, 1)), 2.6 * s, 0.11 * s, 3)

# ---------------------------------------------------------------- hills: pines
def build_pines(coll):
    variants = []
    for k in range(3):
        B = Builder(); h = 5.5 + k * 1.5
        B.cyl('bark', 0, 0, 0, 0.18, h * 0.3, 6)
        for i in range(4):
            B.cyl('pine', 0, h * (0.2 + i * 0.17), 0, (1.9 - i * 0.38) * (0.9 + k * 0.1), h * 0.34, 8, r2=0.05)
        o = B.commit(coll, name_prefix=f'pine{k}_')
        for ob in o.values(): ob.location = (0, 0, -1000)     # park the prototypes off-screen; instances are placed below
        variants.append(o)
    holders = {}     # exporter instances (EXT_mesh_gpu_instancing) only the children of an Empty that share one mesh
    for k, o in enumerate(variants):
        for mat in o:
            e = bpy.data.objects.new(f'inst_pine{k}_{mat}', None); coll.objects.link(e); holders[(k, mat)] = e
    count = 0
    for _ in range(2600):
        x = rng.uniform(-260, 260); z = rng.uniform(-300, 90)
        if abs(x) < 46 and -26 < z < 66: continue                       # keep the campus footprint clear
        if abs(x) < 70 and z > 20: continue
        if ground_y(x, z) < -4.0 and z > 60: continue
        if rng.random() > (0.55 if abs(x) < 60 and z > -60 else 0.9): continue
        k = rng.randrange(3); v = variants[k]; sc = rng.uniform(0.8, 1.7); rot = rng.uniform(0, math.tau)
        for mat, proto in v.items():
            ob = bpy.data.objects.new('pine', proto.data); coll.objects.link(ob); ob.parent = holders[(k, mat)]
            ob.location = P(x, ground_y(x, z) - 0.2, z); ob.scale = (sc, sc, sc * rng.uniform(0.9, 1.3)); ob.rotation_euler = (0, 0, rot)
        count += 1
    print('pines', count)

# ---------------------------------------------------------------- lights, sky, camera
def build_world():
    w = bpy.data.worlds.new('golden'); w.use_nodes = True; scene.world = w
    nt = w.node_tree; nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'MULTIPLE_SCATTERING' if 'MULTIPLE_SCATTERING' in sky.bl_rna.properties['sky_type'].enum_items else 'NISHITA'   # 4.0 only has Nishita
    sky.sun_elevation = math.radians(5.5); sky.sun_rotation = math.radians(-62); sky.sun_size = math.radians(1.2); sky.sun_intensity = 1.0
    sky.air_density = 1.4; sky.dust_density = 2.6; sky.ozone_density = 1.5; sky.altitude = 120
    bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = 1.0
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs[0], bg.inputs[0]); nt.links.new(bg.outputs[0], out.inputs[0])
    # sun lamp lined up with the sky's sun for sharp, warm shadows
    el, az = math.radians(5.5), math.radians(-62)
    toward = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.0; sun.angle = math.radians(1.0); sun.color = (1.0, 0.62, 0.36)
    so = bpy.data.objects.new('sun', sun); scene.collection.objects.link(so)
    so.rotation_euler = (-toward).to_track_quat('-Z', 'Y').to_euler()

def build_cycles_settings(w=1920, h=1080, samples=96):
    scene.render.engine = 'CYCLES'; c = scene.cycles; c.device = 'CPU'; c.samples = samples
    try: c.use_denoising = True; c.denoiser = 'OPENIMAGEDENOISE'
    except Exception: c.use_denoising = False                      # this Blender build ships without OIDN
    c.max_bounces = 6; c.diffuse_bounces = 3; c.glossy_bounces = 3; c.transmission_bounces = 4
    c.use_adaptive_sampling = True; c.adaptive_threshold = 0.02
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = w, h, 100
    scene.view_settings.view_transform = 'AgX' if 'AgX' in [x.identifier for x in scene.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    scene.view_settings.look = 'None'; scene.view_settings.exposure = 0.0
    try: scene.display_settings.display_device = 'sRGB'
    except Exception: pass

def add_camera():
    cam = bpy.data.cameras.new('cam'); cam.sensor_fit = 'VERTICAL'; cam.angle = math.radians(42); cam.clip_end = 3000; cam.clip_start = 0.1
    co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); scene.camera = co
    co.location = P(0, 17, 116); co.rotation_euler = ((P(0, 7.5, 0) - P(0, 17, 116))).to_track_quat('-Z', 'Y').to_euler()

def shrink_textures(px):
    """Web copy only: the .blend keeps full-res maps on disk, the GLB gets px-wide ones (packed so the exporter reads the resized pixels)."""
    for img in bpy.data.images:
        if img.size[0] > px:
            img.scale(px, int(img.size[1] * px / img.size[0])); img.pack()

# ---------------------------------------------------------------- main
if __name__ == '__main__':
    quick = '--quick' in sys.argv
    c_terrain, c_campus, c_school, c_detail, c_hills = (new_coll(n) for n in ('Terrain', 'Campus', 'School', 'Details', 'Hills'))
    build_terrain(c_terrain); build_campus(c_campus); build_school(c_school); build_details(c_detail)
    if not quick: build_pines(c_hills)
    build_world(); build_cycles_settings(); add_camera()
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print('saved', OUT_BLEND)
    if '--no-export' not in sys.argv:
        os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
        shrink_textures(1024)
        bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_apply=True, export_image_format='JPEG', export_jpeg_quality=78,
                                  export_cameras=False, export_lights=False, use_visible=True, export_gpu_instances=True)   # pines become a few EXT_mesh_gpu_instancing nodes (three.js GLTFLoader reads it)
        print('exported', OUT_GLB, os.path.getsize(OUT_GLB) // 1024, 'KB')
