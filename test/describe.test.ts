import assert from "node:assert/strict"
import { test } from "node:test"
import { catalog, describe, generate, toSvg, THEMES } from "../dist/index.js"

const COLORS = ["#635bff", "#f59e0b", "#0f766e", "#e11d48", "#111111", "#9ca3af"]

test("every style and shape has a plain, short description", () => {
  for (const { style, shapes } of catalog) {
    for (const shape of shapes.length ? shapes : [undefined]) {
      for (const theme of THEMES) {
        for (const color of COLORS) {
          const scene = generate({ style, seed: "alt", color, theme, ...(shape ? { shape } : null) })
          const text = describe(scene)
          assert.match(text, /^Abstract art: [a-z][^.]*\.$/, `${style} ${shape}: ${text}`)
          assert.ok(text.length <= 140, `${style} ${shape} is ${text.length} long: ${text}`)
          assert.doesNotMatch(text, /undefined|null|NaN|  |, ,/, text)
          assert.equal(describe(scene), text)
        }
      }
    }
  }
})

test("a cover seen without its page can say which page it is for", () => {
  const scene = generate({ style: "aquatint", seed: "alt", color: "#0f766e" })
  const plain = describe(scene).replace(/^Abstract art: /, "")
  assert.equal(
    describe(scene, { title: "  How the new search works " }),
    `Abstract cover art for "How the new search works": ${plain}`
  )
  assert.equal(describe(scene, { title: "" }), describe(scene))
  // Nothing about where the art sits or what it is made with.
  for (const { style } of catalog) {
    const text = describe(generate({ style, seed: "words", areas: [{ place: "bottom-left", size: "lg" }] }))
    assert.doesNotMatch(text, /\b(left|right|top|bottom|middle|frame|aquatint|riso|moir|halftone|dither|sfumato)/i, text)
  }
})

test("a labelled SVG is read out, an unlabelled one is hidden", () => {
  const scene = generate({ style: "riso", seed: "alt" })
  assert.match(toSvg(scene), /aria-hidden="true"/)
  const labelled = toSvg(scene, { label: "Two <discs> & a bar" })
  assert.match(labelled, /role="img"><title>Two &lt;discs&gt; &amp; a bar<\/title>/)
})

test("motion arrives once or keeps going, and is the same every time", () => {
  for (const { style } of catalog) {
    const input = { style, seed: "move", color: "#635bff" }
    const still = toSvg(generate(input))
    const initial = toSvg(generate({ ...input, motion: "once" }))
    const always = toSvg(generate({ ...input, motion: "loop" }))
    assert.equal(toSvg(generate({ ...input, motion: "loop" })), always)
    assert.doesNotMatch(still, /@keyframes/)
    assert.doesNotMatch(initial, /infinite/, style)
    for (const svg of [initial, always]) {
      if (svg.includes("@keyframes")) {
        assert.match(svg, /<style>@media \(prefers-reduced-motion:no-preference\)\{/, style)
      }
    }
  }
  assert.throws(() => generate({ style: "riso", seed: 1, motion: "sometimes" as "none" }), /Unknown motion/)
})
