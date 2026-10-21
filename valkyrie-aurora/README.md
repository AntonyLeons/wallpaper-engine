# Moonlit Reverie

Valkyrie Aurora uses locally bundled artwork and a transparent atmosphere canvas, with no runtime network requests or new browser dependencies.

## Build and checks

Run from workspace root:

- pnpm --filter wallpaper-engine-valkyrie-aurora typecheck
- pnpm --filter wallpaper-engine-valkyrie-aurora build
- node valkyrie-aurora/scripts/verify.mjs

Postbuild embeds JS/CSS into dist/index.html for file:// use and copies project.json and preview.jpg. Never edit dist by hand.

Chrome checks cover six viewports (16:9, 16:10, 21:9, 32:9, portrait, 4K), local assets, console errors, absent Wallpaper Engine APIs, invalid inputs, partial updates, audio delivery mocks, FPS limits, reduced motion, visibility pause/resume and unavailable Canvas. Screenshots go into ignored .cache/.

Typecheck, build, node syntax checks and browser checks passed. No lint script is configured; the lint command was attempted and reported missing. Manual Wallpaper Engine checks remain: host audio delivery, saved property behavior, desktop pause policy and GPU/CPU usage on target hardware.

## Performance and controls

The painting is decoded once and moves as a compositor layer. Effects resolution is capped at 1280 by 800, regardless of monitor DPI. The particle pool is preallocated at 96 (38 visible by default). No per-frame gradients, blur passes or procedural scenery. Audio fades after callbacks stop. Animation stops when hidden or reduced motion is requested. FPS follows the lower nonzero host/theme limit; zero means uncapped.

Existing property keys and combo values are preserved. project.json changes: title/description and preview.jpg; particlecount default 220 to 120, minimum 100 to 0; showseconds default true to false; labels updated for the new effects.

auroraintensity controls stardust brightness; the painted aurora stays static. haloglowintensity controls lake audio brightness. breathingintensity controls subtle whole-scene drift. taskbaroffset positions the portrait clock. Presets and colors tint added effects, not the painting. Clock visibility, formats and visualizer modes remain supported.

Official references: [FPS](https://docs.wallpaperengine.io/en/web/performance/fps.html), [properties](https://docs.wallpaperengine.io/en/web/api/propertylistener.html), [audio](https://docs.wallpaperengine.io/en/web/audio/visualizer.html).

## Artwork

Built-in image_gen tool. Final saved asset: public/moonlit-reverie.webp, 1672 by 941, approximately 451 KiB. preview.jpg is a thumbnail. WebP encoding preserves the composition; the original PNG remains in the Codex generated_images folder.

Final prompt:

> Create a premium landscape 16:9 anime fantasy desktop wallpaper. A clearly adult woman in her late twenties with long silver hair with lavender tips, violet eyes, a warm confident smile, and a small star hairpin. She wears an elegant black and ivory evening gown with a modest sweetheart neckline and a delicate glowing crystal pendant. Waist-up portrait in the right half of the composition, face near x=68%, y=35%, one hand gently holding the pendant. Left half has generous spacious scenery: a midnight alpine lake, distant mountains, stars and flowing teal and lavender northern lights reflecting in the water. Beautiful painterly anime key visual, refined linework, luminous soft shading, indigo shadows, cyan rim lighting, dreamy romantic atmosphere. Complete cohesive painting. No text, logos, borders or UI. Adult proportions, fully clothed. Render landscape 2560x1440 or higher.

