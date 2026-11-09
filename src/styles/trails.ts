import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../grammar/processes.ts"
import { SUBJECTS, trails as streaked } from "../layouts/trails.ts"
import type { Subject } from "../layouts/trails.ts"

// Lights in a long exposure: streaks in the greys of a night street, and one
// hot in the brand's colour, glowing. A sweep across the sheet, trails in
// tilted rings, a bundle bending round a corner, or short streaks drifting.
export const trails = defineRecipe({
  style: "trails",
  version: 1,
  ranges: {
    size: [0.82, 0.94],
    streaks: [16, 26],
    width: [0.004, 0.007],
    glow: [1, 1.6],
    turn: [-0.4, 0.4],
    ...film.ranges,
  },
  moods: {
    calm: { streaks: [16, 19], width: [0.004, 0.005], glow: [1, 1.2] },
    bold: { streaks: [22, 26], width: [0.006, 0.007], glow: [1.3, 1.6], size: [0.88, 0.94] },
  },
  grain: { smooth: { ...film.grain?.smooth }, heavy: { ...film.grain?.heavy } },
  shapes: SUBJECTS,
  // Greys with only a breath of the brand in them, so the one hot light is
  // the only colour.
  palette: {
    ...BASE_PALETTE,
    light: {
      ground: { l: [0.9, 0.93], c: [0.04, 0.08] },
      quiet: { l: [0.82, 0.85], c: [0.05, 0.09] },
      soft: { l: [0.7, 0.75], c: [0.06, 0.1] },
      body: { l: [0.52, 0.58], c: [0.06, 0.1] },
      strong: { l: [0.3, 0.36], c: [0.06, 0.1] },
      ink: { l: [0.16, 0.19], c: [0.05, 0.08] },
    },
    dark: {
      ground: { l: [0.13, 0.16], c: [0.05, 0.09] },
      quiet: { l: [0.24, 0.28], c: [0.05, 0.09] },
      soft: { l: [0.38, 0.44], c: [0.06, 0.1] },
      body: { l: [0.56, 0.62], c: [0.06, 0.1] },
      strong: { l: [0.78, 0.84], c: [0.05, 0.08] },
      ink: { l: [0.96, 0.98], c: [0.03, 0.06] },
    },
  },
  layout: (context) => streaked(context, context.shape as Subject, { size: context.p.size, streaks: context.p.streaks, width: context.p.width, glow: context.p.glow, turn: context.p.turn }),
  finish: (art, context) => film.finish(art, context as never),
})
