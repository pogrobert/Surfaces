import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { plate } from "../finishes/index.ts"
import { COPY_MOTIFS, photocopy } from "../layouts/copy.ts"
import type { CopyMotif } from "../layouts/copy.ts"

// Simple shapes, or a page laid crooked on the glass, in toner on paper, with
// the faults that give a copy away: the open lid, low-ink streaks and stray
// specks.
export const photocopyStyle = defineRecipe({
  style: "photocopy",
  version: 1,
  ranges: {
    size: [1, 1.3],
    fade: [0.89, 0.99],
    lid: [0.09, 0.2],
    streaks: [2, 6],
    low: [0.45, 0.8],
    specks: [60, 220],
    grainSize: [0.62, 0.82],
    hardness: [3.2, 5],
    wash: [0.12, 0.3],
    film: [0.12, 0.2],
  },
  moods: {
    calm: { streaks: [2, 3], specks: [60, 100], low: [0.45, 0.6] },
    bold: { streaks: [4, 6], specks: [160, 220], hardness: [4.2, 5] },
  },
  grain: {
    smooth: {
      grainSize: [0.85, 0.98],
      hardness: [2.4, 3.2],
      wash: [0.4, 0.55],
      film: [0.03, 0.06],
    },
    heavy: {
      grainSize: [0.5, 0.6],
      hardness: [4.6, 5.6],
      wash: [0.05, 0.14],
      film: [0.3, 0.4],
    },
  },
  palette: {
    ...BASE_PALETTE,
    maxChroma: 0.06,
    light: {
      ...BASE_PALETTE.light,
      // Copier paper, a little warm whatever the brand.
      ground: { l: [0.955, 0.97], c: [0.1, 0.2], turn: -30 },
      strong: { l: [0.16, 0.22], c: [0.5, 0.8], turn: 10 },
    },
    dark: {
      ...BASE_PALETTE.dark,
      ground: { l: [0.12, 0.15], c: [0.2, 0.3], turn: 8 },
      strong: { l: [0.88, 0.93], c: [0.2, 0.4], turn: -8 },
    },
  },
  shapes: COPY_MOTIFS,
  aroundCentre: true,

  picture: ({ p, rng, theme }) => [
    {
      type: "toner",
      tone: "strong",
      low: 0.28,
      high: 0.62,
      scale: p.grainSize,
      hardness: p.hardness,
      wash: p.wash,
      seed: rng.fork("photo").int(1, 9999),
      invert: theme === "dark",
    },
  ],
  layout: (context) => photocopy(context, context.shape as CopyMotif, context.p),
  finish(art, { p, rng }) {
    const seeds = rng.fork("grain")
    return plate(art, {
      scale: p.grainSize,
      hardness: p.hardness,
      wash: p.wash,
      seed: seeds.int(1, 9999),
      film: p.film,
      filmSeed: seeds.int(1, 9999),
    })
  },
})
