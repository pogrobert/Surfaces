import assert from "node:assert/strict"
import { test } from "node:test"
import { generate } from "../src/core/generate.ts"
import { AREA_SIZES, MOODS, PLACES } from "../src/core/intent.ts"
import { validate } from "../src/core/validate.ts"
import { toSvg } from "../src/render/svg.ts"
import { STYLES } from "../src/styles/index.ts"
import { PRESETS, STYLE_NAMES } from "./support/inputs.ts"

test("every range is ordered, and every mood sits inside its range", () => {
  for (const recipe of Object.values(STYLES)) {
    const ranges = recipe.ranges as Record<string, readonly [number, number]>
    for (const [name, [low, high]] of Object.entries(ranges)) {
      assert.ok(low < high, `${recipe.style}.${name}`)
    }
    for (const mood of MOODS) {
      const narrowed = recipe.moods[mood] as Record<
        string,
        readonly [number, number]
      >
      for (const [name, [low, high]] of Object.entries(narrowed)) {
        const range = ranges[name]
        assert.ok(range, `${recipe.style}.${mood}.${name} has no range`)
        assert.ok(
          low >= range[0] && high <= range[1] && low < high,
          `${recipe.style}.${mood}.${name} leaves its range`
        )
      }
    }
  }
})

// A grain level may move only the finish's own numbers, never the ones that
// place or colour the drawing.
const FINISH_NUMBERS =
  /^(grain|grainScale|grainSize|film|hardness|wash|paper)$/

test("every grain level is ordered and touches only the finish", () => {
  for (const recipe of Object.values(STYLES)) {
    const ranges = recipe.ranges as Record<string, readonly [number, number]>
    for (const level of ["smooth", "heavy"] as const) {
      const narrowed = recipe.grain[level] as Record<
        string,
        readonly [number, number]
      >
      assert.ok(Object.keys(narrowed).length > 0, `${recipe.style}.${level}`)
      for (const [name, [low, high]] of Object.entries(narrowed)) {
        assert.ok(ranges[name], `${recipe.style}.${level}.${name} has no range`)
        assert.match(name, FINISH_NUMBERS, `${recipe.style}.${level}.${name}`)
        assert.ok(low < high, `${recipe.style}.${level}.${name}`)
      }
    }
  }
})

test("every style takes an area at every place and size", () => {
  for (const style of STYLE_NAMES) {
    for (const [width, height] of PRESETS) {
      for (const place of PLACES) {
        for (const size of AREA_SIZES) {
          const scene = generate({ style, seed: 1, width, height, areas: [{ place, size }] })
          const [area] = scene.areas
          assert.ok(area && area.width > 0 && area.place === place, `${style} ${place} ${size}`)
        }
      }
    }
  }
})

test("bad input fails loudly instead of drawing something wrong", () => {
  const base = { style: "halftone", seed: 1 } as const
  assert.throws(() => generate({ ...base, style: "nope" as "halftone" }))
  assert.throws(() => generate({ ...base, color: "red" }))
  assert.throws(() => generate({ ...base, shape: "nope" }), /Use "tile"/)
  assert.throws(() => generate({ ...base, grain: "grainy" as "heavy" }))
  assert.throws(() => generate({ ...base, width: 100 }))
  assert.throws(() => generate({ ...base, width: 0, height: 100 }))
  assert.throws(() => generate({ ...base, width: 5000, height: 1000 }), /4:1/)
  assert.throws(() =>
    generate({ style: "underpaint", seed: 1, shape: "disc" })
  )
})

test("a width and height alone draw a cover", () => {
  const scene = generate({ style: "sfumato", seed: 1, width: 1080, height: 1920 })
  assert.deepEqual(scene.output, { w: 1080, h: 1920 })
  assert.match(toSvg(scene), /width="1080" height="1920"/)
})

test("a wrong input says how to put it right", () => {
  const errors = (input: unknown) => validate(input).errors.join("\n")
  assert.match(errors({ style: "riso", seed: "a", grian: "heavy" }), /Unknown option "grian"\. Did you mean "grain"\?/)
  assert.match(errors({ style: "riso", seed: "a", grain: "rough" }), /Unknown grain "rough"\. Use "smooth", "natural" or "heavy"\./)
  assert.match(errors({ style: "rizo", seed: "a" }), /Did you mean "riso"\?/)
  assert.match(errors({ style: "riso", seed: "a", color: "red" }), /hex colour/)
  assert.match(errors({ style: "riso", seed: "a", areas: [{ place: "top-middle" }] }), /Use "top-left"/)
  assert.match(
    errors({ style: "riso", seed: "a", areas: [{ place: "left", size: "lg" }, { place: "bottom-left", size: "lg" }] }),
    /overlap/
  )
  assert.match(errors({ style: "riso", seed: "a", areas: [{ place: "left", box: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 } }] }), /use one/)
  assert.match(errors({ style: "riso" }), /Missing "seed"/)
  assert.deepEqual(validate({ style: "riso", seed: "my-post", color: "#635bff" }), { errors: [], warnings: [] })
  assert.equal(validate({ style: "riso", seed: 42 }).warnings.length, 1)
})
