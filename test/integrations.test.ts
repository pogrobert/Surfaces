import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { generate } from "../src/core/generate.ts"
import { toSvg } from "../src/render/svg.ts"
import { createHandler } from "../src/http.ts"
import { formats } from "../src/core/intent.ts"
import { toHtml } from "../src/render/layers.ts"
import { toPng } from "../src/png.ts"
import { Surface } from "../src/react.ts"
import { STYLES } from "../src/styles/index.ts"
import { STYLE_NAMES } from "./support/inputs.ts"
import { rampPng } from "./support/png.ts"

const PNG = [0x89, 0x50, 0x4e, 0x47]
const widthOf = (png: Uint8Array) =>
  new DataView(png.buffer, png.byteOffset).getUint32(16)

// resvg panics on some filters and takes the process with it, so this is the
// test that every style can be rasterised at all.
test("every style, in both themes, exports a PNG at its own size", async () => {
  for (const style of STYLE_NAMES) {
    for (const theme of ["light", "dark"] as const) {
      const scene = generate({ style, seed: "png", theme, width: 600, height: 315 })
      const png = await toPng(scene)
      assert.deepEqual([...png.subarray(0, 4)], PNG, `${style} ${theme}`)
      assert.equal(widthOf(png), 600, `${style} ${theme}`)
    }
  }
  const photo = generate({ style: "halftone", seed: 1, image: { data: rampPng(16, 9), type: "image/png" } })
  assert.deepEqual([...(await toPng(photo, { width: 320 })).subarray(0, 4)], PNG)
})

test("the browser target is untouched by the resvg one", () => {
  const scene = generate({ style: "sfumato", seed: "target" })
  assert.match(toSvg(scene), /feDisplacementMap/)
  assert.doesNotMatch(toSvg(scene, { target: "resvg" }), /feDisplacementMap|feComposite/)
  assert.throws(() => toSvg(scene, { target: "canvas" as "resvg" }))
})

test("a scene's areas are in the output's own pixels, with their ink", () => {
  const scene = generate({ style: "riso", seed: 1, ...formats.og, areas: [{ place: "left", size: "lg" }, { place: "top-right", size: "sm" }] })
  assert.equal(scene.areas.length, 2)
  for (const area of scene.areas) {
    assert.equal(area.ink, scene.ink)
    assert.ok(area.x > 0 && area.x + area.width <= 1200)
    assert.ok(area.y > 0 && area.y + area.height <= 630)
  }
  assert.deepEqual(generate({ style: "riso", seed: 1 }).areas, [])
})

test("an OG image is a PNG at 1200 by 630", async () => {
  const png = await toPng(generate({ style: "aquatint", seed: "og", color: "#0f766e", ...formats.og }))
  assert.deepEqual([...png.subarray(0, 4)], PNG)
  assert.equal(widthOf(png), 1200)
})

const handler = createHandler({
  defaults: { color: "#635bff" },
  png: async (input) => toPng(generate(input)),
})
const get = (query: string, headers: Record<string, string> = {}) =>
  handler(new Request(`http://localhost/cover?${query}`, { headers }))

test("a URL draws the same bytes as the library, and caches for good", async () => {
  const response = await get("style=riso&seed=my-post&width=1200&height=630&area=left:lg&theme=dark")
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("content-type"), "image/svg+xml")
  assert.match(response.headers.get("cache-control")!, /immutable/)
  const expected = toSvg(
    generate({ style: "riso", seed: "my-post", width: 1200, height: 630, areas: [{ place: "left", size: "lg" }], theme: "dark", color: "#635bff" })
  )
  assert.equal(await response.text(), expected)
  const again = await get("style=riso&seed=my-post&width=1200&height=630&area=left:lg&theme=dark", {
    "if-none-match": response.headers.get("etag")!,
  })
  assert.equal(again.status, 304)
  const head = await handler(
    new Request("http://localhost/cover?style=riso&seed=x", { method: "HEAD" })
  )
  assert.equal(head.status, 200)
  assert.equal(await head.text(), "")
})

test("a URL can ask for a PNG, a size and every decision", async () => {
  const png = await get("style=strata&seed=a&color=0f766e&width=640&height=360&grain=smooth&mood=calm&detail=micro&area=left:lg&area=top-right:sm&shape=pair&format=png")
  assert.equal(png.status, 200)
  assert.equal(png.headers.get("content-type"), "image/png")
  assert.equal(widthOf(new Uint8Array(await png.arrayBuffer())), 640)
})

test("a bad URL says what is wrong, and a server fault is a 500", async () => {
  for (const query of [
    "seed=x",
    "style=nope&seed=x",
    "style=riso",
    "style=riso&seed=x&color=red",
    "style=riso&seed=x&width=99999&height=10",
    "style=riso&seed=x&shape=star",
    "style=riso&seed=x&format=gif",
    "style=riso&seed=x&extra=1",
    "style=riso&seed=x&w=1200&h=630",
    "style=riso&seed=x&width=1200",
    "style=riso&seed=x&width=4000&height=500",
  ]) {
    const response = await get(query)
    assert.equal(response.status, 400, query)
    assert.ok((await response.text()).length > 0, query)
  }
  const svgOnly = createHandler()
  assert.equal((await svgOnly(new Request("http://x/?style=riso&seed=1&format=png"))).status, 400)
  const broken = createHandler({
    png: async () => {
      throw new Error("resvg is not installed")
    },
  })
  assert.equal((await broken(new Request("http://x/?style=riso&seed=1&format=png"))).status, 500)
  assert.equal((await handler(new Request("http://x/?style=riso&seed=1", { method: "POST" }))).status, 405)
})

test("the React component draws the same art and puts its children in an area", () => {
  const html = renderToString(
    createElement(Surface, { style: "moire", seed: "react", label: "Cover" }, "Hello title")
  )
  const scene = generate({ style: "moire", seed: "react", areas: [{ place: "bottom-left", size: "lg" }] })
  assert.ok(html.includes(toHtml(scene, { fill: true }).slice(200, 600)))
  assert.match(html, /role="img" aria-label="Cover"/)
  assert.ok(html.includes(`color:${scene.ink}`))
  assert.ok(html.includes("Hello title"))
  const again = renderToString(
    createElement(Surface, { style: "moire", seed: "react", label: "Cover" }, "Hello title")
  )
  assert.equal(html, again)
  // Children and areas together are two ways of saying one thing.
  assert.throws(
    () => renderToString(createElement(Surface, { style: "moire", seed: "react", areas: [] }, "Twice")),
    /children or areas, not both/
  )
  assert.ok(Object.keys(STYLES).length > 0)
})
