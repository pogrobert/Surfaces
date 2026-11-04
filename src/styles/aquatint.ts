import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { plate } from "../finishes/index.ts"
import { stage } from "../layouts/stage.ts"
import { SUBJECTS } from "../shapes/subjects.ts"
import type { Subject } from "../shapes/subjects.ts"

// Grainy monochrome light with one clear subject. On paper the grain is shadow;
// on black it is light.
export const aquatint = defineRecipe({
  style: "aquatint",
  version: 1,
  ranges: {
    size: [0.98, 1.26],
    peak: [0.8, 0.96],
    lightTurn: [-48, 48],
    ringWeight: [0.52, 0.68],
    limbScale: [0.62, 0.95],
    sag: [0.2, 0.34],
    glow: [0.4, 0.7],
    grainSize: [0.6, 0.8],
    hardness: [1.7, 3.2],
    wash: [0.46, 0.68],
    film: [0.14, 0.24],
  },
  moods: {
    calm: {
      peak: [0.8, 0.86],
      hardness: [1.7, 2.2],
      glow: [0.4, 0.5],
      wash: [0.58, 0.68],
    },
    bold: { peak: [0.9, 0.96], hardness: [2.6, 3.2], glow: [0.58, 0.7] },
  },
  grain: {
    smooth: {
      grainSize: [0.82, 0.95],
      hardness: [1.3, 1.8],
      wash: [0.9, 0.96],
      film: [0.04, 0.08],
    },
    heavy: {
      grainSize: [0.5, 0.62],
      hardness: [2.8, 3.8],
      wash: [0.3, 0.42],
      film: [0.3, 0.4],
    },
  },
  palette: {
    ...BASE_PALETTE,
    maxChroma: 0.1,
    light: {
      ...BASE_PALETTE.light,
      ground: { l: [0.95, 0.965], c: [0.16, 0.26] },
      soft: { l: [0.885, 0.91], c: [0.4, 0.55] },
      strong: { l: [0.22, 0.28], c: [0.8, 1], turn: 12 },
    },
    dark: {
      ...BASE_PALETTE.dark,
      ground: { l: [0.115, 0.14], c: [0.2, 0.3], turn: 8 },
      soft: { l: [0.2, 0.24], c: [0.6, 0.75], turn: 8 },
      strong: { l: [0.91, 0.95], c: [0.3, 0.45], turn: -8 },
    },
  },

  shapes: SUBJECTS,

  layout: (context) => stage(context, context.shape as Subject, context.p),
  finish(art, { p, rng }) {
    const grain = rng.fork("grain")
    return plate(art, {
      scale: p.grainSize,
      hardness: p.hardness,
      wash: p.wash,
      seed: grain.int(1, 9999),
      film: p.film,
      filmSeed: grain.int(1, 9999),
    })
  },
})
