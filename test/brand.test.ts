import assert from "node:assert/strict"
import { test } from "node:test"
import { createBrand, directions } from "../src/brand.ts"
import { judge } from "../src/core/judge.ts"
import { readPage } from "../src/page.ts"
import { toSvg } from "../src/render/svg.ts"

const errorOf = (run: () => unknown) => {
  try {
    run()
    return ""
  } catch (error) {
    return (error as Error).message
  }
}

test("a brand draws every kind of cover from a title alone", () => {
  const brand = createBrand({ name: "acme.dev", color: "#635bff", style: "riso" })
  const cover = brand.cover({ title: "Notes on shipping every day" })
  assert.equal(cover.style, "riso")
  assert.deepEqual(cover.output, { w: 1600, h: 900 })
  assert.equal(cover.areas[0]?.place, "bottom-left")
  assert.deepEqual(brand.og({ title: "Notes" }).output, { w: 1200, h: 630 })
  assert.equal(brand.card({ title: "Notes" }).areas.length, 0)
  assert.equal(brand.hero({ title: "Notes" }).areas[0]?.place, "center")
  assert.ok(brand.avatar("user-42").layers.length > 0)
})

test("one title in one brand is one drawing, and two brands never share one", () => {
  const look = { color: "#635bff", style: "linework" } as const
  const stripe = createBrand({ name: "stripe.com", ...look })
  const linear = createBrand({ name: "linear.app", ...look })
  const title = { title: "Launch notes" }
  assert.equal(toSvg(stripe.cover(title)), toSvg(createBrand({ name: "stripe.com", ...look }).cover(title)))
  assert.notEqual(JSON.stringify(stripe.cover(title).layers), JSON.stringify(linear.cover(title).layers))
})

test("an id keeps a cover's art when its title is edited", () => {
  const brand = createBrand({ name: "acme.dev", color: "#0f766e", style: "halftone" })
  assert.equal(
    toSvg(brand.cover({ id: "launch", title: "Launch week" })),
    toSvg(brand.cover({ id: "launch", title: "Launch week, day one" }))
  )
})

test("what a brand doesn't decide is chosen from its page, with why", () => {
  const facts = readPage(
    `<title>Common Ground</title><link href="https://fonts.googleapis.com/css2?family=Fraunces&family=Nunito" rel="stylesheet"><h1>We thrive together as a community</h1>`,
    `body { background: #fff7d6; color: #3b2a20; } .button { background: #f59e0b; }`
  )
  const brand = createBrand({ name: "commonground.org", ...facts })
  assert.deepEqual(brand.look, { style: "stencil", color: "#f59e0b", theme: "light", font: "serif" })
  assert.match(brand.why.join("\n"), /^style stencil/m)
  // A decision given is a decision made: no reason for it.
  const decided = createBrand({ name: "commonground.org", ...facts, style: "riso" })
  assert.equal(decided.look.style, "riso")
  assert.doesNotMatch(decided.why.join("\n"), /^style/m)
})

test("a brand's look rebuilds it exactly", () => {
  const brand = createBrand({ name: "acme.dev", ...readPage("", "a { color: #e11d48; } body { font-family: Georgia, serif; }") })
  const again = createBrand({ name: brand.name, ...brand.look })
  assert.equal(toSvg(brand.cover({ title: "Hello" })), toSvg(again.cover({ title: "Hello" })))
})

test("a brand too fine for avatars draws them in the nearest bold style", () => {
  assert.equal(createBrand({ name: "acme.dev", style: "linework" }).avatar("ada").style, "riso")
  assert.equal(createBrand({ name: "acme.dev", style: "marbling" }).avatar("ada").style, "marbling")
})

test("wrong choices fail, naming the fix", () => {
  assert.match(errorOf(() => createBrand({ color: "#635bff" } as never)), /Missing "name"/)
  assert.match(errorOf(() => createBrand({ name: "a", seed: "x" } as never)), /A brand has no seed/)
  assert.match(errorOf(() => createBrand({ name: "a", style: "rizo" } as never)), /Did you mean "riso"\?/)
  assert.match(errorOf(() => createBrand({ name: "a", mood: "loud" } as never)), /Unknown mood "loud"/)
  assert.match(errorOf(() => createBrand({ name: "a" }).cover({})), /Give the post a "title"/)
})

test("<Cover> shows a brand's cover with its title where the art leaves room", async () => {
  const { createElement } = await import("react")
  const { renderToString } = await import("react-dom/server")
  const { Cover } = await import("../src/react.ts")
  const brand = createBrand({ name: "acme.dev", color: "#635bff", style: "riso" })
  const html = renderToString(createElement(Cover, { brand, title: "Launch week" }))
  assert.match(html, />Launch week</)
  assert.match(html, /aspect-ratio:1600 \/ 900/)
  // A card's title is beside it, not on it.
  assert.doesNotMatch(renderToString(createElement(Cover, { brand, use: "card", title: "Launch week" })), />Launch week</)
})

test("directions are varied, judged, and start with the brand's own pick", () => {
  const choices = { name: "acme.dev", color: "#635bff" }
  const options = directions(choices)
  assert.equal(options.length, 6)
  assert.deepEqual(options[0]!.look, createBrand(choices).look)
  const styles = options.map((option) => option.look.style)
  assert.equal(new Set(styles).size, styles.length)
  // One of each kind before two of any: no two of the first five are one kind.
  const kinds = [["stencil", "riso", "photocopy", "halftone", "dither"], ["engraving", "linework", "moire"], ["underpaint", "sfumato", "fluted"], ["aquatint", "mezzotint", "chrome", "glass"], ["marbling", "strata", "endpaper"]]
  assert.equal(new Set(styles.slice(0, 5).map((style) => kinds.findIndex((kind) => kind.includes(style)))).size, 5)
  for (const option of options) {
    assert.ok(judge(option.cover({ title: "A title it wasn't tried on" })).ok, option.look.style)
    assert.match(option.why.join("\n"), new RegExp(`^style ${option.look.style}`, "m"))
  }
  assert.deepEqual(directions(choices).map((option) => option.look), options.map((option) => option.look))
})

test("with a style decided, directions vary only what isn't, its mark first", () => {
  const more = directions({ name: "acme.dev", color: "#f59e0b", style: "stencil" })
  assert.ok(more.length >= 5)
  assert.ok(more.every((option) => option.look.style === "stencil"))
  assert.deepEqual(more.slice(1, 6).map((option) => option.look.shape), ["grid", "star", "pinwheel", "pair", "arch"])
  assert.equal(new Set(more.map((option) => JSON.stringify(option.look))).size, more.length)
  const calm = directions({ name: "acme.dev", style: "riso", mood: "calm" })
  assert.ok(calm.every((option) => option.look.mood === "calm"))
  // Riso has six marks, which fill the set before grain gets a turn.
  assert.ok(calm.slice(1).every((option) => option.look.shape))
  const decided = directions({ name: "acme.dev", style: "riso", mood: "calm", shape: "bars" })
  assert.ok(decided.every((option) => option.look.shape === "bars" && option.look.mood === "calm"))
  assert.ok(decided.some((option) => option.look.grain === "heavy"))
})

test("a count asks for fewer", () => {
  assert.equal(directions({ name: "acme.dev" }, { count: 3 }).length, 3)
})

test("a brand can always make one mark", () => {
  const brand = createBrand({ name: "acme.dev", style: "riso", shape: "arches" })
  assert.deepEqual([brand.cover({ title: "A" }), brand.og({ title: "B" }), brand.hero({ title: "C" })].map((scene) => scene.shape), ["arches", "arches", "arches"])
  assert.match(errorOf(() => createBrand({ name: "a", style: "riso", shape: "arch" })), /isn't a riso shape.*Did you mean "arches"\?/)
  assert.match(errorOf(() => createBrand({ name: "a", style: "underpaint", shape: "disc" })), /no shapes to choose from/)
})
