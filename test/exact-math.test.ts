import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import {
  atan2,
  cos,
  cubeRoot,
  PI,
  powSrgb,
  rootSrgb,
  sin,
} from "../src/core/math.ts"
import { fromOklch, toOklch } from "../src/core/color.ts"

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sources(path) : [path]
  })
}

test("src uses no engine-approximated math", () => {
  const banned =
    /Math\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|log|log2|log10|log1p|pow|cbrt|hypot|random)\b|\*\*|Date\.|performance\.|localeCompare|toLocale/
  for (const file of sources("src")) {
    const code = readFileSync(file, "utf8")
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
    assert.equal(code.match(banned)?.[0], undefined, file)
  }
})

test("exact trig and roots agree with the engine's to high precision", () => {
  for (let x = -20; x <= 20; x += 0.137) {
    assert.ok(Math.abs(sin(x) - Math.sin(x)) < 1e-6, `sin ${x}`)
    assert.ok(Math.abs(cos(x) - Math.cos(x)) < 1e-6, `cos ${x}`)
  }
  for (let y = -3; y <= 3; y += 0.31) {
    for (let x = -3; x <= 3; x += 0.29) {
      assert.ok(Math.abs(atan2(y, x) - Math.atan2(y, x)) < 1e-6, `atan2 ${y} ${x}`)
    }
  }
  assert.equal(atan2(0, 0), 0)
  assert.ok(Math.abs(atan2(1, 0) - PI / 2) < 1e-12)
  for (let x = 0.0005; x < 1; x += 0.0173) {
    assert.ok(Math.abs(cubeRoot(x) - Math.cbrt(x)) < 1e-9, `cbrt ${x}`)
    assert.ok(Math.abs(powSrgb(x) - x ** 2.4) < 1e-9, `pow ${x}`)
    assert.ok(Math.abs(rootSrgb(x) - x ** (1 / 2.4)) < 1e-9, `root ${x}`)
  }
})

test("colours survive the trip through OKLCH", () => {
  for (const color of ["#635bff", "#f59e0b", "#0f766e", "#123456", "#fefefe"]) {
    assert.equal(fromOklch(toOklch(color)), color)
  }
})
