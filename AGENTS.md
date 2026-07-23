# Wallpaper Engine Project

This repository contains a Wallpaper Engine web wallpaper.

## Stack

- TypeScript
- HTML
- CSS
- Canvas 2D or WebGL
- Vite for local development and production builds

## Requirements

- The production entry point must be `dist/index.html`.
- All production assets must work without a web server.
- Use relative asset paths.
- Do not require runtime internet access.
- Do not include Node.js APIs in browser code.
- Support 16:9, 21:9 and 4K displays.
- Avoid layout shifts and visible loading flashes.

## Performance

- Respect the Wallpaper Engine FPS limit.
- Pause animation while the page is hidden.
- Avoid unnecessary allocations inside animation loops.
- Cap particle counts.
- Reuse objects and canvas buffers where practical.
- Avoid excessive blur filters and oversized textures.
- Provide reduced-quality behaviour for lower settings.

## Wallpaper Engine Integration

- Implement `window.wallpaperPropertyListener`.
- Keep property names stable.
- Validate all property values.
- User-facing controls should include sensible defaults.
- Audio-responsive features must fail gracefully when audio data is unavailable.

## Validation

Before completing a task:

1. Run the build.
2. Run linting and type checking.
3. Verify that `dist/index.html` opens locally.
4. Check the browser console for errors.
5. Confirm that all asset paths are relative.