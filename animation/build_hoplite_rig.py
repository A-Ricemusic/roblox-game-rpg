import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND_PATH = os.path.join(ROOT, "animation", "blender", "HopliteR15.blend")
RENDER_ROOT = os.path.join(ROOT, "artifacts", "blender-renders")

def rad(v):
    return math.radians(v)

def clear_scene():
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

def mat(name, color, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.metallic = metallic
    m.roughness = 0.45
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = 0.45
    return m

def cube(name, location, scale, material, armature=None, bone=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if armature and bone:
        world = obj.matrix_world.copy()
        obj.parent = armature
        obj.parent_type = "BONE"
        obj.parent_bone = bone
        obj.matrix_world = world
    return obj

def create_armature():
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    rig = bpy.context.object
    rig.name = "R15_Hoplite_Rig"
    arm = rig.data
    arm.name = "R15_Hoplite_Armature"
    arm.edit_bones.remove(arm.edit_bones[0])

    bones = {
        "HumanoidRootPart": ((0, 0, 0), (0, 0, 1.0), None),
        "LowerTorso": ((0, 0, 1.0), (0, 0, 2.0), "HumanoidRootPart"),
        "UpperTorso": ((0, 0, 2.0), (0, 0, 3.4), "LowerTorso"),
        "Head": ((0, 0, 3.4), (0, 0, 4.4), "UpperTorso"),
        "RightUpperArm": ((-0.75, 0, 3.15), (-0.75, 0, 2.25), "UpperTorso"),
        "RightLowerArm": ((-0.75, 0, 2.25), (-0.75, 0, 1.45), "RightUpperArm"),
        "RightHand": ((-0.75, 0, 1.45), (-0.75, 0, 1.0), "RightLowerArm"),
        "LeftUpperArm": ((0.75, 0, 3.15), (0.75, 0, 2.25), "UpperTorso"),
        "LeftLowerArm": ((0.75, 0, 2.25), (0.75, 0, 1.45), "LeftUpperArm"),
        "LeftHand": ((0.75, 0, 1.45), (0.75, 0, 1.0), "LeftLowerArm"),
        "RightUpperLeg": ((-0.35, 0, 1.0), (-0.35, 0, 0.0), "LowerTorso"),
        "RightLowerLeg": ((-0.35, 0, 0.0), (-0.35, 0, -1.0), "RightUpperLeg"),
        "RightFoot": ((-0.35, 0, -1.0), (-0.35, -0.45, -1.0), "RightLowerLeg"),
        "LeftUpperLeg": ((0.35, 0, 1.0), (0.35, 0, 0.0), "LowerTorso"),
        "LeftLowerLeg": ((0.35, 0, 0.0), (0.35, 0, -1.0), "LeftUpperLeg"),
        "LeftFoot": ((0.35, 0, -1.0), (0.35, -0.45, -1.0), "LeftLowerLeg"),
    }
    for name, (head, tail, parent) in bones.items():
        b = arm.edit_bones.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode="POSE")
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig

def add_ik_controls(rig):
    controls = {}
    for name, location in {
        "RightHandTarget": (-0.75, 0, 1.0),
        "LeftHandTarget": (0.75, 0, 1.0),
        "RightFootTarget": (-0.35, -0.45, -1.0),
        "LeftFootTarget": (0.35, -0.45, -1.0),
    }.items():
        bpy.ops.object.empty_add(type="SPHERE", radius=0.12, location=location)
        control = bpy.context.object
        control.name = name
        control.hide_render = True
        controls[name] = control

    for bone_name, target_name in {
        "RightHand": "RightHandTarget",
        "LeftHand": "LeftHandTarget",
        "RightFoot": "RightFootTarget",
        "LeftFoot": "LeftFootTarget",
    }.items():
        constraint = rig.pose.bones[bone_name].constraints.new("IK")
        constraint.target = controls[target_name]
        constraint.chain_count = 3
        constraint.use_tail = True
    return controls

def add_body(rig):
    skin = mat("Skin", (0.72, 0.49, 0.35))
    tunic = mat("BlackTunic", (0.035, 0.045, 0.06))
    leather = mat("Leather", (0.12, 0.07, 0.035))
    bronze = mat("Bronze", (0.72, 0.43, 0.08), 0.65)
    parts = [
        ("LowerTorso_Geo", (0,0,1.55), (.55,.32,.5), tunic, "LowerTorso"),
        ("UpperTorso_Geo", (0,0,2.7), (.78,.38,.7), tunic, "UpperTorso"),
        ("Head_Geo", (0,0,3.9), (.48,.42,.5), skin, "Head"),
        ("RightUpperArm_Geo", (-.75,0,2.7), (.28,.28,.45), tunic, "RightUpperArm"),
        ("RightLowerArm_Geo", (-.75,0,1.85), (.23,.23,.4), skin, "RightLowerArm"),
        ("RightHand_Geo", (-.75,0,1.2), (.25,.22,.25), skin, "RightHand"),
        ("LeftUpperArm_Geo", (.75,0,2.7), (.28,.28,.45), tunic, "LeftUpperArm"),
        ("LeftLowerArm_Geo", (.75,0,1.85), (.23,.23,.4), skin, "LeftLowerArm"),
        ("LeftHand_Geo", (.75,0,1.2), (.25,.22,.25), skin, "LeftHand"),
        ("RightUpperLeg_Geo", (-.35,0,.5), (.32,.34,.5), leather, "RightUpperLeg"),
        ("RightLowerLeg_Geo", (-.35,0,-.5), (.28,.3,.5), leather, "RightLowerLeg"),
        ("RightFoot_Geo", (-.35,-.25,-1.05), (.3,.48,.18), leather, "RightFoot"),
        ("LeftUpperLeg_Geo", (.35,0,.5), (.32,.34,.5), leather, "LeftUpperLeg"),
        ("LeftLowerLeg_Geo", (.35,0,-.5), (.28,.3,.5), leather, "LeftLowerLeg"),
        ("LeftFoot_Geo", (.35,-.25,-1.05), (.3,.48,.18), leather, "LeftFoot"),
    ]
    for name, location, scale, material, bone in parts:
        cube(name, location, scale, material, rig, bone)
    # The blade extends in the same direction as the forearm/hand chain. This is
    # important: when the hand IK target moves forward, the tip also points forward.
    blade = cube("HopliteSword_Blade", (-.75,0,-.35), (.09,.045,1.15), bronze, rig, "RightHand")
    guard = cube("HopliteSword_Guard", (-.75,0,.75), (.42,.09,.08), bronze, rig, "RightHand")
    grip = cube("HopliteSword_Grip", (-.75,0,1.05), (.12,.11,.3), leather, rig, "RightHand")
    for obj in (blade, guard, grip): obj["RobloxWeapon"] = True

def set_pose(rig, frame, values):
    for pb in rig.pose.bones:
        pb.rotation_euler = (0,0,0)
        pb.location = (0,0,0)
    for name, data in values.items():
        pb = rig.pose.bones[name]
        if "r" in data: pb.rotation_euler = tuple(rad(v) for v in data["r"])
        if "l" in data: pb.location = data["l"]
    for pb in rig.pose.bones:
        pb.keyframe_insert("rotation_euler", frame=frame, group=pb.name)
        pb.keyframe_insert("location", frame=frame, group=pb.name)

def action(rig, controls, name, keys, end):
    act = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = act
    for control in controls.values():
        if control.animation_data:
            control.animation_data_clear()
    neutral_controls = {
        "RightHandTarget": (-0.75, 0, 1.0), "LeftHandTarget": (0.75, 0, 1.0),
        "RightFootTarget": (-0.35, -0.45, -1.0), "LeftFootTarget": (0.35, -0.45, -1.0),
    }
    for frame, pose, targets in keys:
        set_pose(rig, frame, pose)
        for control_name, neutral_location in neutral_controls.items():
            controls[control_name].location = targets.get(control_name, neutral_location)
            controls[control_name].keyframe_insert("location", frame=frame)
    act.use_fake_user = True
    act["frame_end"] = end
    # Convert the target-driven result into ordinary bone keyframes. Each attack
    # becomes self-contained and can be previewed/exported without live controls.
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.nla.bake(
        frame_start=1, frame_end=end, step=1, only_selected=False,
        visual_keying=True, clear_constraints=False, clear_parents=False,
        use_current_action=True, clean_curves=False, bake_types={"POSE"},
    )
    rig.animation_data.action.name = name
    rig.animation_data.action.use_fake_user = True
    return act

def create_actions(rig, controls):
    neutral = {}
    # Forward is -Y. Arm local X rotation brings a hanging limb forward/back.
    # World-space controls make the silhouette intentional. Forward is -Y.
    action(rig, controls, "SwordAttack01_DownwardDiagonal", [
        (1, neutral, {}),
        (6, {"UpperTorso":{"r":(0,0,-18)}}, {"RightHandTarget":(-1.0,-.45,4.3), "LeftHandTarget":(-.35,-.35,3.55)}),
        (11,{"HumanoidRootPart":{"l":(0,-.25,-.05)}, "UpperTorso":{"r":(8,0,22)}}, {"RightHandTarget":(.75,-1.35,1.45), "LeftHandTarget":(.15,-.8,2.4), "RightFootTarget":(-.35,-1.15,-1.0)}),
        (17,{"UpperTorso":{"r":(4,0,12)}}, {"RightHandTarget":(.9,-.8,1.15), "LeftHandTarget":(.25,-.45,2.1), "RightFootTarget":(-.35,-.95,-1.0)}),
        (24,neutral,{})], 24)
    action(rig, controls, "SwordAttack02_RisingDiagonal", [
        (1,neutral,{}),
        (5,{"UpperTorso":{"r":(6,0,20)}},{"RightHandTarget":(.8,-.6,1.15), "LeftHandTarget":(.2,-.4,2.1)}),
        (11,{"HumanoidRootPart":{"l":(0,-.22,-.04)}, "UpperTorso":{"r":(-8,0,-22)}},{"RightHandTarget":(-1.0,-1.0,4.0), "LeftHandTarget":(-.35,-.6,3.3), "RightFootTarget":(-.35,-1.05,-1.0)}),
        (17,{"UpperTorso":{"r":(-4,0,-12)}},{"RightHandTarget":(-.9,-.55,4.25), "LeftHandTarget":(-.2,-.3,3.45), "RightFootTarget":(-.35,-.8,-1.0)}),
        (24,neutral,{})],24)
    action(rig, controls, "SwordAttack03_ForwardThrust", [
        (1,neutral,{}),
        (6,{"UpperTorso":{"r":(0,0,12)}},{"RightHandTarget":(-1.0,.2,2.55), "LeftHandTarget":(-.35,.05,2.45)}),
        (11,{"HumanoidRootPart":{"l":(0,-.5,-.08)}, "UpperTorso":{"r":(-12,0,0)}},{"RightHandTarget":(-.15,-2.15,2.65), "LeftHandTarget":(-.25,-1.45,2.62), "RightFootTarget":(-.35,-1.4,-1.0)}),
        (16,{"HumanoidRootPart":{"l":(0,-.42,-.05)}, "UpperTorso":{"r":(-8,0,0)}},{"RightHandTarget":(-.15,-1.9,2.65), "LeftHandTarget":(-.25,-1.25,2.62), "RightFootTarget":(-.35,-1.2,-1.0)}),
        (24,neutral,{})],24)
    action(rig, controls, "SwordAttack04_Whirlwind", [
        (1,neutral,{}),
        (6,{"UpperTorso":{"r":(0,0,-10)}},{"RightHandTarget":(-.15,-1.75,2.55), "LeftHandTarget":(-.2,-1.25,2.55)}),
        (12,{"HumanoidRootPart":{"r":(0,35,0)}},{"RightHandTarget":(-.15,-1.75,2.55), "LeftHandTarget":(-.2,-1.25,2.55)}),
        (17,{"HumanoidRootPart":{"r":(0,145,0)}},{"RightHandTarget":(-.15,-1.75,2.55), "LeftHandTarget":(-.2,-1.25,2.55)}),
        (21,{"HumanoidRootPart":{"r":(0,285,0)}},{"RightHandTarget":(-.15,-1.75,2.55), "LeftHandTarget":(-.2,-1.25,2.55)}),
        (24,{"HumanoidRootPart":{"r":(0,360,0)}},{"RightHandTarget":(-.15,-1.75,2.55), "LeftHandTarget":(-.2,-1.25,2.55)}),
        (32,neutral,{})],32)

def setup_scene(rig):
    world = bpy.context.scene.world
    world.color = (0.025,0.035,0.06)
    ground = mat("Ground", (.08,.1,.14))
    cube("Ground", (0,0,-1.35), (6,6,.12), ground)
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0,0,1.5))
    target = bpy.context.object
    target.name = "CameraTarget"
    bpy.ops.object.camera_add(location=(8,-13,4.8))
    cam = bpy.context.object
    cam.name = "ReviewCamera"
    bpy.context.scene.camera = cam
    # Track camera toward torso.
    constraint = cam.constraints.new(type="TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    bpy.ops.object.light_add(type="AREA", location=(4,-4,7))
    bpy.context.object.data.energy = 1300
    bpy.context.object.data.shape = "DISK"
    bpy.context.object.data.size = 5
    bpy.ops.object.light_add(type="AREA", location=(-4,1,4))
    bpy.context.object.data.energy = 700
    bpy.context.object.data.size = 4
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.fps = 24

def render_contacts(rig):
    os.makedirs(RENDER_ROOT, exist_ok=True)
    contacts = {
        "SwordAttack01_DownwardDiagonal": 10,
        "SwordAttack02_RisingDiagonal": 10,
        "SwordAttack03_ForwardThrust": 11,
        "SwordAttack04_Whirlwind": 21,
    }
    for name, frame in contacts.items():
        rig.animation_data.action = bpy.data.actions[name]
        bpy.context.scene.frame_set(frame)
        bpy.context.scene.render.filepath = os.path.join(RENDER_ROOT, f"{name}_contact.png")
        bpy.ops.render.render(write_still=True)

def main():
    clear_scene()
    rig = create_armature()
    add_body(rig)
    controls = add_ik_controls(rig)
    create_actions(rig, controls)
    for bone in ("RightHand", "LeftHand", "RightFoot", "LeftFoot"):
        for constraint in rig.pose.bones[bone].constraints:
            constraint.mute = True
    setup_scene(rig)
    os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    render_contacts(rig)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

main()
