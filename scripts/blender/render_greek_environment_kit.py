"""Render a contact sheet of the generated Greek environment kit."""

from pathlib import Path
import math
import bpy


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "assets" / "blender" / "previews" / "greek_environment_kit.png"


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    positions = {
        "Greek_Doric_Column_Tall": (-10, 5, 0),
        "Greek_Doric_Column_Short": (-5, 5, 0),
        "Greek_Gateway_Entablature": (2, 5, 10),
        "Greek_Bronze_Brazier": (10, 4, 0),
        "Greek_Olive_Tree": (5, -6, 0),
        "Greek_Fountain_Basin": (-6, -7, 0),
        "Greek_Temple_Roof": (0, 23, 0),
        "Greek_Amphora": (13, -5, 0),
        "Greek_Ruined_Column": (-13, -8, 0),
        "Greek_Cliff_Module": (18, 14, 0),
        "Greek_Athena_Statue": (-19, 13, 0),
    }
    for collection_name, position in positions.items():
        for obj in bpy.data.collections[collection_name].objects:
            obj.location.x += position[0]
            obj.location.y += position[1]
            obj.location.z += position[2]

    bpy.ops.object.light_add(type="AREA", location=(5, -5, 24))
    bpy.context.object.data.energy = 1800
    bpy.context.object.data.shape = "DISK"
    bpy.context.object.data.size = 12
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 20))
    bpy.context.object.rotation_euler = (math.radians(25), math.radians(-20), math.radians(-25))
    bpy.context.object.data.energy = 2.0
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.05))
    floor = bpy.context.object
    floor.data.materials.append(bpy.data.materials["Aged Pentelic Marble"])

    bpy.ops.object.camera_add(location=(48, -58, 38))
    camera = bpy.context.object
    direction = (mathutils.Vector((0, 0, 5.0)) - camera.location).to_track_quat("-Z", "Y")
    camera.rotation_euler = direction.to_euler()
    camera.data.lens = 54
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUTPUT)
    scene.world.color = (0.045, 0.07, 0.12)
    bpy.ops.render.render(write_still=True)


import mathutils

if __name__ == "__main__":
    main()
