"""Build two realistic, game-rigged Sicilian pirates with melee and ranged actions.

Requires the free MPFB Blender extension (https://github.com/makehumancommunity/mpfb2).
The generated human mesh assets are CC0; MPFB's generator code is GPL-3.0.
"""
from __future__ import annotations

import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

bpy.ops.preferences.addon_enable(module="bl_ext.user_default.mpfb")
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.entities.objectproperties import HumanObjectProperties

ROOT = Path(__file__).resolve().parent
EXPORT_ROOT = ROOT / "exports" / "realistic-pirates"
BLEND_PATH = ROOT / "blender" / "RealisticSicilianPirates.blend"
EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
ASSET_ROOT = Path(os.environ.get("MAKEHUMAN_ASSETS", ""))
if not (ASSET_ROOT / "base").is_dir():
    raise RuntimeError("Set MAKEHUMAN_ASSETS to a makehuman-assets checkout containing base/.")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def mat(name, color, roughness=.62, metallic=0.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_fake_user = True
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if name.startswith("Skin"):
        bsdf.inputs["Subsurface Weight"].default_value = .08
    return material


SKIN_DARK = mat("Skin Mediterranean Umber", (.33, .12, .055, 1), .52)
SKIN_OLIVE = mat("Skin Mediterranean Olive", (.42, .19, .085, 1), .52)
EYE_BROWN = mat("Eyes Deep Brown", (.045, .018, .008, 1), .24)
EYE_HAZEL = mat("Eyes Hazel", (.12, .07, .018, 1), .24)
EYE_WHITE = mat("Eyes Sclera", (.82, .78, .68, 1), .36)
HAIR_DARK = mat("Hair Dark Brown", (.018, .008, .004, 1), .88)
LINEN_IVORY = mat("Linen Ivory", (.48, .40, .27, 1), .86)
LINEN_BLUE = mat("Linen Faded Navy", (.035, .07, .11, 1), .83)
LINEN_GREEN = mat("Linen Sea Green", (.12, .23, .17, 1), .86)
CRIMSON = mat("Crimson Sash", (.34, .015, .012, 1), .78)
LEATHER = mat("Leather Brown", (.095, .032, .012, 1), .73)
STEEL = mat("Forged Steel", (.28, .31, .33, 1), .24, .82)
WOOD = mat("Crossbow Walnut", (.16, .055, .016, 1), .72)


def remove_shape_keys(obj):
    if obj.data.shape_keys:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.shape_key_remove(all=True)


def decimate(obj, ratio):
    remove_shape_keys(obj)
    modifier = obj.modifiers.new("Roblox triangle budget", "DECIMATE")
    modifier.ratio = ratio
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def garment_from_body(body, name, z_min, z_max, material, inflate=.018, x_max=None):
    garment = body.copy()
    garment.data = bpy.data.meshes.new_from_object(body.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    garment.name = name
    bpy.context.collection.objects.link(garment)
    bpy.context.view_layer.objects.active = garment
    garment.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for vertex in garment.data.vertices:
        vertex.select = not (z_min <= vertex.co.z <= z_max and (x_max is None or abs(vertex.co.x) <= x_max))
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="VERT")
    bpy.ops.object.mode_set(mode="OBJECT")
    garment.data.materials.clear()
    garment.data.materials.append(material)
    solidify = garment.modifiers.new("Layered cloth", "SOLIDIFY")
    solidify.thickness = inflate
    return garment


def bind_rigid(obj, rig, bone_name):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    # Armature deformation operates in mesh-local space. Baking every component's
    # object transform first prevents guards, strings, and grips from separating.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    group = obj.vertex_groups.new(name=bone_name)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    modifier = obj.modifiers.new("Game skeleton", "ARMATURE")
    modifier.object = rig


def primitive(name, location, scale, material, parent_bone=None, rig=None, kind="uv"):
    if kind == "uv":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=location)
    elif kind == "cube":
        bpy.ops.mesh.primitive_cube_add(location=location)
    elif kind == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, location=location)
    elif kind == "torus":
        bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=.2, major_segments=32, minor_segments=8, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Natural softened edge", "BEVEL")
    bevel.width = .008
    bevel.segments = 2
    if parent_bone and rig:
        bind_rigid(obj, rig, parent_bone)
    return obj


def extruded_profile(name, points, thickness, material, rig, bone_name):
    vertices = [(x, -thickness / 2, z) for x, z in points] + [(x, thickness / 2, z) for x, z in points]
    count = len(points)
    faces = [tuple(range(count)), tuple(range(count, count * 2))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Forged edge bevel", "BEVEL")
    bevel.width = .006
    bevel.segments = 2
    bind_rigid(obj, rig, bone_name)
    return obj


def tube(name, points, radius, material, rig, bone_name):
    curve = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, position in zip(spline.bezier_points, points):
        point.co = position
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    bind_rigid(obj, rig, bone_name)
    return obj


def add_face_details(rig, offset, eye_material):
    for side in (-1, 1):
        white = primitive(f"EyeWhite_{side}", offset + Vector((side*.032, -.089, 1.545)), (.034, .018, .021), EYE_WHITE, "head", rig)
        iris = primitive(f"Iris_{side}", offset + Vector((side*.032, -.107, 1.545)), (.013, .005, .013), eye_material, "head", rig)
    for x in (-.105, -.055, 0, .055, .105):
        primitive(f"HairCurl_{x}", offset + Vector((x, -.005, 1.655 + abs(x)*.2)), (.08, .075, .085), HAIR_DARK, "head", rig)
    primitive("HairCap", offset + Vector((0, .002, 1.64)), (.17, .15, .11), HAIR_DARK, "head", rig)
    primitive("Beard", offset + Vector((0, -.092, 1.47)), (.105, .025, .105), HAIR_DARK, "head", rig)


def weapon_sword(rig, offset):
    blade_points = [(0.54, 1.1), (0.55, .93), (0.58, .68), (0.64, .4), (0.72, .18), (0.7, .1), (0.63, .16), (0.54, .42), (0.5, .72), (0.5, 1.08)]
    extruded_profile("CorsairFalchionBlade", blade_points, .025, STEEL, rig, "hand_r")
    fuller_points = [(0.535, 1.02), (0.545, .8), (0.58, .58), (0.64, .34)]
    tube("CorsairFalchionFuller", [(x, -.014, z) for x, z in fuller_points], .006, LEATHER, rig, "hand_r")
    guard = tube("CorsairFalchionGuard", [(.42, -.03, 1.1), (.55, -.035, 1.12), (.69, -.03, 1.08)], .018, STEEL, rig, "hand_r")
    grip = tube("CorsairFalchionGrip", [(.55, -.03, 1.12), (.55, -.03, 1.34)], .026, LEATHER, rig, "hand_r")
    for index in range(5):
        primitive(f"CorsairGripWrap_{index}", offset + Vector((.55, -.03, 1.16 + index * .035)), (.03, .03, .008), CRIMSON, "hand_r", rig, "torus")
    primitive("CorsairFalchionPommel", offset + Vector((.55, -.03, 1.37)), (.045, .035, .045), STEEL, "hand_r", rig)


def weapon_crossbow(rig, offset):
    stock_points = [(0.3, 1.03), (0.34, .9), (0.42, .94), (0.41, 1.12), (0.38, 1.3), (0.31, 1.32), (0.29, 1.15)]
    stock = extruded_profile("MarksmanCrossbowStock", stock_points, .09, WOOD, rig, "hand_r")
    stock.rotation_euler = (math.pi / 2, 0, -.12)
    tube("MarksmanCrossbowLeftLimb", [(.35, -.22, 1.18), (.16, -.25, 1.16), (.02, -.2, 1.1)], .018, WOOD, rig, "hand_r")
    tube("MarksmanCrossbowRightLimb", [(.35, -.22, 1.18), (.54, -.25, 1.16), (.68, -.2, 1.1)], .018, WOOD, rig, "hand_r")
    tube("MarksmanCrossbowStringLeft", [(.02, -.2, 1.1), (.35, -.13, 1.18)], .004, LEATHER, rig, "hand_r")
    tube("MarksmanCrossbowStringRight", [(.68, -.2, 1.1), (.35, -.13, 1.18)], .004, LEATHER, rig, "hand_r")
    tube("MarksmanCrossbowRail", [(.35, .05, .98), (.35, -.34, 1.2)], .012, STEEL, rig, "hand_r")
    tube("MarksmanLoadedBolt", [(.35, -.02, 1.22), (.35, -.48, 1.22)], .008, STEEL, rig, "hand_r")
    primitive("MarksmanCrossbowTrigger", offset + Vector((.35, -.02, 1.02)), (.018, .035, .055), STEEL, "hand_r", rig, "cube")


def dress_as_sicilian_pirate(body, rig, suit, role, name):
    suit.data.materials.clear()
    suit.data.materials.append(LINEN_IVORY if role == "Melee" else LINEN_GREEN)
    suit.data.materials.append(LEATHER)
    for polygon in suit.data.polygons:
        average_z = sum(suit.data.vertices[index].co.z for index in polygon.vertices) / len(polygon.vertices)
        polygon.material_index = 0 if average_z > .72 else 1
    bpy.context.view_layer.objects.active = suit
    suit.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for vertex in suit.data.vertices:
        vertex.select = vertex.co.z < .34
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="VERT")
    bpy.ops.object.mode_set(mode="OBJECT")
    primitive(f"{name}_CrimsonWaistSash", Vector((0, 0, .79)), (.25, .17, .025), CRIMSON, "pelvis", rig, "cylinder")
    primitive(f"{name}_LeatherBelt", Vector((0, 0, .81)), (.255, .175, .012), LEATHER, "pelvis", rig, "cylinder")


def add_action(rig, name, duration, loop, keys):
    action = bpy.data.actions.new(name)
    action["Loop"] = loop
    rig.animation_data_create()
    rig.animation_data.action = action
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    for frame, poses in keys:
        for bone_name, rotation in poses.items():
            bone = rig.pose.bones.get(bone_name)
            if not bone:
                continue
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = rotation
            bone.keyframe_insert("rotation_euler", frame=frame, group=bone_name)
    bpy.ops.object.mode_set(mode="OBJECT")
    action.frame_start, action.frame_end = 1, duration
    return action


def build_pirate(name, x_offset, role):
    body = HumanService.create_human()
    body.name = f"{name}_Body"
    HumanObjectProperties.set_value("gender", 1.0, entity_reference=body)
    HumanObjectProperties.set_value("age", .58 if role == "Melee" else .52, entity_reference=body)
    HumanObjectProperties.set_value("muscle", .72 if role == "Melee" else .55, entity_reference=body)
    HumanObjectProperties.set_value("weight", .56 if role == "Melee" else .43, entity_reference=body)
    HumanObjectProperties.set_value("african", .05, entity_reference=body)
    HumanObjectProperties.set_value("asian", .05, entity_reference=body)
    HumanObjectProperties.set_value("caucasian", .9, entity_reference=body)
    TargetService.reapply_macro_details(body)
    skin_path = ASSET_ROOT / "base" / "skins" / "middleage_caucasian_male" / "middleage_caucasian_male.mhmat"
    HumanService.set_character_skin(str(skin_path), body, skin_type="GAMEENGINE")
    rig = HumanService.add_builtin_rig(body, "game_engine")
    rig.name = f"{name}_Rig"
    # Position the rig before binding rigid accessories so the armature modifier
    # records the same object space as the skinned body and clothing.
    rig.location.x = x_offset
    assets = [
        ("clothes/male_casualsuit01/male_casualsuit01.mhclo", "Clothes"),
        ("clothes/shoes04/shoes04.mhclo", "Clothes"),
        (f"hair/{'short02' if role == 'Melee' else 'short03'}/{'short02' if role == 'Melee' else 'short03'}.mhclo", "Hair"),
    ]
    loaded_assets = []
    for relative, asset_type in assets:
        loaded_assets.append(HumanService.add_mhclo_asset(str(ASSET_ROOT / "base" / relative), body, asset_type=asset_type, material_type="GAMEENGINE"))
    dress_as_sicilian_pirate(body, rig, loaded_assets[0], role, name)
    for side in (-1, 1):
        white = primitive(f"{name}_EyeWhite_{side}", Vector((side*.032, -.089, 1.545)), (.034, .018, .021), EYE_WHITE, "head", rig)
        primitive(f"{name}_Iris_{side}", Vector((side*.032, -.107, 1.545)), (.013, .005, .013), EYE_BROWN if role == "Melee" else EYE_HAZEL, "head", rig)
    if role == "Ranged":
        weapon_crossbow(rig, Vector((0, 0, 0)))
    else:
        weapon_sword(rig, Vector((0, 0, 0)))
    actions = []
    actions.append(add_action(rig, f"{name}_Idle", 61, True, [
        (1, {"spine_02": (0, 0, 0), "upperarm_l": (.06, 0, -.08), "upperarm_r": (.06, 0, .08)}),
        (31, {"spine_02": (.035, 0, 0), "upperarm_l": (.09, 0, -.08), "upperarm_r": (.09, 0, .08)}),
        (61, {"spine_02": (0, 0, 0), "upperarm_l": (.06, 0, -.08), "upperarm_r": (.06, 0, .08)}),
    ]))
    walk_keys = []
    for frame, stride in ((1, 0), (8, 1), (16, 0), (24, -1), (31, 0)):
        walk_keys.append((frame, {"thigh_l": (-stride*.65, 0, 0), "thigh_r": (stride*.65, 0, 0), "upperarm_l": (stride*.55, 0, 0), "upperarm_r": (-stride*.55, 0, 0), "shin_l": (max(0, stride)*.5, 0, 0), "shin_r": (max(0, -stride)*.5, 0, 0), "spine_02": (.09, 0, 0)}))
    actions.append(add_action(rig, f"{name}_Run", 31, True, walk_keys))
    if role == "Melee":
        actions.append(add_action(rig, f"{name}_SwordAttack", 25, False, [
            (1, {}), (8, {"spine_02": (.05, .45, 0), "upperarm_r": (-1.3, .25, .45), "lowerarm_r": (-.5, 0, 0)}),
            (14, {"spine_02": (.12, -.5, 0), "upperarm_r": (.75, .1, .15), "lowerarm_r": (-.1, 0, 0)}), (25, {}),
        ]))
    else:
        actions.append(add_action(rig, f"{name}_CrossbowFire", 28, False, [
            (1, {}), (8, {"upperarm_l": (-.9, -.15, -.35), "lowerarm_l": (-1.05, 0, 0), "upperarm_r": (-.85, .2, .3), "lowerarm_r": (-1.0, 0, 0)}),
            (14, {"spine_02": (-.05, 0, 0), "upperarm_l": (-.95, -.15, -.35), "upperarm_r": (-.9, .2, .3)}), (28, {}),
        ]))
    return body, rig, actions


melee_body, melee_rig, melee_actions = build_pirate("SicilianCorsair", -1.1, "Melee")
ranged_body, ranged_rig, ranged_actions = build_pirate("SicilianMarksman", 1.1, "Ranged")

bpy.context.scene.render.engine = "BLENDER_EEVEE"
bpy.context.scene.render.fps = 30
texture_root = EXPORT_ROOT / "textures"
texture_root.mkdir(parents=True, exist_ok=True)
for image in bpy.data.images:
    if image.source != "FILE" or image.size[0] == 0 or image.size[1] == 0:
        continue
    largest = max(image.size[0], image.size[1])
    if largest > 512:
        factor = 512 / largest
        image.scale(max(1, round(image.size[0] * factor)), max(1, round(image.size[1] * factor)))
    image.filepath_raw = str(texture_root / f"{image.name.replace('/', '_')}.png")
    image.file_format = "PNG"
    image.save()
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))


def export_character(name, rig, body, actions):
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    body.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.parent == rig:
            obj.select_set(True)
        elif obj.type == "MESH" and any(mod.type == "ARMATURE" and mod.object == rig for mod in obj.modifiers):
            obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    rig.animation_data.action = actions[0]
    bpy.ops.export_scene.fbx(filepath=str(EXPORT_ROOT / f"{name}.fbx"), use_selection=True,
        add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True,
        bake_anim_simplify_factor=0.0, axis_forward="-Z", axis_up="Y", path_mode="COPY", embed_textures=True,
        global_scale=.16, apply_unit_scale=True, apply_scale_options="FBX_SCALE_ALL")


export_character("SicilianCorsair", melee_rig, melee_body, melee_actions)
export_character("SicilianMarksman", ranged_rig, ranged_body, ranged_actions)
print(f"Built {BLEND_PATH} and {EXPORT_ROOT}")
