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
  // The art alone: the page sets the title, in its own type.
  assert.equal(cover.areas.length, 0)
  assert.ok(!cover.layers.some((layer) => layer.kind === "text"))
  // Words over the art get room, and the scene says where and in what ink.
  const room = brand.cover({ title: "Notes on shipping every day", text: "bottom-left" }).areas[0]!
  assert.equal(room.place, "bottom-left")
  assert.match(room.ink, /^#[0-9a-f]{6}$/)
  const og = brand.og({ title: "Notes" })
  assert.deepEqual(og.output, { w: 1200, h: 630 })
  assert.equal(og.areas.length, 1)
  assert.ok(!og.layers.some((layer) => layer.kind === "text"))
  assert.match(errorOf(() => brand.cover({ title: "Notes", text: "middle" as never })), /Unknown text place "middle"/)
  assert.equal(brand.card({ title: "Notes" }).areas.length, 0)
  assert.equal(brand.hero({ title: "Notes" }).areas[0]?.place, "center")
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
  // One of the warm styles, the brand's name choosing between them.
  assert.ok(["stencil", "underpaint"].includes(brand.look.style), brand.look.style)
  assert.deepEqual({ ...brand.look, style: "-" }, { style: "-", color: "#f59e0b", theme: "light", font: "serif" })
  assert.match(brand.why.join("\n"), new RegExp(`^style ${brand.look.style}`, "m"))
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

test("wrong choices fail, naming the fix", () => {
  assert.match(errorOf(() => createBrand({ color: "#635bff" } as never)), /Missing "name"/)
  assert.match(errorOf(() => createBrand({ name: "a", seed: "x" } as never)), /A brand has no seed/)
  assert.match(errorOf(() => createBrand({ name: "a", style: "rizo" } as never)), /Did you mean "riso"\?/)
  assert.match(errorOf(() => createBrand({ name: "a", mood: "loud" } as never)), /Unknown mood "loud"/)
  assert.match(errorOf(() => createBrand({ name: "a" }).cover({})), /Give the cover a "title"/)
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
  const kinds = [["stencil", "screenprint", "riso", "photocopy", "halftone", "dither", "linocut", "typewriter"], ["engraving", "linework", "moire", "currents", "dashes"], ["underpaint", "sfumato", "fluted", "trails", "prism"], ["aquatint", "mezzotint", "chrome", "glass"], ["marbling", "strata", "endpaper", "patches"], ["papercut", "weave", "terrazzo", "swatchbook"]]
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
  assert.deepEqual(more.slice(1, 6).map((option) => option.look.shape), ["grid", "corner", "halves", "pair", "arch"])
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

test("covers with one tag make one mark, and a tag never overrides a brand's own", () => {
  const brand = createBrand({ name: "acme.dev", style: "riso" })
  const marks = (tag: string) => ["Alpha", "Beta", "Gamma", "Delta"].map((title) => brand.cover({ title, tag }).shape)
  assert.equal(new Set(marks("engineering")).size, 1)
  assert.equal(new Set(marks("Engineering")).size, 1)
  assert.equal(marks("engineering")[0], marks("Engineering")[0])
  const tags = ["engineering", "design", "company", "product", "notes", "events"]
  assert.ok(new Set(tags.map((tag) => marks(tag)[0])).size > 1)
  // Without a tag, each title draws its own.
  assert.ok(new Set(["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"].map((title) => brand.cover({ title }).shape)).size > 1)
  assert.equal(createBrand({ name: "acme.dev", style: "riso", shape: "bars" }).cover({ title: "A", tag: "design" }).shape, "bars")
  assert.equal(createBrand({ name: "acme.dev", style: "underpaint" }).cover({ title: "A", tag: "design" }).shape, undefined)
})

test("a brand makes the rest of the kit: banners for X, LinkedIn and email", () => {
  const brand = createBrand({ name: "acme.dev", color: "#f59e0b", style: "stencil", theme: "light" })
  const x = brand.banner({ for: "x", title: "Bots for every business" })
  assert.deepEqual(x.output, { w: 1500, h: 500 })
  assert.ok(!x.layers.some((layer) => layer.kind === "text"))
  assert.ok(brand.banner({ for: "x", title: "Bots for every business", drawTitle: true }).layers.some((layer) => layer.kind === "text"))
  // X lays the profile's photo over the bottom left: nothing that must be
  // seen goes there, and the art runs on under it, with no patch cut out.
  assert.ok(x.areas.some((area) => area.place === "bottom-left" && area.art === "behind" && !area.clear))
  assert.ok(brand.banner({ for: "x" }).areas.every((area) => area.place === "bottom-left"))
  assert.deepEqual(brand.banner({ for: "linkedin" }).output, { w: 1584, h: 396 })
  assert.equal(brand.banner({ for: "linkedin" }).areas.length, 0)
  assert.deepEqual(brand.banner({ for: "email", title: "The letter" }).output, { w: 1200, h: 400 })
  assert.ok(judge(brand.banner({ for: "linkedin" })).ok)
  assert.ok(!("icon" in brand))
  assert.match(errorOf(() => brand.banner({ for: "tiktok" } as never)), /Unknown banner "tiktok"/)
})

test("a brand's logo is set as it is on its link previews and headers, clear of the art", () => {
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#0f766e"/></svg>`
  const brand = createBrand({ name: "harbour.test", color: "#0f766e", logo })
  const logoOf = (scene: ReturnType<typeof brand.og>) => scene.layers.find((layer) => layer.kind === "logo")
  const og = brand.og({ title: "How we cut our build times in half" })
  assert.match(String((logoOf(og) as { href: string }).href), /^data:image\/svg\+xml;base64,/)
  assert.ok(judge(og).ok, judge(og).problems.join("; "))
  assert.ok(toSvg(og).includes(`<image href="data:image/svg+xml;base64,`))
  for (const where of ["x", "linkedin", "email"] as const) {
    const banner = brand.banner({ for: where })
    assert.ok(logoOf(banner), where)
    assert.ok(judge(banner).ok, `${where}: ${judge(banner).problems.join("; ")}`)
  }
  // A post's cover is on the site itself, which shows its logo already.
  assert.equal(logoOf(brand.cover({ title: "Hi" })), undefined)
  // A logo for each ground.
  const dark = createBrand({ name: "harbour.test", theme: "dark", logo: { light: logo, dark: logo.replace("#0f766e", "#5eead4") } })
  assert.match(Buffer.from(String((logoOf(dark.og({ title: "Hi" })) as { href: string }).href.split(",")[1]), "base64").toString(), /#5eead4/)
  assert.match(errorOf(() => createBrand({ name: "a", logo: "logo.svg" })), /"logo": Expected the logo as an SVG file's text/)
  // One drawn in the text's colour takes the cover's ink on each ground.
  const ink = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="currentColor" d="M5 0 10 10H0z"/></svg>`
  const drawn = (theme: "light" | "dark") => {
    const scene = createBrand({ name: "harbour.test", theme, logo: ink }).og({ title: "Hi" })
    return { svg: Buffer.from(String((logoOf(scene) as { href: string }).href.split(",")[1]), "base64").toString(), ink: scene.ink }
  }
  for (const theme of ["light", "dark"] as const) {
    const { svg, ink: color } = drawn(theme)
    assert.ok(svg.includes(`fill="${color}"`) && !/currentColor/i.test(svg), theme)
  }
  assert.notEqual(drawn("light").ink, drawn("dark").ink)
})

test("a logo in the title's way fails, naming the fix", async () => {
  const { validate } = await import("../src/core/validate.ts")
  const svg = `<svg viewBox="0 0 1 1"></svg>`
  const base = { style: "riso", seed: "a/b", width: 1200, height: 630, areas: [{ place: "left", size: "lg" }] } as const
  assert.match(validate({ ...base, logo: { image: svg, place: "left" } }).errors.join("\n"), /logo at "left" overlaps Area 1/)
  assert.match(validate({ ...base, logo: { image: svg, place: "middle" as never } }).errors.join("\n"), /unknown place "middle"/)
  assert.deepEqual(validate({ ...base, logo: { image: svg, place: "top-left" } }).errors, [])
})

test("a logo its ground would lose is drawn in one colour, the cover's ink", () => {
  const navy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 25"><path fill="#0a2540" d="M0 4h18v18H0z"/></svg>`
  const plain = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M5 0 10 10H0z"/></svg>`
  // As Mozilla's footer logo: white, by a rule in its own style sheet.
  const styled = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>.st0{fill:#fff}</style><path class="st0" d="M0 0h10v10H0z"/></svg>`
  const onLight = createBrand({ name: "acme.dev", style: "halftone", color: "#10bcec", theme: "light", logo: styled }).og({ title: "Hi" })
  const drawnStyled = Buffer.from(String((onLight.layers.find((layer) => layer.kind === "logo") as { href: string }).href.split(",")[1]), "base64").toString()
  assert.ok(drawnStyled.includes(`.st0{fill:${onLight.ink}}`), drawnStyled)
  for (const logo of [navy, plain]) {
    const scene = createBrand({ name: "acme.dev", style: "halftone", color: "#10bcec", theme: "dark", logo }).og({ title: "Hi" })
    const drawn = Buffer.from(String((scene.layers.find((layer) => layer.kind === "logo") as { href: string }).href.split(",")[1]), "base64").toString()
    assert.ok(drawn.includes(scene.ink) && !drawn.includes("#0a2540"), drawn)
  }
  // As Patagonia's: white by name, made for a dark header.
  const white = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="white" d="M0 0h10v10H0z"/></svg>`
  const named = createBrand({ name: "acme.dev", style: "halftone", color: "#10bcec", theme: "light", logo: white }).og({ title: "Hi" })
  assert.match(Buffer.from(String((named.layers.find((layer) => layer.kind === "logo") as { href: string }).href.split(",")[1]), "base64").toString(), new RegExp(`fill="${named.ink}"`))
  // One that reads on its ground is drawn as it is.
  const light = createBrand({ name: "acme.dev", style: "halftone", color: "#10bcec", theme: "light", logo: navy }).og({ title: "Hi" })
  assert.match(Buffer.from(String((light.layers.find((layer) => layer.kind === "logo") as { href: string }).href.split(",")[1]), "base64").toString(), /#0a2540/)
})

test("the judge holds a logo to showing on what is under it", () => {
  const navy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 25"><path fill="#0a2540" d="M0 4h18v18H0z"/></svg>`
  // A dark version given for dark covers, and itself dark: shown as given, and failed.
  const scene = createBrand({ name: "acme.dev", style: "halftone", color: "#10bcec", theme: "dark", logo: { light: navy, dark: navy } }).og({ title: "Hi" })
  assert.match(judge(scene).problems.join(";"), /the logo shows at [\d.]+:1/)
  // Drawn for itself, it reads.
  assert.ok(judge(createBrand({ name: "acme.dev", style: "halftone", color: "#10bcec", theme: "dark", logo: navy }).og({ title: "Hi" })).ok)
})
