# one-off: find which sun_rotation puts the Nishita sun disc at azimuth of the three.js sun (-0.86, ., -0.46) -> Blender (-0.86, 0.46)
import bpy, math, sys
ROT = math.radians(float(sys.argv[-1]))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y = 128, 64
w = bpy.data.worlds.new('w'); w.use_nodes = True; sc.world = w
nt = w.node_tree; nt.nodes.clear()
sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'MULTIPLE_SCATTERING'; sky.sun_elevation = math.radians(30); sky.sun_rotation = ROT; sky.sun_size = math.radians(3)
bg = nt.nodes.new('ShaderNodeBackground'); out = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(sky.outputs[0], bg.inputs[0]); nt.links.new(bg.outputs[0], out.inputs[0])
cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'PANO'
try: cam.data.panorama_type = 'EQUIRECTANGULAR'
except Exception: cam.data.cycles.panorama_type = 'EQUIRECTANGULAR'
cam.rotation_euler = (math.radians(90), 0, 0)   # looks along +Y, Z up
sc.render.filepath='/tmp/claude-1000/-home-ashwik-Desktop-fschool-ai/f4866264-645d-42e4-8f66-a8622be03ec9/scratchpad/calib.exr'
sc.render.image_settings.file_format='OPEN_EXR'; sc.render.image_settings.color_depth='32'
bpy.ops.render.render(write_still=True)
img = bpy.data.images.load(sc.render.filepath)
px = list(img.pixels); W, H = 128, 64
lum = sorted((((px[(y*W+x)*4]+px[(y*W+x)*4+1]+px[(y*W+x)*4+2]), x, y) for y in range(H) for x in range(W)), reverse=True)
print('top', lum[:3], 'median', lum[len(lum)//2])
best = max(((px[(y * W + x) * 4] + px[(y * W + x) * 4 + 1]), x, y) for y in range(H) for x in range(W))
_, x, y = best
lon = (x + 0.5) / W * 2 * math.pi - math.pi   # equirect: centre column = camera forward (+Y)
lat = math.pi / 2 - (H - 1 - y + 0.5) / H * math.pi   # image row 0 is the bottom in bpy pixels
# forward +Y; lon positive turns toward +X (camera right)
dx, dy = math.sin(lon), math.cos(lon)
print('SUN_DIR_XY', round(dx, 2), round(dy, 2), 'elev_deg', round(math.degrees(lat), 1))
