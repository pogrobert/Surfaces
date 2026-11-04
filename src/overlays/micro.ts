import type { Rng } from "../core/random.ts"
import type { Box, Layer, Shape } from "../core/scene.ts"
import { boxesTouch, inflate } from "../layouts/geometry.ts"

// Micrographics: the small print of technical drawings laid over the art. Crop
// marks, a ruler, a figure label, a crosshair on the subject and a
// registration mark. The type is a 3 by 5 pixel face drawn as blocks, so it
// needs no font and reads the same in every renderer and rasteriser.
const FONT: Record<string, string> = {
  "0": "111101101101111",
  "1": "010110010010111",
  "2": "111001111100111",
  "3": "111001111001111",
  "4": "101101111001001",
  "5": "111100111001111",
  "6": "111100111101111",
  "7": "111001010010010",
  "8": "111101111101111",
  "9": "111101111001111",
  A: "010101111101101",
  B: "110101110101110",
  C: "011100100100011",
  D: "110101101101110",
  E: "111100110100111",
  F: "111100110100100",
  G: "011100101101011",
  H: "101101111101101",
  I: "111010010010111",
  K: "101101110101101",
  L: "100100100100111",
  M: "101111111101101",
  N: "110101101101101",
  O: "010101101101010",
  P: "110101110100100",
  R: "110101110101101",
  S: "011100010001110",
  T: "111010010010010",
  U: "101101101101111",
  V: "101101101101010",
  W: "101101111111101",
  X: "101101010101101",
  Y: "101101010010010",
  ".": "000000000000010",
  "-": "000000111000000",
  "/": "001001010100100",
  ":": "000010000010000",
  "+": "000010111010000",
  "#": "101111101111101",
  " ": "000000000000000",
}

export type MicroFrame = {
  w: number
  h: number
  // Every box kept clear for content; none when there is no content.
  keep: readonly Box[]
  subject: Box | undefined
  output: { w: number; h: number }
  rng: Rng
  // Only the crop and registration marks, for art too soft or too busy to
  // carry a ruler and a label without them reading as noise.
  marksOnly: boolean
}

// Text as blocks, one row of pixels at a time, with runs merged.
function text(value: string, x: number, y: number, px: number, points: number[]) {
  let cursor = x
  for (const char of value) {
    const glyph = FONT[char] ?? FONT[" "]!
    for (let row = 0; row < 5; row++) {
      let run = -1
      for (let col = 0; col <= 3; col++) {
        const on = col < 3 && glyph[row * 3 + col] === "1"
        if (on && run < 0) run = col
        if (!on && run >= 0) {
          points.push(cursor + run * px, y + row * px, (col - run) * px)
          run = -1
        }
      }
    }
    cursor += px * 4
  }
  return { x, y, w: value.length * px * 4 - px, h: px * 5 }
}

const hex = (value: number) => value.toString(16).toUpperCase().padStart(6, "0").slice(-6)

export function micrographics({ w, h, keep, subject, output, rng, marksOnly }: MicroFrame): Layer[] {
  // Sized to the canvas's short side, so it still reads when a cover is shown
  // at a third of its size, as in a card: small print, but print, not specks.
  const px = Math.max(1.3, Math.min(w, h) * 0.0042)
  const line = px * 0.6
  const inset = Math.min(w, h) * 0.04
  const keepOff = keep.length ? inflate(keep, Math.min(w, h) * 0.04) : null
  const pixels: number[] = []
  const rules: Shape[] = []
  const rings: Shape[] = []
  const clear = (box: Box) => !keepOff || !boxesTouch(box, keepOff)
  const rect = (x: number, y: number, rw: number, rh: number): Shape => ({
    type: "rect",
    x,
    y,
    w: rw,
    h: rh,
    radii: [0, 0, 0, 0],
  })

  // Every element takes its draws whether it is drawn or not.
  const figure = rng.int(1, 24)
  const code = hex(rng.int(0, 0xffffff))
  const ruleOnRight = rng.next() < 0.5
  const labelCorner = rng.int(0, 3)
  const markCorner = (labelCorner + 2) % 4

  // Crop marks at the four corners.
  const arm = px * 7
  for (const [cx, cy, sx, sy] of [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ] as const) {
    const box = { x: Math.min(cx, cx + sx * arm), y: Math.min(cy, cy + sy * arm), w: arm, h: arm }
    if (!clear(box)) continue
    rules.push(rect(sx > 0 ? cx : cx - arm, cy - line / 2, arm, line))
    rules.push(rect(cx - line / 2, sy > 0 ? cy : cy - arm, line, arm))
  }

  // A ruler down one side, with a long tick every fifth and a number every
  // tenth, counting in the output's own pixels.
  const step = px * 5
  const ticks = marksOnly ? -1 : Math.floor((h - inset * 4) / step)
  const rx = ruleOnRight ? w - inset : inset
  for (let i = 0; i <= ticks; i++) {
    const y = inset * 2 + i * step
    const long = i % 5 === 0
    const size = long ? px * 4 : px * 2
    const x = ruleOnRight ? rx - size : rx
    if (!clear({ x, y: y - line, w: size, h: line * 2 })) continue
    rules.push(rect(x, y - line / 2, size, line))
    if (i % 10 === 0 && i > 0) {
      const label = String(Math.round((y / h) * output.h))
      const lx = ruleOnRight ? rx - px * 6 - label.length * px * 4 : rx + px * 6
      const box = { x: lx, y: y - px * 2.5, w: label.length * px * 4, h: px * 5 }
      if (clear(box)) text(label, lx, y - px * 2.5, px * 0.8, pixels)
    }
  }

  // The figure label in one corner, the registration mark in the opposite one.
  const corner = (index: number, bw: number, bh: number) => ({
    x: index % 2 ? w - inset * 1.6 - bw : inset * 1.6,
    y: index < 2 ? inset * 1.6 : h - inset * 1.6 - bh,
  })
  const lines = [`FIG. ${String(figure).padStart(2, "0")}`, `S/${code}`, `${output.w}X${output.h}`]
  const labelW = Math.max(...lines.map((value) => value.length)) * px * 4
  const labelH = lines.length * px * 7
  // The seed's corner first, then the others, for one clear of the content
  // and of the subject: small print beside the art, not printed over it.
  let placed = labelCorner
  for (let turn = 0; turn < 4; turn++) {
    const index = (labelCorner + turn) % 4
    const box = { ...corner(index, labelW, labelH), w: labelW, h: labelH }
    if (clear(box) && !(subject && boxesTouch(box, subject))) {
      placed = index
      break
    }
  }
  const at = corner(placed, labelW, labelH)
  if (!marksOnly && clear({ x: at.x, y: at.y, w: labelW, h: labelH })) {
    lines.forEach((value, index) => text(value, at.x, at.y + index * px * 7, px, pixels))
  }
  const mark = px * 6
  const mAt = corner(marksOnly ? markCorner : (placed + 2) % 4, mark * 2, mark * 2)
  if (clear({ x: mAt.x, y: mAt.y, w: mark * 2, h: mark * 2 })) {
    const cx = mAt.x + mark
    const cy = mAt.y + mark
    rings.push({ type: "ring", cx, cy, r: mark * 0.62, inner: mark * 0.62 - line })
    rules.push(rect(cx - mark, cy - line / 2, mark * 2, line))
    rules.push(rect(cx - line / 2, cy - mark, line, mark * 2))
  }

  // A crosshair on the subject, if there is one and it is clear of the title.
  if (subject && !marksOnly) {
    const cx = subject.x + subject.w / 2
    const cy = subject.y + subject.h / 2
    const reach = px * 9
    if (clear({ x: cx - reach, y: cy - reach, w: reach * 2, h: reach * 2 })) {
      rules.push(rect(cx - reach, cy - line / 2, reach * 0.6, line))
      rules.push(rect(cx + reach * 0.4, cy - line / 2, reach * 0.6, line))
      rules.push(rect(cx - line / 2, cy - reach, line, reach * 0.6))
      rules.push(rect(cx - line / 2, cy + reach * 0.4, line, reach * 0.6))
      rings.push({ type: "ring", cx, cy, r: reach * 0.25, inner: reach * 0.25 - line })
    }
  }

  return [
    {
      kind: "shapes",
      id: "micro",
      paint: { type: "solid", tone: "ink", opacity: 0.6 },
      shapes: [...rules, { type: "blocks", h: px, points: pixels }],
    },
    {
      kind: "shapes",
      id: "micro-rings",
      paint: { type: "solid", tone: "ink", opacity: 0.6 },
      shapes: rings,
    },
  ]
}
