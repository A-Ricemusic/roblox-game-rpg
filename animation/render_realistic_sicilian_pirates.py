from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT / "blender" / "RealisticSicilianPirates.blend"))

bpy.ops.object.camera_add(location=(0, -6.5, 1.25))
camera = bpy.context.object
camera.data.lens = 60
bpy.context.scene.camera = camera

def point_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()

point_at(camera, (0, 0, .9))
for location, energy, size in (((-3, -4, 5), 1100, 4), ((4, -2, 3), 850, 3), ((0, 3, 4), 900, 3)):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    point_at(light, (0, 0, 1))

world = bpy.context.scene.world
world.color = (.025, .025, .03)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1600
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(ROOT / "previews" / "realistic_sicilian_pirates.png")
(ROOT / "previews").mkdir(parents=True, exist_ok=True)
bpy.ops.render.render(write_still=True)
