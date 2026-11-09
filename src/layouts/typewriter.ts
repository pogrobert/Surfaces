import { clamp, cos, PI, sin, TAU } from "../core/math.ts"
import type { Rng } from "../core/random.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Mark, Shape, Tone } from "../core/scene.ts"
import { behind, insideOf } from "../grammar/kit.ts"
import { CAP, CAPITALS, DIGITS, KEYS } from "../grammar/keys.ts"
import type { Key } from "../grammar/keys.ts"
import { seated } from "../grammar/seated.ts"
import { inflate } from "./geometry.ts"
import { clearing } from "./stage.ts"

// Typewriter art: a picture struck in characters on the machine's own grid,
// as typists drew with the keys they had. Every subject is typed on the one
// grid, a fixed pitch across and a line down, and a key is struck whole or
// not at all, never cut: the brand's initial typed large, a lit sphere, a
// page of text swelling into a shape, or a table of figures.

export const SUBJECTS = ["initial", "sphere", "page", "columns"] as const
export type Subject = (typeof SUBJECTS)[number]

export type TypewriterParams = {
  size: number
  // Characters across the canvas's short side.
  pitch: number
  contrast: number
  // Where the light comes from, in degrees.
  light: number
}

type Strike = { x: number; y: number; key: Key; tone: Tone }

// Ink from 0 to 1 as a key and a tone: the ramp from a full stop to a hash,
// the deeper keys in the deeper tones.
function keyFor(ink: number): { key: Key; tone: Tone } {
  const key = KEYS[Math.min(KEYS.length - 1, Math.floor(ink * KEYS.length))]!
  const tone: Tone = ink > 0.8 ? "ink" : ink > 0.56 ? "strong" : ink > 0.32 ? "accent" : "body"
  return { key, tone }
}

// A slow texture over the sheet, -1 to 1, so a tone typed flat still varies
// as a ribbon's ink does.
function texture(rng: Rng, side: number) {
  const waves = Array.from({ length: 3 }, (_, i) => {
    const a = rng.next() * TAU
    const k = (TAU / side) * (1.2 + i * 0.9)
    return { cx: cos(a) * k, cy: sin(a) * k, phase: rng.next() * TAU }
  })
  return (x: number, y: number) => waves.reduce((sum, wave) => sum + sin(wave.cx * x + wave.cy * y + wave.phase), 0) / waves.length
}

// The brand's initial: the first letter of its seed, which a brand's covers
// begin with its name. A seed with no Latin letter takes one of a few that
// stand well on their own.
export function initialOf(seed: string, rng: Rng) {
  const letter = seed
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .match(/[A-Z]/)?.[0]
  return CAPITALS.find((key) => key.char === letter) ?? rng.pick(CAPITALS.filter((key) => "AEMORS".includes(key.char)))
}

export function typewriter(frame: Frame & { seed: string }, subject: Subject, p: TypewriterParams): Art {
  const { w, h, keep, titled, rng } = frame
  const draw = rng.fork("typewriter")
  const stage = frame.fill ? { area: { x: 0, y: 0, w, h }, away: { x: 0, y: -1 } } : clearing(frame)
  const seat = seated(frame, stage, p.size, draw)
  // Round a title in the middle it is drawn larger, to show past the
  // clearing, but no larger than a typist would fill: every key is struck.
  const side = Math.min(behind(frame, seat.side, 0.85), Math.max(seat.side, Math.min(w, h) * 1.3))
  const { x: cx, y: cy } = seat
  const cell = Math.min(w, h) / p.pitch
  const line = cell * 1.3
  const lit = (p.light / 180) * PI
  const grain = texture(draw.fork("texture"), Math.min(w, h))
  // No key is struck on the title, or within a margin of it, nor under the
  // clearing a title in the middle stands on: a typist leaves its space.
  const clear = [...(titled ? inflate(keep, cell * 1.2) : []), ...inflate(frame.calm, cell * 0.6)]
  const onTitle = (x: number, y: number) => clear.some((box) => x > box.x && x < box.x + box.w && y > box.y && y < box.y + box.h)

  // The ink a subject wants at each point, or nothing for no key there, and
  // the box it keeps inside.
  let inkAt: (x: number, y: number, column: number, row: number) => number | undefined
  let own: Box | undefined
  // Figures in a table are typed as written, not shaded, so a subject may
  // name the key itself.
  let keyAt: ((column: number, row: number) => { key: Key; tone: Tone } | undefined) | undefined

  // How lit a point on a round thing is: bright where it faces the light,
  // deep where it turns away.
  const shade = (u: number, v: number) => {
    const z = Math.sqrt(Math.max(0, 1 - u * u - v * v))
    const facing = Math.max(0, (u * cos(lit) + v * sin(lit)) * 0.62 + z * 0.78)
    return 1 - facing * p.contrast
  }

  if (subject === "initial") {
    const letter = initialOf(frame.seed, draw)
    // The capital as tall as the square, set in the middle of it.
    const scale = (side * 0.92) / CAP
    const left = cx - (letter.advance * scale) / 2
    const top = cy - (CAP * scale) / 2
    const contours = letter.contours.map((points) => points.map((value, i) => (i % 2 ? top + value * scale : left + value * scale)))
    inkAt = (x, y) => {
      if (!insideOf(contours, x, y)) return undefined
      // Lit across the letter as if it were round, so it has weight, and
      // never lighter than a colon, so its every stroke reads.
      return 0.24 + 0.76 * shade((x - cx) / (side * 0.6), (y - cy) / (side * 0.6))
    }
    own = { x: left, y: top, w: letter.advance * scale, h: CAP * scale }
  } else if (subject === "sphere") {
    const r = side / 2
    inkAt = (x, y) => {
      const u = (x - cx) / r
      const v = (y - cy) / r
      return u * u + v * v > 1 ? undefined : 0.12 + 0.88 * shade(u, v)
    }
    own = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }
  } else if (subject === "page") {
    // A page of typed text, set in a column, its middle swelling into a
    // solid round, as a concrete poem does.
    const pageW = side * 0.78
    const pageH = side
    const left = cx - pageW / 2
    const top = cy - pageH / 2
    const words = draw.fork("words")
    // Each line's spaces between words, and where it stops short, as a
    // paragraph's last line does now and then: decided once a line.
    const firstColumn = Math.ceil(left / cell)
    const across = Math.floor(pageW / cell)
    const lines = new Map<number, { gaps: Set<number>; end: number }>()
    const lineOf = (row: number) => {
      let found = lines.get(row)
      if (!found) {
        const gaps = new Set<number>()
        for (let at = Math.floor(words.between([2, 8])); at < across; at += Math.floor(words.between([3, 10]))) gaps.add(firstColumn + at)
        const end = firstColumn + (words.next() < 0.18 ? Math.floor(words.between([0.3, 0.7]) * across) : across)
        found = { gaps, end }
        lines.set(row, found)
      }
      return found
    }
    const swell = side * 0.3
    inkAt = (x, y, column, row) => {
      if (x < left || x > left + pageW || y < top || y > top + pageH) return undefined
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / swell
      // Inside the swell every key is struck, heavier toward its middle.
      if (d < 1) return clamp(0.55 + (1 - d) * 0.45, 0, 0.999)
      const text = lineOf(row)
      if (text.gaps.has(column) || column >= text.end) return undefined
      // Text: light keys, darker nearer the swell.
      return clamp(0.12 + 0.28 * Math.max(0, 1 - (d - 1) / 1.6), 0.02, 0.5)
    }
    own = { x: left, y: top, w: pageW, h: pageH }
  } else {
    // A table of figures: columns of numbers right-aligned, a rule typed under
    // the heading and above the total, one column in the brand's colour.
    // A table is a page's width at most, even round a title in the middle.
    const across = Math.min(side, Math.min(w, h) * 1.05)
    const tableW = across * 0.92
    const tableH = across * 0.86
    const left = cx - tableW / 2
    const top = cy - tableH / 2
    const columns = Math.max(3, Math.floor(tableW / cell / 7))
    const width = Math.floor(tableW / cell / columns)
    const rows = Math.floor(tableH / line)
    const figures = draw.fork("figures")
    const coloured = figures.int(0, columns - 1)
    const digits = new Map<string, number>()
    const firstColumn = Math.round(left / cell)
    const firstRow = Math.round(top / line)
    keyAt = (column, row) => {
      const c = column - firstColumn
      const r = row - firstRow
      if (c < 0 || r < 0 || r >= rows || c >= columns * width) return undefined
      const which = Math.floor(c / width)
      const at = c % width
      // A rule under the heading and over the total.
      if (r === 1 || r === rows - 2) return at < width - 1 ? { key: KEYS[2]!, tone: "body" } : undefined
      // Figures right-aligned, a decimal point two from the end.
      const key = `${which}:${r}`
      let length = digits.get(key)
      if (length === undefined) {
        length = r === 0 ? figures.int(2, width - 2) : figures.int(3, width - 1)
        digits.set(key, length)
      }
      const fromEnd = width - 2 - at
      if (fromEnd < 0 || fromEnd >= length) return undefined
      if (fromEnd === 2 && r !== 0) return { key: KEYS[0]!, tone: "body" }
      const digit = DIGITS[hashDigit(which, r, fromEnd, figures)]!
      const tone: Tone = r === 0 ? "body" : which === coloured ? "accent" : r === rows - 1 ? "ink" : "strong"
      return { key: digit, tone }
    }
    inkAt = () => undefined
    own = { x: left, y: top, w: tableW, h: tableH }
  }

  // Strike every key the subject wants, on the grid, whole.
  const strikes: Strike[] = []
  const cols = Math.ceil(w / cell)
  const rowsDown = Math.ceil(h / line)
  for (let row = 0; row < rowsDown; row++) {
    for (let column = 0; column < cols; column++) {
      const x = (column + 0.5) * cell
      const y = (row + 0.5) * line
      if (onTitle(x, y)) continue
      const named = keyAt?.(column, row)
      if (named) {
        strikes.push({ x, y, ...named })
        continue
      }
      const ink = inkAt(x, y, column, row)
      if (ink === undefined) continue
      strikes.push({ x, y, ...keyFor(clamp(ink + grain(x, y) * 0.1, 0.02, 0.999)) })
    }
  }

  const size = cell / 0.62
  const scale = size / 1000
  const groups = new Map<Tone, Shape[]>()
  for (const { x, y, key, tone } of strikes) {
    const left = x - (key.advance * scale) / 2
    const top = y - (CAP * scale) / 2
    const shapes = groups.get(tone) ?? []
    for (const contour of key.contours) {
      const points: number[] = []
      for (let i = 0; i < contour.length; i += 2) points.push(left + contour[i]! * scale, top + contour[i + 1]! * scale)
      shapes.push({ type: "polygon", points })
    }
    groups.set(tone, shapes)
  }
  const marks: Mark[] = [...groups].map(([tone, shapes]) => ({ kind: "shapes", id: `keys-${tone}`, paint: { type: "solid", tone, opacity: 1 }, shapes }))
  const struck = strikes.length ? boundsOfStrikes(strikes, cell, line) : undefined
  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks,
    over: [],
    ...(own && struck ? { subject: intersect(own, struck) } : null),
  }
}

// A digit for a place in the table, the same every time it is asked.
function hashDigit(column: number, row: number, place: number, rng: Rng) {
  return Math.floor(rng.fork(`${column}/${row}/${place}`).next() * 10)
}

function boundsOfStrikes(strikes: Strike[], cell: number, line: number): Box {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const { x, y } of strikes) {
    x0 = Math.min(x0, x - cell / 2)
    y0 = Math.min(y0, y - line / 2)
    x1 = Math.max(x1, x + cell / 2)
    y1 = Math.max(y1, y + line / 2)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function intersect(a: Box, b: Box): Box {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) }
}
