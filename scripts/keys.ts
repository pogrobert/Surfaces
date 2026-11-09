// Builds src/grammar/keys.ts: a typewriter's keys, as flat outlines read
// from Inter Bold (OFL), so the core draws them as plain shapes without
// carrying a whole face: the few characters it shades with, the digits it
// types tables in, and the capitals it draws a brand's initial as. Run with
// `node scripts/keys.ts` after changing the keys.
import { readFileSync, writeFileSync } from "node:fs"
import { loadFont } from "../src/type/fontfile.ts"

// From least ink to most.
const KEYS = ".:-=+*xo#"
const DIGITS = "0123456789"
const CAPITALS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

const font = await loadFont(readFileSync("node_modules/@fontsource/inter/files/inter-latin-700-normal.woff"))
// A contour as flat points, each curve in `steps` straight steps.
const flat = (contour: { x: number; y: number; on: boolean }[], steps = 2) => {
  const points: number[] = []
  const count = contour.length
  const at = (i: number) => contour[((i % count) + count) % count]!
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true })
  const first = contour.findIndex((p) => p.on)
  let from = first >= 0 ? at(first) : mid(at(0), at(1))
  const start = first >= 0 ? first : 0
  // Upright, in thousandths of the em down from the cap height.
  const put = (p: { x: number; y: number }) => points.push(Math.round(p.x), Math.round(font.cap - p.y))
  put(from)
  for (let k = 1; k <= count; k++) {
    const p = at(start + k)
    if (p.on) {
      put(p)
      from = p
      continue
    }
    const next = at(start + k + 1)
    const end = next.on ? next : mid(p, next)
    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      const u = 1 - t
      put({ x: u * u * from.x + 2 * u * t * p.x + t * t * end.x, y: u * u * from.y + 2 * u * t * p.y + t * t * end.y })
    }
    from = end
    if (next.on) k++
  }
  return points
}
// At a key's size two steps a curve is smooth enough; a capital drawn the
// height of a cover takes five.
const read = (chars: string, steps: number) =>
  [...chars].map((char) => {
    const code = char.codePointAt(0)!
    return { char, advance: font.advance.get(code)!, contours: font.contours(code).map((contour) => flat(contour, steps)) }
  })
const table = (rows: ReturnType<typeof read>) =>
  rows.map((key) => `  { char: ${JSON.stringify(key.char)}, advance: ${key.advance}, contours: ${JSON.stringify(key.contours)} },`).join("\n")
const keys = read(KEYS, 2)
const digits = read(DIGITS, 2)
const capitals = read(CAPITALS, 5)
writeFileSync(
  "src/grammar/keys.ts",
  `// Built by scripts/keys.ts from Inter Bold, under the SIL Open Font License
// 1.1 (fonts/OFL.txt). Do not edit by hand.
// A typewriter's keys, from least ink to most: each character's advance and
// outlines in thousandths of the em, x from its left, y down from the cap
// height, so the baseline is at ${font.cap}.
export const CAP = ${font.cap}
export type Key = { char: string; advance: number; contours: readonly (readonly number[])[] }
export const KEYS: readonly Key[] = [
${table(keys)}
]
// For tables of figures.
export const DIGITS: readonly Key[] = [
${table(digits)}
]
// For a brand's initial, drawn large: a typed picture of the letter.
export const CAPITALS: readonly Key[] = [
${table(capitals)}
]
`
)
const points = (rows: ReturnType<typeof read>) => rows.reduce((n, key) => n + key.contours.reduce((m, c) => m + c.length / 2, 0), 0)
console.log("points: keys", points(keys), "digits", points(digits), "capitals", points(capitals))
