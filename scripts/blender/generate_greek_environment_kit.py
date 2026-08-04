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
TERRACOTTA = material("Weathered Terracotta", (0.43, 0.13, 0.055), roughness=0.86)
CLAY = material("Attic Red Clay", (0.34, 0.095, 0.035), roughness=0.78)
CLAY_DARK = material("Attic Black Glaze", (0.035, 0.022, 0.016), roughness=0.42)
ROCK = material("Aegean Cliff Stone", (0.23, 0.21, 0.17), roughness=0.96)


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


def lathe_profile(target, name, profile, mat, segments=48):
    vertices = []
    for radius, z in profile:
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            vertices.append((math.cos(angle) * radius, math.sin(angle) * radius, z))
    faces = []
    for ring in range(len(profile) - 1):
        for index in range(segments):
            next_index = (index + 1) % segments
            lower = ring * segments
            upper = (ring + 1) * segments
            faces.append((lower + index, lower + next_index, upper + next_index, upper + index))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    target.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def curve_tube(target, name, points, radius, mat):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    target.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def leaf_mesh(target, name, location, rotation, scale, mat):
    vertices = [(0, -1, 0), (0.55, -0.2, 0.08), (0.42, 0.65, 0.04), (0, 1, 0), (-0.42, 0.65, 0.04), (-0.55, -0.2, 0.08)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3, 4, 5)])
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = rotation
    obj.scale = scale
    obj.data.materials.append(mat)
    target.objects.link(obj)
    solidify = obj.modifiers.new("Leaf thickness", "SOLIDIFY")
    solidify.thickness = 0.025
    return obj


def roof_tile(target, name, location, rotation_x, mat):
    segments = 8
    length = 2.35
    vertices = []
    for y in (-length / 2, length / 2):
        for index in range(segments + 1):
            angle = math.pi * index / segments
            vertices.append((math.cos(angle) * 1.15, y, math.sin(angle) * 0.34))
    faces = []
    for index in range(segments):
        faces.append((index, index + 1, segments + 2 + index, segments + 1 + index))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler.x = rotation_x
    obj.data.materials.append(mat)
    target.objects.link(obj)
    solidify = obj.modifiers.new("Handmade tile thickness", "SOLIDIFY")
    solidify.thickness = 0.09
    bevel = obj.modifiers.new("Worn tile edge", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 2
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
    curve_tube(target, "Gnarled Trunk", ((0, 0, 0), (-0.25, 0.12, 1.8), (0.2, -0.1, 3.5), (0, 0, 5.2)), 0.68, BARK)
    branches = ((0, 0, 4.2, -3.5, 0.8, 7.0), (0, 0, 4.5, 3.4, 1.1, 7.3), (0, 0, 4.7, -0.8, -3.2, 7.7), (0, 0, 4.9, 1.1, 3.1, 8.0), (0, 0, 5.0, 0.2, 0, 9.0))
    tips = []
    for index, (x, y, z, tx, ty, tz) in enumerate(branches):
        curve_tube(target, f"Branch {index + 1}", ((x, y, z), (tx * 0.45, ty * 0.45, z + 1.2), (tx, ty, tz)), 0.24 if index < 4 else 0.3, BARK)
        tips.append((tx, ty, tz))
    for cluster, (tx, ty, tz) in enumerate(tips):
        for index in range(26):
            angle = index * 2.399963 + cluster * 0.7
            radius = 0.45 + (index % 7) * 0.22
            location = (tx + math.cos(angle) * radius, ty + math.sin(angle) * radius * 0.72, tz + ((index * 5) % 9 - 4) * 0.17)
            rotation = (math.radians(58 + index % 4 * 9), angle, math.radians(index * 17 % 360))
            leaf_mesh(target, f"Leaf {cluster + 1}-{index + 1}", location, rotation, (0.34, 0.72, 0.34), LEAF_LIGHT if index % 5 == 0 else LEAF)


def fountain():
    target = collection("Greek_Fountain_Basin")
    lathe_profile(target, "Carved Basin", ((7.5, 0), (7.5, 0.28), (7.15, 0.44), (6.85, 0.82), (6.35, 1.12), (5.95, 1.16)), MARBLE, 64)
    torus(target, "Rolled Basin Rim", (0, 0, 1.08), 6.35, 0.22, MARBLE_LIGHT)
    cylinder(target, "Water Surface", (0, 0, 1.08), 5.9, 0.08, WATER, 32)
    lathe_profile(target, "Central Pedestal", ((1.35, 1.12), (1.12, 1.3), (0.82, 2.25), (1.0, 2.45), (2.15, 2.65), (2.28, 2.84), (1.9, 2.95)), MARBLE_LIGHT, 48)
    torus(target, "Upper Bowl Rim", (0, 0, 2.84), 2.12, 0.16, MARBLE_LIGHT)


def gateway():
    target = collection("Greek_Gateway_Entablature")
    cube(target, "Architrave", (0, 0, 0.7), (30, 4.2, 1.4), MARBLE_LIGHT, 0.08)
    cube(target, "Frieze", (0, 0, 1.75), (27.5, 4.35, 0.7), MARBLE, 0.05)
    for index in range(9):
        cube(target, f"Triglyph {index + 1}", (-12 + index * 3, -2.25, 1.75), (0.68, 0.18, 0.72), BRONZE, 0.02)
    cube(target, "Cornice", (0, 0, 2.55), (31.5, 4.7, 0.9), MARBLE_LIGHT, 0.1)


def triangular_prism(target, name, width, depth, height, location, mat):
    half_width = width / 2
    half_depth = depth / 2
    vertices = [
        (-half_width, -half_depth, 0), (half_width, -half_depth, 0), (0, -half_depth, height),
        (-half_width, half_depth, 0), (half_width, half_depth, 0), (0, half_depth, height),
    ]
    faces = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.data.materials.append(mat)
    target.objects.link(obj)
    return obj


def temple_roof():
    target = collection("Greek_Temple_Roof")
    for side, direction in (("South", -1), ("North", 1)):
        underlay = cube(target, f"{side} Roof Underlay", (0, direction * 9.6, 3.05), (44, 19.7, 0.3), TERRACOTTA, 0.03)
        underlay.rotation_euler.x = math.radians(direction * 15)
        for row in range(9):
            y = direction * (1.2 + row * 2.05)
            z = 5.55 - row * 0.53
            for column in range(18):
                x = -20.4 + column * 2.4
                roof_tile(target, f"{side} Curved Tile {row + 1}-{column + 1}", (x, y, z), math.radians(direction * 15), TERRACOTTA)
    triangular_prism(target, "Front Pediment", 44, 1.2, 5.9, (0, -18.7, 0), MARBLE_LIGHT)
    triangular_prism(target, "Rear Pediment", 44, 1.2, 5.9, (0, 18.7, 0), MARBLE)
    cube(target, "Ridge Beam", (0, 0, 5.8), (44.8, 1.0, 0.8), TERRACOTTA, 0.12)


def amphora():
    target = collection("Greek_Amphora")
    lathe_profile(target, "Wheel-thrown Vessel", ((0.46, 0), (0.62, 0.16), (0.68, 0.36), (1.05, 0.72), (1.28, 1.45), (1.18, 2.15), (0.78, 2.55), (0.55, 2.72), (0.52, 3.48)), CLAY, 64)
    torus(target, "Lip", (0, 0, 3.62), 0.55, 0.12, CLAY_DARK)
    for side in (-1, 1):
        curve_tube(target, f"Handle {side}", ((side * 0.5, 0, 3.3), (side * 1.25, 0, 3.05), (side * 1.05, 0, 2.25)), 0.13, CLAY_DARK)
    torus(target, "Painted Shoulder Band", (0, 0, 2.48), 1.02, 0.09, CLAY_DARK)


def ruined_column():
    target = collection("Greek_Ruined_Column")
    shaft = fluted_shaft(target, "Broken Fluted Drum", 7.2, MARBLE_LIGHT)
    shaft.rotation_euler.y = math.radians(90)
    shaft.location = (-3.6, 0, 1.3)
    cube(target, "Broken Capital", (4.2, 0.3, 1.15), (3.5, 3.5, 1.8), MARBLE, 0.18).rotation_euler = (math.radians(8), math.radians(-12), math.radians(14))


def cliff_module():
    target = collection("Greek_Cliff_Module")
    boulders = ((-5.2, 0, 4.2, 5.8, 5.1, 4.5), (0, 0.4, 5.5, 6.4, 5.5, 5.8), (5.4, -0.3, 4.5, 5.7, 5.2, 4.9), (-2.5, 1.2, 8.0, 4.8, 4.2, 3.5), (3.1, 0.6, 8.6, 4.5, 4.4, 3.8))
    for index, (x, y, z, sx, sy, sz) in enumerate(boulders):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1, location=(x, y, z))
        obj = bpy.context.object
        obj.name = f"Weathered Rock {index + 1}"
        obj.scale = (sx, sy, sz)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        texture = bpy.data.textures.new(f"Rock strata {index + 1}", type="CLOUDS")
        texture.noise_scale = 0.65
        texture.noise_depth = 2
        displacement = obj.modifiers.new("Eroded strata", "DISPLACE")
        displacement.texture = texture
        displacement.strength = 0.62
        displacement.texture_coords = "GLOBAL"
        obj.data.materials.append(ROCK)
        move_to(obj, target)
        obj.rotation_euler = (math.radians(index * 7), math.radians(index * 19), math.radians(index * 11))


def athena_statue():
    target = collection("Greek_Athena_Statue")
    cube(target, "Statue Plinth", (0, 0, 0.65), (7, 7, 1.3), MARBLE, 0.16)
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=2.0, radius2=0.95, depth=7.2, location=(0, 0, 4.9))
    robe = bpy.context.object
    robe.name = "Draped Robe"
    robe.data.materials.append(MARBLE_LIGHT)
    move_to(robe, target)
    uv_sphere(target, "Head", (0, 0, 9.25), (0.92, 0.86, 1.05), MARBLE_LIGHT)
    cylinder(target, "Right Arm", (1.35, 0, 7.25), 0.34, 3.3, MARBLE_LIGHT, 16).rotation_euler.y = math.radians(-28)
    cylinder(target, "Spear", (2.5, 0, 7.2), 0.12, 12.8, BRONZE, 12)
    cylinder(target, "Shield", (-1.65, -0.2, 6.8), 2.05, 0.34, BRONZE, 32).rotation_euler.y = math.radians(90)
    torus(target, "Shield Rim", (-1.82, -0.2, 6.8), 1.82, 0.13, PATINA).rotation_euler.y = math.radians(90)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=1.15, radius2=0.35, depth=1.25, location=(0, 0, 10.35))
    helm = bpy.context.object
    helm.name = "Corinthian Helm"
    helm.data.materials.append(BRONZE)
    move_to(helm, target)
    cube(target, "Helmet Crest", (0, 0, 11.35), (0.34, 2.2, 1.6), PATINA, 0.14)


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
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        bpy.ops.object.mode_set(mode="OBJECT")
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
    temple_roof()
    amphora()
    ruined_column()
    cliff_module()
    athena_statue()
    for value in list(bpy.data.collections):
        if value != bpy.context.scene.collection:
            consolidate_collection(value)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_PATH))
    for value in list(bpy.data.collections):
        if value != bpy.context.scene.collection:
            export_collection(value)


if __name__ == "__main__":
    main()
