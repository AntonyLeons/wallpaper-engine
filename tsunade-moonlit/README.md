# Tsunade — Moonlit Veranda

Anime wallpaper artwork featuring Tsunade in her adult appearance, a moonlit village, warm lanterns and cherry blossoms.

## Assets and reproduction

- `public/tsunade-moonlit-source.png`: original artwork generated with the built-in imagegen tool; 1672 × 941 pixels.
- `public/tsunade-moonlit-4k.png`: finished RTX-upscaled 3840 × 2160 still wallpaper.
- `public/tsunade-moonlit-4k.mp4`: finished 3840 × 2160, 24 FPS looping H.264 video, with a half-second wraparound crossfade.
- `public/tsunade-moonlit-render-4k.mp4`: unmodified ComfyUI render, 124 frames / 5.17 seconds.
- `workflows/tsunade-moonlit-still-api.json`: local NVIDIA RTX upscale and exact 3840 × 2160 crop for the still.
- `workflows/tsunade-moonlit-4k-api.json`: local MiniMax H3 first/last-frame animation, eight sampling steps, 124 frames at 24 FPS, tiled VAE decode, RTX upscale and H.264 export.

Both workflows were validated against the local ComfyUI installation before submission. Import the source image into ComfyUI's input directory before reproducing a run. Models and custom nodes are external prerequisites; the workflows do not call paid partner APIs.

The 4K outputs are upscaled, rather than native 4K diffusion renders. The animation's start, midpoint and last frame were inspected. The final video rotates the first half-second to the end and blends the boundary with FFmpeg to soften the generated loop seam. The original ComfyUI render is preserved. The final encoded video was checked for decode errors and its resolution and frame rate verified. These are media assets and reproducible workflows, not a web wallpaper runtime; import the final MP4 as a video wallpaper in Wallpaper Engine.

## Artwork prompt

Widescreen anime film illustration of adult Tsunade from Naruto: blonde hair, amber eyes, violet diamond forehead mark, green haori and a gray wrap blouse with a plunging neckline, curvaceous figure, fully clothed, relaxed confident expression. Seated three-quarter pose on a wooden veranda, character on the right with atmospheric village scenery to the left. Moonlit Japanese mountain village, warm lantern light, pond reflections, cherry blossoms and drifting petals. Emerald, gold and midnight blue palette. Detailed clean linework, painterly background, no text or watermark. Source generated with the built-in imagegen tool; animation and upscaling use local ComfyUI.

The exact animation prompt and seed are stored in the API workflow JSON.
