import assert from "node:assert/strict"
import { gzipSync } from "node:zlib"
import { test } from "node:test"
import { generate } from "../src/core/generate.ts"
import { TONES } from "../src/core/scene.ts"
import type { Layer, Scene } from "../src/core/scene.ts"
import { toSvg } from "../src/render/svg.ts"
import { boxesTouch, distanceFrom } from "../src/layouts/geometry.ts"
import { STYLES } from "../src/styles/index.ts"
import {
  BRAND_COLORS,
  randomInputs,
  SIZES,
  STYLE_NAMES,
  TITLE_PLACES,
  titleAt,
} from "./support/inputs.ts"
import { coverage, keptBoxes, worstTitleContrast } from "../src/core/judge.ts"

// 1,000 seeds, each through every style with a random colour, use or size,
// mood and theme.
const INPUTS = randomInputs(1000)
const scenes = INPUTS.map((input) => ({
  input,
  scene: generate(input),
}))
const label = (input: unknown) => JSON.stringify(input)

// What a missing or broken number prints as. Ids are lowercase base 36 hashes
// and can spell "null" by chance, so those two words only count on their own.
const BROKEN = /NaN|Infinity|(?<![a-z0-9])(undefined|null)/

// Covers are served compressed, and a screen of identical cells compresses to
// almost nothing, so the budget is on the compressed size: well under a PNG
// of the same cover. The raw ceiling only catches a runaway.
const MAX_GZIP_BYTES = 50_000
const MAX_SVG_BYTES = 250_000

// A strict enough reading of what the renderer writes: every tag closes, in
// order, and every attribute is quoted.
function assertWellFormed(svg: string, name: string) {
  const open: string[] = []
  const tag = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z0-9:-]+="[^"<>]*")*)\s*(\/?)>/g
  let end = 0
  for (const match of svg.matchAll(tag)) {
    assert.equal(match.index, end, `${name}: stray text at ${end}`)
    end = match.index + match[0].length
    const [, closing, element, , selfClosing] = match
    if (closing) assert.equal(open.pop(), element, name)
    else if (!selfClosing) open.push(element!)
  }
  assert.equal(end, svg.length, `${name}: unparsed tail`)
  assert.equal(open.length, 0, name)
}

function assertReferencesResolve(svg: string, name: string) {
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]!)
  assert.equal(new Set(ids).size, ids.length, `${name}: duplicate id`)
  for (const [, id] of svg.matchAll(/url\(#([^)]+)\)/g)) {
    assert.ok(ids.includes(id!), `${name}: dangling ${id}`)
  }
}

function everyNumber(value: unknown, visit: (number: number) => void) {
  if (typeof value === "number") visit(value)
  else if (Array.isArray(value)) value.forEach((item) => everyNumber(item, visit))
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => everyNumber(item, visit))
  }
}

function tonesUsed(layers: Layer[]): string[] {
  return layers.flatMap((layer) => {
    if (layer.kind === "fill" || layer.kind === "pool" || layer.kind === "text") return [layer.tone]
    if (layer.kind === "grain" || layer.kind === "logo") return []
    if (layer.kind === "stipple") return [layer.tone, ...tonesUsed(layer.layers)]
    if (layer.kind === "blur" || layer.kind === "soften" || layer.kind === "clip") {
      return tonesUsed(layer.layers)
    }
    const paint = layer.paint
    return paint.type === "solid"
      ? [paint.tone]
      : paint.stops.map((stop) => stop.tone)
  })
}

test("every scene is finite and every tone resolves", () => {
  for (const { input, scene } of scenes) {
    assert.doesNotThrow(() => JSON.stringify(scene))
    everyNumber(scene, (number) =>
      assert.ok(Number.isFinite(number), label(input))
    )
    for (const tone of TONES) {
      assert.match(scene.palette[tone], /^#[0-9a-f]{6}$/, label(input))
    }
    for (const tone of tonesUsed(scene.layers)) {
      assert.ok(tone in scene.palette, label(input))
    }
  }
})

// Hairlines and dot screens break their ink up by design, so they are held to
// how much of the canvas their drawing spans rather than to how much ink it
// lays.
const HAIRLINE = new Set(["linework", "dither", "currents", "typewriter", "dashes", "trails"])

function span(scene: Scene) {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  const take = (x: number, y: number) => {
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x)
    bottom = Math.max(bottom, y)
  }
  // Marks inside a piece cut to its shape count too.
  const marks = (layers: readonly Layer[]): Layer[] => layers.flatMap((layer) => (layer.kind === "clip" ? marks(layer.layers) : [layer]))
  for (const layer of marks(scene.layers)) {
    if (layer.kind !== "shapes") continue
    for (const shape of layer.shapes) {
      if (shape.type === "blocks") {
        for (let i = 0; i < shape.points.length; i += 3) {
          take(shape.points[i]!, shape.points[i + 1]!)
          take(shape.points[i]! + shape.points[i + 2]!, shape.points[i + 1]! + shape.h)
        }
      } else if (shape.type === "ribbon" || shape.type === "polygon") {
        const step = shape.type === "ribbon" ? 3 : 2
        for (let i = 0; i < shape.points.length; i += step) {
          take(shape.points[i]!, shape.points[i + 1]!)
        }
      } else if (shape.type === "rect") {
        take(shape.x, shape.y)
        take(shape.x + shape.w, shape.y + shape.h)
      }
    }
  }
  const w = Math.min(right, scene.size.w) - Math.max(left, 0)
  const h = Math.min(bottom, scene.size.h) - Math.max(top, 0)
  return w > 0 && h > 0 ? (w * h) / (scene.size.w * scene.size.h) : 0
}

test("every SVG is well formed, self-contained and small", () => {
  for (const { input, scene } of scenes) {
    const name = label(input)
    const svg = toSvg(scene)
    assert.doesNotMatch(svg, BROKEN, name)
    assertWellFormed(svg, name)
    assertReferencesResolve(svg, name)
    assert.ok(svg.length < MAX_SVG_BYTES, `${name}: ${svg.length} bytes`)
    const packed = gzipSync(svg).length
    assert.ok(packed < MAX_GZIP_BYTES, `${name}: ${packed} bytes compressed`)
  }
})

test("every title clears 4.5:1 across the whole safe zone", () => {
  for (const { input, scene } of scenes) {
    const worst = worstTitleContrast(scene)
    assert.ok(worst >= 4.5, `${label(input)}: ${worst.toFixed(2)}:1`)
  }
})

test("every style holds a title in every brand colour and theme", () => {
  for (const style of STYLE_NAMES) {
    for (const color of BRAND_COLORS) {
      for (const theme of ["light", "dark"] as const) {
        for (let seed = 0; seed < 8; seed++) {
          const scene = generate({ style, seed, color, theme })
          const worst = worstTitleContrast(scene)
          assert.ok(worst >= 4.5, `${style} ${color} ${theme} ${seed}: ${worst}`)
        }
      }
    }
  }
})

test("every area stays inside the canvas, and subjects stay out of them", () => {
  for (const { input, scene } of scenes) {
    for (const box of keptBoxes(scene)) {
      const { x, y, w, h } = box
      assert.ok(x >= 0 && y >= 0, label(input))
      assert.ok(x + w <= scene.size.w && y + h <= scene.size.h, label(input))
      if (scene.subject) assert.ok(!boxesTouch(scene.subject, box), label(input))
    }
  }
})

test("every style holds at every size and title place", () => {
  for (const style of STYLE_NAMES) {
    for (const [width, height] of SIZES) {
      for (const text of TITLE_PLACES) {
        for (const theme of ["light", "dark"] as const) {
          for (let seed = 0; seed < 5; seed++) {
            const input = { style, seed, width, height, ...titleAt(text), theme }
            const scene = generate(input)
            const name = label(input)
            const svg = toSvg(scene)
            assert.doesNotMatch(svg, BROKEN, name)
            assertWellFormed(svg, name)
            const worst = worstTitleContrast(scene, 8)
            assert.ok(worst >= 4.5, `${name}: ${worst.toFixed(2)}:1`)
            if (scene.subject && keptBoxes(scene).length) {
              assert.ok(!boxesTouch(scene.subject, keptBoxes(scene)), name)
            }
            if (HAIRLINE.has(style)) {
              assert.ok(span(scene) > 0.05, `${name}: drawing spans ${span(scene)}`)
            } else {
              const covered = coverage(scene, 23)
              assert.ok(covered > 0.04, `${name}: ${covered} covered`)
            }
          }
        }
      }
    }
  }
})

test("every style holds a title at every grain level", () => {
  for (const style of STYLE_NAMES) {
    for (const grain of ["smooth", "heavy"] as const) {
      for (const theme of ["light", "dark"] as const) {
        for (let seed = 0; seed < 20; seed++) {
          const input = { style, seed, grain, theme, color: BRAND_COLORS[seed]! }
          const scene = generate(input)
          const svg = toSvg(scene)
          assertWellFormed(svg, label(input))
          assert.ok(worstTitleContrast(scene, 8) >= 4.5, label(input))
        }
      }
    }
  }
})

test("every approved shape holds", () => {
  for (const style of STYLE_NAMES) {
    for (const shape of STYLES[style].shapes ?? []) {
      for (const theme of ["light", "dark"] as const) {
        for (let seed = 0; seed < 20; seed++) {
          const input = { style, seed, shape, theme }
          const scene = generate(input)
          assert.equal(scene.shape, shape)
          const svg = toSvg(scene)
          assertWellFormed(svg, label(input))
          assertReferencesResolve(svg, label(input))
          assert.ok(worstTitleContrast(scene, 8) >= 4.5, label(input))
        }
      }
    }
  }
})

test("no cover is blank, and none is all art", () => {
  for (const { input, scene } of scenes) {
    if (HAIRLINE.has(scene.style)) {
      const spanned = span(scene)
      assert.ok(spanned > 0.05, `${label(input)}: drawing spans ${spanned}`)
      continue
    }
    // A dark marbled sheet's veins are the pale ink, where a light one's are
    // the paper: open ground either way.
    const covered = coverage(scene, 37, scene.style === "marbling" && input.theme === "dark" ? [scene.palette.ink] : [])
    assert.ok(covered > 0.05, `${label(input)}: ${covered} covered`)
    assert.ok(covered < 0.98, `${label(input)}: ${covered} covered`)
  }
})

function rects(scene: Scene) {
  return scene.layers.flatMap((layer) =>
    layer.kind === "shapes"
      ? layer.shapes.flatMap((shape) => (shape.type === "rect" ? [shape] : []))
      : []
  )
}

test("Endpaper keeps its composition rules", () => {
  // Every row of the wall has cells, and both its ends are filled.
  for (const { input, scene } of scenes) {
    if (scene.style !== "endpaper") continue
    const shapes = rects(scene)
    const narrow = Math.min(...shapes.map((shape) => shape.w))
    // Rows are a fixed distance apart; the closest two show it.
    const rows = [...new Set(shapes.map((shape) => shape.y))].sort((a, b) => a - b)
    const pitch = Math.min(...rows.slice(1).map((y, i) => y - rows[i]!))
    const wide = shapes.filter((shape) => shape.w > narrow * 1.5)
    for (const one of wide) {
      for (const other of wide) {
        const below = Math.abs(other.y - one.y - pitch) < 1
        const overlaps = one.x < other.x + other.w && other.x < one.x + one.w
        assert.ok(!(below && overlaps), `stacked wide cells: ${label(input)}`)
      }
    }
    // The wall's ends stay full wherever they are clear of the title; near
    // it the wall thins out on purpose.
    const left = Math.min(...shapes.map((shape) => shape.x))
    const right = Math.max(...shapes.map((shape) => shape.x + shape.w))
    const clear = (x: number, y: number) =>
      !keptBoxes(scene).length || distanceFrom(keptBoxes(scene), x, y + narrow / 2) >= pitch * 2.6
    for (let y = rows[0]!; y <= rows[rows.length - 1]! + 1; y += pitch) {
      const row = shapes.filter((shape) => Math.abs(shape.y - y) < 1)
      if (clear(left + pitch / 2, y)) {
        assert.ok(row.some((shape) => Math.abs(shape.x - left) < 1), `an open left end: ${label(input)}`)
      }
      if (clear(right - pitch / 2, y)) {
        assert.ok(
          row.some((shape) => Math.abs(shape.x + shape.w - right) < 1),
          `an open right end: ${label(input)}`
        )
      }
    }
    // And nothing of the wall lies on the title.
    if (keptBoxes(scene).length) {
      for (const shape of shapes) {
        assert.ok(!boxesTouch(shape, keptBoxes(scene)), `a cell on the title: ${label(input)}`)
      }
    }
    const accents = scene.layers.find(
      (layer) => layer.kind === "shapes" && layer.id === "accent"
    )
    assert.ok(
      accents?.kind === "shapes" && accents.shapes.length <= 1,
      `more than one accent: ${label(input)}`
    )
  }
})

test("Halftone leaves no orphan cells", () => {
  for (const { input, scene } of scenes) {
    if (scene.style !== "halftone") continue
    const shapes = rects(scene)
    const centres = shapes.map((shape) => ({
      x: shape.x + shape.w / 2,
      y: shape.y + shape.h / 2,
    }))
    // The screen's pitch, from the gap between its rows: not from the dots,
    // which a screen lightening toward a title never draws at full size.
    const rows = [...new Set(centres.map((centre) => Math.round(centre.y)))].sort((a, b) => a - b)
    const pitch = Math.min(...rows.slice(1).map((y, index) => y - rows[index]!))
    for (const tile of centres) {
      const near = centres.some(
        (other) =>
          other !== tile &&
          Math.abs(other.x - tile.x) < pitch * 1.1 &&
          Math.abs(other.y - tile.y) < pitch * 1.1
      )
      assert.ok(near, `orphan cell: ${label(input)}`)
    }
  }
})
