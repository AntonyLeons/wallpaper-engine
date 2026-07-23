import os
from PIL import Image

ASSETS_DIR = r"c:\Users\anton\Documents\Github\wallpaper-engine\valkyrie-aurora\public\assets"

def remove_chromatic_fringing(img):
    w, h = img.size
    data = img.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = data[x, y]
            if a == 0: continue

            brightness = 0.299 * r + 0.587 * g + 0.114 * b

            # Detect Cyan/Blue/Magenta chromatic fringe spikes on white/gold dress and hair lines
            is_cyan_fringe = (b > r + 35) and (g > r + 20) and brightness > 60
            is_blue_fringe = (b > r + 40) and (b > g + 30) and brightness > 60
            is_magenta_fringe = (b > g + 35) and (r > g + 20) and brightness > 60

            if is_cyan_fringe or is_blue_fringe or is_magenta_fringe:
                if brightness > 180:
                    data[x, y] = (245, 242, 248, a)
                else:
                    data[x, y] = (215, 175, 95, a)

    return img

def process_alpha_key(img):
    w, h = img.size
    data = img.load()

    face_min_x, face_max_x = int(w * 0.36), int(w * 0.64)
    face_min_y, face_max_y = int(h * 0.18), int(h * 0.44)

    for y in range(h):
        for x in range(w):
            r, g, b, a = data[x, y]
            brightness = 0.299 * r + 0.587 * g + 0.114 * b

            is_inside_face = (x >= face_min_x and x <= face_max_x and y >= face_min_y and y <= face_max_y)

            if is_inside_face:
                data[x, y] = (r, g, b, 255)
            elif brightness < 45:
                data[x, y] = (0, 0, 0, 0)
            else:
                data[x, y] = (r, g, b, 255)

    return img

def setup_layered_assets():
    print("Setting up clean assets with Y-boundary alpha feathering...")
    if not os.path.exists(ASSETS_DIR): return

    char_path = os.path.join(ASSETS_DIR, "character.png")
    char_closed_path = os.path.join(ASSETS_DIR, "character_closed.png")

    if not os.path.exists(char_path): return

    img_open = Image.open(char_path).convert("RGBA")
    w, h = img_open.size

    # 1. Clean Body Base Layer with Defringing & Alpha Keying
    img_body = img_open.copy()
    img_body = process_alpha_key(img_body)
    img_body = remove_chromatic_fringing(img_body)
    img_body.save(os.path.join(ASSETS_DIR, "character_body.png"), "PNG", optimize=True)

    # 2. Multi-Frame Eye Sequences with Soft Y-Boundary Feathering (Removes Horizontal Slice Seams)
    if os.path.exists(char_closed_path):
        img_closed = Image.open(char_closed_path).convert("RGBA")
        img_closed_keyed = process_alpha_key(img_closed.copy())
        img_closed_keyed = remove_chromatic_fringing(img_closed_keyed)

        open_pixels = img_body.load()
        closed_pixels = img_closed_keyed.load()

        eye_open = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        eye_closed = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        eye_half = Image.new("RGBA", (w, h), (0, 0, 0, 0))

        data_open = eye_open.load()
        data_closed = eye_closed.load()
        data_half = eye_half.load()

        face_min_x, face_max_x = int(w * 0.36), int(w * 0.64)
        face_min_y, face_max_y = int(h * 0.20), int(h * 0.38)
        feather_margin = 10

        for y in range(face_min_y, face_max_y):
            # Calculate smooth Y-boundary feathering factor
            dist_top = y - face_min_y
            dist_bottom = (face_max_y - 1) - y
            dist_edge = min(dist_top, dist_bottom)

            feather_factor = 1.0
            if dist_edge < feather_margin:
                feather_factor = dist_edge / float(feather_margin)

            for x in range(face_min_x, face_max_x):
                # Calculate smooth X-boundary feathering factor
                dist_left = x - face_min_x
                dist_right = (face_max_x - 1) - x
                dist_x_edge = min(dist_left, dist_right)
                if dist_x_edge < feather_margin:
                    feather_factor = min(feather_factor, dist_x_edge / float(feather_margin))

                o_r, o_g, o_b, o_a = open_pixels[x, y]
                c_r, c_g, c_b, c_a = closed_pixels[x, y]

                diff = abs(o_r - c_r) + abs(o_g - c_g) + abs(o_b - c_b)
                if diff > 25:
                    final_alpha = int(255 * feather_factor)
                    data_open[x, y] = (o_r, o_g, o_b, final_alpha)
                    data_closed[x, y] = (c_r, c_g, c_b, final_alpha)
                    data_half[x, y] = ((o_r + c_r) // 2, (o_g + c_g) // 2, (o_b + c_b) // 2, final_alpha)

        eye_open.save(os.path.join(ASSETS_DIR, "eyes_open.png"), "PNG", optimize=True)
        eye_closed.save(os.path.join(ASSETS_DIR, "eyes_closed.png"), "PNG", optimize=True)
        eye_half.save(os.path.join(ASSETS_DIR, "eyes_half.png"), "PNG", optimize=True)

    print("Multi-layer assets created with zero horizontal slice seams!")

if __name__ == "__main__":
    setup_layered_assets()
