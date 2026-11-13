import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { createBrand } from "../src/brand.ts"
import { catalog } from "../src/catalog.ts"
import { describe } from "../src/core/describe.ts"
import { generate } from "../src/core/generate.ts"
import { worstTitleContrast } from "../src/core/judge.ts"
import type { Layer } from "../src/core/scene.ts"
import { validate } from "../src/core/validate.ts"
import { Cover, Surface } from "../src/react.ts"
import { toHtml } from "../src/render/layers.ts"
import { toSvg } from "../src/render/svg.ts"

// What an audit of the library found, each held to what was done about it:
// how an agent is told what it got wrong, what a screen reader is told, what
// moves, and how much of the art a title in the middle costs.

const brand = createBrand({ name: "acme.dev", color: "#635bff", style: "riso" })
const quietly = <T>(run: () => T): [T, string[]] => {
  const warn = console.warn
  const said: string[] = []
  console.warn = (text: string) => void said.push(text)
  try {
    return [run(), said]
  } finally {
    console.warn = warn
  }
}

test("the catalog says which styles move, and it is so", () => {
  const moves = (layers: Layer[]): boolean => layers.some((layer) => ("motion" in layer && layer.motion) || ("layers" in layer && moves(layer.layers as Layer[])))
  for (const entry of catalog) {
    for (const shape of entry.shapes.length ? entry.shapes : [undefined]) {
      const [scene] = quietly(() => generate({ style: entry.style, seed: "moves", motion: "loop", ...(shape ? { shape } : null) }))
      assert.equal(moves(scene.layers), entry.moves, `${entry.style} ${shape ?? ""}`)
    }
  }
})

test("a style drawn still says so when asked to move, and a brand's hero doesn't ask", () => {
  assert.match(validate({ style: "trails", seed: "a-post", motion: "loop" }).warnings.join(), /trails is drawn still/)
  assert.deepEqual(validate({ style: "riso", seed: "a-post", motion: "loop" }).warnings, [])
  const still = createBrand({ name: "acme.dev", color: "#635bff", style: "trails" })
  assert.equal(still.input("hero", { title: "Hi" }).motion, undefined)
  assert.deepEqual(quietly(() => still.hero({ title: "Hi" }))[1], [])
  assert.equal(brand.input("hero", { title: "Hi" }).motion, "loop")
})

test("an input given a brand's word is told where the word belongs", () => {
  assert.match(validate({ style: "riso", seed: "a-post", text: "bottom-left" }).errors.join(), /Unknown option "text"\. Where words go is an area/)
  assert.match(validate({ style: "riso", seed: "a-post", background: "#fff" }).errors.join(), /no separate background/)
  assert.match(validate({ style: "riso", seed: "a-post", grian: "heavy" }).errors.join(), /Did you mean "grain"\?/)
})

test("art alone is hidden from a screen reader, and a title drawn in is read out", () => {
  const plain = brand.og({ title: "Hello there" })
  const drawn = brand.og({ title: "Hello there", drawTitle: true })
  assert.match(toSvg(plain), /^<svg[^>]* aria-hidden="true">/)
  assert.match(toSvg(drawn), /role="img"><title>Hello there<\/title>/)
  assert.match(toHtml(drawn), /^<div[^>]* role="img" aria-label="Hello there">/)
  assert.match(toHtml(drawn, { label: "Mine" }), /^<div[^>]* role="img" aria-label="Mine">/)
  assert.match(describe(drawn), /^Abstract cover art for "Hello there":/)
  assert.match(describe(plain), /^Abstract art:/)
})

test("a label names the picture and leaves what stands on it alone", () => {
  const labelled = renderToString(createElement(Surface, { style: "riso", seed: "a-post", label: "Cover" }, createElement("h1", null, "Title")))
  // The element round the heading carries no role; the picture inside does.
  assert.match(labelled, /^<div style="[^"]*"><div role="img" aria-label="Cover"/)
  assert.match(labelled, /<h1>Title<\/h1>/)
  assert.match(renderToString(createElement(Surface, { style: "riso", seed: "a-post" }, "Title")), /^<div style="[^"]*"><div aria-hidden="true"/)
})

test("a cover that moves can be held still", () => {
  const moving = toHtml(generate({ style: "riso", seed: "a-post", motion: "loop" }))
  assert.match(moving, /\[data-paused\] \.[a-z0-9-]+ \*\{animation-play-state:paused!important\}/)
  assert.doesNotMatch(toHtml(generate({ style: "riso", seed: "a-post" })), /data-paused/)
  assert.match(renderToString(createElement(Surface, { style: "riso", seed: "a-post", motion: "loop", paused: true })), /^<div style="[^"]*"><div aria-hidden="true" data-paused=""/)
})

test("<Cover> sets its title as a title, and gives way to the page's own", () => {
  const title = "Shipping the new editor"
  const set = renderToString(createElement(Cover, { brand, title }))
  // Set right to left where the title is, as a title in Arabic or Hebrew needs.
  assert.match(set, /<div dir="auto" style="margin:0;font-size:[\d.]+cqw;font-weight:700[^"]*">Shipping the new editor<\/div>/)
  // As a heading, at the same size, its own margins taken off.
  assert.match(renderToString(createElement(Cover, { brand, title, heading: "h1" })), /<h1 dir="auto" style="margin:0;font-size:[\d.]+cqw;[^"]*">Shipping the new editor<\/h1>/)
  const own = renderToString(createElement(Cover, { brand, title }, createElement("h1", null, title)))
  assert.match(own, /<h1>Shipping the new editor<\/h1>/)
  assert.doesNotMatch(own, /font-size:[\d.]+cqw/)
  assert.doesNotMatch(renderToString(createElement(Cover, { brand, title, text: "none" })), /Shipping/)
  assert.doesNotMatch(renderToString(createElement(Cover, { brand, title, use: "card" })), /Shipping/)
  // A short title is set larger than a long one.
  const size = (words: string) => Number(renderToString(createElement(Cover, { brand, title: words })).match(/font-size:([\d.]+)cqw/)![1])
  assert.ok(size("Pricing") > size("How we rebuilt search from the ground up, twice, and what it taught us"))
})

test("the ground under a title in the middle is only as strong as the art needs", () => {
  const clearing = (layers: Layer[]) => layers.find((layer) => layer.id === "clearing")
  const strength = (layer: Layer | undefined) => (layer?.kind === "soften" && layer.layers[0]?.kind === "shapes" && layer.layers[0].paint.type === "solid" ? layer.layers[0].paint.opacity : 0)
  const halo = (layers: Layer[]) => {
    const title = layers.find((layer) => layer.kind === "text")
    return title?.kind === "text" ? title.halo : undefined
  }
  for (const { style } of catalog) {
    for (const theme of ["light", "dark"] as const) {
      const one = createBrand({ name: "acme.dev", color: "#635bff", style, theme })
      for (const title of ["Pricing", "How we rebuilt search from the ground up, twice"]) {
        // The page's words may stand anywhere in the area, so ground goes
        // under all of it; a drawn title has ground only round its letters.
        // Both read, and neither is laid on at full.
        const paged = one.hero({ title })
        const drawn = one.hero({ title, drawTitle: true })
        for (const scene of [paged, drawn]) assert.ok(worstTitleContrast(scene) >= 4.5, `${style} ${theme} ${title}`)
        assert.ok(strength(clearing(paged.layers)) <= 0.82, `${style} ${theme} ${title}: ${strength(clearing(paged.layers))}`)
        assert.equal(clearing(drawn.layers), undefined, `${style} ${theme} ${title}`)
        assert.ok((halo(drawn.layers)?.opacity ?? 0) <= 0.82, `${style} ${theme} ${title}`)
      }
    }
  }
  // Art that is already quiet under the words gets nothing laid over it: the
  // ground is there at no strength, and no renderer writes it.
  const quiet = createBrand({ name: "acme.dev", color: "#635bff", style: "trails" }).hero({ title: "Pricing" })
  assert.equal(strength(clearing(quiet.layers)), 0)
  assert.doesNotMatch(toSvg(quiet), /clearing/)
  assert.doesNotMatch(toHtml(quiet), /clearing/)
  assert.match(toSvg(createBrand({ name: "acme.dev", color: "#635bff", style: "weave" }).hero({ title: "Pricing" })), /clearing/)
  // A drawn title on strong art has a halo, drawn from its own letters under
  // them; on quiet art it has none, and nothing is drawn for one.
  const strong = createBrand({ name: "acme.dev", color: "#635bff", style: "weave" }).hero({ title: "Shipping the new editor", drawTitle: true })
  assert.ok(halo(strong.layers)!.opacity > 0)
  assert.match(toSvg(strong), /title-halo/)
  assert.match(toHtml(strong), /title-halo/)
  const calm = createBrand({ name: "acme.dev", color: "#635bff", style: "trails" }).hero({ title: "Shipping the new editor", drawTitle: true })
  assert.equal(halo(calm.layers), undefined)
  assert.doesNotMatch(toSvg(calm), /halo/)
})

test("both sides of a cover that follows the reader stay one drawing", () => {
  for (const { style } of catalog) {
    const [scene] = quietly(() => generate({ style, seed: "auto-hero", theme: "auto", width: 2400, height: 1200, areas: [{ place: "center", size: "lg" }] }))
    assert.equal(scene.layers.length, scene.dark!.layers.length, style)
  }
})
