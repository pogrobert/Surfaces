import { cos, PI } from "../core/math.ts"

// A baseline JPEG from RGBA pixels, with no dependencies, for link previews:
// film grain is noise, which a PNG can't squeeze, and some apps drop a preview
// image of more than a few hundred kilobytes. Colour is kept at half
// resolution (4:2:0), as cameras keep it; a title's edges are in the light,
// which is kept whole. The tables are the standard ones from the JPEG
// specification, scaled by quality the way libjpeg scales them.

const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35,
  42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62,
  63,
]
const LUMA = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80,
  62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98,
  112, 100, 103, 99,
]
const CHROMA = [
  17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
  99, 99,
]

// The standard Huffman tables: code counts by length, then the symbols.
const DC_LUMA = { counts: [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], symbols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
const DC_CHROMA = { counts: [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], symbols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
const AC_LUMA = {
  counts: [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d],
  symbols: [
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
    0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16,
    0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
    0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94,
    0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
    0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8,
    0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa,
  ],
}
const AC_CHROMA = {
  counts: [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77],
  symbols: [
    0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81,
    0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34,
    0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44,
    0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
    0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92,
    0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4,
    0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6,
    0xd7, 0xd8, 0xd9, 0xda, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa,
  ],
}

type Table = { counts: number[]; symbols: number[] }
type Codes = Map<number, [code: number, length: number]>

// Each symbol's code, from the counts as the specification assigns them.
function codesOf({ counts, symbols }: Table): Codes {
  const codes: Codes = new Map()
  let code = 0
  let index = 0
  for (let length = 1; length <= 16; length++) {
    for (let i = 0; i < counts[length - 1]!; i++) codes.set(symbols[index++]!, [code++, length])
    code <<= 1
  }
  return codes
}

// A quality from 1 to 100 turns the base table into the one used, in zigzag.
function scaled(base: number[], quality: number) {
  const q = Math.min(100, Math.max(1, Math.round(quality)))
  const factor = q < 50 ? 5000 / q : 200 - q * 2
  return ZIGZAG.map((index) => Math.min(255, Math.max(1, Math.floor((base[index]! * factor + 50) / 100))))
}

// The cosines of the 8 by 8 transform, worked out once.
const COSINES = Array.from({ length: 64 }, (_, i) => cos(((2 * (i >> 3) + 1) * (i & 7) * PI) / 16))
const C0 = 1 / Math.SQRT2

class Bits {
  bytes: number[] = []
  private value = 0
  private count = 0
  write(code: number, length: number) {
    for (let bit = length - 1; bit >= 0; bit--) {
      this.value = (this.value << 1) | ((code >> bit) & 1)
      if (++this.count === 8) this.flush()
    }
  }
  private flush() {
    this.bytes.push(this.value)
    // A byte of all ones is followed by a zero, so it isn't read as a marker.
    if (this.value === 0xff) this.bytes.push(0)
    this.value = 0
    this.count = 0
  }
  end() {
    while (this.count) this.write(1, 1)
  }
}

// The number of bits a coefficient takes, and its bits as JPEG writes them.
function category(value: number): [size: number, bits: number] {
  const magnitude = Math.abs(value)
  let size = 0
  while (magnitude >> size) size++
  return [size, value < 0 ? value + (1 << size) - 1 : value]
}

export function encodeJpeg(pixels: Uint8Array, width: number, height: number, quality = 86): Uint8Array {
  const lumaTable = scaled(LUMA, quality)
  const chromaTable = scaled(CHROMA, quality)
  const codes = { dcLuma: codesOf(DC_LUMA), acLuma: codesOf(AC_LUMA), dcChroma: codesOf(DC_CHROMA), acChroma: codesOf(AC_CHROMA) }
  const bits = new Bits()
  const previous = [0, 0, 0]

  // The colour of a pixel, its edges repeated past the image.
  const at = (x: number, y: number) => (Math.min(y, height - 1) * width + Math.min(x, width - 1)) * 4
  const block = new Float64Array(64)
  const rows = new Float64Array(64)
  const coefficients = new Float64Array(64)

  function encode(component: number, table: number[], dc: Codes, ac: Codes) {
    // The transform down the columns, then along the rows.
    for (let v = 0; v < 8; v++) {
      for (let x = 0; x < 8; x++) {
        let sum = 0
        for (let y = 0; y < 8; y++) sum += block[y * 8 + x]! * COSINES[y * 8 + v]!
        rows[v * 8 + x] = sum
      }
    }
    for (let v = 0; v < 8; v++) {
      for (let u = 0; u < 8; u++) {
        let sum = 0
        for (let x = 0; x < 8; x++) sum += rows[v * 8 + x]! * COSINES[x * 8 + u]!
        coefficients[v * 8 + u] = 0.25 * (u ? 1 : C0) * (v ? 1 : C0) * sum
      }
    }
    const quantised = ZIGZAG.map((index, k) => Math.round(coefficients[index]! / table[k]!))
    const [size, value] = category(quantised[0]! - previous[component]!)
    previous[component] = quantised[0]!
    const [dcCode, dcLength] = dc.get(size)!
    bits.write(dcCode, dcLength)
    if (size) bits.write(value, size)
    let zeros = 0
    for (let k = 1; k < 64; k++) {
      const coefficient = quantised[k]!
      if (!coefficient) {
        zeros++
        continue
      }
      while (zeros > 15) {
        const [code, length] = ac.get(0xf0)!
        bits.write(code, length)
        zeros -= 16
      }
      const [acSize, acValue] = category(coefficient)
      const [code, length] = ac.get((zeros << 4) | acSize)!
      bits.write(code, length)
      bits.write(acValue, acSize)
      zeros = 0
    }
    if (zeros) {
      const [code, length] = ac.get(0)!
      bits.write(code, length)
    }
  }

  // Each 16 by 16 square: four blocks of light, then one each of the two
  // colours, averaged over every four pixels.
  const luma = (i: number) => 0.299 * pixels[i]! + 0.587 * pixels[i + 1]! + 0.114 * pixels[i + 2]!
  const blue = (i: number) => -0.168736 * pixels[i]! - 0.331264 * pixels[i + 1]! + 0.5 * pixels[i + 2]!
  const red = (i: number) => 0.5 * pixels[i]! - 0.418688 * pixels[i + 1]! - 0.081312 * pixels[i + 2]!
  for (let top = 0; top < height; top += 16) {
    for (let left = 0; left < width; left += 16) {
      for (const [dx, dy] of [[0, 0], [8, 0], [0, 8], [8, 8]] as const) {
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) block[y * 8 + x] = luma(at(left + dx + x, top + dy + y)) - 128
        encode(0, lumaTable, codes.dcLuma, codes.acLuma)
      }
      for (const [component, channel] of [[1, blue], [2, red]] as const) {
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const px = left + x * 2
            const py = top + y * 2
            block[y * 8 + x] = (channel(at(px, py)) + channel(at(px + 1, py)) + channel(at(px, py + 1)) + channel(at(px + 1, py + 1))) / 4
          }
        }
        encode(component, chromaTable, codes.dcChroma, codes.acChroma)
      }
    }
  }
  bits.end()

  const out: number[] = []
  const word = (value: number) => out.push(value >> 8, value & 0xff)
  const segment = (marker: number, body: number[]) => {
    word(marker)
    word(body.length + 2)
    out.push(...body)
  }
  word(0xffd8)
  segment(0xffe0, [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0])
  segment(0xffdb, [0, ...lumaTable, 1, ...chromaTable])
  segment(0xffc0, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])
  segment(0xffc4, [
    0x00, ...DC_LUMA.counts, ...DC_LUMA.symbols,
    0x10, ...AC_LUMA.counts, ...AC_LUMA.symbols,
    0x01, ...DC_CHROMA.counts, ...DC_CHROMA.symbols,
    0x11, ...AC_CHROMA.counts, ...AC_CHROMA.symbols,
  ])
  segment(0xffda, [3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0])
  const result = new Uint8Array(out.length + bits.bytes.length + 2)
  result.set(out, 0)
  result.set(bits.bytes, out.length)
  result[result.length - 2] = 0xff
  result[result.length - 1] = 0xd9
  return result
}
