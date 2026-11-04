import { BASE_PALETTE } from "../core/palette.ts"
import type { PaletteSpec } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import type { Layer } from "../core/scene.ts"
import { plate } from "../finishes/index.ts"
import { mezzotint, STILL_LIFES } from "../layouts/mezzotint.ts"
import type { StillLife } from "../layouts/mezzotint.ts"

// A still life burnished out of a velvet-black plate. The plate is dark in
// both themes: on black it is the whole cover, and on paper it is a print
// with a margin of paper round it and the plate's pressed edge, its lights
// the paper itself. So the ground is the plate, the strongest tone is the
// light, and content on it reads in a pale ink either way.
const PALETTE: PaletteSpec = {
  ...BASE_PALETTE,
  maxChroma: 0.06,
  light: {
    ground: { l: [0.13, 0.155], c: [0.2, 0.35], turn: -20 },
    quiet: { l: [0.2, 0.23], c: [0.3, 0.45], turn: -20 },
    soft: { l: [0.34, 0.4], c: [0.5, 0.7] },
    // The paper round the plate.
    body: { l: [0.95, 0.965], c: [0.15, 0.25], turn: -40 },
    strong: { l: [0.95, 0.965], c: [0.15, 0.25], turn: -40 },
    ink: { l: [0.96, 0.975], c: [0.1, 0.18], turn: -40 },
  },
  dark: {
    ground: { l: [0.1, 0.12], c: [0.35, 0.5], turn: 8 },
    quiet: { l: [0.17, 0.2], c: [0.45, 0.6], turn: 8 },
    soft: { l: [0.3, 0.36], c: [0.6, 0.75] },
    // On a dark page there is no paper: the margin is the plate's own black.
    body: { l: [0.1, 0.12], c: [0.35, 0.5], turn: 8 },
    strong: { l: [0.88, 0.92], c: [0.45, 0.6], turn: -10 },
    ink: { l: [0.96, 0.98], c: [0.08, 0.14] },
  },
}

export const mezzotintStyle = defineRecipe({
  style: "mezzotint",
  version: 1,
  ranges: {
    peak: [0.86, 0.96],
    size: [0.9, 1],
    room: [0.1, 0.16],
    grainSize: [0.9, 1.05],
    hardness: [1.1, 1.4],
    wash: [0.84, 0.92],
    film: [0.08, 0.14],
  },
  moods: {
    calm: { peak: [0.86, 0.9], room: [0.13, 0.16], hardness: [1.1, 1.2] },
    bold: { peak: [0.92, 0.96], room: [0.1, 0.12], hardness: [1.3, 1.4] },
  },
  grain: {
    smooth: { grainSize: [1.15, 1.25], hardness: [1, 1.1], wash: [0.94, 0.97], film: [0.03, 0.06] },
    heavy: { grainSize: [0.75, 0.85], hardness: [1.6, 2], wash: [0.66, 0.74], film: [0.2, 0.28] },
  },
  palette: PALETTE,
  shapes: STILL_LIFES,
  // A still life fogged under a title loses what makes it one: it stands
  // beside or above a title in the middle instead.
  aroundCentre: true,

  layout: (context) => mezzotint(context, context.shape as StillLife, context.p),
  // The back row's plate, then the black of what stands in front, then the
  // front row's plate over it, one grain through all of it.
  finish(art, { p, rng }) {
    const grain = rng.fork("grain")
    const seed = grain.int(1, 9999)
    const filmSeed = grain.int(1, 9999)
    const printed = plate(art, { scale: p.grainSize, hardness: p.hardness, wash: p.wash, seed, film: p.film, filmSeed })
    if (!art.second?.length) return printed
    const front: Layer = {
      kind: "stipple",
      id: "front",
      tone: "strong",
      scale: p.grainSize,
      hardness: p.hardness,
      wash: p.wash,
      seed,
      layers: art.second,
      ...(art.moves?.second ? { motion: art.moves.second } : null),
    }
    const after = printed.findIndex((layer) => layer.kind === "stipple") + 1
    return [...printed.slice(0, after), ...(art.between ?? []), front, ...printed.slice(after)]
  },
})
