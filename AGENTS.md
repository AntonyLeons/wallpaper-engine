# Wallpaper Engine Workspace

This repository is a multi-theme monorepo containing Wallpaper Engine web wallpapers (e.g. `aetheris/`).

## Workspace Structure

- Each wallpaper theme resides in its own root subfolder (e.g., `aetheris/`).
- Each theme folder is a self-contained package with its own `src/`, `index.html`, `project.json`, `tsconfig.json`, `vite.config.ts`, and `dist/`.
- Root `pnpm-workspace.yaml` and root `package.json` orchestrate multi-wallpaper builds and type-checking across the workspace.

## Stack

- TypeScript
- HTML
- CSS
- Canvas 2D or WebGL
- Vite for local development and production builds
- pnpm Workspaces for monorepo management

## Requirements

- The production entry point for each wallpaper must be `<wallpaper-folder>/dist/index.html`.
- All production assets must work without a web server.
- Use relative asset paths (`./assets/...`).
- Do not require runtime internet access.
- Do not include Node.js APIs in browser code.
- Support 16:9, 21:9 and 4K displays.
- Avoid layout shifts and visible loading flashes.

## Performance

- Respect the Wallpaper Engine FPS limit.
- Pause animation while the page is hidden (`visibilitychange`).
- Avoid unnecessary allocations inside animation loops.
- Cap particle counts.
- Reuse objects and canvas buffers where practical.
- Avoid excessive blur filters and oversized textures.
- Provide reduced-quality behaviour for lower settings.

## Wallpaper Engine Integration

- Implement `window.wallpaperPropertyListener`.
- Enable `"supportsaudioprocessing": true` in `project.json` for audio-reactive wallpapers.
- Keep property names stable.
- Validate all property values.
- User-facing controls should include sensible defaults.
- Audio-responsive features must fail gracefully when audio data is unavailable.

## Multi-Theme Development & Build Commands

- **Build All Themes**: `pnpm run build`
- **Typecheck All Themes**: `pnpm run typecheck`
- **Build Single Theme**: `pnpm --filter <theme-package-name> build` (e.g., `pnpm run build:aetheris`)

## Validation

Before completing a task:

1. Run workspace build (`pnpm run build`).
2. Run linting and type checking (`pnpm run typecheck`).
3. Verify that `<wallpaper-folder>/dist/index.html` opens locally.
4. Check the browser console for errors.
5. Confirm that all asset paths in build outputs are relative.