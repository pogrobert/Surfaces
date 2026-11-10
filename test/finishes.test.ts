import assert from "node:assert/strict"
import { test } from "node:test"
import { generate } from "../src/core/generate.ts"
import { createRng } from "../src/core/random.ts"
import type { Art } from "../src/core/recipe.ts"
import { toSvg } from "../src/render/svg.ts"
import {
  exposure,
  film,
  focus,
  plate,
  print,
  smear,
} from "../src/finishes/index.ts"
import { STYLES } from "../src/styles/index.ts"
import { STYLE_NAMES } from "./support/inputs.ts"

const FINISHES = {
  film: (art: Art) => film(art, { amount: 0.3, scale: 0.7, seed: 7 }),
  plate: (art: Art) =>
    plate(art, {
      scale: 0.7,
      hardness: 2.4,
      wash: 0.5,
      seed: 7,
      film: 0.2,
      filmSeed: 8,
    }),
  print: (art: Art) =>
    print(art, {
      scale: 0.7,
      hardness: 2.6,
      wash: 0.6,
      seed: 7,
      dx: 8,
      dy: -6,
      blend: "multiply",
      paper: 0.1,
      paperSeed: 8,
    }),
  focus: (art: Art) =>
    focus(art, { mass: 70, fine: 2, amount: 0.3, scale: 0.72, seed: 7 }),
  smear: (art: Art) =>
    smear(art, { across: 2, along: 16, amount: 0.2, scale: 0.74, seed: 7 }),
  exposure: (art: Art) =>
    exposure(art, {
      angle: 20,
      streak: 100,
      warp: 300,
      bloom: 0.54,
      seed: 7,
      amount: 0.3,
      scale: 0.72,
      grainSeed: 8,
    }),
}

// Not an offer to callers: these combinations haven't been judged by eye. It
// proves the three parts are really apart, so a new style is a new combination
// and not a new pile of code.
test("any layout can go through any finish", () => {
  const base = generate({ style: "underpaint", seed: "matrix" })
  for (const style of STYLE_NAMES) {
    const recipe = STYLES[style]
    for (const [name, finish] of Object.entries(FINISHES)) {
      const p: Record<string, number> = {}
      for (const [key, [low]] of Object.entries(
        recipe.ranges as Record<string, readonly [number, number]>
      )) {
        p[key] = low
      }
      const art = (recipe as { layout(context: unknown): Art }).layout({
        w: base.size.w,
        h: base.size.h,
        safe: { x: 0, y: base.size.h, w: 0, h: 0 },
        keep: [{ x: 0, y: base.size.h, w: 0, h: 0 }],
        calm: [],
        titled: false,
        fill: false,
        theme: "dark",
        mood: undefined,
        p,
        shape: recipe.shapes?.[0],
        rng: createRng("matrix"),
        seed: "matrix",
      })
      const svg = toSvg({ ...base, layers: finish(art) })
      assert.doesNotMatch(svg, /NaN|undefined/, `${style} through ${name}`)
    }
  }
})
