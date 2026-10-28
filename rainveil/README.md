# Rainveil

A procedural night city seen through rain-covered apartment glass. Stepped towers,
warm windows, subtle facade lighting and waterfront mist sit above animated broken reflections.
All artwork is generated locally with Canvas 2D; no fonts, images or network
services are required.

## Build

```sh
pnpm --filter wallpaper-engine-rainveil typecheck
pnpm --filter wallpaper-engine-rainveil build
```

Open `dist/index.html` directly, or select the built theme in Wallpaper Engine.
The postbuild step embeds the generated JavaScript and CSS in the HTML so Chrome
can also open it through `file://` without changing browser security settings.

Existing Wallpaper Engine property keys and defaults are preserved. All four city
palettes, custom accent colors, rain controls, bokeh, lightning, audio visualizers,
mouse interaction, clock positions, media text and taskbar offset remain available.
No `project.json` properties were added or renamed.

The skyline and surface texture rebuild only when the viewport or palette changes.
Their backing textures are capped at 2560 pixels wide; the water mirror is capped
at 1280 pixels. Live animation respects the host FPS, pauses while hidden and uses
bounded rain and bokeh populations. Portrait layouts crop the city around its
central tower; ultrawide layouts extend the skyline.

Manual Wallpaper Engine verification: audio capture, media-session callbacks,
host FPS / pause behavior and property controls in the embedded browser.
