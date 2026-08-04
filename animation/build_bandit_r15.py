"""Build the low-poly Sicilian bandit, R15 armature, and idle/run/attack actions."""
from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
EXPORTS = ROOT / "exports" / "bandit"
EXPORTS.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
def material(name: str, color: tuple[float, float, float, float], metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.metallic = metallic
    mat.roughness = 0.72
    return mat


SKIN = material("Sun-weathered skin", (0.48, 0.25, 0.13, 1))
LINEN = material("Aged linen", (0.73, 0.65, 0.48, 1))
RED = material("Crimson sash", (0.42, 0.035, 0.025, 1))
LEATHER = material("Dark leather", (0.16, 0.055, 0.025, 1))
HAIR = material("Black curls", (0.018, 0.012, 0.009, 1))
IRON = material("Dagger iron", (0.38, 0.42, 0.45, 1), 0.75)

# Bone heads/tails are in Blender meters; the model is deliberately Roblox-proportioned.
BONES = {
    "HumanoidRootPart": ((0, 0, 0.95), (0, 0, 1.25), None),
    "LowerTorso": ((0, 0, 0.95), (0, 0, 1.75), "HumanoidRootPart"),
    "UpperTorso": ((0, 0, 1.75), (0, 0, 2.75), "LowerTorso"),
    "Head": ((0, 0, 2.75), (0, 0, 3.45), "UpperTorso"),
    "LeftUpperArm": ((-0.58, 0, 2.55), (-0.58, 0, 1.85), "UpperTorso"),
    "LeftLowerArm": ((-0.58, 0, 1.85), (-0.58, 0, 1.2), "LeftUpperArm"),
    "LeftHand": ((-0.58, 0, 1.2), (-0.58, 0, 0.9), "LeftLowerArm"),
    "RightUpperArm": ((0.58, 0, 2.55), (0.58, 0, 1.85), "UpperTorso"),
    "RightLowerArm": ((0.58, 0, 1.85), (0.58, 0, 1.2), "RightUpperArm"),
    "RightHand": ((0.58, 0, 1.2), (0.58, 0, 0.9), "RightLowerArm"),
    "LeftUpperLeg": ((-0.25, 0, 1.1), (-0.25, 0, 0.25), "LowerTorso"),
    "LeftLowerLeg": ((-0.25, 0, 0.25), (-0.25, 0, -0.55), "LeftUpperLeg"),
    "LeftFoot": ((-0.25, 0, -0.55), (-0.25, -0.42, -0.68), "LeftLowerLeg"),
    "RightUpperLeg": ((0.25, 0, 1.1), (0.25, 0, 0.25), "LowerTorso"),
    "RightLowerLeg": ((0.25, 0, 0.25), (0.25, 0, -0.55), "RightUpperLeg"),
    "RightFoot": ((0.25, 0, -0.55), (0.25, -0.42, -0.68), "RightLowerLeg"),
}

bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
rig = bpy.context.object
rig.name = "BanditR15"
armature = rig.data
armature.name = "BanditR15_Armature"
armature.edit_bones.remove(armature.edit_bones[0])
for name, (head, tail, _) in BONES.items():
    bone = armature.edit_bones.new(name)
    bone.head, bone.tail = head, tail
for name, (_, _, parent) in BONES.items():
    if parent:
        armature.edit_bones[name].parent = armature.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")


def cube(name, location, scale, mat, bone, bevel=0.08, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bevel_mod = obj.modifiers.new("Soft carved edges", "BEVEL")
    bevel_mod.width, bevel_mod.segments = bevel, 2
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    return obj


cube("LowerTorso", (0, 0, 1.35), (.44, .26, .42), LEATHER, "LowerTorso")
cube("UpperTorso", (0, 0, 2.25), (.58, .29, .54), LINEN, "UpperTorso")
cube("Head", (0, -.01, 3.05), (.38, .34, .38), SKIN, "Head", .12)
cube("Bandana", (0, 0, 3.3), (.41, .37, .11), RED, "Head", .04)
cube("Hair", (0, .05, 3.42), (.42, .35, .12), HAIR, "Head", .08)

for side, x in (("Left", -.58), ("Right", .58)):
    cube(side + "UpperArm", (x, 0, 2.2), (.18, .18, .36), SKIN, side + "UpperArm")
    cube(side + "LowerArm", (x, 0, 1.53), (.16, .16, .34), SKIN, side + "LowerArm")
    cube(side + "Hand", (x, 0, 1.03), (.17, .17, .2), SKIN, side + "Hand")
    lx = -.25 if side == "Left" else .25
    cube(side + "UpperLeg", (lx, 0, .67), (.21, .23, .43), LEATHER, side + "UpperLeg")
    cube(side + "LowerLeg", (lx, 0, -.15), (.18, .2, .4), SKIN, side + "LowerLeg")
    cube(side + "Foot", (lx, -.18, -.61), (.2, .36, .14), LEATHER, side + "Foot")

cube("CrimsonSash", (0, -.31, 2.2), (.12, .035, .7), RED, "UpperTorso", .025, (0, 0, -.52))
cube("Dagger", (.58, -.12, .68), (.045, .48, .045), IRON, "RightHand", .015, (math.pi / 8, 0, 0))
cube("DaggerGrip", (.58, .05, 1.08), (.14, .045, .045), LEATHER, "RightHand", .02)


def action(name, frames, poses):
    act = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = act
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        for bone_name, rotation in poses(frame).items():
            bone = rig.pose.bones[bone_name]
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = rotation
            bone.keyframe_insert("rotation_euler", frame=frame, group=bone_name)
    bpy.ops.object.mode_set(mode="OBJECT")
    return act


idle = action("Bandit_Idle", [1, 16, 31, 46, 61], lambda f: {
    "UpperTorso": (math.sin((f-1)/60*math.tau)*.035, 0, 0),
    "LeftUpperArm": (.08, 0, -.08), "RightUpperArm": (.08, 0, .08),
})
run = action("Bandit_Run", [1, 8, 16, 24, 31], lambda f: {
    "UpperTorso": (.16, 0, 0),
    "LeftUpperArm": (math.sin((f-1)/30*math.tau)*.8, 0, 0),
    "RightUpperArm": (-math.sin((f-1)/30*math.tau)*.8, 0, 0),
    "LeftUpperLeg": (-math.sin((f-1)/30*math.tau)*.75, 0, 0),
    "RightUpperLeg": (math.sin((f-1)/30*math.tau)*.75, 0, 0),
})

def attack_pose(frame):
    t = (frame - 1) / 21
    if t <= 1 / 3:
        power = t * 3
    elif t <= 0.58:
        power = 1 - ((t - 1 / 3) / (0.58 - 1 / 3)) * 2.4
    else:
        power = -1.4 * (1 - (t - 0.58) / 0.42)
    return {"UpperTorso": (.1 * abs(power), power * .3, 0), "RightUpperArm": (-.7 - power, .2, .35 * abs(power)), "LeftUpperArm": (-.3 * abs(power), -.15, -.2)}

attack = action("Bandit_Attack_Dagger", [1, 8, 13, 22], attack_pose)

bpy.context.scene.render.engine = "BLENDER_EEVEE"
bpy.context.scene.frame_start, bpy.context.scene.frame_end, bpy.context.scene.render.fps = 1, 61, 30
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "blender" / "SicilianBanditR15.blend"))

def export(path, selected_action=None, all_actions=False):
    rig.animation_data.action = selected_action
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.fbx(filepath=str(path), use_selection=True, add_leaf_bones=False,
        bake_anim=True, bake_anim_use_all_actions=all_actions, bake_anim_simplify_factor=0.0,
        apply_scale_options="FBX_SCALE_ALL", axis_forward="-Z", axis_up="Y")

export(EXPORTS / "SicilianBanditR15.fbx", idle, True)
for act in (idle, run, attack):
    export(EXPORTS / f"{act.name}.fbx", act, False)
print(f"Built {ROOT / 'blender' / 'SicilianBanditR15.blend'} and {EXPORTS}")
