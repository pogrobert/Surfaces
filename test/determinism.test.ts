import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { test } from "node:test"
import { generate } from "../src/core/generate.ts"
import type { SurfaceInput } from "../src/core/generate.ts"
import { formats } from "../src/core/intent.ts"
import { createRng } from "../src/core/random.ts"
import type { Layer } from "../src/core/scene.ts"
import { toSvg } from "../src/render/svg.ts"
import { randomInputs, seeds, STYLE_NAMES } from "./support/inputs.ts"

const GOLDEN = new URL("./golden.json", import.meta.url)

const sha = (text: string) =>
  createHash("sha256").update(text).digest("hex").slice(0, 16)

test("one seed gives byte-identical output every time", () => {
  for (const input of randomInputs(seeds(10, 50))) {
    const first = generate(input)
    const second = generate({ ...input })
    assert.equal(JSON.stringify(first), JSON.stringify(second))
    assert.equal(toSvg(first), toSvg(second))
  }
})

test("output matches the stored hashes, from a fresh process", () => {
  const hashes = Object.fromEntries(
    randomInputs(25).map((input) => [
      JSON.stringify(input),
      sha(toSvg(generate(input))),
    ])
  )
  if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, `${JSON.stringify(hashes, null, 1)}\n`)
    return
  }
  assert.deepEqual(hashes, JSON.parse(readFileSync(GOLDEN, "utf8")))
})

test("a number seed and its text are the same seed", () => {
  const input: SurfaceInput = { style: "underpaint", seed: 20261013 }
  assert.equal(
    toSvg(generate(input)),
    toSvg(generate({ ...input, seed: "20261013" }))
  )
})

test("different seeds give different drawings", () => {
  for (const style of STYLE_NAMES) {
    const drawings = new Set<string>()
    for (let i = 0; i < 300; i++) {
      drawings.add(JSON.stringify(generate({ style, seed: i }).layers))
    }
    assert.equal(drawings.size, 300, style)
  }
})

// Everything that says where something is, none of what colour it is.
function geometry(layer: Layer): unknown {
  switch (layer.kind) {
    case "fill":
      return layer.id
    case "pool":
      return [layer.id, layer.cx, layer.cy, layer.rx, layer.ry, layer.rotate]
    case "shapes":
      return [layer.id, layer.shapes]
    case "grain":
      return [layer.id, layer.seed]
    case "stipple":
      return [layer.id, layer.seed, layer.layers.map(geometry)]
    case "soften":
      return [layer.id, layer.radius, layer.ry, layer.layers.map(geometry)]
    case "clip":
      return [layer.id, layer.shape, layer.layers.map(geometry)]
    case "blur":
      return [
        layer.id,
        layer.seed,
        layer.angle,
        layer.streak,
        layer.warp,
        layer.layers.map(geometry),
      ]
  }
}

test("light and dark are the same drawing", () => {
  for (const input of randomInputs(seeds(20, 100))) {
    const light = generate({ ...input, theme: "light" })
    const dark = generate({ ...input, theme: "dark" })
    assert.deepEqual(light.layers.map(geometry), dark.layers.map(geometry))
  }
})

test("a new brand colour repaints the drawing and moves nothing", () => {
  for (const input of randomInputs(seeds(20, 100))) {
    const one = generate({ ...input, color: "#0ea5e9" })
    const other = generate({ ...input, color: "#e11d48" })
    assert.deepEqual(one.layers.map(geometry), other.layers.map(geometry))
    assert.notDeepEqual(one.palette, other.palette)
  }
})

test("a mood narrows ranges and keeps the seed's composition", () => {
  for (let seed = 0; seed < 100; seed++) {
    for (const style of ["underpaint", "aquatint", "sfumato"] as const) {
      const plain = generate({ style, seed })
      const calm = generate({ style, seed, mood: "calm" })
      assert.deepEqual(plain.subject, calm.subject)
      assert.deepEqual(
        plain.layers.map((layer) => layer.kind),
        calm.layers.map((layer) => layer.kind)
      )
    }
  }
})

test("a grain level changes the grain and nothing else", () => {
  for (const input of randomInputs(seeds(12, 60))) {
    const drawing = (grain: "smooth" | "natural" | "heavy") => {
      const scene = generate({ ...input, grain })
      return [scene.palette, scene.areas, scene.subject, scene.layers.map(geometry)]
    }
    assert.deepEqual(drawing("smooth"), drawing("natural"))
    assert.deepEqual(drawing("heavy"), drawing("natural"))
  }
})

test("a post's cover and its OG image are one drawing", () => {
  for (const style of STYLE_NAMES) {
    for (let seed = 0; seed < 50; seed++) {
      const input = { style, seed, color: "#0f766e", theme: "dark" } as const
      const cover = generate({ ...input, width: 1600, height: 900 })
      const og = generate({ ...input, ...formats.og })
      assert.deepEqual(cover.palette, og.palette)
      assert.equal(cover.shape, og.shape)
      assert.equal(cover.layers.length, og.layers.length)
    }
  }
  // Pools sit at the same share of the canvas on either side.
  const pool = (size: { width: number; height: number }) => {
    const scene = generate({ style: "underpaint", seed: "same", ...size })
    const first = scene.layers[1]
    assert.equal(first?.kind, "pool")
    return first?.kind === "pool" ? first.cx / scene.size.w : NaN
  }
  assert.ok(Math.abs(pool({ width: 1600, height: 900 }) - pool(formats.og)) < 1e-9)
})

test("the same shape at twice the size is the same drawing", () => {
  for (const style of STYLE_NAMES) {
    const small = generate({ style, seed: "size", width: 600, height: 315 })
    const large = generate({ style, seed: "size", width: 2400, height: 1260 })
    assert.deepEqual(small.layers, large.layers)
    const body = (svg: string) => svg.replace(/ width="\d+" height="\d+"/, "")
    assert.equal(body(toSvg(small)), body(toSvg(large)))
    assert.deepEqual(large.output, { w: 2400, h: 1260 })
  }
})

test("choosing a shape changes the shape and nothing else", () => {
  const scene = (shape?: string) =>
    generate({ style: "endpaper", seed: "shape", ...(shape ? { shape } : null) })
  const boxes = (shape?: string) =>
    scene(shape).layers.flatMap((layer) =>
      layer.kind === "shapes"
        ? layer.shapes.map((item) =>
            item.type === "rect" ? [item.x, item.y, item.w, item.h] : []
          )
        : []
    )
  assert.deepEqual(boxes("disc"), boxes("leaf"))
  assert.deepEqual(scene("disc").palette, scene("leaf").palette)
  assert.deepEqual(boxes(scene().shape), boxes("arch"))
})

test("forks are independent of each other and of draw order", () => {
  const one = createRng("a")
  const other = createRng("a")
  for (let i = 0; i < 100; i++) one.next()
  assert.equal(one.fork("x").next(), other.fork("x").next())
  assert.notEqual(other.fork("x").next(), other.fork("y").next())
})
