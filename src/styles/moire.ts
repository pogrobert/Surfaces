import { BASE_PALETTE } from "../core/palette.ts"
import type { PaletteSpec } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { focus } from "../finishes/index.ts"
import { fringe } from "../layouts/fringe.ts"

// Fine fringes of light breaking from the edge of one soft mass, shot in heavy
// grain. Almost no colour: the brand is only a tint in the grey.
const PALETTE: PaletteSpec = {
  ...BASE_PALETTE,
  maxChroma: 0.05,
  light: {
    ...BASE_PALETTE.light,
    // Nearly neutral: the brand is only a faint tint in the grey.
    ground: { l: [0.82, 0.86], c: [0.15, 0.25] },
    quiet: { l: [0.66, 0.71], c: [0.2, 0.3] },
    strong: { l: [0.17, 0.22], c: [0.5, 0.7], turn: 10 },
    ink: { l: [0.15, 0.18], c: [0.3, 0.5], turn: 10 },
  },
  dark: {
    ...BASE_PALETTE.dark,
    ground: { l: [0.14, 0.17], c: [0.5, 0.7], turn: 8 },
    quiet: { l: [0.29, 0.33], c: [0.6, 0.8], turn: 8 },
    strong: { l: [0.72, 0.78], c: [0.4, 0.6], turn: -8 },
  },
}

export const moire = defineRecipe({
  style: "moire",
  version: 1,
  ranges: {
    length: [300, 440],
    swing: [60, 150],
    breadth: [0.34, 0.5],
    spacing: [15, 21],
    hair: [1.2, 1.8],
    swell: [7, 11],
    waver: [8, 16],
    wavelength: [90, 150],
    lean: [80, 190],
    glow: [0.5, 0.9],
    softness: [58, 84],
    focus: [1.8, 2.8],
    grain: [0.34, 0.5],
  },
  moods: {
    calm: {
      waver: [8, 10],
      swell: [7, 8.5],
      lean: [80, 110],
      grain: [0.34, 0.4],
    },
    bold: { waver: [13, 16], swell: [9.5, 11], lean: [140, 190] },
  },
  grain: {
    smooth: { grain: [0.1, 0.16] },
    heavy: { grain: [0.6, 0.72] },
  },
  // Too soft or busy for a ruler and label: detail "micro" adds the marks alone.
  marksOnly: true,
  palette: PALETTE,

  layout: (context) => fringe(context, context.p),
  finish: (art, { p, rng }) =>
    focus(art, {
      mass: p.softness,
      fine: p.focus,
      amount: p.grain,
      scale: 0.72,
      seed: rng.fork("grain").int(1, 9999),
    }),
})
