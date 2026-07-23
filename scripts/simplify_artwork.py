import os
from PIL import Image, ImageFilter, ImageEnhance

ASSETS_DIR = r"c:\Users\anton\Documents\Github\wallpaper-engine\valkyrie-aurora\public\assets"

def simplify_background():
    bg_path = os.path.join(ASSETS_DIR, "background.png")
    if not os.path.exists(bg_path): return

    print("Simplifying background artwork...")
    img = Image.open(bg_path).convert("RGBA")

    # Soft Gaussian Blur to convert busy background clutter into a dreamy, sleek anime bokeh backdrop
    img_blurred = img.filter(ImageFilter.GaussianBlur(radius=8.0))

    # Enhance color saturation and ambient contrast
    enhancer_col = ImageEnhance.Color(img_blurred)
    img_vibrant = enhancer_col.enhance(1.25)

    enhancer_con = ImageEnhance.Contrast(img_vibrant)
    img_final = enhancer_con.enhance(1.1)

    img_final.save(bg_path, "PNG", optimize=True)
    print("  -> Saved simplified background.png")

def simplify_character_asset(filename):
    char_path = os.path.join(ASSETS_DIR, filename)
    if not os.path.exists(char_path): return

    print(f"Simplifying character asset {filename}...")
    img = Image.open(char_path).convert("RGBA")
    w, h = img.size

    # Stage 1: Median smoothing to eliminate hyper-fine line noise while retaining bold outlines
    img_smoothed = img.filter(ImageFilter.MedianFilter(size=3))

    # Stage 2: Clean Alpha Transparency Keying
    data = img_smoothed.getdata()
    new_data = []

    # Face protection zone normalized coordinates
    face_min_x = int(w * 0.36)
    face_max_x = int(w * 0.64)
    face_min_y = int(h * 0.18)
    face_max_y = int(h * 0.44)

    for idx, item in enumerate(data):
        x = idx % w
        y = idx // w
        r, g, b, a = item
        brightness = 0.299 * r + 0.587 * g + 0.114 * b

        is_face = (x >= face_min_x and x <= face_max_x and y >= face_min_y and y <= face_max_y)

        if is_face:
          new_data.append((r, g, b, 255))
        elif brightness < 32:
          new_data.append((0, 0, 0, 0))
        else:
          new_data.append((r, g, b, 255))

    img_smoothed.putdata(new_data)
    img_smoothed.save(char_path, "PNG", optimize=True)
    print(f"  -> Saved simplified {filename}")

def main():
    simplify_background()
    for f in ["character.png", "character_closed.png", "character_half_closed.png"]:
        simplify_character_asset(f)

if __name__ == "__main__":
    main()
