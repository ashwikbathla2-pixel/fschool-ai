# Builds the PRD section 7 clay Room: one shared shell dressed with a theme's prop set, one accent colour per theme.
# Run:  PYTHONPATH=<numpy dir> blender -b -P build_room.py [-- --theme pilot]     (default: all four themes)
# Writes ../world3d/models/room/room-<theme>.glb. Blender is Z-up; the exporter converts to the site's Y-up (x right, y up, z toward the camera).
# Room: floor 6 x 5 m, back wall at Blender y=+2.5 (site z=-2.5), left wall at x=-3. Tap targets are Empties named tap_<id> that parent their meshes.
import bpy, bmesh, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'world3d', 'models', 'room'))
THEMES = {   # accent (sRGB hex) and a second tone for props
    'pilot':  dict(accent='#4f8df7', tone='#dfe7f2'),
    'coder':  dict(accent='#7a6cf0', tone='#e6e3f4'),
    'doctor': dict(accent='#2fb7a4', tone='#dff1ee'),
    'studio': dict(accent='#e0a24a', tone='#f3ead8'),
}
def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1,)

def build(theme):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    T = THEMES[theme]; M = {}
    def mat(name, hexcol, rough=0.92, emit=0.0):
        m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = lin(hexcol); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = 0
        if 'Specular IOR Level' in b.inputs: b.inputs['Specular IOR Level'].default_value = 0.15
        if emit: b.inputs['Emission Color'].default_value = lin(hexcol); b.inputs['Emission Strength'].default_value = emit
        M[name] = m; return m
    mat('clay', '#f4f0ea'); mat('floor', '#ebe5db'); mat('wall', '#f8f5f0'); mat('wood', '#d9c3a3'); mat('accent', T['accent']); mat('tone', T['tone'])
    mat('dark', '#3a3835', 0.8); mat('white', '#ffffff'); mat('gold', '#e8c46a', 0.6); mat('glass', '#cfe6fb', 0.4, emit=0.9); mat('screen', T['tone'], 0.5, emit=0.6)
    mat('green', '#8bb98a')
    coll = bpy.context.scene.collection

    def empty(name, loc=(0, 0, 0)):
        e = bpy.data.objects.new(name, None); e.location = loc; coll.objects.link(e); return e
    def box(name, m, c, s, parent=None, rot=None, bevel=0.025):
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bmesh.ops.scale(bm, vec=s, verts=bm.verts)
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(name, me); ob.location = c; coll.objects.link(ob); me.materials.append(M[m])
        if rot: ob.rotation_euler = rot
        if parent: ob.parent = parent
        for p in me.polygons: p.use_smooth = True
        if bevel: md = ob.modifiers.new('soft', 'BEVEL'); md.width = min(bevel, min(s) * 0.45); md.segments = 3; md.limit_method = 'NONE'   # rounded clay edges
        return ob
    def cyl(name, m, c, r, h, parent=None, rot=None, seg=24, r2=None):
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(name, me); ob.location = c; coll.objects.link(ob); me.materials.append(M[m])
        if rot: ob.rotation_euler = rot
        if parent: ob.parent = parent
        for p in me.polygons: p.use_smooth = True
        return ob
    def ball(name, m, c, r, parent=None, scale=(1, 1, 1)):
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=r)
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(name, me); ob.location = c; ob.scale = scale; coll.objects.link(ob); me.materials.append(M[m])
        if parent: ob.parent = parent
        for p in me.polygons: p.use_smooth = True
        return ob

    # ---- shell: floating slab, back wall with a window, left wall with a door
    shell = empty('shell')
    box('floor', 'floor', (0, 0, -0.1), (6, 5, 0.2), shell, bevel=0.05)
    W0, W1, Z0, Z1 = 0.6, 2.2, 0.9, 2.1                                    # window opening on the back wall (x range, z range)
    box('wall_back_l', 'wall', ((-3 + W0) / 2, 2.45, 1.3), (W0 + 3, 0.1, 2.6), shell)
    box('wall_back_r', 'wall', ((W1 + 3) / 2, 2.45, 1.3), (3 - W1, 0.1, 2.6), shell)
    box('wall_back_lo', 'wall', ((W0 + W1) / 2, 2.45, Z0 / 2), (W1 - W0, 0.1, Z0), shell)
    box('wall_back_hi', 'wall', ((W0 + W1) / 2, 2.45, (Z1 + 2.6) / 2), (W1 - W0, 0.1, 2.6 - Z1), shell)
    D0, D1, DH = -1.7, -0.7, 2.0                                           # door opening on the left wall (y range, height)
    box('wall_left_a', 'wall', (-2.95, (D0 - 2.5) / 2, 1.3), (0.1, D0 + 2.5, 2.6), shell)
    box('wall_left_b', 'wall', (-2.95, (D1 + 2.5) / 2, 1.3), (0.1, 2.5 - D1, 2.6), shell)
    box('wall_left_hi', 'wall', (-2.95, (D0 + D1) / 2, (DH + 2.6) / 2), (0.1, D1 - D0, 2.6 - DH), shell)
    box('base_back', 'tone', (0, 2.38, 0.06), (6, 0.04, 0.12), shell, bevel=0.01); box('base_left', 'tone', (-2.88, 0, 0.06), (0.04, 5, 0.12), shell, bevel=0.01)
    box('rug', 'tone', (0.2, -0.3, 0.012), (3.0, 2.2, 0.025), shell, bevel=0.012)

    # ---- tap targets (PRD section 7 table)
    win = empty('tap_window'); box('window_glass', 'glass', ((W0 + W1) / 2, 2.43, (Z0 + Z1) / 2), (W1 - W0, 0.02, Z1 - Z0), win, bevel=0)
    for nm, c, s in (('l', (W0, 2.42, (Z0 + Z1) / 2), (0.06, 0.08, Z1 - Z0 + 0.06)), ('r', (W1, 2.42, (Z0 + Z1) / 2), (0.06, 0.08, Z1 - Z0 + 0.06)),
                     ('t', ((W0 + W1) / 2, 2.42, Z1), (W1 - W0 + 0.06, 0.08, 0.06)), ('b', ((W0 + W1) / 2, 2.4, Z0), (W1 - W0 + 0.12, 0.2, 0.05)), ('m', ((W0 + W1) / 2, 2.42, (Z0 + Z1) / 2), (0.04, 0.06, Z1 - Z0))):
        box('wf_' + nm, 'white', c, s, win, bevel=0.01)
    door = empty('tap_door'); box('door_leaf', 'accent', (-2.9, (D0 + D1) / 2, DH / 2), (0.06, D1 - D0 - 0.08, DH - 0.04), door, bevel=0.02)
    cyl('door_knob', 'gold', (-2.84, D1 - 0.18, 1.0), 0.04, 0.05, door, rot=(0, math.pi / 2, 0)); box('door_frame', 'white', (-2.92, (D0 + D1) / 2, DH + 0.03), (0.08, D1 - D0 + 0.1, 0.06), door, bevel=0.01)
    wb = empty('tap_whiteboard'); box('wb_frame', 'white', (-0.95, 2.36, 1.55), (1.8, 0.05, 1.05), wb, bevel=0.03); box('wb_board', 'clay', (-0.95, 2.33, 1.55), (1.66, 0.03, 0.9), wb, bevel=0)
    for i, w in enumerate((0.9, 0.6, 1.1)): box(f'wb_line{i}', 'accent', (-1.1 + (w - 1.1) / 2, 2.31, 1.8 - i * 0.22), (w * 0.8, 0.012, 0.045), wb, bevel=0)
    bs = empty('tap_bookshelf'); box('bs_body', 'wood', (-2.4, 2.3, 1.0), (1.0, 0.36, 2.0), bs, bevel=0.03)
    for k in range(4):
        box(f'bs_shelf{k}', 'clay', (-2.4, 2.18, 0.42 + k * 0.5), (0.9, 0.2, 0.04), bs, bevel=0.01)
        x = -2.82
        for j, (w, h, m) in enumerate((('0.07', '0.30', 'accent'), ('0.06', '0.26', 'tone'), ('0.08', '0.32', 'white'), ('0.06', '0.24', 'accent'), ('0.07', '0.29', 'dark'), ('0.08', '0.27', 'tone'), ('0.06', '0.31', 'accent'))):
            w, h = float(w), float(h); box(f'bk{k}{j}', m, (x + w / 2, 2.16, 0.44 + k * 0.5 + h / 2), (w, 0.15, h), bs, bevel=0.008); x += w + 0.015
    tr = empty('tap_trophy'); box('tr_board', 'wood', (-2.84, 0.9, 1.45), (0.18, 1.5, 0.05), tr, bevel=0.015)
    for i, y in enumerate((0.45, 0.9, 1.35)):
        cyl(f'tr_cup{i}', 'gold', (-2.74, y, 1.53), 0.06, 0.1, tr, r2=0.035); ball(f'tr_top{i}', 'gold', (-2.74, y, 1.62), 0.045, tr)
    shield = box('tr_shield', 'accent', (-2.81, 0.9, 1.9), (0.04, 0.2, 0.24), tr, bevel=0.015)                     # Pass Guarantee shield
    fs = empty('tap_futureself')                                                                                    # clay stand-in: no face, no photo, no real person (PRD guardrails)
    cyl('fs_body', 'accent', (-1.15, -0.35, 0.78), 0.2, 1.1, fs, r2=0.14); ball('fs_head', 'clay', (-1.15, -0.35, 1.5), 0.15, fs); ball('fs_shoulders', 'accent', (-1.15, -0.35, 1.28), 0.2, fs, scale=(1.3, 0.8, 0.5))
    cyl('fs_base', 'tone', (-1.15, -0.35, 0.02), 0.28, 0.04, fs)
    desk = empty('tap_desk'); box('desk_top', 'wood', (1.4, 1.85, 0.74), (1.9, 0.85, 0.07), desk, bevel=0.03)
    for sx in (-0.85, 0.85):
        for sy in (-0.35, 0.35): box('desk_leg', 'clay', (1.4 + sx, 1.85 + sy, 0.36), (0.07, 0.07, 0.72), desk, bevel=0.015)
    box('mon_stand', 'dark', (1.4, 2.05, 0.9), (0.08, 0.08, 0.2), desk, bevel=0.01); box('mon_body', 'dark', (1.4, 2.05, 1.18), (0.78, 0.05, 0.48), desk, bevel=0.02); box('mon_screen', 'screen', (1.4, 2.02, 1.18), (0.7, 0.01, 0.42), desk, bevel=0)
    box('keyboard', 'white', (1.4, 1.68, 0.79), (0.5, 0.17, 0.025), desk, bevel=0.01)
    cyl('chair_seat', 'accent', (1.4, 1.1, 0.46), 0.26, 0.09, desk); cyl('chair_stem', 'dark', (1.4, 1.1, 0.24), 0.04, 0.4, desk); cyl('chair_base', 'dark', (1.4, 1.1, 0.04), 0.24, 0.05, desk)
    box('chair_back', 'accent', (1.4, 1.33, 0.82), (0.46, 0.07, 0.4), desk, bevel=0.03)

    # ---- theme props
    if theme == 'pilot':
        p = empty('props_pilot'); box('panel', 'dark', (0.3, 2.2, 0.85), (1.1, 0.35, 0.55), p, rot=(math.radians(-18), 0, 0), bevel=0.04)
        for i in range(6): cyl(f'dial{i}', 'white', (0.0 + i * 0.12 + (0.0 if i < 3 else 0.0), 2.03, 0.9 + (i % 2) * 0.17), 0.045, 0.02, p, rot=(math.pi / 2 + math.radians(-18), 0, 0))
        cyl('yoke_stem', 'dark', (0.3, 1.55, 0.95), 0.025, 0.3, p, rot=(math.pi / 2, 0, 0)); box('yoke_bar', 'dark', (0.3, 1.4, 0.95), (0.4, 0.04, 0.05), p, bevel=0.02)
        ball('plane_fuse', 'white', (2.4, 1.9, 0.92), 0.14, desk, scale=(0.4, 1.4, 0.4)); box('plane_wing', 'accent', (2.4, 1.9, 0.93), (0.5, 0.1, 0.02), desk, bevel=0.01); box('plane_tail', 'accent', (2.4, 1.78, 0.98), (0.02, 0.07, 0.1), desk, bevel=0.005)
        box('map', 'tone', (-0.95, 2.36, 0.62), (1.2, 0.03, 0.4), p, bevel=0.01)
    elif theme == 'coder':
        p = empty('props_coder'); box('mon2_body', 'dark', (0.55, 2.05, 1.12), (0.62, 0.05, 0.42), desk, rot=(0, 0, math.radians(18)), bevel=0.02); box('mon2_screen', 'screen', (0.57, 2.02, 1.12), (0.55, 0.01, 0.36), desk, rot=(0, 0, math.radians(18)), bevel=0)
        cyl('mug', 'white', (2.1, 1.72, 0.82), 0.05, 0.1, desk); cyl('mug_top', 'accent', (2.1, 1.72, 0.87), 0.045, 0.01, desk)
        for i, (x, z) in enumerate(((-1.5, 1.9), (-1.2, 1.78), (-0.7, 1.85), (-0.45, 1.7))): box(f'note{i}', 'accent' if i % 2 == 0 else 'gold', (x, 2.3, z), (0.14, 0.01, 0.14), wb, rot=(0, math.radians(i * 5 - 6), 0), bevel=0)
        for i in range(4): box(f'rack{i}', 'dark', (2.55, 1.0, 0.25 + i * 0.28), (0.5, 0.55, 0.2), p, bevel=0.02); box(f'rack_led{i}', 'accent', (2.55, 0.72, 0.25 + i * 0.28), (0.04, 0.01, 0.04), p, bevel=0)
    elif theme == 'doctor':
        p = empty('props_doctor')
        box('cross_v', 'accent', (-0.1, 2.34, 0.8), (0.12, 0.03, 0.4), p, bevel=0.01); box('cross_h', 'accent', (-0.1, 2.34, 0.8), (0.4, 0.03, 0.12), p, bevel=0.01)
        cyl('stool_seat', 'white', (-0.3, -1.4, 0.5), 0.2, 0.08, p); cyl('stool_leg', 'dark', (-0.3, -1.4, 0.25), 0.03, 0.5, p); cyl('stool_base', 'dark', (-0.3, -1.4, 0.03), 0.22, 0.04, p)
        cyl('steth_disc', 'dark', (2.05, 1.85, 0.8), 0.04, 0.02, desk); box('cab', 'white', (2.55, 0.9, 0.5), (0.45, 0.6, 1.0), p, bevel=0.03); box('cab_cross', 'accent', (2.31, 0.9, 0.75), (0.02, 0.18, 0.06), p, bevel=0)
        box('bed', 'tone', (-1.0, -1.7, 0.32), (1.5, 0.7, 0.14), p, bevel=0.04); box('bed_pillow', 'white', (-1.6, -1.7, 0.45), (0.3, 0.5, 0.1), p, bevel=0.04)
    else:
        p = empty('props_studio'); cyl('lamp_pole', 'dark', (2.7, -1.5, 0.75), 0.02, 1.5, p); cyl('lamp_shade', 'accent', (2.7, -1.5, 1.55), 0.22, 0.28, p, r2=0.12); cyl('lamp_base', 'dark', (2.7, -1.5, 0.02), 0.15, 0.04, p)
        cyl('pot', 'white', (-2.5, -1.9, 0.22), 0.2, 0.45, p, r2=0.15)
        for i, (x, y, z, r) in enumerate(((0, 0, 0.68, 0.22), (0.12, 0.05, 0.9, 0.18), (-0.1, -0.05, 1.05, 0.16))): ball(f'leaf{i}', 'green', (-2.5 + x, -1.9 + y, z), r, p, scale=(1, 1, 1.2))
        box('easel_l', 'wood', (1.6, -1.3, 0.7), (0.05, 0.05, 1.4), p, rot=(math.radians(10), 0, 0)); box('canvas', 'white', (1.6, -1.4, 0.95), (0.7, 0.04, 0.55), p, bevel=0.01); box('canvas_art', 'accent', (1.55, -1.42, 0.98), (0.3, 0.01, 0.25), p, bevel=0)

    # ---- export (modifiers applied so the bevels bake in)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'room-{theme}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_cameras=False, export_lights=False, export_image_format='AUTO')
    print('exported', path, os.path.getsize(path) // 1024, 'KB')
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, f'room-{theme}.blend'))

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for th in ([argv[argv.index('--theme') + 1]] if '--theme' in argv else THEMES): build(th)
