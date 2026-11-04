import { BASE_PALETTE } from "../core/palette.ts"
import type { PaletteSpec } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import type { Layer } from "../core/scene.ts"
import { marbling, PATTERNS } from "../layouts/marbling.ts"
import type { Pattern } from "../layouts/marbling.ts"

// Marbled paper: inks floated on a bath and combed or stirred into veins, laid
// on the cover as a sheet, a disc, or the whole cover under paper labels. The
// brand and its partner, with a deep and a pale of the brand, on paper.
const PALETTE: PaletteSpec = {
  ...BASE_PALETTE,
  partnerFloor: 0.09,
  maxChroma: 0.17,
  light: {
    ...BASE_PALETTE.light,
    // Paper, warmed a little whatever the brand.
    ground: { l: [0.955, 0.97], c: [0.06, 0.1], turn: -30 },
    quiet: { l: [0.9, 0.93], c: [0.18, 0.26], turn: -20 },
    soft: { l: [0.82, 0.87], c: [0.45, 0.6] },
    body: { l: [0.58, 0.66], c: [0.85, 1] },
    strong: { l: [0.3, 0.37], c: [0.75, 0.9], turn: 16 },
    partner: { l: [0.68, 0.76], c: [0.85, 1] },
  },
  dark: {
    ...BASE_PALETTE.dark,
    quiet: { l: [0.22, 0.26], c: [0.3, 0.42], turn: 8 },
    soft: { l: [0.36, 0.42], c: [0.6, 0.75], turn: 8 },
    body: { l: [0.56, 0.64], c: [0.9, 1] },
    strong: { l: [0.84, 0.89], c: [0.4, 0.55], turn: -12 },
    partner: { l: [0.66, 0.74], c: [0.85, 1] },
  },
}

export const marblingStyle = defineRecipe({
  style: "marbling",
  version: 1,
  ranges: {
    scale: [0.9, 1.15],
    gap: [42, 60],
    pull: [100, 150],
    wave: [10, 24],
    turn: [3.2, 4.6],
    grain: [0.1, 0.16],
  },
  moods: {
    calm: { pull: [100, 115], wave: [10, 15], turn: [3.2, 3.8] },
    bold: { pull: [135, 150], wave: [18, 24], turn: [4, 4.6] },
  },
  grain: {
    smooth: { grain: [0.02, 0.05] },
    heavy: { grain: [0.32, 0.42] },
  },
  // Too soft or busy for a ruler and label: detail "micro" adds the marks alone.
  marksOnly: true,
  palette: PALETTE,
  shapes: PATTERNS,
  // A centred title goes on a label over the whole sheet, as on a book.
  aroundCentre: true,

  layout: (context) => marbling(context, context.shape as Pattern, context.p),
  // The sheet is one piece, cut to its edge, and moves whole inside it.
  finish: (art, { p, rng }): Layer[] => [
    ...art.under,
    ...(art.pieces ?? []).map(
      (piece): Layer => ({
        kind: "clip",
        id: piece.id,
        shape: piece.clip,
        layers: piece.marks,
        ...(art.moves?.plate ? { motion: art.moves.plate } : null),
      })
    ),
    ...art.over,
    { kind: "grain", id: "grain", amount: p.grain, scale: 0.74, seed: rng.fork("grain").int(1, 9999) },
  ],
})
