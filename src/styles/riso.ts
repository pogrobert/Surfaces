import { cos, radians, sin } from "../core/math.ts"
import { BASE_PALETTE } from "../core/palette.ts"
import type { PaletteSpec } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { print } from "../finishes/index.ts"
import { overprint, RISO_MOTIFS } from "../layouts/overprint.ts"
import type { Motif } from "../layouts/overprint.ts"

// A two-colour print from a stencil duplicator: grainy ink, simple shapes, and
// layers that never quite line up. The overlap makes the third colour.
const PALETTE: PaletteSpec = {
  ...BASE_PALETTE,
  maxChroma: 0.2,
  // A grey brand still gets a colour for its second ink.
  partnerFloor: 0.09,
  // The first ink is the brand colour itself, as a spot ink is, moved only
  // as far as the paper needs.
  accent: { light: [0.55, 0.82], dark: [0.5, 0.84] },
  light: {
    ...BASE_PALETTE.light,
    // Paper, not white: warmed a little whatever the brand.
    ground: { l: [0.955, 0.97], c: [0.06, 0.1], turn: -30 },
    partner: { l: [0.74, 0.82], c: [0.8, 1] },
  },
  dark: {
    ...BASE_PALETTE.dark,
    ground: { l: [0.15, 0.18], c: [0.14, 0.2], turn: 8 },
    partner: { l: [0.58, 0.66], c: [0.8, 1] },
  },
}

export const riso = defineRecipe({
  style: "riso",
  version: 1,
  ranges: {
    size: [1, 1.3],
    fade: [0.08, 0.4],
    register: [6, 15],
    registerAngle: [0, 360],
    grainSize: [0.62, 0.8],
    hardness: [2.2, 3.6],
    wash: [0.44, 0.66],
    paper: [0.08, 0.16],
  },
  moods: {
    calm: {
      register: [6, 8],
      fade: [0.26, 0.4],
      wash: [0.56, 0.66],
      paper: [0.08, 0.11],
    },
    bold: {
      register: [11, 15],
      fade: [0.08, 0.18],
      hardness: [3, 3.6],
      paper: [0.12, 0.16],
    },
  },
  grain: {
    smooth: {
      grainSize: [0.82, 0.95],
      hardness: [1.6, 2.2],
      wash: [0.92, 0.97],
      paper: [0.02, 0.05],
    },
    heavy: {
      grainSize: [0.52, 0.62],
      hardness: [3.4, 4.4],
      wash: [0.3, 0.4],
      paper: [0.2, 0.28],
    },
  },
  shapes: RISO_MOTIFS,
  palette: PALETTE,
  layout(context) {
    // The finish lands the second ink here; a moving print needs to know it.
    const angle = radians(context.p.registerAngle)
    return overprint(context, context.shape as Motif, context.p, {
      dx: cos(angle) * context.p.register,
      dy: sin(angle) * context.p.register,
    })
  },
  finish(art, { p, rng, theme }) {
    const seeds = rng.fork("press")
    const angle = radians(p.registerAngle)
    return print(art, {
      scale: p.grainSize,
      hardness: p.hardness,
      wash: p.wash,
      seed: seeds.int(1, 9998),
      dx: cos(angle) * p.register,
      dy: sin(angle) * p.register,
      blend: theme === "dark" ? "screen" : "multiply",
      paper: p.paper,
      paperSeed: seeds.int(1, 9999),
    })
  },
})
