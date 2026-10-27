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
a compact display along the bottom centre. Audio effects stay hidden without audio.
`project.json` changes are limited to these display labels and the scene description;
no property keys, values or Workshop identity fields change.

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
