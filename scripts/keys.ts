// Builds src/grammar/keys.ts: a typewriter's few keys, the characters the
// type fill sets, as flat outlines read from Inter Bold (OFL), so the core
// draws them as plain shapes without carrying a whole face. Run with
// `node scripts/keys.ts` after changing the keys.
import { readFileSync, writeFileSync } from "node:fs"
import { loadFont } from "../src/type/fontfile.ts"

// From least ink to most.
const KEYS = ".:-=+*xo#"

const font = await loadFont(readFileSync("node_modules/@fontsource/inter/files/inter-latin-700-normal.woff"))
const flat = (contour: { x: number; y: number; on: boolean }[]) => {
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
    // A curve in two straight steps: at a key's size, smooth enough.
    for (const t of [0.5, 1]) {
      const u = 1 - t
      put({ x: u * u * from.x + 2 * u * t * p.x + t * t * end.x, y: u * u * from.y + 2 * u * t * p.y + t * t * end.y })
    }
    from = end
    if (next.on) k++
  }
  return points
}
const keys = [...KEYS].map((char) => {
  const code = char.codePointAt(0)!
  return { char, advance: font.advance.get(code)!, contours: font.contours(code).map(flat) }
})
const body = keys.map((key) => `  { char: ${JSON.stringify(key.char)}, advance: ${key.advance}, contours: ${JSON.stringify(key.contours)} },`).join("\n")
writeFileSync(
  "src/grammar/keys.ts",
  `// Built by scripts/keys.ts from Inter Bold, under the SIL Open Font License
// 1.1 (fonts/OFL.txt). Do not edit by hand.
// A typewriter's keys, from least ink to most: each character's advance and
// outlines in thousandths of the em, x from its left, y down from the cap
// height, so the baseline is at ${font.cap}.
export const CAP = ${font.cap}
export const KEYS: readonly { char: string; advance: number; contours: readonly (readonly number[])[] }[] = [
${body}
]
`
)
console.log(keys.map((key) => `${key.char} ${key.contours.reduce((n, c) => n + c.length / 2, 0)}`).join("  "))
