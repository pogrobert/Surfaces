// A site's own font, read from its file, so a title drawn into an image is
// set in it: TrueType outlines in a TTF, an OpenType file with TrueType
// outlines, WOFF or WOFF2. What a title needs is read from it: the advance
// of every character, the kerning between pairs, the cap height and the
// descent, and each glyph's outlines, all on a grid of a thousand units to
// the em, as the bundled faces are.
//
// The decoding is the library's own, with no dependency: WOFF2's rebuilt
// glyph table included. Only the compression under it comes from the
// platform: WOFF's deflate and WOFF2's Brotli through DecompressionStream
// where the runtime decodes them, or Node's built-in zlib.

import { hash } from "../core/random.ts"

type Point = { x: number; y: number; on: boolean }
export type Contour = Point[]

// What a title is laid out and drawn with, from a font file.
export type TitleFont = {
  kind: "font"
  // Names it in a scene, which stays plain data.
  key: string
  family: string
  weight: number
  serif: boolean
  // In thousandths of the em.
  cap: number
  descent: number
  advance: Map<number, number>
  kern: Map<string, number>
  contours(code: number): Contour[]
}

// The most a font file may weigh: a title needs one face, not a family.
export const MOST_FONT_BYTES = 8 * 1024 * 1024

const text = (bytes: Uint8Array, at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length))

class Reader {
  bytes: Uint8Array
  view: DataView
  at: number
  constructor(bytes: Uint8Array, at = 0) {
    this.bytes = bytes
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this.at = at
  }
  u8() { return this.view.getUint8(this.at++) }
  i8() { return this.view.getInt8(this.at++) }
  u16() { const value = this.view.getUint16(this.at); this.at += 2; return value }
  i16() { const value = this.view.getInt16(this.at); this.at += 2; return value }
  u32() { const value = this.view.getUint32(this.at); this.at += 4; return value }
  // WOFF2's variable-length numbers.
  base128() {
    let value = 0
    for (let i = 0; i < 5; i++) {
      const byte = this.u8()
      if (i === 0 && byte === 0x80) throw new Error("This WOFF2 file is damaged: a length starts with a zero")
      value = value * 128 + (byte & 0x7f)
      if (!(byte & 0x80)) return value
    }
    throw new Error("This WOFF2 file is damaged: a length runs past five bytes")
  }
  u255() {
    const code = this.u8()
    if (code === 253) return this.u16()
    if (code === 255) return this.u8() + 253
    if (code === 254) return this.u8() + 253 * 2
    return code
  }
}

// A table as a reader of its own, from its start.
const at = (table: Uint8Array, offset = 0) => new Reader(table, offset)

// ---- Decompression, from the platform ----

const NODE_ZLIB = "node:zlib"
async function decompress(bytes: Uint8Array, format: "deflate" | "brotli") {
  if (typeof DecompressionStream !== "undefined") {
    let stream: DecompressionStream | undefined
    try {
      stream = new DecompressionStream(format as CompressionFormat)
    } catch {
      // This runtime doesn't decode the format; Node's zlib may.
    }
    if (stream) {
      const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
      return new Uint8Array(await new Response(out).arrayBuffer())
    }
  }
  let zlib: { inflateSync(data: Uint8Array): Uint8Array; brotliDecompressSync(data: Uint8Array): Uint8Array }
  try {
    zlib = await import(/* webpackIgnore: true */ /* @vite-ignore */ NODE_ZLIB)
  } catch {
    throw new Error(`This runtime can't decompress ${format === "brotli" ? "WOFF2" : "WOFF"}; read the font where Node runs, or give it as a TTF`)
  }
  return new Uint8Array(format === "brotli" ? zlib.brotliDecompressSync(bytes) : zlib.inflateSync(bytes))
}

// ---- The containers ----

// The tables of a TTF or an OpenType file, as they are in it.
function sfntTables(bytes: Uint8Array) {
  const read = at(bytes, 4)
  const count = read.u16()
  const tables = new Map<string, Uint8Array>()
  for (let i = 0; i < count; i++) {
    const entry = 12 + i * 16
    const tag = text(bytes, entry, 4)
    const view = at(bytes, entry + 8)
    const offset = view.u32()
    const length = view.u32()
    tables.set(tag, bytes.subarray(offset, offset + length))
  }
  return tables
}

// A WOFF file's tables, each inflated where it was compressed.
async function woffTables(bytes: Uint8Array) {
  const count = at(bytes, 12).u16()
  const tables = new Map<string, Uint8Array>()
  for (let i = 0; i < count; i++) {
    const entry = 44 + i * 20
    const tag = text(bytes, entry, 4)
    const read = at(bytes, entry + 4)
    const offset = read.u32()
    const packed = read.u32()
    const size = read.u32()
    const data = bytes.subarray(offset, offset + packed)
    tables.set(tag, packed < size ? await decompress(data, "deflate") : data)
  }
  return tables
}

// The tags WOFF2 names by number.
const KNOWN = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT",
  "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH",
  "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
  "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
]

// A WOFF2 file's tables, decompressed, with its glyph table read from the
// transformed form WOFF2 keeps it in: each glyph's contours, and the
// advances when hmtx is transformed too.
async function woff2Tables(bytes: Uint8Array) {
  const head = at(bytes, 4)
  const flavor = text(bytes, 4, 4)
  if (flavor === "ttcf") throw new Error("This WOFF2 file holds a collection of fonts; give the file of one face, a .ttf or .woff2")
  head.at = 12
  const count = head.u16()
  head.at = 20
  const compressed = head.u32()
  const entries: { tag: string; length: number; transformed: boolean }[] = []
  const read = at(bytes, 48)
  for (let i = 0; i < count; i++) {
    const flags = read.u8()
    const index = flags & 0x3f
    const tag = index === 63 ? text(bytes, read.at, 4) : KNOWN[index]!
    if (index === 63) read.at += 4
    const version = (flags >> 6) & 3
    const original = read.base128()
    // glyf and loca are transformed unless their version says null (3);
    // every other table is transformed only with a version other than 0.
    const transformed = tag === "glyf" || tag === "loca" ? version !== 3 : version !== 0
    const length = transformed ? read.base128() : original
    entries.push({ tag, length, transformed })
  }
  const data = await decompress(bytes.subarray(read.at, read.at + compressed), "brotli")
  const tables = new Map<string, Uint8Array>()
  const transformed = new Set<string>()
  let offset = 0
  for (const entry of entries) {
    tables.set(entry.tag, data.subarray(offset, offset + entry.length))
    if (entry.transformed) transformed.add(entry.tag)
    offset += entry.length
  }
  return { tables, transformed }
}

// ---- Glyphs ----

type Glyph =
  | { kind: "simple"; contours: Contour[] }
  | { kind: "compound"; parts: { glyph: number; dx: number; dy: number; a: number; b: number; c: number; d: number }[] }
  | { kind: "empty" }

// A compound glyph's parts, from the bytes after its header, as glyf and
// WOFF2's composite stream both write them. Returns where they end and
// whether instructions follow.
function readParts(read: Reader) {
  const parts: Extract<Glyph, { kind: "compound" }>["parts"] = []
  let instructions = false
  for (;;) {
    const flags = read.u16()
    const glyph = read.u16()
    const words = flags & 1
    const dx = words ? read.i16() : read.i8()
    const dy = words ? read.i16() : read.i8()
    let [a, b, c, d] = [1, 0, 0, 1]
    const f2 = () => read.i16() / 16384
    if (flags & 0x8) a = d = f2()
    else if (flags & 0x40) { a = f2(); d = f2() }
    else if (flags & 0x80) { a = f2(); b = f2(); c = f2(); d = f2() }
    parts.push({ glyph, dx, dy, a, b, c, d })
    if (flags & 0x100) instructions = true
    if (!(flags & 0x20)) break
  }
  return { parts, instructions }
}

// A glyph from a plain glyf table.
function glyfGlyph(glyf: Uint8Array, loca: Uint8Array, long: boolean, id: number): Glyph {
  const index = at(loca, long ? id * 4 : id * 2)
  const start = long ? index.u32() : index.u16() * 2
  const end = long ? index.u32() : index.u16() * 2
  if (end <= start) return { kind: "empty" }
  const read = at(glyf.subarray(start, end))
  const count = read.i16()
  read.at = 10
  if (count < 0) return { kind: "compound", parts: readParts(read).parts }
  const ends: number[] = []
  for (let i = 0; i < count; i++) ends.push(read.u16())
  const points = (ends.at(-1) ?? -1) + 1
  // Past the instructions, which a title has no use for.
  const instructions = read.u16()
  read.at += instructions
  const flags: number[] = []
  while (flags.length < points) {
    const flag = read.u8()
    flags.push(flag)
    if (flag & 8) for (let repeat = read.u8(); repeat > 0; repeat--) flags.push(flag)
  }
  const axis = (short: number, same: number) => {
    let value = 0
    return flags.map((flag) => {
      if (flag & short) value += flag & same ? read.u8() : -read.u8()
      else if (!(flag & same)) value += read.i16()
      return value
    })
  }
  const xs = axis(2, 16)
  const ys = axis(4, 32)
  const contours: Contour[] = []
  let first = 0
  for (const last of ends) {
    const contour: Contour = []
    for (let i = first; i <= last; i++) contour.push({ x: xs[i]!, y: ys[i]!, on: Boolean(flags[i]! & 1) })
    contours.push(contour)
    first = last + 1
  }
  return { kind: "simple", contours }
}

// Every glyph from WOFF2's transformed glyf table: its streams of contour
// counts, point counts, flags, coordinates and compound parts, read glyph
// by glyph. Only the outlines are kept; hinting a title has no use for.
function woff2Glyphs(table: Uint8Array): Glyph[] {
  const header = at(table)
  header.u16()
  const options = header.u16()
  const count = header.u16()
  header.u16()
  const sizes = Array.from({ length: 7 }, () => header.u32())
  let offset = header.at
  const streams = sizes.map((size) => {
    const stream = at(table.subarray(offset, offset + size))
    offset += size
    return stream
  })
  const [contourStream, pointStream, flagStream, glyphStream, compositeStream, boxStream, instructionStream] = streams as [Reader, Reader, Reader, Reader, Reader, Reader, Reader]
  void options
  void instructionStream
  // The bounding boxes' bitmap comes first in its stream; the boxes
  // themselves are of no use to a title.
  void boxStream
  const glyphs: Glyph[] = []
  for (let id = 0; id < count; id++) {
    const contours = contourStream.i16()
    if (contours === 0) {
      glyphs.push({ kind: "empty" })
      continue
    }
    if (contours < 0) {
      const { parts, instructions } = readParts(compositeStream)
      if (instructions) glyphStream.u255()
      glyphs.push({ kind: "compound", parts })
      continue
    }
    const points: number[] = []
    for (let c = 0; c < contours; c++) points.push(pointStream.u255())
    const total = points.reduce((sum, n) => sum + n, 0)
    let x = 0
    let y = 0
    const all: Point[] = []
    for (let p = 0; p < total; p++) {
      const flag = flagStream.u8()
      const on = !(flag & 0x80)
      const kind = flag & 0x7f
      const sign = (bit: number, value: number) => (bit & 1 ? value : -value)
      let dx: number
      let dy: number
      if (kind < 10) {
        dx = 0
        dy = sign(kind, ((kind & 14) << 7) + glyphStream.u8())
      } else if (kind < 20) {
        dx = sign(kind, (((kind - 10) & 14) << 7) + glyphStream.u8())
        dy = 0
      } else if (kind < 84) {
        const b0 = kind - 20
        const b1 = glyphStream.u8()
        dx = sign(kind, 1 + (b0 & 0x30) + (b1 >> 4))
        dy = sign(kind >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f))
      } else if (kind < 120) {
        const b0 = kind - 84
        dx = sign(kind, 1 + (Math.floor(b0 / 12) << 8) + glyphStream.u8())
        dy = sign(kind >> 1, 1 + (((b0 % 12) >> 2) << 8) + glyphStream.u8())
      } else if (kind < 124) {
        const b0 = glyphStream.u8()
        const b1 = glyphStream.u8()
        const b2 = glyphStream.u8()
        dx = sign(kind, (b0 << 4) + (b1 >> 4))
        dy = sign(kind >> 1, ((b1 & 0x0f) << 8) + b2)
      } else {
        const b0 = glyphStream.u8()
        const b1 = glyphStream.u8()
        const b2 = glyphStream.u8()
        const b3 = glyphStream.u8()
        dx = sign(kind, (b0 << 8) + b1)
        dy = sign(kind >> 1, (b2 << 8) + b3)
      }
      x += dx
      y += dy
      all.push({ x, y, on })
    }
    // The glyph's instructions are counted in the glyph stream and kept in
    // their own; skipping the count is enough.
    glyphStream.u255()
    const shaped: Contour[] = []
    let first = 0
    for (const n of points) {
      shaped.push(all.slice(first, first + n))
      first += n
    }
    glyphs.push({ kind: "simple", contours: shaped })
  }
  return glyphs
}

// ---- Character maps, kerning, names ----

// Glyph ids by code point, from the Unicode subtables.
function cmapOf(table: Uint8Array) {
  const map = new Map<number, number>()
  const read = at(table, 2)
  const count = read.u16()
  const subtables: { platform: number; encoding: number; offset: number }[] = []
  for (let i = 0; i < count; i++) subtables.push({ platform: read.u16(), encoding: read.u16(), offset: read.u32() })
  const unicode = subtables.filter(({ platform, encoding }) => (platform === 3 && (encoding === 1 || encoding === 10)) || platform === 0)
  for (const { offset } of unicode) {
    const sub = at(table, offset)
    const format = sub.u16()
    if (format === 4) {
      sub.at = offset + 6
      const segments = sub.u16() / 2
      const ends = offset + 14
      const starts = ends + segments * 2 + 2
      const deltas = starts + segments * 2
      const ranges = deltas + segments * 2
      const view = sub.view
      for (let s = 0; s < segments; s++) {
        const end = view.getUint16(ends + s * 2)
        const start = view.getUint16(starts + s * 2)
        const delta = view.getInt16(deltas + s * 2)
        const range = view.getUint16(ranges + s * 2)
        for (let code = start; code <= end && code !== 0xffff; code++) {
          let glyph: number
          if (range === 0) glyph = (code + delta) & 0xffff
          else {
            glyph = view.getUint16(ranges + s * 2 + range + (code - start) * 2)
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff
          }
          if (glyph && !map.has(code)) map.set(code, glyph)
        }
      }
    } else if (format === 12) {
      sub.at = offset + 12
      const groups = sub.u32()
      for (let g = 0; g < groups; g++) {
        const start = sub.u32()
        const end = sub.u32()
        const first = sub.u32()
        for (let code = start; code <= end && code - start < 0x10000; code++) if (!map.has(code)) map.set(code, first + code - start)
      }
    }
  }
  return map
}

// Kerning from GPOS pair adjustments under the "kern" feature, by glyph id
// pair: how far the second glyph moves along.
function gposKerning(gpos: Uint8Array | undefined) {
  const pairs = new Map<string, number>()
  if (!gpos) return pairs
  const view = at(gpos).view
  const u16 = (offset: number) => view.getUint16(offset)
  const i16 = (offset: number) => view.getInt16(offset)
  const features = u16(6)
  const lookups = u16(8)
  const wanted = new Set<number>()
  for (let i = 0; i < u16(features); i++) {
    const entry = features + 2 + i * 6
    if (text(gpos, entry, 4) !== "kern") continue
    const feature = features + u16(entry + 4)
    for (let j = 0; j < u16(feature + 2); j++) wanted.add(u16(feature + 4 + j * 2))
  }
  const coverage = (offset: number) => {
    const glyphs: number[] = []
    const count = u16(offset + 2)
    if (u16(offset) === 1) for (let i = 0; i < count; i++) glyphs.push(u16(offset + 4 + i * 2))
    else for (let i = 0; i < count; i++) for (let g = u16(offset + 4 + i * 6); g <= u16(offset + 6 + i * 6); g++) glyphs.push(g)
    return glyphs
  }
  const classes = (offset: number) => {
    const map = new Map<number, number>()
    if (u16(offset) === 1) {
      const first = u16(offset + 2)
      for (let i = 0; i < u16(offset + 4); i++) map.set(first + i, u16(offset + 6 + i * 2))
    } else {
      for (let i = 0; i < u16(offset + 2); i++) {
        const entry = offset + 4 + i * 6
        for (let g = u16(entry); g <= u16(entry + 2); g++) map.set(g, u16(entry + 4))
      }
    }
    return map
  }
  const bits = (format: number) => [...Array(8).keys()].filter((bit) => format & (1 << bit)).length
  const advanceIn = (offset: number, format: number) => {
    if (!(format & 4)) return 0
    return i16(offset + ((format & 1 ? 1 : 0) + (format & 2 ? 1 : 0)) * 2)
  }
  const pairPos = (sub: number) => {
    const firsts = coverage(sub + u16(sub + 2))
    const v1 = u16(sub + 4)
    const size = (bits(v1) + bits(u16(sub + 6))) * 2
    if (u16(sub) === 1) {
      firsts.forEach((left, index) => {
        const set = sub + u16(sub + 10 + index * 2)
        for (let i = 0; i < u16(set); i++) {
          const entry = set + 2 + i * (2 + size)
          const value = advanceIn(entry + 2, v1)
          const key = `${left},${u16(entry)}`
          if (value && !pairs.has(key)) pairs.set(key, value)
        }
      })
    } else {
      const left = classes(sub + u16(sub + 8))
      const right = classes(sub + u16(sub + 10))
      const count1 = u16(sub + 12)
      const count2 = u16(sub + 14)
      const byClass = new Map<number, number[]>()
      for (const [glyph, cls] of right) byClass.set(cls, [...(byClass.get(cls) ?? []), glyph])
      for (const first of firsts) {
        const c1 = left.get(first) ?? 0
        if (c1 >= count1) continue
        for (let c2 = 0; c2 < count2; c2++) {
          const value = advanceIn(sub + 16 + (c1 * count2 + c2) * size, v1)
          if (!value) continue
          for (const second of byClass.get(c2) ?? []) {
            const key = `${first},${second}`
            if (!pairs.has(key)) pairs.set(key, value)
          }
        }
      }
    }
  }
  for (let i = 0; i < u16(lookups); i++) {
    if (!wanted.has(i)) continue
    const lookup = lookups + u16(lookups + 2 + i * 2)
    const type = u16(lookup)
    for (let j = 0; j < u16(lookup + 4); j++) {
      let sub = lookup + u16(lookup + 6 + j * 2)
      let kind = type
      if (type === 9) {
        kind = u16(sub + 2)
        sub += view.getUint32(sub + 4)
      }
      if (kind === 2) pairPos(sub)
    }
  }
  return pairs
}

// Kerning from the older kern table, its first horizontal subtable, for a
// font with no GPOS kerning.
function kernTable(kern: Uint8Array | undefined) {
  const pairs = new Map<string, number>()
  if (!kern || kern.length < 18) return pairs
  const view = at(kern).view
  if (view.getUint16(0) !== 0) return pairs
  const pairCount = view.getUint16(10)
  for (let i = 0; i < pairCount; i++) {
    const entry = 18 + i * 6
    if (entry + 6 > kern.length) break
    pairs.set(`${view.getUint16(entry)},${view.getUint16(entry + 2)}`, view.getInt16(entry + 4))
  }
  return pairs
}

// The font's family name, its typographic one where it gives one.
function familyOf(name: Uint8Array | undefined) {
  if (!name) return ""
  const view = at(name).view
  const count = view.getUint16(2)
  const strings = view.getUint16(4)
  const found = new Map<number, string>()
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 12
    const platform = view.getUint16(entry)
    const id = view.getUint16(entry + 6)
    const length = view.getUint16(entry + 8)
    const offset = strings + view.getUint16(entry + 10)
    if ((id !== 1 && id !== 16) || found.has(id)) continue
    let value = ""
    if (platform === 3 || platform === 0) for (let c = 0; c < length; c += 2) value += String.fromCharCode(view.getUint16(offset + c))
    else value = text(name, offset, length)
    found.set(id, value)
  }
  return found.get(16) ?? found.get(1) ?? ""
}

// ---- Reading a font ----

const bytesOf = (data: Uint8Array | ArrayBuffer) => (data instanceof Uint8Array ? data : new Uint8Array(data))

// A font from its file's bytes, ready to set titles in: pass it as a title's
// `font`. TTF, OpenType with TrueType outlines, WOFF or WOFF2; one face, at
// its own weight (a variable font at its default one).
// How much ink a horizontal line at `y` crosses, through the outline's
// points: near enough for telling a foot from a stem.
function inkAcross(contours: Contour[], y: number) {
  const crossings: number[] = []
  for (const contour of contours) {
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i]!
      const b = contour[(i + 1) % contour.length]!
      if (a.y <= y !== b.y <= y) crossings.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
    }
  }
  crossings.sort((a, b) => a - b)
  let sum = 0
  for (let i = 0; i + 1 < crossings.length; i += 2) sum += crossings[i + 1]! - crossings[i]!
  return sum
}

/**
 * Reads a site's own font file (TTF, WOFF or WOFF2 bytes) so a title can be
 * drawn in it: `brand.og({ title, drawTitle: { font: await loadFont(bytes) } })`.
 * Imported from the package root, not from `/png`.
 */
export async function loadFont(data: Uint8Array | ArrayBuffer): Promise<TitleFont> {
  if (!(data instanceof Uint8Array) && !(data instanceof ArrayBuffer)) {
    throw new Error("Expected the font file's bytes, as from readFile(\"public/fonts/Brand.woff2\")")
  }
  const bytes = bytesOf(data)
  if (bytes.length < 12) throw new Error("That isn't a font file: it is too short to be one")
  if (bytes.length > MOST_FONT_BYTES) throw new Error(`Expected a font file under ${MOST_FONT_BYTES / 1024 / 1024} MB; give one face, not a whole family`)
  try {
    return await readFont(bytes)
  } catch (error) {
    // What this file says itself; anything else is a read past what the file
    // holds, from a file cut short or damaged.
    if (error instanceof Error && error.constructor === Error) throw error
    throw new Error(`This font file is damaged or cut short, so it can't be read; give the file as the site serves it, a TTF, WOFF or WOFF2`)
  }
}

async function readFont(bytes: Uint8Array): Promise<TitleFont> {
  const signature = text(bytes, 0, 4)
  let tables: Map<string, Uint8Array>
  let transformed = new Set<string>()
  if (signature === "wOF2") ({ tables, transformed } = await woff2Tables(bytes))
  else if (signature === "wOFF") tables = await woffTables(bytes)
  else if (signature === "\x00\x01\x00\x00" || signature === "true") tables = sfntTables(bytes)
  else if (signature === "OTTO") throw new Error("This font draws with PostScript (CFF) outlines, which titles can't use yet; give its TTF, WOFF or WOFF2 with TrueType outlines")
  else if (signature === "ttcf") throw new Error("This file is a collection of fonts (a .ttc); give the file of one face, a .ttf or .woff2")
  else throw new Error("That isn't a font file: expected a TTF, OTF, WOFF or WOFF2")
  if (tables.has("CFF ") || tables.has("CFF2")) throw new Error("This font draws with PostScript (CFF) outlines, which titles can't use yet; give its TTF, WOFF or WOFF2 with TrueType outlines")
  for (const tag of ["head", "hhea", "hmtx", "cmap", "glyf"]) {
    if (!tables.has(tag)) throw new Error(`This font has no ${tag} table, so a title can't be set in it`)
  }

  const head = at(tables.get("head")!)
  head.at = 18
  const units = head.u16()
  if (units < 16 || units > 16384) throw new Error(`This font file is damaged: its em is ${units} units, where a font's is 16 to 16384`)
  head.at = 50
  const long = head.i16() === 1
  const hhea = at(tables.get("hhea")!)
  hhea.at = 6
  const descender = hhea.i16()
  hhea.at = 34
  const metrics = hhea.u16()
  if (!metrics) throw new Error("This font file is damaged: it gives no glyph a width")
  const glyphCount = tables.has("maxp") ? at(tables.get("maxp")!, 4).u16() : 0

  // Advances: plain, or from WOFF2's transformed hmtx, whose advances come
  // first, after one byte of flags.
  const hmtx = tables.get("hmtx")!
  const hmtxStart = transformed.has("hmtx") ? 1 : 0
  const stride = transformed.has("hmtx") ? 2 : 4
  const advanceOf = (glyph: number) => at(hmtx).view.getUint16(hmtxStart + Math.min(glyph, metrics - 1) * stride)

  let cap = Math.round(units * 0.7)
  let weight = 400
  let serif: boolean | undefined
  const os2 = tables.get("OS/2")
  if (os2) {
    const read = at(os2).view
    weight = read.getUint16(4)
    // PANOSE's serif style, where the font gives it: 11 to 13 are the sans.
    const family = read.getUint8(32)
    const style = read.getUint8(33)
    if (family === 2 && style >= 2) serif = style <= 10
    if (read.getUint16(0) >= 2 && os2.length >= 90) cap = read.getInt16(88)
  }

  // Glyph outlines, read when asked for.
  const glyphOf: (id: number) => Glyph = transformed.has("glyf")
    ? (() => {
        const all = woff2Glyphs(tables.get("glyf")!)
        return (id: number) => all[id] ?? { kind: "empty" }
      })()
    : (id: number) => glyfGlyph(tables.get("glyf")!, tables.get("loca")!, long, id)
  // A glyph built of others, as an accented letter is of its letter and
  // mark, to so many parts at most: a real one has a handful.
  let parts = 0
  const resolve = (id: number, depth = 0): Contour[] => {
    const glyph = glyphOf(id)
    if (depth === 0) parts = 0
    if (glyph.kind === "simple") return glyph.contours
    if (glyph.kind === "empty" || depth > 8) return []
    parts += glyph.parts.length
    if (parts > 512) throw new Error("This font file is damaged: a glyph is built of too many others")
    return glyph.parts.flatMap((part) =>
      resolve(part.glyph, depth + 1).map((contour) =>
        contour.map((p) => ({ x: Math.round(p.x * part.a + p.y * part.c + part.dx), y: Math.round(p.x * part.b + p.y * part.d + part.dy), on: p.on }))
      )
    )
  }

  // Everything on a grid of a thousand units to the em, as the bundled faces.
  const cmap = cmapOf(tables.get("cmap")!)
  // Many fonts leave PANOSE empty; then the T says: a serif's stands on a
  // foot wider than its stem.
  if (serif === undefined) {
    const t = cmap.get(0x54)
    serif = t !== undefined && inkAcross(resolve(t), cap * 0.04) > 1.5 * inkAcross(resolve(t), cap * 0.5)
  }
  const q = (value: number) => Math.round((value * 1000) / units)
  const advance = new Map<number, number>()
  // Every character a glyph draws, as one glyph often serves several: a
  // hyphen and a soft hyphen.
  const codesOf = new Map<number, number[]>()
  for (const [code, glyph] of cmap) {
    if (glyphCount && glyph >= glyphCount) continue
    advance.set(code, q(advanceOf(glyph)))
    if (code <= 0x24f || (code >= 0x2000 && code <= 0x20cf)) codesOf.set(glyph, [...(codesOf.get(glyph) ?? []), code])
  }
  // Kerning between the characters a title is likely to use, Latin and
  // punctuation, as the bundled faces keep it: big enough to see.
  const byGlyph = gposKerning(tables.get("GPOS"))
  if (!byGlyph.size) for (const [key, value] of kernTable(tables.get("kern"))) byGlyph.set(key, value)
  const kern = new Map<string, number>()
  for (const [key, value] of byGlyph) {
    if (Math.abs(value) < units * 0.008) continue
    const [left, right] = key.split(",").map(Number) as [number, number]
    for (const a of codesOf.get(left) ?? []) for (const b of codesOf.get(right) ?? []) kern.set(`${String.fromCodePoint(a)}${String.fromCodePoint(b)}`, q(value))
  }

  const outlines = new Map<number, Contour[]>()
  const family = familyOf(tables.get("name")) || "Title"
  // A key from the file itself, so one font always names itself the same.
  let digest = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) digest = Math.imul(digest ^ bytes[i]!, 0x01000193)
  const font: TitleFont = {
    kind: "font",
    key: `font:${hash(`${family}/${weight}/${bytes.length}/${digest >>> 0}`).toString(36)}`,
    family,
    weight,
    serif: serif === true,
    cap: q(cap),
    descent: Math.abs(q(descender)),
    advance,
    kern,
    contours(code) {
      let found = outlines.get(code)
      if (!found) {
        const glyph = cmap.get(code)
        try {
          found = glyph === undefined ? [] : resolve(glyph).map((contour) => contour.map((p) => ({ x: q(p.x), y: q(p.y), on: p.on })))
        } catch {
          // A damaged glyph past the ones checked below is left blank.
          found = []
        }
        outlines.set(code, found)
      }
      return found
    },
  }
  // Every character a title is likely to use is read now, so a damaged file
  // says so here, not halfway through drawing.
  for (const codes of codesOf.values()) {
    for (const code of codes) {
      const glyph = cmap.get(code)!
      const contours = resolve(glyph)
      if (contours.some((contour) => contour.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))) throw new Error("This font file is damaged: a letter's outline isn't readable")
      outlines.set(code, contours.map((contour) => contour.map((p) => ({ x: q(p.x), y: q(p.y), on: p.on }))))
    }
  }
  return font
}
