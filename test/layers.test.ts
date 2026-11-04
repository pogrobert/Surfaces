import assert from "node:assert/strict"
import { test } from "node:test"
import { generate } from "../src/core/generate.ts"
import { toHtml } from "../src/render/layers.ts"
import { STYLE_NAMES } from "./support/inputs.ts"

// A moving cover's loops must cost a browser nothing but blending finished
// pictures on the graphics card: every loop on an HTML element of its own,
// animating only transform and opacity, which every browser moves without
// drawing anything again. These hold that by construction, so no benchmark
// has to run a browser flat out to find it.

// The graphics card keeps every layer as a picture; this is how much of the
// canvas, counted again for each layer, a cover may ask it to keep. Most
// covers need two to five. The most are Dither, each of its tone groups a
// layer of its own that blinks, and Halftone's circling light, a layer for
// each stretch of its circle, of which only one shows at a time.
const MOST_PICTURE = 24
// Moving layers on one cover. Each is cheap, but not free to keep. The most
// is Endpaper with no title, its whole wall of small tiles turning: many
// layers, each a sliver of the canvas.
const MOST_MOVING = 64

type Look = { endless: Map<string, string[]>; html: string }

function look(html: string): Look {
  const style = html.match(/<style>([\s\S]*?)<\/style>/)![1]!
  const frames = new Map<string, string>()
  for (const m of style.matchAll(/@keyframes ([\w-]+)\{((?:[^{}]*\{[^{}]*\})*)\}/g)) frames.set(m[1]!, m[2]!)
  // Each class whose animation never ends, with what it animates.
  const endless = new Map<string, string[]>()
  for (const m of style.matchAll(/\.([\w-]+)\{animation:([^}]*)\}/g)) {
    for (const part of m[2]!.split(",")) {
      if (!part.includes("infinite")) continue
      const name = part.trim().split(" ")[0]!
      const animated = [...(frames.get(name) ?? "").matchAll(/([a-z-]+):/g)].map((p) => p[1]!)
      endless.set(m[1]!, [...(endless.get(m[1]!) ?? []), ...animated])
    }
  }
  return { endless, html }
}

// Each moving cover, in both themes and a few seeds.
function* covers() {
  for (const style of STYLE_NAMES) {
    for (const seed of ["a", "b", "c"]) {
      for (const theme of ["light", "dark"] as const) {
        yield { name: `${style} ${seed} ${theme}`, html: toHtml(generate({ style, seed, theme, motion: "loop", color: "#635bff" })) }
      }
    }
  }
}

test("every loop moves an HTML layer, never something inside an SVG", () => {
  for (const { name, html } of covers()) {
    const { endless } = look(html)
    for (const name_ of endless.keys()) {
      for (const m of html.matchAll(new RegExp(`<(\\w+)[^>]*class="[^"]*\\b${name_}\\b`, "g"))) {
        assert.equal(m[1], "div", `${name}: a loop runs on a <${m[1]}>`)
      }
    }
  }
})

test("loops animate only transform and opacity", () => {
  // A held keyframe names its timing too; that animates nothing.
  const free = new Set(["transform", "opacity", "animation-timing-function"])
  for (const { name, html } of covers()) {
    for (const animated of look(html).endless.values()) {
      for (const property of animated) assert.ok(free.has(property), `${name}: a loop animates ${property}`)
    }
  }
})

test("a moving cover asks the graphics card to keep little", () => {
  for (const { name, html } of covers()) {
    let picture = 0
    const placed = /<(?:svg|div) class="[\w-]+f"[^>]*? style="left:([-\d.]+)%;top:([-\d.]+)%;width:([\d.]+)%;height:([\d.]+)%/g
    for (const m of html.matchAll(placed)) {
      const [x, y, w, h] = [m[1], m[2], m[3], m[4]].map((value) => Number(value) / 100) as [number, number, number, number]
      // Only what is on the canvas is drawn; the rest is cut off at its edge.
      picture += Math.max(0, Math.min(1, x + w) - Math.max(0, x)) * Math.max(0, Math.min(1, y + h) - Math.max(0, y))
    }
    assert.ok(picture <= MOST_PICTURE, `${name}: ${picture.toFixed(1)} canvases of pictures`)
    const moving = new Set<string>()
    for (const cls of look(html).endless.keys()) {
      for (const m of html.matchAll(new RegExp(`<div[^>]*class="[^"]*\\b${cls}\\b`, "g"))) moving.add(`${m.index}`)
    }
    assert.ok(moving.size <= MOST_MOVING, `${name}: ${moving.size} moving layers`)
  }
})

test("a still cover is one sheet with no motion", () => {
  for (const style of STYLE_NAMES) {
    const html = toHtml(generate({ style, seed: "a", motion: "none", color: "#635bff" }))
    assert.equal(html.match(/<svg class=/g)?.length, 1, style)
    assert.ok(!html.includes("@keyframes"), style)
  }
})
