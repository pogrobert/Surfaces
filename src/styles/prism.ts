import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../grammar/processes.ts"
import { prism as refracted, SUBJECTS } from "../layouts/prism.ts"
import type { Subject } from "../layouts/prism.ts"

// Light through glass: wide bands running deep to pale across their width,
// fringed in the partner colour along one edge and the brand's along the
// other. A ribbon in an S, three folds, a tilted ring, or upright bars.
export const prism = defineRecipe({
  style: "prism",
  version: 1,
  ranges: {
    size: [0.82, 0.94],
    band: [0.17, 0.24],
    split: [0.08, 0.13],
    turn: [-0.5, 0.5],
    ...film.ranges,
  },
  moods: {
    calm: { split: [0.08, 0.095], band: [0.17, 0.2] },
    bold: { split: [0.11, 0.13], band: [0.21, 0.24], size: [0.88, 0.94] },
  },
  grain: { smooth: { ...film.grain?.smooth }, heavy: { ...film.grain?.heavy } },
  shapes: SUBJECTS,
  palette: {
    ...BASE_PALETTE,
    partnerFloor: 0.1,
    light: { ...BASE_PALETTE.light, partner: { l: [0.62, 0.72], c: [0.85, 1] } },
    dark: { ...BASE_PALETTE.dark, partner: { l: [0.6, 0.7], c: [0.85, 1] } },
  },
  layout: (context) => refracted(context, context.shape as Subject, { size: context.p.size, band: context.p.band, split: context.p.split, turn: context.p.turn }),
  finish: (art, context) => film.finish(art, context as never),
})
