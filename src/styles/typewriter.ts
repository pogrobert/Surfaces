import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { paper } from "../grammar/grounds.ts"
import { film } from "../grammar/processes.ts"
import { SUBJECTS, typewriter as type } from "../layouts/typewriter.ts"
import type { Subject } from "../layouts/typewriter.ts"

// Typewriter art: a picture struck in characters on the machine's grid, on
// folded paper under grain. The brand's initial typed large, a lit sphere, a
// page swelling into a shape, or a table of figures.
export const typewriter = defineRecipe({
  style: "typewriter",
  version: 2,
  ranges: {
    size: [0.82, 0.94],
    pitch: [30, 40],
    contrast: [0.85, 1.15],
    light: [0, 360],
    ...paper.ranges,
    ...film.ranges,
  },
  moods: {
    calm: { pitch: [36, 40], contrast: [0.85, 0.95], ...paper.moods?.calm },
    bold: { pitch: [30, 33], contrast: [1.05, 1.15], size: [0.88, 0.94] },
  },
  grain: { smooth: { ...film.grain?.smooth }, heavy: { ...film.grain?.heavy } },
  shapes: SUBJECTS,
  palette: paper.palette(BASE_PALETTE),
  layout(context) {
    const art = type(context, context.shape as Subject, {
      size: context.p.size,
      pitch: context.p.pitch,
      contrast: context.p.contrast,
      light: context.p.light,
    })
    return { ...art, over: [...art.over, ...(paper.over?.(context, context.p, art.subject ? [art.subject] : []) ?? [])] }
  },
  finish: (art, context) => film.finish(art, context as never),
})
