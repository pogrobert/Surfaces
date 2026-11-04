import { BASE_PALETTE } from "../core/palette.ts"
import type { PaletteSpec } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import type { Layer, Mark } from "../core/scene.ts"
import { smear } from "../finishes/index.ts"
import { FRAMES } from "../layouts/discs.ts"
import type { DiscFrame } from "../layouts/discs.ts"
import { strata } from "../layouts/strata.ts"

// Bands of colour like a horizon at dusk, their borders broken and pulled up
// and down until they shimmer, cut to a disc with a sharp edge. Two hues: the
// brand and its partner.
const PALETTE: PaletteSpec = {
  ...BASE_PALETTE,
  // A grey brand still gets a colour band in its ramp.
  partnerFloor: 0.09,
  maxChroma: 0.2,
  light: {
    ...BASE_PALETTE.light,
    // Paper, warmed a little whatever the brand.
    ground: { l: [0.965, 0.978], c: [0.06, 0.1], turn: -30 },
    quiet: { l: [0.93, 0.95], c: [0.2, 0.3], turn: -20 },
    soft: { l: [0.82, 0.87], c: [0.5, 0.65] },
    body: { l: [0.62, 0.7], c: [0.9, 1] },
    strong: { l: [0.28, 0.36], c: [0.8, 0.95], turn: 16 },
    partner: { l: [0.72, 0.8], c: [0.85, 1] },
  },
  dark: {
    ...BASE_PALETTE.dark,
    quiet: { l: [0.22, 0.26], c: [0.3, 0.42], turn: 8 },
    soft: { l: [0.38, 0.44], c: [0.6, 0.75], turn: 8 },
    body: { l: [0.58, 0.65], c: [0.9, 1] },
    strong: { l: [0.84, 0.89], c: [0.45, 0.6], turn: -12 },
    partner: { l: [0.66, 0.74], c: [0.85, 1] },
  },
}

// On a moving cover, bands that move alike are softened together and moved as
// one layer, and a band that moves on its own is softened on its own. Moving a
// band inside a shared softening would redraw the softening on every frame;
// softened apart, each border still meets an opaque band beneath it, so the
// cover looks the same.
function apart(layers: Layer[]): Layer[] {
  return layers.map((layer) => {
    const soft = layer.kind === "clip" ? layer.layers[0] : undefined
    if (layer.kind !== "clip" || soft?.kind !== "soften") return layer
    if (!soft.layers.some((mark) => mark.motion)) return layer
    const runs: Mark[][] = []
    for (const mark of soft.layers) {
      const run = runs[runs.length - 1]
      if (run && JSON.stringify(run[0]!.motion) === JSON.stringify(mark.motion)) run.push(mark)
      else runs.push([mark])
    }
    return {
      ...layer,
      layers: runs.map((run, index): Layer => {
        const { motion } = run[0]!
        return {
          ...soft,
          id: runs.length > 1 ? `${soft.id}${index}` : soft.id,
          layers: run.map(({ motion: _, ...mark }) => mark as Mark),
          ...(motion ? { motion } : null),
        }
      }),
    }
  })
}

export const strataStyle = defineRecipe({
  style: "strata",
  version: 1,
  ranges: {
    size: [1, 1.24],
    swell: [10, 34],
    spike: [22, 50],
    jag: [3, 8],
    uneven: [0, 0.3],
    smear: [12, 24],
    across: [1.2, 2.8],
    grain: [0.16, 0.26],
  },
  moods: {
    calm: { spike: [22, 30], smear: [20, 24], swell: [10, 18] },
    bold: { spike: [40, 50], smear: [12, 15], swell: [24, 34] },
  },
  grain: {
    smooth: { grain: [0.03, 0.06] },
    heavy: { grain: [0.42, 0.55] },
  },
  palette: PALETTE,
  shapes: FRAMES,

  layout: (context) => strata(context, context.shape as DiscFrame, context.p),
  finish: (art, { p, rng, motion }) => {
    const layers = smear(art, {
      across: p.across,
      along: p.smear,
      amount: p.grain,
      scale: 0.74,
      seed: rng.fork("grain").int(1, 9999),
    })
    return motion === "none" ? layers : apart(layers)
  },
})
