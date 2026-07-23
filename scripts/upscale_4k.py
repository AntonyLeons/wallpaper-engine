import os
from PIL import Image, ImageFilter, ImageEnhance

ASSETS_DIR = r"c:\Users\anton\Documents\Github\wallpaper-engine\valkyrie-aurora\public\assets"

def upscale_image_4k(file_path):
    print(f"Upscaling {os.path.basename(file_path)}...")
    img = Image.open(file_path).convert("RGBA")
    w, h = img.size

    # Target 4K dimensions (3840x3840 for character portraits, 3840x2160 for background)
    filename = os.path.basename(file_path)
    if filename == "background.png":
        target_w, target_h = 3840, 2160
    else:
        target_w, target_h = 3840, 3840

    # Stage 1: High-precision 4X Multi-Stage Lanczos3 Upscaling
    # Upscale 2X first, sharpen, then upscale to target 4K for maximum edge clarity
    mid_w, mid_h = target_w // 2, target_h // 2
    img_mid = img.resize((mid_w, mid_h), Image.Resampling.LANCZOS)
    img_mid = img_mid.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=2))

    img_4k = img_mid.resize((target_w, target_h), Image.Resampling.LANCZOS)

    # Stage 2: Crisp Edge Detail & Contrast Sharpening
    img_sharpened = img_4k.filter(ImageFilter.UnsharpMask(radius=1.5, percent=130, threshold=2))

    # Stage 3: Micro-contrast enhancement for fine anime lines and hair details
    enhancer = ImageEnhance.Sharpness(img_sharpened)
    img_final = enhancer.enhance(1.2)

    img_final.save(file_path, "PNG", optimize=True)
    print(f"  -> Saved 4K {filename} ({target_w}x{target_h})")

def main():
    if not os.path.exists(ASSETS_DIR):
        print("Assets directory not found!")
        return

    for filename in os.listdir(ASSETS_DIR):
        if filename.endswith(".png"):
            full_path = os.path.join(ASSETS_DIR, filename)
            upscale_image_4k(full_path)

if __name__ == "__main__":
    main()
