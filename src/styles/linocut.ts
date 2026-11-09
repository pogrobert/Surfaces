import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { paper } from "../grammar/grounds.ts"
import { block } from "../grammar/processes.ts"
import { linocut as carve, SUBJECTS } from "../layouts/linocut.ts"
import type { Subject } from "../layouts/linocut.ts"

// A relief print in one deep ink on folded paper: hills under a ringed sun, a
// sprig with its veins cut, waves cut along their crests, or the brand's
// initial standing in a field cut away inside a border.
export const linocut = defineRecipe({
  style: "linocut",
  version: 2,
  ranges: {
    size: [0.82, 0.94],
    spacing: [0.024, 0.034],
    cut: [0.3, 0.42],
    ...paper.ranges,
    ...block.ranges,
  },
  moods: {
    calm: { spacing: [0.03, 0.034], cut: [0.3, 0.35], ...paper.moods?.calm, ...block.moods?.calm },
    bold: { spacing: [0.024, 0.027], cut: [0.37, 0.42], size: [0.88, 0.94], ...block.moods?.bold },
  },
  grain: { smooth: { ...block.grain?.smooth }, heavy: { ...block.grain?.heavy } },
  shapes: SUBJECTS,
  palette: block.palette!(paper.palette(BASE_PALETTE)),
  layout(context) {
    const art = carve(context, context.shape as Subject, { size: context.p.size, spacing: context.p.spacing, cut: context.p.cut })
    return { ...art, over: [...art.over, ...(paper.over?.(context, context.p, art.subject ? [art.subject] : []) ?? [])] }
  },
  finish: (art, context) => block.finish(art, context as never),
})
