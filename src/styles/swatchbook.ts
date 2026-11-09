import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { lift } from "../grammar/processes.ts"
import { SUBJECTS, swatchbook as book } from "../layouts/swatchbook.ts"
import type { Subject } from "../layouts/swatchbook.ts"

// A sample book of the brand's materials: cards of flat colour, wash,
// halftone, stripes, lines, cloth and terrazzo, laid in a grid, fanned like a
// paint deck, scattered, or as one paint strip in steps.
export const swatchbook = defineRecipe({
  style: "swatchbook",
  version: 1,
  ranges: {
    size: [0.82, 0.94],
    round: [0.04, 0.1],
    tilt: [-0.12, 0.12],
    ...lift.ranges,
  },
  moods: {
    calm: { round: [0.06, 0.1], ...lift.moods?.calm },
    bold: { round: [0.04, 0.06], size: [0.88, 0.94], ...lift.moods?.bold },
  },
  grain: { smooth: { ...lift.grain?.smooth }, heavy: { ...lift.grain?.heavy } },
  shapes: SUBJECTS,
  palette: {
    ...BASE_PALETTE,
    partnerFloor: 0.08,
    light: { ...BASE_PALETTE.light, partner: { l: [0.64, 0.74], c: [0.75, 0.95] } },
    dark: { ...BASE_PALETTE.dark, partner: { l: [0.56, 0.66], c: [0.75, 0.95] } },
  },
  layout: (context) => book(context, context.shape as Subject, { size: context.p.size, round: context.p.round, tilt: context.p.tilt }),
  finish: (art, context) => lift.finish(art, context as never),
})
