import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../grammar/processes.ts"
import { patches as patched, SUBJECTS } from "../layouts/patches.ts"
import type { Subject } from "../layouts/patches.ts"

// Plain soft forms laid over one another, each filled with its own pattern of
// small marks, dots, rings, dashes or squares, as from sheets of screen tone:
// a cluster, the same on a speckled disc, a row of pills, or a pair.
export const patches = defineRecipe({
  style: "patches",
  version: 1,
  ranges: {
    size: [0.82, 0.94],
    pitch: [0.03, 0.042],
    fill: [0.5, 0.68],
    tilt: [-0.3, 0.3],
    ...film.ranges,
  },
  moods: {
    calm: { pitch: [0.036, 0.042], fill: [0.5, 0.58] },
    bold: { pitch: [0.03, 0.034], fill: [0.6, 0.68], size: [0.88, 0.94] },
  },
  grain: { smooth: { ...film.grain?.smooth }, heavy: { ...film.grain?.heavy } },
  shapes: SUBJECTS,
  palette: {
    ...BASE_PALETTE,
    partnerFloor: 0.08,
    light: { ...BASE_PALETTE.light, partner: { l: [0.66, 0.76], c: [0.8, 1] } },
    dark: { ...BASE_PALETTE.dark, partner: { l: [0.58, 0.68], c: [0.8, 1] } },
  },
  layout: (context) => patched(context, context.shape as Subject, { size: context.p.size, pitch: context.p.pitch, fill: context.p.fill, tilt: context.p.tilt }),
  finish: (art, context) => film.finish(art, context as never),
})
