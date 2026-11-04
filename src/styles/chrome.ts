import { BASE_PALETTE } from "../core/palette.ts"
import type { PaletteSpec } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../finishes/index.ts"
import { object, OBJECTS } from "../layouts/object.ts"
import type { ObjectShape } from "../layouts/object.ts"

// A polished object in a pool of the brand's light. Chrome reflects a sky and
// a hard horizon; glass shows the light behind it, bent and dimmed.
const RANGES = {
  size: [0.92, 1.12],
  tilt: [-24, 24],
  horizon: [0.42, 0.6],
  glow: [0.55, 0.85],
  lens: [1.2, 1.6],
  rim: [0.5, 0.9],
  grain: [0.1, 0.2],
} as const

const PALETTE: PaletteSpec = {
  ...BASE_PALETTE,
  maxChroma: 0.12,
  // A grey brand still gets a colour beside it, or the metal's colour film
  // and the light through the glass go grey.
  partnerFloor: 0.09,
  light: {
    ...BASE_PALETTE.light,
    ground: { l: [0.955, 0.97], c: [0.1, 0.18] },
    quiet: { l: [0.975, 0.99], c: [0.04, 0.08] },
    soft: { l: [0.74, 0.8], c: [0.25, 0.4] },
    strong: { l: [0.2, 0.26], c: [0.4, 0.6], turn: 12 },
    partner: { l: [0.74, 0.8], c: [0.7, 0.9] },
  },
  dark: {
    ...BASE_PALETTE.dark,
    ground: { l: [0.11, 0.135], c: [0.18, 0.28], turn: 8 },
    quiet: { l: [0.06, 0.09], c: [0.2, 0.3], turn: 8 },
    soft: { l: [0.42, 0.5], c: [0.25, 0.4] },
    strong: { l: [0.94, 0.97], c: [0.06, 0.12], turn: -8 },
    partner: { l: [0.52, 0.6], c: [0.8, 1] },
  },
}

const shared = {
  ranges: RANGES,
  moods: {
    calm: { glow: [0.55, 0.65], rim: [0.5, 0.65] },
    bold: { glow: [0.75, 0.85], rim: [0.75, 0.9], tilt: [-24, -12] },
  },
  grain: {
    smooth: { grain: [0.02, 0.05] },
    heavy: { grain: [0.34, 0.46] },
  },
  palette: PALETTE,
  shapes: OBJECTS,
} as const

export const chrome = defineRecipe({
  ...shared,
  style: "chrome",
  version: 1,
  layout: (context) =>
    object(context, context.shape as ObjectShape, "chrome", context.p),
  finish: (art, { p, rng }) =>
    film(art, { amount: p.grain, scale: 0.74, seed: rng.fork("grain").int(1, 9999) }),
})

export const glass = defineRecipe({
  ...shared,
  style: "glass",
  version: 1,
  layout: (context) =>
    object(context, context.shape as ObjectShape, "glass", context.p),
  finish: (art, { p, rng }) =>
    film(art, { amount: p.grain, scale: 0.74, seed: rng.fork("grain").int(1, 9999) }),
})
