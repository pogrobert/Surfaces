// Builds src/type/: the outlines of the bundled title faces, read from the
// WOFF files of the @fontsource packages (OFL) at build time, so the library
// draws titles as plain shapes with no font loading anywhere. Run with
// `node scripts/fonts.ts` after changing a face.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { inflateSync } from "node:zlib"

type Tables = Map<string, Buffer>

// A WOFF file's tables, each inflated where it was compressed.
export function woffTables(file: string): Tables {
  const data = readFileSync(file)
  if (data.toString("ascii", 0, 4) !== "wOFF") throw new Error(`${file} isn't a WOFF file`)
  const count = data.readUInt16BE(12)
  const tables: Tables = new Map()
  for (let i = 0; i < count; i++) {
    const at = 44 + i * 20
    const tag = data.toString("ascii", at, at + 4)
    const offset = data.readUInt32BE(at + 4)
    const packed = data.readUInt32BE(at + 8)
    const size = data.readUInt32BE(at + 12)
    const bytes = data.subarray(offset, offset + packed)
    tables.set(tag, packed < size ? inflateSync(bytes) : Buffer.from(bytes))
  }
  return tables
}

type Point = { x: number; y: number; on: boolean }

// Glyph ids by code point, from the Windows Unicode subtable.
function cmapOf(table: Buffer) {
  const map = new Map<number, number>()
  const count = table.readUInt16BE(2)
  for (let i = 0; i < count; i++) {
    const platform = table.readUInt16BE(4 + i * 8)
    const encoding = table.readUInt16BE(6 + i * 8)
    const offset = table.readUInt32BE(8 + i * 8)
    if (platform !== 3 || (encoding !== 1 && encoding !== 10)) continue
    const format = table.readUInt16BE(offset)
    if (format === 4) {
      const segments = table.readUInt16BE(offset + 6) / 2
      const ends = offset + 14
      const starts = ends + segments * 2 + 2
      const deltas = starts + segments * 2
      const ranges = deltas + segments * 2
      for (let s = 0; s < segments; s++) {
        const end = table.readUInt16BE(ends + s * 2)
        const start = table.readUInt16BE(starts + s * 2)
        const delta = table.readInt16BE(deltas + s * 2)
        const range = table.readUInt16BE(ranges + s * 2)
        for (let code = start; code <= end && code !== 0xffff; code++) {
          let glyph: number
          if (range === 0) glyph = (code + delta) & 0xffff
          else {
            const at = ranges + s * 2 + range + (code - start) * 2
            glyph = table.readUInt16BE(at)
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff
          }
          if (glyph) map.set(code, glyph)
        }
      }
    } else if (format === 12) {
      const groups = table.readUInt32BE(offset + 12)
      for (let g = 0; g < groups; g++) {
        const at = offset + 16 + g * 12
        const start = table.readUInt32BE(at)
        const end = table.readUInt32BE(at + 4)
        const first = table.readUInt32BE(at + 8)
        for (let code = start; code <= end; code++) map.set(code, first + code - start)
      }
    }
  }
  return map
}

// A glyph's contours in font units, compound glyphs resolved into their parts.
function outline(tables: Tables, glyph: number, long: boolean): Point[][] {
  const loca = tables.get("loca")!
  const glyf = tables.get("glyf")!
  const start = long ? loca.readUInt32BE(glyph * 4) : loca.readUInt16BE(glyph * 2) * 2
  const end = long ? loca.readUInt32BE(glyph * 4 + 4) : loca.readUInt16BE(glyph * 2 + 2) * 2
  if (end <= start) return []
  const data = glyf.subarray(start, end)
  const contours = data.readInt16BE(0)
  if (contours < 0) {
    // Compound: each part another glyph, moved and perhaps scaled.
    const parts: Point[][] = []
    let at = 10
    for (;;) {
      const flags = data.readUInt16BE(at)
      const index = data.readUInt16BE(at + 2)
      at += 4
      const words = flags & 1
      const dx = words ? data.readInt16BE(at) : data.readInt8(at)
      const dy = words ? data.readInt16BE(at + 2) : data.readInt8(at + 1)
      at += words ? 4 : 2
      let [a, b, c, d] = [1, 0, 0, 1]
      const f2 = (offset: number) => data.readInt16BE(offset) / 16384
      if (flags & 0x8) { a = d = f2(at); at += 2 }
      else if (flags & 0x40) { a = f2(at); d = f2(at + 2); at += 4 }
      else if (flags & 0x80) { a = f2(at); b = f2(at + 2); c = f2(at + 4); d = f2(at + 6); at += 8 }
      for (const contour of outline(tables, index, long)) {
        parts.push(contour.map((p) => ({ x: Math.round(p.x * a + p.y * c + dx), y: Math.round(p.x * b + p.y * d + dy), on: p.on })))
      }
      if (!(flags & 0x20)) break
    }
    return parts
  }
  const ends: number[] = []
  for (let i = 0; i < contours; i++) ends.push(data.readUInt16BE(10 + i * 2))
  const points = (ends.at(-1) ?? -1) + 1
  let at = 10 + contours * 2
  const instructions = data.readUInt16BE(at)
  at += 2 + instructions
  const flags: number[] = []
  while (flags.length < points) {
    const flag = data.readUInt8(at++)
    flags.push(flag)
    if (flag & 8) {
      const repeat = data.readUInt8(at++)
      for (let r = 0; r < repeat; r++) flags.push(flag)
    }
  }
  const read = (short: number, same: number) => {
    const values: number[] = []
    let value = 0
    for (const flag of flags) {
      if (flag & short) {
        const step = data.readUInt8(at++)
        value += flag & same ? step : -step
      } else if (!(flag & same)) {
        value += data.readInt16BE(at)
        at += 2
      }
      values.push(value)
    }
    return values
  }
  const xs = read(2, 16)
  const ys = read(4, 32)
  const out: Point[][] = []
  let first = 0
  for (const last of ends) {
    const contour: Point[] = []
    for (let i = first; i <= last; i++) contour.push({ x: xs[i]!, y: ys[i]!, on: Boolean(flags[i]! & 1) })
    out.push(contour)
    first = last + 1
  }
  return out
}

// Kerning from GPOS pair adjustments under the "kern" feature: how far the
// second glyph moves along, by glyph id pair.
function kerningOf(gpos: Buffer | undefined) {
  const pairs = new Map<string, number>()
  if (!gpos) return pairs
  const features = gpos.readUInt16BE(6)
  const lookups = gpos.readUInt16BE(8)
  const wanted = new Set<number>()
  const featureCount = gpos.readUInt16BE(features)
  for (let i = 0; i < featureCount; i++) {
    const at = features + 2 + i * 6
    if (gpos.toString("ascii", at, at + 4) !== "kern") continue
    const feature = features + gpos.readUInt16BE(at + 4)
    const count = gpos.readUInt16BE(feature + 2)
    for (let j = 0; j < count; j++) wanted.add(gpos.readUInt16BE(feature + 4 + j * 2))
  }
  const coverage = (offset: number) => {
    const glyphs: number[] = []
    const format = gpos.readUInt16BE(offset)
    const count = gpos.readUInt16BE(offset + 2)
    if (format === 1) for (let i = 0; i < count; i++) glyphs.push(gpos.readUInt16BE(offset + 4 + i * 2))
    else for (let i = 0; i < count; i++) {
      const at = offset + 4 + i * 6
      for (let g = gpos.readUInt16BE(at); g <= gpos.readUInt16BE(at + 2); g++) glyphs.push(g)
    }
    return glyphs
  }
  const classes = (offset: number) => {
    const map = new Map<number, number>()
    const format = gpos.readUInt16BE(offset)
    if (format === 1) {
      const startGlyph = gpos.readUInt16BE(offset + 2)
      const count = gpos.readUInt16BE(offset + 4)
      for (let i = 0; i < count; i++) map.set(startGlyph + i, gpos.readUInt16BE(offset + 6 + i * 2))
    } else {
      const count = gpos.readUInt16BE(offset + 2)
      for (let i = 0; i < count; i++) {
        const at = offset + 4 + i * 6
        for (let g = gpos.readUInt16BE(at); g <= gpos.readUInt16BE(at + 2); g++) map.set(g, gpos.readUInt16BE(at + 4))
      }
    }
    return map
  }
  const bits = (format: number) => [...Array(8).keys()].filter((bit) => format & (1 << bit)).length
  // The x advance in a value record, when it has one.
  const advanceIn = (at: number, format: number) => {
    if (!(format & 4)) return 0
    const before = (format & 1 ? 1 : 0) + (format & 2 ? 1 : 0)
    return gpos.readInt16BE(at + before * 2)
  }
  const pairPos = (sub: number) => {
    const format = gpos.readUInt16BE(sub)
    const firsts = coverage(sub + gpos.readUInt16BE(sub + 2))
    const v1 = gpos.readUInt16BE(sub + 4)
    const v2 = gpos.readUInt16BE(sub + 6)
    const size = (bits(v1) + bits(v2)) * 2
    if (format === 1) {
      firsts.forEach((left, index) => {
        const set = sub + gpos.readUInt16BE(sub + 10 + index * 2)
        const count = gpos.readUInt16BE(set)
        for (let i = 0; i < count; i++) {
          const at = set + 2 + i * (2 + size)
          const right = gpos.readUInt16BE(at)
          const value = advanceIn(at + 2, v1)
          const key = `${left},${right}`
          if (value && !pairs.has(key)) pairs.set(key, value)
        }
      })
    } else {
      const left = classes(sub + gpos.readUInt16BE(sub + 8))
      const right = classes(sub + gpos.readUInt16BE(sub + 10))
      const count1 = gpos.readUInt16BE(sub + 12)
      const count2 = gpos.readUInt16BE(sub + 14)
      const byClass2 = new Map<number, number[]>()
      for (const [glyph, cls] of right) byClass2.set(cls, [...(byClass2.get(cls) ?? []), glyph])
      for (const first of firsts) {
        const c1 = left.get(first) ?? 0
        if (c1 >= count1) continue
        for (let c2 = 0; c2 < count2; c2++) {
          const value = advanceIn(sub + 16 + (c1 * count2 + c2) * size, v1)
          if (!value) continue
          for (const second of byClass2.get(c2) ?? []) {
            const key = `${first},${second}`
            if (!pairs.has(key)) pairs.set(key, value)
          }
        }
      }
    }
  }
  const lookupCount = gpos.readUInt16BE(lookups)
  for (let i = 0; i < lookupCount; i++) {
    if (!wanted.has(i)) continue
    const lookup = lookups + gpos.readUInt16BE(lookups + 2 + i * 2)
    const type = gpos.readUInt16BE(lookup)
    const subs = gpos.readUInt16BE(lookup + 4)
    for (let j = 0; j < subs; j++) {
      let sub = lookup + gpos.readUInt16BE(lookup + 6 + j * 2)
      let kind = type
      if (type === 9) {
        kind = gpos.readUInt16BE(sub + 2)
        sub += gpos.readUInt32BE(sub + 4)
      }
      if (kind === 2) pairPos(sub)
    }
  }
  return pairs
}

// The characters a title can use: printable ASCII and Latin-1, curly quotes,
// dashes, the ellipsis and the euro.
const CHARACTERS = [
  ...Array.from({ length: 95 }, (_, i) => 32 + i),
  ...Array.from({ length: 96 }, (_, i) => 160 + i),
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x20ac, 0x2022, 0x2122,
]

// One face: metrics and kerning, small enough for the core to lay titles out
// with, and outlines, which only drawing a PNG needs. Advances and outlines
// are in thousandths of the em, each point stepped from the one before, and
// off-curve points are marked with "~". Kerning is kept between ASCII
// characters.
function build(file: string) {
  const tables = woffTables(file)
  const head = tables.get("head")!
  const upm = head.readUInt16BE(18)
  const long = head.readInt16BE(50) === 1
  const hhea = tables.get("hhea")!
  const metrics = hhea.readUInt16BE(34)
  const hmtx = tables.get("hmtx")!
  const os2 = tables.get("OS/2")!
  const cap = os2.readUInt16BE(0) >= 2 ? os2.readInt16BE(88) : Math.round(upm * 0.7)
  const advance = (glyph: number) => hmtx.readUInt16BE(Math.min(glyph, metrics - 1) * 4)
  const cmap = cmapOf(tables.get("cmap")!)
  // Everything on a grid of a thousand units to the em: a tenth of a pixel
  // on a title a hundred pixels tall, and far shorter to write down.
  const q = (value: number) => Math.round((value * 1000) / upm)
  const advances: string[] = []
  const shapes: string[] = []
  const ids = new Map<number, number>()
  for (const code of CHARACTERS) {
    const glyph = cmap.get(code)
    if (glyph === undefined) continue
    ids.set(glyph, code)
    advances.push(`${code.toString(36)}:${q(advance(glyph)).toString(36)}`)
    let x = 0
    let y = 0
    const contours = outline(tables, glyph, long).map((contour) =>
      contour
        .map((point) => {
          const px = q(point.x)
          const py = q(point.y)
          const step = `${point.on ? "" : "~"}${px - x},${py - y}`
          x = px
          y = py
          return step
        })
        .join(" ")
    )
    if (contours.length) shapes.push(`${code.toString(36)}:${contours.join(";")}`)
  }
  const kern: string[] = []
  for (const [key, value] of kerningOf(tables.get("GPOS"))) {
    const [left, right] = key.split(",").map(Number) as [number, number]
    const a = ids.get(left)
    const b = ids.get(right)
    if (a === undefined || b === undefined || a > 126 || b > 126 || Math.abs(value) < upm * 0.008) continue
    kern.push(`${String.fromCharCode(a)}${String.fromCharCode(b)}${q(value)}`)
  }
  return {
    metrics: { ascent: q(hhea.readInt16BE(4)), descent: q(hhea.readInt16BE(6)), cap: q(cap), advances: advances.join("|"), kern: kern.join("|") },
    outlines: shapes.join("|"),
  }
}

const HEADER = `// Built by scripts/fonts.ts from the @fontsource packages of Inter Bold (the
// sans) and Fraunces SemiBold (the serif). The fonts are licensed under the
// SIL Open Font License 1.1, in fonts/OFL.txt. Do not edit by hand.
`

if (process.argv[2] === "--tables") {
  for (const file of process.argv.slice(3)) console.log(file.split("/").pop(), [...woffTables(file).keys()].join(" "))
} else {
  const root = new URL("..", import.meta.url).pathname
  mkdirSync(`${root}src/type`, { recursive: true })
  const files = `${root}node_modules/@fontsource`
  const sans = build(`${files}/inter/files/inter-latin-700-normal.woff`)
  const serif = build(`${files}/fraunces/files/fraunces-latin-600-normal.woff`)
  const metrics = `${HEADER}// What a title is laid out with: each face's vertical metrics, every
// character's advance and the kerning between pairs.
import type { FaceMetrics } from "../core/type.ts"

export const METRICS: Record<"sans" | "serif", FaceMetrics> = ${JSON.stringify({ sans: sans.metrics, serif: serif.metrics }, null, 2)}
`
  const outlines = `${HEADER}// What a title is drawn with in a PNG: every character's outline.

export const OUTLINES: Record<"sans" | "serif", string> = ${JSON.stringify({ sans: sans.outlines, serif: serif.outlines }, null, 2)}
`
  writeFileSync(`${root}src/type/metrics.ts`, metrics)
  writeFileSync(`${root}src/type/outlines.ts`, outlines)
  console.log(`metrics ${(metrics.length / 1024).toFixed(1)} KB, outlines ${(outlines.length / 1024).toFixed(1)} KB`)
}
