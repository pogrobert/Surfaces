import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../grammar/processes.ts"
import { dashes as dashed, SUBJECTS } from "../layouts/dashes.ts"
import type { Subject } from "../layouts/dashes.ts"

// A form drawn only in short level dashes, longer and heavier where it rises:
// a lit orb, a cumulus cloud, hills in mist, or relief across the sheet.
export const dashes = defineRecipe({
  style: "dashes",
  version: 1,
  ranges: {
    size: [0.82, 0.94],
    rows: [46, 60],
    drift: [0.3, 0.9],
    light: [0, 360],
    ...film.ranges,
  },
  moods: {
    calm: { rows: [54, 60], drift: [0.3, 0.5] },
    bold: { rows: [46, 50], drift: [0.6, 0.9], size: [0.88, 0.94] },
  },
  grain: { smooth: { ...film.grain?.smooth }, heavy: { ...film.grain?.heavy } },
  shapes: SUBJECTS,
  palette: BASE_PALETTE,
  layout: (context) => dashed(context, context.shape as Subject, { size: context.p.size, rows: context.p.rows, drift: context.p.drift, light: context.p.light }),
  finish: (art, context) => film.finish(art, context as never),
})
