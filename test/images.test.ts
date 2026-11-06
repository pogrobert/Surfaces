import assert from "node:assert/strict"
import { test } from "node:test"
import { generate } from "../src/core/generate.ts"
import { MOST_IMAGE_BYTES, readImage } from "../src/core/image.ts"
import { toSvg } from "../src/render/svg.ts"
import { STYLES } from "../src/styles/index.ts"
import type { StyleName } from "../src/styles/index.ts"
import { BRAND_COLORS, SIZES, TITLE_PLACES, titleAt } from "./support/inputs.ts"
import { rampPng } from "./support/png.ts"
import { worstTitleContrast } from "../src/core/judge.ts"

const PHOTO = { data: rampPng(32, 18), type: "image/png" } as const
const TAKERS = (Object.keys(STYLES) as StyleName[]).filter(
  (name) => STYLES[name].picture
)

test("the styles that take a photo are the ones that print it in their own inks", () => {
  assert.deepEqual([...TAKERS].sort(), ["dither", "halftone", "photocopy", "riso"])
})

test("one photo and one seed give the same bytes, and a new photo changes them", () => {
  for (const style of TAKERS) {
    const input = { style, seed: "photo", image: PHOTO } as const
    assert.equal(toSvg(generate(input)), toSvg(generate({ ...input })))
    const other = generate({ ...input, image: { ...PHOTO, data: rampPng(32, 18, 40) } })
    assert.notEqual(toSvg(generate(input)), toSvg(other))
  }
})

test("the photo is carried inside the SVG, never linked", () => {
  const svg = toSvg(generate({ style: "riso", seed: 1, image: PHOTO }))
  assert.match(svg, /href="data:image\/png;base64,iVBORw0KGgo/)
  assert.doesNotMatch(svg, /href="https?:/)
  const text = readImage(PHOTO).href.split(",")[1]
  assert.equal(text, Buffer.from(PHOTO.data).toString("base64"))
})

// The photo could be anything, so every ink it might print is tried at full
// strength everywhere, and the title still has to hold.
test("a title holds over the worst a photo could be, in every ink", () => {
  for (const style of TAKERS) {
    for (const theme of ["light", "dark"] as const) {
      for (const color of BRAND_COLORS) {
        for (const [width, height] of SIZES) {
          for (const text of TITLE_PLACES) {
            const scene = generate({ style, seed: color, theme, color, width, height, ...titleAt(text), image: PHOTO })
            const picture = scene.layers.find((layer) => layer.kind === "picture")
            assert.ok(picture?.kind === "picture")
            for (const treatment of picture.treatments) {
              const worst = worstTitleContrast(
                {
                  ...scene,
                  layers: scene.layers.map((layer) =>
                    layer === picture ? { ...picture, treatments: [treatment] } : layer
                  ),
                },
                6
              )
              const name = `${style} ${theme} ${color} ${width}x${height} ${text} ${treatment.tone}`
              assert.ok(worst >= 4.5, `${name}: ${worst.toFixed(2)}:1`)
            }
          }
        }
      }
    }
  }
})

test("bad photos fail loudly", () => {
  assert.throws(
    () => generate({ style: "underpaint", seed: 1, image: PHOTO }),
    /does not take an image;.*"riso"/
  )
  assert.throws(
    () => generate({ style: "riso", seed: 1, image: { data: PHOTO.data, type: "image/jpeg" } }),
    /not a JPEG/
  )
  assert.throws(() =>
    generate({ style: "riso", seed: 1, image: { data: PHOTO.data, type: "image/gif" as "image/png" } })
  )
  const huge = new Uint8Array(MOST_IMAGE_BYTES + 1)
  huge.set(PHOTO.data.subarray(0, 8))
  assert.throws(() => generate({ style: "riso", seed: 1, image: { data: huge, type: "image/png" } }), /MB/)
  assert.throws(() =>
    generate({ style: "riso", seed: 1, image: { ...PHOTO, focus: "middle" as "center" } })
  )
})
