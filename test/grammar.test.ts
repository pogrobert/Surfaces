import assert from "node:assert/strict"
import { test } from "node:test"
import { drawRecipe } from "../src/core/generate.ts"
import { judge } from "../src/core/judge.ts"
import { compose, GRAMMAR } from "../src/grammar/compose.ts"
import type { Layers } from "../src/grammar/compose.ts"
import { STYLES } from "../src/styles/index.ts"
import { BRAND_COLORS, PRESETS, titleAt } from "./support/inputs.ts"
import type { TitlePlace } from "./support/inputs.ts"

// The common covers, and the awkward ones: a wide title across a square, a
// tall strip, a short one.
const LAYOUTS: readonly (readonly [number, number, TitlePlace])[] = [
  ...PRESETS,
  [1000, 1000, "left"],
  [1000, 1000, "top"],
  [600, 1800, "top"],
  [2000, 500, "left"],
  [1600, 900, "none"],
]

// Every combination of the grammar's parts that compose() lets through.
function combinations() {
  const all: Layers[] = []
  for (const ground of Object.keys(GRAMMAR.ground) as Layers["ground"][])
    for (const figure of Object.keys(GRAMMAR.figure) as Layers["figure"][])
      for (const fill of Object.keys(GRAMMAR.fill) as Layers["fill"][])
        for (const relation of Object.keys(GRAMMAR.relation) as Layers["relation"][])
          for (const process of Object.keys(GRAMMAR.process) as Layers["process"][])
            all.push({ ground, figure, fill, relation, process })
  return all.flatMap((layers) => {
    const style = Object.values(layers).join("-")
    try {
      return [{ layers, recipe: compose({ style, version: 1, ...layers }) }]
    } catch {
      return []
    }
  })
}

test("a clash between parts fails, naming the parts and what to change", () => {
  assert.throws(
    () => compose({ style: "x", version: 1, ground: "plain", figure: "tiles", fill: "flat", relation: "inside", process: "wash" }),
    /"wash" doesn't work with "flat"; choose another fill/
  )
})

test("a composed style is an ordinary recipe that knows its parts", () => {
  assert.deepEqual(STYLES.stencil.layers, { ground: "paper", figure: "tiles", fill: "paint", relation: "inside", process: "wash" })
  assert.deepEqual(STYLES.stencil.shapes, GRAMMAR.figure.tiles.shapes)
})

// The judge holds every combination before any is offered: content reads,
// the art is neither blank nor a wall, and the figure stays out of the areas.
test("every combination the grammar allows passes the judge", () => {
  const found = combinations()
  assert.ok(found.length >= 12, `${found.length} combinations`)
  for (const { layers, recipe } of found) {
    for (const shape of recipe.shapes ?? []) {
      for (const [index, [width, height, place]] of LAYOUTS.entries()) {
        for (const theme of ["light", "dark"] as const) {
          const input = { seed: `judge-${index}`, shape, width, height, theme, color: BRAND_COLORS[(index * 3) % BRAND_COLORS.length]!, ...titleAt(place) }
          const verdict = judge(drawRecipe(recipe, input))
          assert.ok(verdict.ok, `${Object.values(layers).join(" ")} ${shape} ${width}x${height} ${place} ${theme}: ${verdict.problems.join("; ")}`)
        }
      }
    }
  }
})

test("the judge turns down a cover whose content can't be read", () => {
  const scene = drawRecipe(STYLES.stencil, { seed: "judge", ...titleAt("bottom-left") })
  assert.ok(judge(scene).ok)
  const [area] = scene.areas
  const k = scene.size.w / scene.output.w
  const smothered = {
    ...scene,
    layers: [
      ...scene.layers,
      {
        kind: "shapes" as const,
        id: "smother",
        paint: { type: "solid" as const, tone: "ink" as const, opacity: 0.9 },
        shapes: [{ type: "rect" as const, x: area!.x * k, y: area!.y * k, w: area!.width * k, h: area!.height * k, radii: [0, 0, 0, 0] as const }],
      },
    ],
  }
  assert.match(judge(smothered).problems.join(), /reads at/)
})
