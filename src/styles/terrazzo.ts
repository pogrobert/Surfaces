import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { lift } from "../grammar/processes.ts"
import { SUBJECTS, terrazzo as stone } from "../layouts/terrazzo.ts"
import type { Subject } from "../layouts/terrazzo.ts"

// Terrazzo made into things: a cut tile with a chipped corner, a slab seen
// with its thickness, two blocks stepped one on the other, or a patch of
// floor between metal strips, the chips in the brand's colours and its
// partner, each piece lying a little above the sheet.
export const terrazzo = defineRecipe({
  style: "terrazzo",
  version: 2,
  ranges: {
    size: [0.8, 0.94],
    chips: [90, 140],
    largest: [0.05, 0.08],
    specks: [200, 320],
    tilt: [-0.14, 0.14],
    ...lift.ranges,
  },
  moods: {
    calm: { chips: [90, 105], largest: [0.05, 0.06], ...lift.moods?.calm },
    bold: { chips: [120, 140], largest: [0.07, 0.08], size: [0.88, 0.94], ...lift.moods?.bold },
  },
  grain: { smooth: { ...lift.grain?.smooth }, heavy: { ...lift.grain?.heavy } },
  shapes: SUBJECTS,
  palette: {
    ...BASE_PALETTE,
    partnerFloor: 0.08,
    light: { ...BASE_PALETTE.light, partner: { l: [0.64, 0.74], c: [0.75, 0.95] } },
    dark: { ...BASE_PALETTE.dark, partner: { l: [0.56, 0.66], c: [0.75, 0.95] } },
  },
  layout: (context) =>
    stone(context, context.shape as Subject, { size: context.p.size, chips: context.p.chips, largest: context.p.largest, specks: context.p.specks, tilt: context.p.tilt }),
  finish: (art, context) => lift.finish(art, context as never),
})
