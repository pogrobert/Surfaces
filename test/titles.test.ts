import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { createBrand } from "../src/brand.ts"
import { generate } from "../src/core/generate.ts"
import { judge, keptBoxes } from "../src/core/judge.ts"
import type { TextLayer } from "../src/core/scene.ts"
import { validate } from "../src/core/validate.ts"
import { readPage } from "../src/page.ts"
import { toJpeg, toPng } from "../src/png.ts"
import { toSvg } from "../src/render/svg.ts"
import { METRICS } from "../src/type/metrics.ts"
import { STYLE_NAMES, PRESETS, titleAt } from "./support/inputs.ts"

const titleOf = (scene: ReturnType<typeof generate>) => scene.layers.find((layer): layer is TextLayer => layer.kind === "text")

// Every line's ink, from its left edge to its right and from its caps to its
// descenders, inside the area it was set in.
function assertInside(layer: TextLayer, box: { x: number; y: number; w: number; h: number }, name: string) {
  for (const line of layer.lines) {
    const left = line.x - (layer.align === "start" ? 0 : layer.align === "end" ? line.width : line.width / 2)
    assert.ok(left >= box.x - 0.01 && left + line.width <= box.x + box.w + 0.01, `${name}: "${line.text}" runs out sideways`)
    const { cap, descent } = METRICS[layer.font]
    const top = line.y - (cap / 1000) * layer.size
    const bottom = line.y + (Math.abs(descent) / 1000) * layer.size
    assert.ok(top >= box.y - 0.01 && bottom <= box.y + box.h + 0.01, `${name}: "${line.text}" runs out of its area`)
  }
}

test("a title is set inside its area, in every place and size", () => {
  for (const [width, height, place] of [...PRESETS, [1000, 1000, "top"], [1500, 500, "left"], [1080, 1920, "bottom"]] as const) {
    for (const title of ["Hello", "How the new search works", "What we learned from ten thousand bookings in our first year of running the shop"]) {
      for (const font of ["sans", "serif"] as const) {
        const input = { style: "riso", seed: "titles", width, height, ...titleAt(place), title, font } as const
        const scene = generate(input)
        const layer = titleOf(scene)
        assert.ok(layer, `${width}x${height} ${place}`)
        const [box] = keptBoxes(scene).length ? keptBoxes(scene) : [{ x: 0, y: 0, w: scene.size.w, h: scene.size.h }]
        assertInside(layer, box!, `${width}x${height} ${place} ${font} "${title}"`)
        assert.ok(judge(scene).ok, `${width}x${height} ${place}`)
      }
    }
  }
})

test("a short title is set large on few lines, a long one smaller on more", () => {
  const set = (title: string) => titleOf(generate({ style: "riso", seed: "a", width: 1200, height: 630, areas: [{ place: "left", size: "lg" }], title }))!
  const short = set("Hello")
  const long = set("What we learned from ten thousand bookings in our first year of running the shop")
  assert.equal(short.lines.length, 1)
  assert.ok(short.size > long.size * 1.4)
  assert.ok(long.lines.length >= 3 && long.lines.length <= 4)
  // Balanced: no line far shorter than the others.
  const widths = long.lines.map((line) => line.width)
  assert.ok(Math.min(...widths) > Math.max(...widths) * 0.5)
})

test("a title that can't fit ends in an ellipsis", () => {
  const title = "A very long title ".repeat(8).trim()
  const layer = titleOf(generate({ style: "riso", seed: "a", width: 1200, height: 630, areas: [{ place: "top-left", size: "sm" }], title }))!
  assert.ok(layer.lines.length <= 4)
  assert.match(layer.lines.at(-1)!.text, /…$/)
})

test("an SVG holds every line of a title to its measured width", () => {
  const svg = toSvg(generate({ style: "halftone", seed: "a", areas: [{ place: "bottom-left", size: "lg" }], title: "Café “déjà vu”", font: "serif" }))
  assert.match(svg, /<text font-family='Fraunces/)
  assert.match(svg, /textLength="[\d.]+" lengthAdjust="spacingAndGlyphs">Café “déjà vu”<\/tspan>/)
})

test("titles fail loudly when they can't be set", () => {
  const errors = (input: unknown) => validate(input).errors.join("\n")
  assert.match(errors({ style: "riso", seed: "a", title: "Hi" }), /needs an area to sit in/)
  assert.match(errors({ style: "riso", seed: "a", title: "Hi", areas: [{ place: "left" }], font: "mono" }), /Unknown font "mono"/)
  assert.match(errors({ style: "riso", seed: "a", title: "x".repeat(161), areas: [{ place: "left" }] }), /keep it to 160/)
  assert.match(validate({ style: "riso", seed: "a", title: "日本の話", areas: [{ place: "left" }] }).warnings.join(), /can't draw "日"/)
})

test("the paper's fold runs only over clear paper, never a title or the figure", () => {
  for (const style of STYLE_NAMES.filter((name) => name === "stencil")) {
    for (const [width, height, place] of [...PRESETS, [1600, 900, "none"], [2400, 1200, "none"], [1600, 900, "top-left"]] as const) {
      for (let seed = 0; seed < 4; seed++) {
        const scene = generate({ style, seed: `fold-${seed}`, width, height, ...titleAt(place), ...(place === "none" ? null : { title: "What we learned from ten thousand bookings" }) })
        const fold = scene.layers.find((layer) => layer.id === "fold")
        if (!fold || fold.kind !== "shapes" || fold.shapes[0]!.type !== "rect") continue
        const band = fold.shapes[0]!
        for (const box of [...keptBoxes(scene), ...(scene.subject ? [scene.subject] : [])]) {
          assert.ok(band.x + band.w <= box.x || band.x >= box.x + box.w, `${width}x${height} ${place} ${seed}`)
        }
      }
    }
  }
  // A strip, such as a header, is never folded: across it a crease is a seam.
  for (const [width, height] of [[1500, 500], [1584, 396], [1200, 400]] as const) {
    assert.ok(!generate({ style: "stencil", seed: "fold-strip", width, height }).layers.some((layer) => layer.id === "fold"), `${width}x${height}`)
  }
})

test("a link preview drawn with its title sets it in the brand's face", () => {
  const brand = createBrand({ name: "acme.dev", ...readPage("", "h1 { font-family: Georgia, serif; } a { color: #b91c1c; }") })
  assert.equal(brand.look.font, "serif")
  assert.equal(titleOf(brand.og({ title: "Notes on shipping" })), undefined)
  const og = brand.og({ title: "Notes on shipping", drawTitle: true })
  assert.equal(titleOf(og)?.font, "serif")
  assert.equal(titleOf(brand.cover({ title: "Notes on shipping" })), undefined)
  assert.ok(titleOf(brand.cover({ title: "Notes on shipping", drawTitle: true })))
  assert.throws(() => brand.card({ title: "Notes", drawTitle: true }), /no area for a title/)
})

test("a PNG draws the title's outlines, the same through native and WebAssembly resvg", async () => {
  const scene = generate({ style: "riso", seed: "a", width: 600, height: 315, areas: [{ place: "left", size: "lg" }], title: "Hello there" })
  const native = await toPng(scene)
  const wasm = await toPng(scene, { wasm: readFileSync(new URL("../node_modules/@resvg/resvg-wasm/index_bg.wasm", import.meta.url)) })
  assert.ok(native.length > 1000)
  assert.deepEqual(Buffer.from(wasm), Buffer.from(native))
  const bare = await toPng({ ...scene, layers: scene.layers.filter((layer) => layer.kind !== "text") })
  assert.notDeepEqual(Buffer.from(bare), Buffer.from(native))
})

test("a JPEG of a grainy link preview stays under what chat apps show", async () => {
  const scene = createBrand({ name: "acme.dev", color: "#f59e0b", style: "underpaint", theme: "light" }).og({ title: "What we learned from ten thousand bookings" })
  const jpeg = await toJpeg(scene)
  assert.deepEqual([...jpeg.slice(0, 2)], [0xff, 0xd8])
  assert.deepEqual([...jpeg.slice(-2)], [0xff, 0xd9])
  assert.ok(jpeg.length < 300_000, `${jpeg.length} bytes`)
  assert.ok(jpeg.length < (await toPng(scene)).length / 3)
})
