import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../grammar/processes.ts"
import { currents as flow, SUBJECTS } from "../layouts/currents.ts"
import type { Subject } from "../layouts/currents.ts"

// Fine lines along a current, evenly apart: a stream parting round a stone, a
// whirl drawing in to its eye, two streams meeting, or a field of flow across
// the sheet that parts round the title.
export const currents = defineRecipe({
  style: "currents",
  version: 2,
  ranges: {
    size: [0.82, 0.94],
    gap: [0.012, 0.017],
    weight: [0.22, 0.34],
    turn: [-0.45, 0.45],
    ...film.ranges,
  },
  moods: {
    calm: { gap: [0.015, 0.017], weight: [0.22, 0.27] },
    bold: { gap: [0.012, 0.013], weight: [0.3, 0.34], size: [0.88, 0.94] },
  },
  grain: { smooth: { ...film.grain?.smooth }, heavy: { ...film.grain?.heavy } },
  shapes: SUBJECTS,
  palette: {
    ...BASE_PALETTE,
    partnerFloor: 0.08,
    light: { ...BASE_PALETTE.light, partner: { l: [0.6, 0.7], c: [0.8, 1] } },
    dark: { ...BASE_PALETTE.dark, partner: { l: [0.62, 0.72], c: [0.8, 1] } },
  },
  layout: (context) => flow(context, context.shape as Subject, { size: context.p.size, gap: context.p.gap, weight: context.p.weight, turn: context.p.turn }),
  finish: (art, context) => film.finish(art, context as never),
})
