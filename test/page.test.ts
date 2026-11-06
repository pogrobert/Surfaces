import assert from "node:assert/strict"
import { test } from "node:test"
import { createBrand } from "../src/brand.ts"
import { readPage } from "../src/page.ts"

// Three sites as their HTML and CSS might come out of a repo.
const DEVTOOL = {
  html: `<html><head><title>Basin: APIs for developers</title>
<meta name="description" content="Deploy a database in seconds. Open source, built for developers.">
</head><body><h1>The database that deploys with your code</h1></body></html>`,
  css: `:root { --background: #0b0b10; --foreground: #ededed; --primary: #635bff; --font-sans: "Inter", sans-serif; --font-mono: "JetBrains Mono", monospace; }
body { background: var(--background); color: var(--foreground); }
.card { border: 1px solid #222222; } a { color: #635bff; } .muted { color: #8a8a99; }`,
}

const NONPROFIT = {
  html: `<html><head><title>Common Ground</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Nunito&display=swap" rel="stylesheet">
<meta name="description" content="Building a fairer neighbourhood, together.">
</head><body><h1>We thrive together as a community</h1></body></html>`,
  css: `body { background: #fff7d6; color: #3b2a20; } .button { background: #f59e0b; color: #3b2a20; } .tag { background: #f59e0b; }`,
}

const MAGAZINE = {
  html: `<html><head><title>The Long Read</title><meta name="description" content="Essays and stories: a journal of slow reading."></head>
<body><h1>On keeping a notebook</h1></body></html>`,
  css: `h1, h2 { font-family: "Tiempos Headline", Georgia, serif; } body { font-family: "Söhne", sans-serif; background: #ffffff; color: #111111; }
a { color: #b91c1c; } a:hover { color: #991b1b; } @media (prefers-color-scheme: dark) { body { background: #111111; color: #eeeeee; } }`,
}

const lookOf = (name: string, page: { html: string; css: string }) => createBrand({ name, ...readPage(page.html, page.css) })

test("readPage finds a page's colours, ground, type and words", () => {
  const facts = readPage(DEVTOOL.html, DEVTOOL.css)
  assert.equal(facts.colors?.[0], "#635bff")
  assert.equal(facts.background, "#0b0b10")
  assert.equal(facts.text, "#ededed")
  assert.equal(facts.fonts?.body, `"Inter", sans-serif`)
  assert.match(facts.words ?? "", /APIs for developers/)
  assert.deepEqual(readPage(NONPROFIT.html, NONPROFIT.css).fonts, { heading: "Fraunces", body: "Nunito" })
  assert.equal(readPage(MAGAZINE.html, MAGAZINE.css).darkMode, true)
})

test("a developer tool gets a technical style in its own colour, dark", () => {
  const brand = lookOf("basin.dev", DEVTOOL)
  assert.deepEqual(brand.look, { style: "linework", color: "#635bff", theme: "dark" })
  assert.match(brand.why.join("\n"), /style linework: the page .*talks about building software/)
})

test("a warm community site gets paint through a stencil", () => {
  assert.deepEqual(lookOf("commonground.org", NONPROFIT).look, { style: "stencil", color: "#f59e0b", theme: "light" })
})

test("a magazine gets an engraver's line, calm, following the reader's dark mode", () => {
  assert.deepEqual(lookOf("thelongread.com", MAGAZINE).look, { style: "engraving", color: "#b91c1c", theme: "auto", mood: "calm" })
})

test("a site's own covers outrank what the page looks like", () => {
  const brand = createBrand({
    name: "basin.dev",
    ...readPage(DEVTOOL.html, DEVTOOL.css),
    covers: [{ style: "riso", color: "#e11d48" }, { style: "riso" }, { style: "halftone" }],
  })
  assert.equal(brand.look.style, "riso")
  assert.equal(brand.look.color, "#e11d48")
  assert.match(brand.why.join("\n"), /already use/)
})

test("a page with nothing to go on still gets a good look", () => {
  assert.deepEqual(createBrand({ name: "about.me" }).look, { style: "underpaint", theme: "light" })
  // Greys only: the deepest of them, not the background.
  assert.equal(createBrand({ name: "a", colors: ["#ffffff", "#9ca3af", "#374151"], background: "#ffffff" }).look.color, "#374151")
})

test("wrong facts fail, naming the fix", () => {
  const errors = (choices: unknown) => {
    try {
      createBrand(choices as never)
      return ""
    } catch (error) {
      return (error as Error).message
    }
  }
  assert.match(errors({ name: "a", colours: ["#fff"] }), /Unknown choice "colours"\. Did you mean "colors"\?/)
  assert.match(errors({ name: "a", colors: ["red"] }), /colors\[0\] "red" isn't a hex colour/)
  assert.match(errors({ name: "a", covers: [{ style: "rizo" }] }), /Did you mean "riso"\?/)
})

test("readPage reads a brand the way real stylesheets give it", () => {
  // A ramp of shades: the middle one, not the palest listed first.
  const ramp = readPage("", ":root { --brand-25: #f5f5ff; --brand-50: #e8e9ff; --brand-500: #635bff; --brand-900: #1c1a4f; }")
  assert.equal(ramp.colors?.[0], "#635bff")
  // A plain name before a specific one.
  const named = readPage("", ":root { --nav-button-primary: #003366; --site-primary: #ffca0a; }")
  assert.equal(named.colors?.[0], "#ffca0a")
  // A framework's whole palette isn't the site's colours.
  const framework = readPage("", ":root { --color-red-500: #fb2c36; --color-blue-500: #2b7fff; } .logo { color: #38bdf8; }")
  assert.deepEqual(framework.colors, ["#38bdf8"])
  // A font the lists don't know is read by its fallback, or not at all.
  assert.equal(createBrand({ name: "a", fonts: { heading: `"Kazimir Text", serif` } }).look.style, "engraving")
  assert.equal(createBrand({ name: "a", fonts: { heading: "Kazimir Text" } }).look.style, "underpaint")
})

test("the brand colour is an ink, never a pale wash", () => {
  assert.equal(createBrand({ name: "a", colors: ["#e8e9ff", "#d6d9fc", "#635bff"] }).look.color, "#635bff")
  // A vivid yellow is light and still the brand.
  assert.equal(createBrand({ name: "a", colors: ["#ffca0a", "#003366"], background: "#ffffff" }).look.color, "#ffca0a")
})

test("every page's brand draws every kind of cover", () => {
  for (const page of [DEVTOOL, NONPROFIT, MAGAZINE]) {
    const brand = lookOf("some.site", page)
    for (const draw of [brand.cover, brand.card, brand.hero, brand.og]) assert.ok(draw({ title: "Some page" }).layers.length > 0)
  }
})
