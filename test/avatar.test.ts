import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { avatar, AVATAR_STYLES, validateAvatar } from "../src/avatar.ts"
import { catalog } from "../src/catalog.ts"
import { generate } from "../src/core/generate.ts"
import { createAvatarHandler } from "../src/http.ts"
import { Avatar } from "../src/react.ts"
import { toSvg } from "../src/render/svg.ts"
import { coverage } from "./support/sample.ts"

const PEOPLE = ["ada", "grace", "linus", "margaret", "alan", "barbara", 42, "katherine"]

test("every avatar style draws every seed, round, the same every time", () => {
  for (const style of AVATAR_STYLES) {
    for (const theme of ["light", "dark", "auto"] as const) {
      for (const seed of PEOPLE) {
        const scene = avatar({ style, seed, theme, color: "#0f766e" })
        assert.equal(scene.output.w, 256, style)
        assert.equal(scene.output.h, 256, style)
        assert.equal(scene.areas.length, 0, style)
        assert.equal(scene.layers[0]?.kind, "clip", `${style} is cut to a circle`)
        assert.equal(toSvg(scene), toSvg(avatar({ style, seed, theme, color: "#0f766e" })), style)
      }
    }
    const square = avatar({ style, seed: "ada", square: true })
    assert.notEqual(square.layers[0]?.kind, "clip", `${style} square stays square`)
  }
})

test("people are told apart, and an avatar fills its circle", () => {
  for (const style of AVATAR_STYLES) {
    const drawn = new Set(PEOPLE.map((seed) => toSvg(avatar({ style, seed, size: 64 }))))
    assert.equal(drawn.size, PEOPLE.length, `${style}: two people share an avatar`)
    for (const seed of PEOPLE) {
      // Nothing is near bare: an avatar is all art.
      const covered = coverage(avatar({ style, seed, square: true }), 15)
      assert.ok(covered > 0.2, `${style} ${seed}: only ${covered} covered`)
    }
  }
})

test("avatars leave covers as they were", () => {
  // Filling is an avatar's alone: a cover of the same seed draws as before.
  for (const style of AVATAR_STYLES) {
    const cover = generate({ style, seed: "ada" })
    assert.equal(cover.areas.length, 0)
    assert.ok(toSvg(cover) !== toSvg(avatar({ style, seed: "ada", square: true, size: 1200 })), style)
  }
  assert.deepEqual(
    catalog.filter((entry) => entry.avatar).map((entry) => entry.style).sort(),
    [...AVATAR_STYLES].sort()
  )
})

test("a wrong avatar input says how to fix it", () => {
  const says = (input: unknown, pattern: RegExp) => {
    const { errors } = validateAvatar(input)
    assert.ok(errors.some((error) => pattern.test(error)), `${JSON.stringify(input)}: ${errors.join(" | ")}`)
    assert.throws(() => avatar(input as never), pattern)
  }
  says({ style: "halftone", seed: "ada" }, /Avatars come in .*too fine to read/)
  says({ style: "rizo", seed: "ada" }, /Did you mean "riso"/)
  says({ style: "riso" }, /Missing "seed"/)
  says({ style: "riso", seed: "ada", width: 64 }, /Avatars are square: use "size"/)
  says({ style: "riso", seed: "ada", size: 4 }, /from 16 to 2048/)
  says({ style: "riso", seed: "ada", color: "teal" }, /hex colour/)
  says({ style: "riso", seed: "ada", square: "yes" }, /true or false/)
  assert.deepEqual(validateAvatar({ style: "marbling", seed: "ada", size: 96, theme: "auto", mood: "calm", grain: "smooth", square: true }).errors, [])
})

test("an avatar URL draws the same bytes, and React places one", async () => {
  const handler = createAvatarHandler({ defaults: { color: "#635bff" } })
  const response = await handler(new Request("http://x/avatar?style=riso&seed=ada&size=96"))
  assert.equal(response.status, 200)
  assert.equal(await response.text(), toSvg(avatar({ style: "riso", seed: "ada", size: 96, color: "#635bff" })))
  for (const query of ["style=halftone&seed=a", "style=riso", "style=riso&seed=a&width=9", "style=riso&seed=a&format=gif"]) {
    assert.equal((await handler(new Request(`http://x/avatar?${query}`))).status, 400, query)
  }
  const html = renderToString(createElement(Avatar, { style: "strata", seed: "ada", label: "Ada Lovelace" }))
  assert.match(html, /role="img" aria-label="Ada Lovelace"/)
  assert.match(html, /width:40px;height:40px/)
  assert.match(renderToString(createElement(Avatar, { style: "strata", seed: "ada" })), /aria-hidden="true"/)
})
