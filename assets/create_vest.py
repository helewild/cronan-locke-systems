import math
import bpy
import bmesh
from mathutils import Vector


OUTPUT_BLEND = r"C:\Users\Alex\Documents\New project\vest_demo.blend"
OUTPUT_RENDER = r"C:\Users\Alex\Documents\New project\vest_render.png"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def make_material(name, color, roughness=0.55):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def point_at(obj, target):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_body():
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.68, depth=1.7, location=(0, 0, 1.45))
    body = bpy.context.active_object
    body.name = "Torso"
    body.scale = (0.88, 0.62, 1.0)
    body.location.y = 0.08
    bpy.ops.object.modifier_add(type="SUBSURF")
    body.modifiers["Subdivision"].levels = 2
    body.modifiers["Subdivision"].render_levels = 2
    bpy.ops.object.shade_smooth()
    return body


def add_vest():
    parts = []

    def add_piece(name, location, scale, rotation=(0.0, 0.0, 0.0)):
        bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
        obj = bpy.context.active_object
        obj.name = name
        obj.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bevel = obj.modifiers.new(name="Bevel", type="BEVEL")
        bevel.width = 0.03
        bevel.segments = 3
        bevel.limit_method = "ANGLE"
        bpy.ops.object.shade_smooth()
        parts.append(obj)
        return obj

    add_piece("BackPanel", (0.0, 0.08, 1.35), (0.78, 0.12, 0.98))
    add_piece("LeftFront", (-0.34, -0.05, 1.28), (0.32, 0.12, 0.9))
    add_piece("RightFront", (0.34, -0.05, 1.28), (0.32, 0.12, 0.9))
    add_piece("LeftShoulder", (-0.2, -0.02, 2.18), (0.18, 0.12, 0.12), rotation=(0.0, math.radians(-8), math.radians(5)))
    add_piece("RightShoulder", (0.2, -0.02, 2.18), (0.18, 0.12, 0.12), rotation=(0.0, math.radians(8), math.radians(-5)))
    add_piece("LeftSideStrap", (-0.72, 0.02, 1.3), (0.08, 0.1, 0.58))
    add_piece("RightSideStrap", (0.72, 0.02, 1.3), (0.08, 0.1, 0.58))
    add_piece("Collar", (0.0, -0.03, 2.05), (0.34, 0.11, 0.1))

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    vest = bpy.context.active_object
    vest.name = "Vest"
    return vest


def add_details():
    details = []

    def add_detail(name, location, scale):
        bpy.ops.mesh.primitive_cube_add(location=location)
        obj = bpy.context.active_object
        obj.name = name
        obj.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bevel = obj.modifiers.new(name="Bevel", type="BEVEL")
        bevel.width = 0.01
        bevel.segments = 2
        bpy.ops.object.shade_smooth()
        details.append(obj)
        return obj

    add_detail("LeftPocketTop", (-0.34, -0.18, 1.55), (0.2, 0.04, 0.16))
    add_detail("RightPocketTop", (0.34, -0.18, 1.55), (0.2, 0.04, 0.16))
    add_detail("LeftPocketBottom", (-0.34, -0.18, 1.1), (0.2, 0.04, 0.18))
    add_detail("RightPocketBottom", (0.34, -0.18, 1.1), (0.2, 0.04, 0.18))
    add_detail("CenterBuckles", (0.0, -0.17, 1.38), (0.05, 0.03, 0.58))
    return details


def add_stand():
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.05, depth=2.3, location=(0, 0.25, 1.25))
    pole = bpy.context.active_object
    pole.name = "StandPole"
    bpy.ops.object.shade_smooth()

    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.45, depth=0.06, location=(0, 0.0, 0.03))
    base = bpy.context.active_object
    base.name = "StandBase"
    bpy.ops.object.shade_smooth()
    return pole, base


def add_lighting():
    bpy.ops.object.light_add(type="AREA", location=(2.8, -2.6, 3.8))
    key = bpy.context.active_object
    key.data.energy = 2500
    key.data.shape = "RECTANGLE"
    key.data.size = 3.0
    key.data.size_y = 3.0
    point_at(key, Vector((0, 0, 1.35)))

    bpy.ops.object.light_add(type="AREA", location=(-2.8, -2.4, 2.0))
    fill = bpy.context.active_object
    fill.data.energy = 1200
    fill.data.size = 2.8
    point_at(fill, Vector((0, 0, 1.3)))


def add_camera():
    bpy.ops.object.camera_add(location=(3.3, -5.7, 2.35))
    cam = bpy.context.active_object
    cam.data.lens = 55
    point_at(cam, Vector((0, -0.03, 1.45)))
    bpy.context.scene.camera = cam


def add_floor():
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "Floor"
    return floor


def configure_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 64
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 1280
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = OUTPUT_RENDER
    world = scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.90, 0.92, 0.95, 1.0)
    bg.inputs[1].default_value = 0.55


def main():
    clear_scene()
    configure_scene()

    vest_mat = make_material("VestMat", (0.20, 0.18, 0.16, 1.0), 0.88)
    detail_mat = make_material("DetailMat", (0.09, 0.09, 0.10, 1.0), 0.7)
    stand_mat = make_material("StandMat", (0.56, 0.58, 0.62, 1.0), 0.4)
    floor_mat = make_material("FloorMat", (0.77, 0.74, 0.72, 1.0), 0.98)

    vest = add_vest()
    vest.data.materials.append(vest_mat)

    for detail in add_details():
        detail.data.materials.append(detail_mat)

    pole, base = add_stand()
    pole.data.materials.append(stand_mat)
    base.data.materials.append(stand_mat)

    floor = add_floor()
    floor.data.materials.append(floor_mat)

    add_lighting()
    add_camera()

    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
    bpy.ops.render.render(write_still=True)
    print(f"Saved blend to {OUTPUT_BLEND}")
    print(f"Saved render to {OUTPUT_RENDER}")


main()
