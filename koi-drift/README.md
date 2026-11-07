# Koi Drift

A fully procedural, offline garden pond wallpaper built with TypeScript and Canvas 2D.
The scene combines koi, floating lily pads, a water lily, bank foliage, submerged
stones, drifting caustics, surface glints and circular ripples. Four presets provide
morning lagoon, sunset, jade and moonlit palettes. The clock and compact audio
visualizer remain optional.

## Visual overhaul

All existing Wallpaper Engine property keys and default values are preserved.
Two controls now describe the new visuals:

- `kelpcount` is labelled **Pond Vegetation** and controls the lily canopy and bank foliage (0 hides both).
- `bubblecount` is labelled **Drifting Glints** and controls small suspended surface particles (0 hides them).

`visualizerstyle` retains `bars`, `waveform` and `off`; bars and waveforms now form
a compact display with configurable placement (follows the clock by default). Audio effects stay hidden without audio.
Existing property keys, defaults and Workshop identity fields are preserved.

Water and stone artwork is cached at a maximum dimension of 1536 pixels. Caustics
reuse one periodic 512px tile, while leaf and flower sprites are generated only on
preset changes. No external fonts, image assets, network access or new dependencies
are required. Animation uses the shared FPS-limited loop and pauses when hidden.

## Validation

Run the theme typecheck and build from the workspace root:

```sh
pnpm --filter wallpaper-engine-koi-drift typecheck
pnpm --filter wallpaper-engine-koi-drift build
```

The package has no lint script configured. Open `dist/index.html` using Wallpaper
Engine or a local browser configured to allow local module assets. In Wallpaper
Engine, verify the four palettes, audio with both visualizer styles, media text,
all clock positions, cursor ripples, plant/glint density and pause/resume behavior.

## Workshop thumbnail

`preview.jpg` is a dedicated 1024 x 1024 composition using the actual pond and koi
renderers. Two larger fish stay readable in square Workshop tiles. A sample clock and active audio spectrum sit above the koi to show the optional
features. Live wallpaper defaults and fish sizes are unchanged.
Regenerate it with `pnpm --filter wallpaper-engine-koi-drift generate:preview`, then
build to include it in `dist/`. The thumbnail renderer uses the existing Puppeteer
and esbuild dependencies and does not load network assets.

## Reddit video preview

Run `pnpm --filter wallpaper-engine-koi-drift generate:video` to export a 20-second
1920 x 1080, 30 FPS H.264/AAC MP4 to `.temp/koi-pond-reddit.mp4`. Pass an absolute
output path after the command to save elsewhere. Requires FFmpeg on PATH.

The export uses the actual renderers and a seeded, fixed-step simulation, with the
clock, a short cursor/ripple demonstration and an original ambient bell-and-pad cue.
The spectrum demonstration follows the cue's note frequencies and envelopes. Swim
speed is set to 0.65 for the preview. Video, poster and WAV files stay outside the
production package; the live wallpaper defaults and download size are unchanged.

## Audio visualizer placement

**Audio Visualizer Position** defaults to **Follow Clock**, grouping the clock and
visualizer. The visualizer centres on the clock and sits below it when space allows,
or above it near the bottom edge. It follows clock presets, custom placement, size,
media text and resizing. Bounds are cached and measured only after layout changes.
With the clock hidden, the visualizer falls back to bottom centre.

Separate top-left, top-centre, top-right, centre, bottom-left, bottom-centre,
bottom-right and custom positions remain available. Custom placement uses horizontal
and vertical percentage sliders. Both bars and waveform support every position.
The bottom margin/taskbar offset is respected; the complete visualizer stays visible.

New `project.json` properties: `visualizerposition` (default `follow_clock`),
`visualizerpositionx` (50) and `visualizerpositiony` (100). Placement controls are
shown only when audio reactivity is enabled and the visualizer is not disabled;
the sliders additionally require custom placement. Explicitly saved positions are
preserved. Run `pnpm --filter wallpaper-engine-koi-drift test:visualizer` to check
placement, validation and resize behavior.
