"""Generate the first production-art pass for the Greek starting area.

Run with Blender in background mode. Each top-level collection is exported as an
individual FBX with Roblox-friendly dimensions and a bottom-centre origin.
"""

from pathlib import Path
import math
import bpy


ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = ROOT / "assets" / "blender"
EXPORT_ROOT = ASSET_ROOT / "exports"
SOURCE_PATH = ASSET_ROOT / "source" / "greek_environment_kit.blend"


def material(name, color, metallic=0.0, roughness=0.6):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.metallic = metallic
    value.roughness = roughness
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return value


MARBLE = material("Aged Pentelic Marble", (0.77, 0.72, 0.61), roughness=0.72)
MARBLE_LIGHT = material("Fresh Marble Edge", (0.91, 0.87, 0.76), roughness=0.58)
BRONZE = material("Aged Bronze", (0.25, 0.12, 0.045), metallic=0.82, roughness=0.38)
PATINA = material("Bronze Patina", (0.07, 0.25, 0.21), metallic=0.45, roughness=0.65)
BARK = material("Olive Bark", (0.19, 0.105, 0.045), roughness=0.92)
LEAF = material("Olive Leaves", (0.17, 0.31, 0.09), roughness=0.82)
LEAF_LIGHT = material("Olive Leaf Highlights", (0.34, 0.43, 0.17), roughness=0.78)
WATER = material("Fountain Water", (0.04, 0.34, 0.47), metallic=0.08, roughness=0.18)


def collection(name):
    value = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(value)
    return value


def move_to(obj, target):
    for source in list(obj.users_collection):
        source.objects.unlink(obj)
    target.objects.link(obj)


def cube(target, name, location, scale, mat, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0] / 2, scale[1] / 2, scale[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Hand-worn edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    obj.data.materials.append(mat)
    move_to(obj, target)
    return obj


def cylinder(target, name, location, radius, depth, mat, vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    move_to(obj, target)
    return obj


def torus(target, name, location, major_radius, minor_radius, mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=28, minor_segments=8, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    move_to(obj, target)
    return obj


def fluted_shaft(target, name, height, mat):
    segments = 40
    rings = ((1.30, 1.05), (1.25, 1.05 + height * 0.42), (1.12, 1.05 + height))
    vertices = []
    for radius, z in rings:
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            fluted_radius = radius * (0.94 if index % 2 else 1.0)
            vertices.append((math.cos(angle) * fluted_radius, math.sin(angle) * fluted_radius, z))
    faces = []
    for ring in range(len(rings) - 1):
        for index in range(segments):
            next_index = (index + 1) % segments
            lower = ring * segments
            upper = (ring + 1) * segments
            faces.append((lower + index, lower + next_index, upper + next_index, upper + index))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple((len(rings) - 1) * segments + index for index in range(segments)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    target.objects.link(obj)
    bevel = obj.modifiers.new("Softened flutes", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 2
    return obj


def uv_sphere(target, name, location, scale, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    move_to(obj, target)
    return obj


def doric_column(name, height):
    target = collection(name)
    cube(target, "Plinth", (0, 0, 0.3), (4.2, 4.2, 0.6), MARBLE, 0.12)
    cube(target, "Base", (0, 0, 0.78), (3.55, 3.55, 0.36), MARBLE_LIGHT, 0.07)
    shaft_height = height - 2.1
    fluted_shaft(target, "Fluted Shaft", shaft_height, MARBLE_LIGHT)
    cylinder(target, "Echinus", (0, 0, height - 0.82), 1.72, 0.65, MARBLE_LIGHT, 20)
    cube(target, "Abacus", (0, 0, height - 0.28), (4.05, 4.05, 0.56), MARBLE, 0.1)


def brazier():
    target = collection("Greek_Bronze_Brazier")
    cylinder(target, "Foot", (0, 0, 0.18), 1.15, 0.36, BRONZE, 20)
    cylinder(target, "Stem", (0, 0, 1.7), 0.28, 2.75, BRONZE, 16)
    cylinder(target, "Collar", (0, 0, 3.03), 0.62, 0.28, PATINA, 20)
    torus(target, "Hammered Bowl Rim", (0, 0, 3.48), 1.28, 0.22, BRONZE)
    bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=0.62, radius2=1.32, depth=0.58, location=(0, 0, 3.18))
    bowl = bpy.context.object
    bowl.name = "Hammered Bowl"
    bowl.data.materials.append(BRONZE)
    move_to(bowl, target)
    cylinder(target, "Fire Anchor", (0, 0, 3.52), 0.72, 0.08, PATINA, 16)


def olive_tree():
    target = collection("Greek_Olive_Tree")
    trunk = cylinder(target, "Ancient Trunk", (0, 0, 2.8), 0.72, 5.6, BARK, 12)
    trunk.scale = (1.0, 0.82, 1.0)
    for index, (angle, height, length) in enumerate(((22, 5.0, 4.5), (112, 4.7, 4.0), (205, 5.1, 4.4), (294, 4.8, 3.8))):
        radians = math.radians(angle)
        branch = cylinder(target, f"Branch {index + 1}", (math.cos(radians) * 1.05, math.sin(radians) * 1.05, height), 0.3, length, BARK, 10)
        branch.rotation_euler = (math.radians(55), 0, radians)
    clusters = ((-2.3, 0.2, 6.8), (2.0, 0.8, 7.1), (-0.3, -2.0, 7.5), (0.7, 2.2, 7.8), (0, 0, 8.5))
    for index, position in enumerate(clusters):
        uv_sphere(target, f"Leaf Cluster {index + 1}", position, (2.8, 2.1, 1.45), LEAF_LIGHT if index % 2 else LEAF)


def fountain():
    target = collection("Greek_Fountain_Basin")
    cylinder(target, "Lower Step", (0, 0, 0.22), 7.5, 0.44, MARBLE, 32)
    torus(target, "Basin Rim", (0, 0, 0.72), 6.25, 0.58, MARBLE_LIGHT)
    cylinder(target, "Water Surface", (0, 0, 1.08), 5.9, 0.08, WATER, 32)
    cylinder(target, "Centre Pedestal", (0, 0, 1.75), 1.15, 1.45, MARBLE, 20)
    bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=1.35, radius2=2.25, depth=0.42, location=(0, 0, 2.45))
    upper = bpy.context.object
    upper.name = "Upper Bowl"
    upper.data.materials.append(MARBLE_LIGHT)
    move_to(upper, target)
    torus(target, "Upper Bowl Rim", (0, 0, 2.66), 2.05, 0.22, MARBLE_LIGHT)


def gateway():
    target = collection("Greek_Gateway_Entablature")
    cube(target, "Architrave", (0, 0, 0.7), (30, 4.2, 1.4), MARBLE_LIGHT, 0.08)
    cube(target, "Frieze", (0, 0, 1.75), (27.5, 4.35, 0.7), MARBLE, 0.05)
    for index in range(9):
        cube(target, f"Triglyph {index + 1}", (-12 + index * 3, -2.25, 1.75), (0.68, 0.18, 0.72), BRONZE, 0.02)
    cube(target, "Cornice", (0, 0, 2.55), (31.5, 4.7, 0.9), MARBLE_LIGHT, 0.1)


def export_collection(target):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in target.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(target.objects), None)
    path = EXPORT_ROOT / f"{target.name}.fbx"
    bpy.ops.export_scene.fbx(
        filepath=str(path), use_selection=True, apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_UNITS", axis_forward="-Z", axis_up="Y",
        bake_space_transform=True, add_leaf_bones=False, mesh_smooth_type="FACE",
    )


def consolidate_collection(target):
    groups = {}
    for obj in list(target.objects):
        if obj.type != "MESH":
            continue
        material_name = obj.data.materials[0].name if obj.data.materials else "Unmaterialed"
        groups.setdefault(material_name, []).append(obj)
    for material_name, objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        for obj in objects:
            for modifier in list(obj.modifiers):
                bpy.context.view_layer.objects.active = obj
                bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = f"{target.name} - {material_name}"
        bpy.context.scene.cursor.location = (0, 0, 0)
        bpy.ops.object.origin_set(type="ORIGIN_CURSOR")


def main():
    EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
    SOURCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for value in list(bpy.data.collections):
        if value != bpy.context.scene.collection:
            bpy.data.collections.remove(value)
    doric_column("Greek_Doric_Column_Tall", 12.2)
    doric_column("Greek_Doric_Column_Short", 8.7)
    gateway()
    brazier()
    olive_tree()
    fountain()
    for value in list(bpy.data.collections):
        if value != bpy.context.scene.collection:
            consolidate_collection(value)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_PATH))
    for value in list(bpy.data.collections):
        if value != bpy.context.scene.collection:
            export_collection(value)


if __name__ == "__main__":
    main()
