import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { lift } from "../grammar/processes.ts"
import { SUBJECTS, weave as woven } from "../layouts/weave.ts"
import type { Subject } from "../layouts/weave.ts"

// Cloth as it is seen: a swatch fraying at two edges, a piece with a corner
// folded back, a woven strap with its selvedges, or a pile of folded cloths,
// in stripes, checks or a tartan's count, each lying a little above the sheet.
export const weave = defineRecipe({
  style: "weave",
  version: 2,
  ranges: {
    size: [0.8, 0.94],
    threads: [28, 36],
    thread: [0.86, 0.93],
    tilt: [-0.12, 0.12],
    ...lift.ranges,
  },
  moods: {
    calm: { threads: [32, 36], ...lift.moods?.calm },
    bold: { threads: [28, 31], thread: [0.9, 0.93], size: [0.88, 0.94], ...lift.moods?.bold },
  },
  grain: { smooth: { ...lift.grain?.smooth }, heavy: { ...lift.grain?.heavy } },
  shapes: SUBJECTS,
  palette: {
    ...BASE_PALETTE,
    partnerFloor: 0.08,
    light: { ...BASE_PALETTE.light, partner: { l: [0.64, 0.74], c: [0.75, 0.95] } },
    dark: { ...BASE_PALETTE.dark, partner: { l: [0.56, 0.66], c: [0.75, 0.95] } },
  },
  layout: (context) => woven(context, context.shape as Subject, { size: context.p.size, threads: context.p.threads, thread: context.p.thread, tilt: context.p.tilt }),
  finish: (art, context) => lift.finish(art, context as never),
})
