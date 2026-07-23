# Wallpaper Engine Workspace

This repository is a pnpm monorepo containing multiple Wallpaper Engine web wallpapers, such as `aetheris/`.

Each wallpaper is a self-contained package and should be treated as an always-running desktop application. Prioritise performance, stability, offline support and graceful fallbacks.

## Workspace Structure

Each wallpaper theme lives in its own root folder:

```text
aetheris/
├── src/
├── public/
├── index.html
├── project.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── dist/
```

Shared code may live under `packages/`.

Rules:

* Each theme must build independently.
* Import shared code through workspace packages, not cross-theme relative paths.
* Keep unrelated files outside theme folders.
* Do not edit generated `dist/` files manually.
* Preserve existing `project.json` fields and property keys.

## Stack

* TypeScript
* HTML and CSS
* Canvas 2D or WebGL
* Vite
* pnpm Workspaces
* Remotion for offline rendering and previews

Prefer plain TypeScript and Canvas for simple themes. Use WebGL for shaders or large particle systems. Do not add React or large dependencies unless clearly justified.

## Build Requirements

Each theme must produce:

```text
<theme>/dist/index.html
```

Production builds must:

* Work without a web server.
* Use relative asset paths.
* Work offline.
* Include all required assets locally.
* Avoid Node.js APIs in browser code.
* Avoid localhost URLs and absolute filesystem paths.
* Avoid layout shifts and loading flashes.

Use a relative Vite base:

```ts
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

## Responsive Design

Support:

* 16:9
* 16:10
* 21:9
* 32:9
* Portrait
* 1080p, 1440p and 4K

Requirements:

* Never assume a fixed resolution.
* Avoid scrollbars.
* Do not stretch raster artwork.
* Use `object-fit: cover` where appropriate.
* Preserve visual focal points across aspect ratios.
* Recalculate canvas and layout state after resizing.
* Cap device-pixel-ratio scaling to avoid excessive GPU usage.

## Performance

Wallpaper Engine wallpapers run continuously.

* Respect Wallpaper Engine’s configured FPS.
* Use `requestAnimationFrame`.
* Use delta-time-based animation.
* Pause expensive work during `visibilitychange`.
* Reset timestamps when resuming.
* Cap particle counts.
* Reuse objects, arrays, buffers and textures.
* Avoid per-frame DOM creation and unnecessary allocation.
* Cache DOM references, contexts, gradients and shader locations.
* Avoid oversized textures, excessive blur and full-resolution effect buffers.
* Avoid repeated media decoding and network polling.
* Ensure memory usage does not grow over time.
* Provide meaningful quality levels for expensive effects.

Prefer animating `transform` and `opacity`. Use Canvas or WebGL instead of large numbers of animated DOM elements.

## Wallpaper Engine Integration

Define Wallpaper Engine APIs as optional TypeScript globals so themes also run in Chrome.

Register listeners early and outside `window.onload`.

Each interactive theme should implement:

```ts
window.wallpaperPropertyListener = {
  applyGeneralProperties(properties) {
    if (typeof properties.fps === "number") {
      settings.fps = Math.max(0, properties.fps);
    }
  },

  applyUserProperties(properties) {
    if (properties.backgroundcolor) {
      applyBackgroundColor(properties.backgroundcolor.value);
    }

    if (properties.particlecount) {
      applyParticleCount(properties.particlecount.value);
    }
  },
};
```

Wallpaper Engine sends all properties initially, but only changed properties later. Always check each property independently.

Do not overwrite an existing listener object when adding callbacks.

## User Properties

Supported property types may include:

* `color`
* `slider`
* `bool`
* `combo`
* `textinput`
* `file`
* `directory`

Rules:

* Keep property keys stable and language-neutral.
* Validate and clamp every value.
* Keep code defaults aligned with `project.json`.
* Use translated labels, not translated internal values.
* Use display conditions to hide irrelevant controls.
* Use `textContent`, not `innerHTML`, for user text.
* Provide fallbacks for missing or invalid files.
* Do not repeatedly retry failed asset loads.

Wallpaper Engine colour values are space-separated floats from `0` to `1`. Convert them before using them as CSS colours.

## Audio

Audio-reactive wallpapers must set:

```json
{
  "supportsaudioprocessing": true
}
```

Register the listener early:

```ts
window.wallpaperRegisterAudioListener?.((audioData) => {
  // Validate, clamp, aggregate and store values.
});
```

Wallpaper Engine provides 128 values:

* `0–63`: left channel
* `64–127`: right channel

Do not render inside the audio callback. Store smoothed bass, mid, treble and overall levels, then render them in the main animation loop.

Audio features must work gracefully when:

* No audio is playing.
* The API is unavailable.
* Audio processing is disabled.
* Values remain zero.

## Media and RGB

Treat media-session and RGB APIs as optional.

* Register listeners early.
* Validate every callback payload.
* Handle missing artwork, titles, durations and timeline data.
* Do not repeatedly decode unchanged artwork.
* Do not expose media information externally.
* Only use RGB APIs after the relevant plugin reports that it loaded.
* Downsample RGB output to a small canvas.
* Update RGB devices at a bounded frequency.
* RGB failure must never break the main wallpaper.

## Files and Directories

Convert user-selected files to local file URLs and always provide a fallback.

For directory properties:

* Support empty and removed directories.
* Load files lazily.
* Limit decoded images, active videos and cache size.
* Remove stale paths when Wallpaper Engine reports removals.
* Do not load an entire directory into memory.

## WebGL

When using WebGL:

* Detect context creation failure.
* Provide a fallback.
* Handle context loss and restoration.
* Compile shaders once.
* Reuse buffers and textures.
* Dispose obsolete GPU resources.
* Use reduced-resolution buffers for blur and bloom.
* Avoid GPU-to-CPU pixel reads in the main loop.

## Remotion

Use Remotion primarily as an offline rendering tool for:

* Seamless video loops
* Cinematic backgrounds
* Theme variants
* Workshop previews
* Preview images and GIFs

Prefer this architecture:

```text
Shared visual logic
├── Wallpaper Engine live runtime
└── Remotion offline renderer
```

Do not use the Remotion Player inside the live wallpaper by default.

Rendered loops must:

* Be deterministic.
* Use seeded randomness.
* Match visually at the loop boundary.
* Avoid runtime network requests.
* Use supported formats such as WebM.
* Use practical resolutions, bitrates and file sizes.

Keep live interactions such as audio, mouse parallax, media data, user properties and RGB inside the Wallpaper Engine runtime.

## Browser and Wallpaper Engine Testing

Every theme must also run in Chrome when Wallpaper Engine APIs are unavailable.

Use feature detection, not user-agent detection.

Before completing a theme change:

1. Run linting and type checking.
2. Build the affected theme.
3. Confirm `dist/index.html` exists.
4. Open it locally.
5. Check the console for errors.
6. Confirm asset paths are relative.
7. Test common aspect ratios.
8. Confirm optional APIs fail gracefully.
9. Report anything requiring manual Wallpaper Engine testing.

For shared or workspace-wide changes, run the full workspace validation.

## Commands

```bash
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run check
pnpm run generate:preview <theme-name>
```

Build a single theme:

```bash
pnpm --filter <theme-package-name> build
```

Develop a single theme:

```bash
pnpm --filter <theme-package-name> dev
```

Recommended root scripts:

```json
{
  "scripts": {
    "build": "pnpm -r --if-present build",
    "typecheck": "pnpm -r --if-present typecheck",
    "lint": "pnpm -r --if-present lint",
    "format": "oxfmt .",
    "format:check": "oxfmt --check .",
    "generate:preview": "tsx scripts/generate-preview.ts",
    "validate:builds": "tsx scripts/validate-builds.ts",
    "check": "pnpm run format:check && pnpm run lint && pnpm run typecheck && pnpm run build && pnpm run validate:builds"
  }
}
```

## Change Policy

* Prefer focused changes.
* Avoid unrelated refactors.
* Preserve property compatibility.
* Preserve theme boundaries.
* Avoid unnecessary dependencies.
* Do not increase resource usage without justification.
* Document new properties and manual `project.json` changes.
* Do not claim checks passed unless they were actually run.

## Source of Truth

Use the official Wallpaper Engine documentation for Wallpaper Engine APIs and behaviour.

Use the official Remotion documentation for rendering behaviour.

Do not invent APIs or assume that normal Chrome behaviour is identical to Wallpaper Engine’s embedded Chromium environment.
