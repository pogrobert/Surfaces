import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { generate } from "../src/core/generate.ts"
import { createHandler } from "../src/http.ts"
import { toPng } from "../src/png.ts"
import { Surface } from "../src/react.ts"
import { toSvg } from "../src/render/svg.ts"
import { STYLE_NAMES } from "./support/inputs.ts"

test("auto is one drawing that carries both themes' colours", () => {
  for (const style of STYLE_NAMES) {
    const input = { style, seed: "auto", color: "#635bff" }
    const light = generate({ ...input, theme: "light" })
    const dark = generate({ ...input, theme: "dark" })
    const auto = generate({ ...input, theme: "auto" })
    const places = (scene: typeof auto) => scene.areas.map(({ ink: _, ...area }) => area)
    assert.deepEqual(places(auto), places(light), style)
    assert.deepEqual(places(auto), places(dark), style)
    assert.deepEqual(auto.dark?.palette, dark.palette, style)
    const svg = toSvg(auto)
    assert.match(svg, /@media \(prefers-color-scheme:dark\)/, style)
    assert.ok(svg.includes(light.palette.ground) && svg.includes(dark.palette.ground), style)
    assert.equal(toSvg(generate({ ...input, theme: "auto" })), svg, style)
    // A rasteriser has no light or dark mode, and gets the light side alone.
    const flat = toSvg(auto, { target: "resvg" })
    assert.doesNotMatch(flat, /var\(|prefers-color-scheme/, style)
  }
  assert.throws(() => generate({ style: "riso", seed: 1, theme: "dusk" as "light" }), /Unknown theme "dusk"/)
})

test("a picture of an auto cover has to pick a theme", async () => {
  await assert.rejects(toPng(generate({ style: "riso", seed: 1, theme: "auto" })), /one theme/)
  const handler = createHandler({ png: (input) => toPng(generate(input)) })
  const response = await handler(new Request("https://x.test/cover.png?style=riso&seed=1&theme=auto&format=png"))
  assert.equal(response.status, 400)
  const svg = await handler(new Request("https://x.test/cover.svg?style=riso&seed=1&theme=auto"))
  assert.equal(svg.status, 200)
})

test("an auto title takes the colour of the theme that shows", () => {
  const scene = generate({ style: "riso", seed: "auto", theme: "auto", areas: [{ place: "bottom-left", size: "lg" }] })
  const { inkVar } = scene.dark!
  assert.equal(scene.areas[0]!.ink, `var(${inkVar}, ${scene.ink})`)
  const html = renderToString(createElement(Surface, { style: "riso", seed: "auto", theme: "auto" }, "Title"))
  assert.ok(html.includes(`color:var(${inkVar}`))
  const svg = toSvg(scene)
  assert.ok(svg.includes(`:root{${inkVar}:${scene.ink}}`))
  assert.ok(svg.includes(`:root{${inkVar}:${scene.dark!.ink}}`))
})
