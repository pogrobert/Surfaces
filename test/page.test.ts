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
  // One of the technical styles, the brand's name choosing between them.
  assert.ok(["halftone", "dither"].includes(brand.look.style), brand.look.style)
  assert.deepEqual({ ...brand.look, style: "-" }, { style: "-", color: "#635bff", theme: "dark" })
  assert.match(brand.why.join("\n"), new RegExp(`style ${brand.look.style}: the page .*talks about building software`))
  // Two developer tools that read alike still look apart.
  const looks = ["basin.dev", "quarry.dev", "harbour.dev", "fjord.dev", "delta.dev", "anvil.dev"].map((name) => lookOf(name, DEVTOOL).look.style)
  assert.ok(new Set(looks).size > 1, looks.join())
})

test("a warm community site gets paint through a stencil", () => {
  assert.deepEqual(lookOf("commonground.org", NONPROFIT).look, { style: "stencil", color: "#f59e0b", theme: "light", font: "serif" })
})

test("a magazine gets an engraver's line, calm, following the reader's dark mode", () => {
  assert.deepEqual(lookOf("thelongread.com", MAGAZINE).look, { style: "engraving", color: "#b91c1c", theme: "auto", mood: "calm", font: "serif" })
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
  // A print, in a risograph ink picked by the name, never the pale violet
  // wash a page nobody designed gets.
  const plain = createBrand({ name: "about.me" })
  assert.deepEqual(plain.look, { style: "riso", color: "#f15060", theme: "light" })
  assert.match(plain.why.join("\n"), /color #f15060: the page gave no colour of its own, so a risograph ink/)
  assert.notEqual(createBrand({ name: "hello.dev" }).look.color, createBrand({ name: "notes.page" }).look.color)
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
  assert.equal(createBrand({ name: "a", fonts: { heading: `"Brightwood Text", serif` } }).look.style, "engraving")
  assert.equal(createBrand({ name: "a", fonts: { heading: "Brightwood Text" } }).look.style, "riso")
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

test("a DESIGN.md says the brand outright, ahead of what the page suggests", () => {
  const design = `---
name: Heritage
description: A journal of slow reading
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#B8422E"
  neutral: "#F7F5F2"
  on-tertiary: "#ffffff"
  button: "{colors.tertiary}"
typography:
  h1:
    fontFamily: Public Sans
    fontSize: 3rem
  body-md:
    fontFamily: Source Serif 4
---

## Overview

Essays and stories, set like a broadsheet.

## Colors

- **Tertiary (#B8422E):** the one accent.
`
  const facts = readPage(DEVTOOL.html, DEVTOOL.css, design)
  // Its colours lead, in the order it names a brand; the page's follow.
  assert.deepEqual(facts.colors?.slice(0, 4), ["#1a1c1e", "#b8422e", "#6c7278", "#f7f5f2"])
  assert.equal(facts.background, "#f7f5f2")
  assert.deepEqual(facts.fonts, { heading: "Public Sans", body: "Source Serif 4" })
  assert.match(facts.words ?? "", /^Heritage\. A journal of slow reading\. Essays and stories/)
  const brand = createBrand({ name: "heritage.press", ...facts })
  // The primary is an ink for text, so the brand is the accent the file names next.
  assert.equal(brand.look.color, "#b8422e")
  assert.equal(brand.look.theme, "light")
})

test("readPage reads shadcn's bare HSL channels and hsl()", () => {
  const facts = readPage("", `:root { --background: 0 0% 100%; --foreground: 222.2 84% 4.9%; --primary: 262.1 83.3% 57.8%; --primary-foreground: 210 20% 98%; }`)
  assert.equal(facts.background, "#ffffff")
  assert.equal(facts.text, "#020817")
  assert.equal(facts.colors?.[0], "#7c3aed")
  assert.equal(readPage("", "a { color: hsl(0deg 72.2% 50.6%); }").colors?.[0], "#dc2626")
})

test("readPage follows variables to the colours they are built from", () => {
  // As Supabase's: a ramp whose 500 is dark, and the brand named plainly.
  const built = readPage("", `:root { --brand-500: 154.9deg 100% 19.2%; --brand-default: 153.1deg 60.2% 52.7%; --color-brand-500: hsl(var(--brand-500)); --color-brand: hsl(var(--brand-default)); }`)
  assert.equal(built.colors?.[0], "#3ecf8e")
  // As GitHub's: ground and text named by the design system, the text set on
  // the brand left out of it.
  const named = readPage("", `:root { --bgColor-default: #ffffff; --fgColor-default: #1f2328; --button-primary-fgColor-rest: #ffffff; --button-primary-bgColor-rest: #1f883d; }`)
  assert.deepEqual([named.background, named.text, named.colors?.[0]], ["#ffffff", "#1f2328", "#1f883d"])
  // A ground its own text can't be read on is dropped.
  assert.equal(readPage("", `:root { --bg: #282c35; --text: #222222; }`).background, undefined)
  // Character references read as the characters they are.
  assert.match(readPage(`<title>We&#x27;ll build it &amp; ship it</title>`).words ?? "", /We'll build it & ship it/)
})

test("a widget's own variables don't stand in for the brand", () => {
  // As Spotify's: a date picker's accent, and the brand only used, not named.
  const facts = readPage("", `.rdp { --rdp-accent-color: #009948; } a:hover { color: #1ed760; } .x { color: #1ed760; } .y { background: #1ed760; }`)
  assert.equal(facts.colors?.[0], "#1ed760")
})

test("the faces real sites set their headings in are known", () => {
  assert.equal(createBrand({ name: "a", fonts: { heading: "Kazimir Text", body: "Proxima Nova" } }).look.font, "serif")
  assert.notEqual(createBrand({ name: "a", fonts: { heading: "Airbnb Cereal VF" } }).look.font, "serif")
})

test("the colours a page declares in its head are read", () => {
  // Safari's pinned tab is drawn in the brand's mark colour; it leads.
  const pinned = readPage(`<link rel="mask-icon" href="/mask.svg" color="#FF5A5F"><meta name="theme-color" content="#ffffff">`, `:root { --primary: #222222; } a { color: #d70466; }`)
  assert.equal(pinned.colors?.[0], "#ff5a5f")
  // A strong theme colour counts, the light one where both are given.
  const themed = readPage(`<meta name="theme-color" media="(prefers-color-scheme: light)" content="#3139FB"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000">`, `a { color: #fb3a4d; }`)
  assert.equal(themed.colors?.[0], "#3139fb")
})
