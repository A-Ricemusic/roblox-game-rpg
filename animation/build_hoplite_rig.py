import bpy
import math
import os
from html import escape
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND_PATH = os.path.join(ROOT, "animation", "blender", "HopliteR15.blend")
EXPORT_ROOT = os.path.join(ROOT, "animation", "exports")
ROBLOX_EXPORT_ROOT = os.path.join(EXPORT_ROOT, "hoplite", "roblox")
RENDER_ROOT = os.path.join(ROOT, "artifacts", "blender-renders")
ANIMATION_REVIEW_ROOT = os.path.join(RENDER_ROOT, "hoplite-review")

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
        "RightFootTarget": (-0.50, -0.72, -1.0), "LeftFootTarget": (0.50, -0.12, -1.0),
    }
    for frame, pose, targets in keys:
        pose_with_stance = {"HumanoidRootPart": {"l": (0, 0, -0.20)}, **pose}
        set_pose(rig, frame, pose_with_stance)
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
    # Forward is -Y. Both hands stay in front of the torso and travel together
    # like the two-handed reference combo. The right hand owns the sword; the
    # left hand supports the grip without crossing the blade's continuation.
    guard = {
        "RightHandTarget": (-0.45, -0.72, 2.35),
        "LeftHandTarget": (0.02, -0.62, 2.42),
    }
    action(rig, controls, "SwordAttack01_DownwardDiagonal", [
        (1, {"UpperTorso":{"r":(4,0,4)}}, guard),
        (3, {"LowerTorso":{"r":(-4,0,-8)}, "UpperTorso":{"r":(3,0,-18)}}, {
            "RightHandTarget":(-1.28,-.72,2.58), "LeftHandTarget":(-.82,-.65,2.55)}),
        (6, {"HumanoidRootPart":{"l":(0,-.12,-.24)}, "LowerTorso":{"r":(5,0,8)}, "UpperTorso":{"r":(-4,0,24)}}, {
            "RightHandTarget":(1.08,-1.18,2.42), "LeftHandTarget":(.58,-1.02,2.48),
            "RightFootTarget":(-.35,-.82,-1.0), "LeftFootTarget":(.35,-.25,-1.0)}),
        (8, {"UpperTorso":{"r":(-2,0,18)}}, {
            "RightHandTarget":(1.24,-.92,2.38), "LeftHandTarget":(.72,-.84,2.44),
            "RightFootTarget":(-.35,-.75,-1.0)}),
        (11, {"UpperTorso":{"r":(3,0,7)}}, guard)], 11)
    action(rig, controls, "SwordAttack02_RisingDiagonal", [
        (1, {"UpperTorso":{"r":(3,0,7)}}, guard),
        (3, {"LowerTorso":{"r":(-3,0,8)}, "UpperTorso":{"r":(5,0,22)}}, {
            "RightHandTarget":(1.12,-.88,1.82), "LeftHandTarget":(.63,-.82,1.98)}),
        (6, {"HumanoidRootPart":{"l":(0,-.12,-.23)}, "LowerTorso":{"r":(4,0,-7)}, "UpperTorso":{"r":(-5,0,-25)}}, {
            "RightHandTarget":(-1.20,-1.06,3.18), "LeftHandTarget":(-.72,-.96,3.03),
            "LeftFootTarget":(.35,-.76,-1.0), "RightFootTarget":(-.35,-.28,-1.0)}),
        (8, {"UpperTorso":{"r":(-3,0,-17)}}, {
            "RightHandTarget":(-1.30,-.86,3.32), "LeftHandTarget":(-.78,-.78,3.15),
            "LeftFootTarget":(.35,-.68,-1.0)}),
        (11, {"UpperTorso":{"r":(3,0,-5)}}, guard)],11)
    action(rig, controls, "SwordAttack03_ForwardThrust", [
        (1, {"UpperTorso":{"r":(3,0,-5)}}, guard),
        (3, {"LowerTorso":{"r":(-6,0,-5)}, "UpperTorso":{"r":(2,0,-18)}}, {
            "RightHandTarget":(-.72,-.62,3.72), "LeftHandTarget":(-.28,-.58,3.55)}),
        (5, {"LowerTorso":{"r":(-8,0,-2)}, "UpperTorso":{"r":(0,0,-10)}}, {
            "RightHandTarget":(-.48,-.76,4.15), "LeftHandTarget":(-.05,-.70,3.90)}),
        (8, {"HumanoidRootPart":{"l":(0,-.24,-.27)}, "LowerTorso":{"r":(8,0,5)}, "UpperTorso":{"r":(-8,0,20)}}, {
            "RightHandTarget":(.72,-1.28,1.62), "LeftHandTarget":(.30,-1.10,1.90),
            "RightFootTarget":(-.35,-1.02,-1.0), "LeftFootTarget":(.35,-.18,-1.0)}),
        (10, {"UpperTorso":{"r":(-5,0,15)}}, {
            "RightHandTarget":(.88,-1.04,1.52), "LeftHandTarget":(.42,-.94,1.83),
            "RightFootTarget":(-.35,-.88,-1.0)}),
        (12, {"UpperTorso":{"r":(3,0,6)}}, guard)],12)
    action(rig, controls, "SwordAttack04_Whirlwind", [
        (1, {"UpperTorso":{"r":(3,0,6)}}, guard),
        (4, {"LowerTorso":{"r":(-5,0,10)}, "UpperTorso":{"r":(3,0,28)}}, {
            "RightHandTarget":(1.18,-.78,1.95), "LeftHandTarget":(.70,-.72,2.08)}),
        (7, {"HumanoidRootPart":{"l":(0,-.08,-.25)}, "LowerTorso":{"r":(5,0,-4)}, "UpperTorso":{"r":(-3,0,-20)}}, {
            "RightHandTarget":(-1.18,-1.08,2.82), "LeftHandTarget":(-.70,-.98,2.72),
            "LeftFootTarget":(.35,-.72,-1.0), "RightFootTarget":(-.35,-.22,-1.0)}),
        (10, {"LowerTorso":{"r":(-4,0,-12)}, "UpperTorso":{"r":(2,0,-30)}}, {
            "RightHandTarget":(-1.30,-.76,2.12), "LeftHandTarget":(-.78,-.72,2.18)}),
        (13, {"HumanoidRootPart":{"l":(0,-.20,-.27)}, "LowerTorso":{"r":(7,0,7)}, "UpperTorso":{"r":(-5,0,30)}}, {
            "RightHandTarget":(1.30,-1.18,2.62), "LeftHandTarget":(.77,-1.04,2.58),
            "RightFootTarget":(-.35,-1.02,-1.0), "LeftFootTarget":(.35,-.20,-1.0)}),
        (15, {"UpperTorso":{"r":(-3,0,22)}}, {
            "RightHandTarget":(1.38,-.92,2.58), "LeftHandTarget":(.84,-.86,2.56),
            "RightFootTarget":(-.35,-.88,-1.0)}),
        (18, {"UpperTorso":{"r":(3,0,7)}}, guard)],18)

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
        "SwordAttack01_DownwardDiagonal": 6,
        "SwordAttack02_RisingDiagonal": 6,
        "SwordAttack03_ForwardThrust": 8,
        "SwordAttack04_Whirlwind": 13,
    }
    for name, frame in contacts.items():
        rig.animation_data.action = bpy.data.actions[name]
        bpy.context.scene.frame_set(frame)
        bpy.context.scene.render.filepath = os.path.join(RENDER_ROOT, f"{name}_contact.png")
        bpy.ops.render.render(write_still=True)

def render_animation_reviews(rig):
    os.makedirs(ANIMATION_REVIEW_ROOT, exist_ok=True)
    scene = bpy.context.scene
    camera = scene.camera
    review_frames = {
        "SwordAttack01_DownwardDiagonal": (3, 6, 8, 11),
        "SwordAttack02_RisingDiagonal": (3, 6, 8, 11),
        "SwordAttack03_ForwardThrust": (5, 8, 10, 12),
        "SwordAttack04_Whirlwind": (4, 7, 13, 18),
    }
    camera_positions = {
        "front": (0, -14, 3.2),
        "three_quarter": (8, -13, 4.8),
    }
    for action_name, frames in review_frames.items():
        rig.animation_data.action = bpy.data.actions[action_name]
        for camera_name, position in camera_positions.items():
            camera.location = position
            for frame in frames:
                scene.frame_set(frame)
                scene.render.image_settings.file_format = "PNG"
                scene.render.filepath = os.path.join(
                    ANIMATION_REVIEW_ROOT, f"{action_name}_{camera_name}_frame_{frame:02d}.png")
                bpy.ops.render.render(write_still=True)

        camera.location = camera_positions["three_quarter"]
        sequence_root = os.path.join(ANIMATION_REVIEW_ROOT, action_name)
        os.makedirs(sequence_root, exist_ok=True)
        for frame in range(1, int(rig.animation_data.action.get("frame_end", 24)) + 1):
            scene.frame_set(frame)
            scene.render.image_settings.file_format = "PNG"
            scene.render.filepath = os.path.join(sequence_root, f"frame_{frame:02d}.png")
            bpy.ops.render.render(write_still=True)
    scene.render.image_settings.file_format = "PNG"

def object_bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        tuple(min(point[axis] for point in points) for axis in range(3)),
        tuple(max(point[axis] for point in points) for axis in range(3)),
    )

def bounds_overlap(first, second, margin=0.025):
    first_min, first_max = object_bounds(first)
    second_min, second_max = object_bounds(second)
    return all(
        first_min[axis] < second_max[axis] - margin
        and first_max[axis] > second_min[axis] + margin
        for axis in range(3)
    )

def validate_weapon_clearance(rig):
    blade = bpy.data.objects["HopliteSword_Blade"]
    body_parts = [
        bpy.data.objects[name]
        for name in (
            "LowerTorso_Geo", "UpperTorso_Geo", "Head_Geo",
            "RightUpperLeg_Geo", "RightLowerLeg_Geo",
            "LeftUpperLeg_Geo", "LeftLowerLeg_Geo",
        )
    ]
    failures = []
    for action_name in (
        "SwordAttack01_DownwardDiagonal", "SwordAttack02_RisingDiagonal",
        "SwordAttack03_ForwardThrust", "SwordAttack04_Whirlwind",
    ):
        rig.animation_data.action = bpy.data.actions[action_name]
        end = int(rig.animation_data.action.get("frame_end", 24))
        for frame in range(1, end + 1):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            intersections = [part.name for part in body_parts if bounds_overlap(blade, part)]
            if intersections:
                failures.append(f"{action_name} frame {frame}: {', '.join(intersections)}")
    if failures:
        raise RuntimeError("Sword intersects the wielder:\n" + "\n".join(failures))

def export_actions(rig):
    os.makedirs(EXPORT_ROOT, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    for action_name in (
        "SwordAttack01_DownwardDiagonal",
        "SwordAttack02_RisingDiagonal",
        "SwordAttack03_ForwardThrust",
        "SwordAttack04_Whirlwind",
    ):
        rig.animation_data.action = bpy.data.actions[action_name]
        end = int(rig.animation_data.action.get("frame_end", 24))
        bpy.context.scene.frame_start = 1
        bpy.context.scene.frame_end = end
        bpy.ops.export_scene.fbx(
            filepath=os.path.join(EXPORT_ROOT, f"{action_name}.fbx"),
            use_selection=True,
            object_types={"ARMATURE"},
            add_leaf_bones=False,
            bake_anim=True,
            bake_anim_use_all_bones=True,
            bake_anim_use_nla_strips=False,
            bake_anim_use_all_actions=False,
            bake_anim_force_startend_keying=True,
            bake_anim_simplify_factor=0.0,
        )

def coordinate_frame(matrix):
    # Blender uses Z-up with forward along -Y. Roblox uses Y-up with forward
    # along -Z, so conjugate the local pose delta into Roblox coordinates.
    basis = matrix.__class__(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
    converted = basis @ matrix @ basis.inverted()
    location = converted.to_translation()
    rotation = converted.to_3x3()
    values = {
        "X": location.x, "Y": location.y, "Z": location.z,
        "R00": rotation[0][0], "R01": rotation[0][1], "R02": rotation[0][2],
        "R10": rotation[1][0], "R11": rotation[1][1], "R12": rotation[1][2],
        "R20": rotation[2][0], "R21": rotation[2][1], "R22": rotation[2][2],
    }
    fields = "".join(f"<{name}>{0 if abs(value) < 1e-9 else value:.9g}</{name}>" for name, value in values.items())
    return f'<CoordinateFrame name="CFrame">{fields}</CoordinateFrame>'

def pose_xml(rig, bone, indent):
    children = "".join(pose_xml(rig, child, indent + "\t") for child in bone.children)
    transform_matrix = rig.pose.bones[bone.name].matrix_basis
    if bone.name == "HumanoidRootPart":
        # The outer R15 pose only identifies the rig root; no Motor6D consumes
        # its transform. RootJoint motion belongs on the LowerTorso child pose.
        transform_matrix = Matrix.Identity(4)
    elif bone.name == "LowerTorso" and bone.parent and bone.parent.name == "HumanoidRootPart":
        transform_matrix = rig.pose.bones[bone.parent.name].matrix_basis @ transform_matrix
    transform = coordinate_frame(transform_matrix)
    return (
        f'{indent}<Item class="Pose"><Properties>{transform}'
        f'<token name="EasingDirection">0</token><token name="EasingStyle">0</token>'
        f'<string name="Name">{escape(bone.name)}</string><float name="Weight">1</float>'
        f'</Properties>{children}{indent}</Item>'
    )

def export_roblox_sequences(rig):
    os.makedirs(ROBLOX_EXPORT_ROOT, exist_ok=True)
    root_bones = [bone for bone in rig.data.bones if bone.parent is None]
    for action_name in (
        "SwordAttack01_DownwardDiagonal",
        "SwordAttack02_RisingDiagonal",
        "SwordAttack03_ForwardThrust",
        "SwordAttack04_Whirlwind",
    ):
        rig.animation_data.action = bpy.data.actions[action_name]
        end = int(rig.animation_data.action.get("frame_end", 24))
        keyframes = []
        for frame in range(1, end + 1):
            bpy.context.scene.frame_set(frame)
            poses = "".join(pose_xml(rig, bone, "\t\t") for bone in root_bones)
            keyframes.append(
                f'\t<Item class="Keyframe"><Properties><string name="Name">Keyframe{frame}</string>'
                f'<float name="Time">{(frame - 1) / 24:.9g}</float></Properties>{poses}\t</Item>'
            )
        xml = (
            '<roblox version="4"><Item class="KeyframeSequence"><Properties>'
            '<bool name="Loop">false</bool>'
            f'<string name="Name">{escape(action_name)}</string><token name="Priority">2</token>'
            f'</Properties>{"".join(keyframes)}</Item></roblox>\n'
        )
        with open(os.path.join(ROBLOX_EXPORT_ROOT, f"{action_name}.rbxmx"), "w", encoding="utf-8") as output:
            output.write(xml)

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
    render_animation_reviews(rig)
    validate_weapon_clearance(rig)
    export_actions(rig)
    export_roblox_sequences(rig)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

main()
