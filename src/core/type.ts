import { METRICS } from "../type/metrics.ts"
import type { Box, TextLayer } from "./scene.ts"

// Titles, set the way a designer sets one: in one of two bundled faces, as
// large as the area allows up to a sensible size, wrapped into balanced lines,
// and placed against the side of its area that the area hangs from. Layout
// uses each face's own advances and kerning, so it is exact in every
// renderer; a PNG draws the face's outlines, an SVG names the face and holds
// each line to its measured width.

export const FONTS = ["sans", "serif"] as const
export type Font = (typeof FONTS)[number]

// What the core lays out with, written by scripts/fonts.ts: in thousandths of
// the em, the advance of every character it has as base 36 pairs, and kerning
// as two characters and a signed number.
export type FaceMetrics = { ascent: number; descent: number; cap: number; advances: string; kern: string }

type Face = { advance: Map<number, number>; kern: Map<string, number>; cap: number; descent: number }
const faces = new Map<Font, Face>()

function face(font: Font): Face {
  let found = faces.get(font)
  if (!found) {
    const data = METRICS[font]
    const advance = new Map<number, number>()
    for (const entry of data.advances.split("|")) {
      const [code, width] = entry.split(":")
      advance.set(parseInt(code!, 36), parseInt(width!, 36))
    }
    const kern = new Map<string, number>()
    for (const entry of data.kern.split("|")) if (entry) kern.set(entry.slice(0, 2), Number(entry.slice(2)))
    found = { advance, kern, cap: data.cap / 1000, descent: Math.abs(data.descent) / 1000 }
    faces.set(font, found)
  }
  return found
}

// The characters of `text` a face can't draw, once each.
export function missing(text: string, font: Font = "sans") {
  const { advance } = face(font)
  return [...new Set([...text].filter((char) => !advance.has(char.codePointAt(0)!) && char !== "\n"))]
}

// A run's width in ems, kerned, and tracked: `tracking` ems between
// characters, none after the last.
function width(text: string, { advance, kern }: Face, tracking = 0) {
  let sum = 0
  let before = ""
  let count = 0
  for (const char of text) {
    sum += advance.get(char.codePointAt(0)!) ?? 0
    sum += kern.get(before + char) ?? 0
    before = char
    count++
  }
  return sum / 1000 + Math.max(count - 1, 0) * tracking
}

// How a face is set at a size: display type, a title's large sizes, tighter
// and closer than text, as a type designer sets a headline. The sans more so
// than the serif, whose letters are already close.
function setting(font: Font, size: number, display: number) {
  const large = size >= display
  return font === "sans"
    ? { tracking: large ? -0.03 : -0.014, leading: large ? 1.0 : 1.1 }
    : { tracking: large ? -0.014 : -0.004, leading: large ? 1.04 : 1.14 }
}

// Short words that read as the start of what follows, kept off a line's end
// so a line never closes on "a" or "of".
const CLINGS = new Set(["a", "an", "the", "of", "to", "in", "on", "at", "by", "for", "and", "or", "with", "from", "as", "is", "our", "your", "my", "we", "it"])

// Words into lines no wider than `limit` ems, filled greedily, and any line
// that would end on a short word that clings to the next handing it over.
function fill(words: string[], limit: number, f: Face, tracking = 0) {
  const lines: string[][] = []
  let line: string[] = []
  for (const word of words) {
    const next = [...line, word]
    if (line.length && width(next.join(" "), f, tracking) > limit) {
      lines.push(line)
      line = [word]
    } else line = next
  }
  if (line.length) lines.push(line)
  for (let index = 0; index < lines.length - 1; index++) {
    const current = lines[index]!
    const last = current.at(-1)!
    const moved = [last, ...lines[index + 1]!]
    if (current.length > 1 && CLINGS.has(last.toLowerCase()) && width(moved.join(" "), f, tracking) <= limit) {
      current.pop()
      lines[index + 1] = moved
    }
  }
  return lines.map((words) => words.join(" "))
}

// The same number of lines, as even as they go: the narrowest width that
// still takes no more lines, as CSS balances text.
function balance(words: string[], limit: number, f: Face, tracking = 0) {
  const count = fill(words, limit, f, tracking).length
  let low = Math.max(...words.map((word) => width(word, f, tracking)))
  let high = limit
  for (let step = 0; step < 16 && high - low > 0.01; step++) {
    const middle = (low + high) / 2
    if (fill(words, middle, f, tracking).length <= count) high = middle
    else low = middle
  }
  return fill(words, high, f, tracking)
}

const MOST_LINES = 4

// A title laid out in `box`, in the ink that reads there. A short title is
// set large, up to a seventh of the canvas's short side, on one line or two;
// a long one comes down to an eleventh and below, on as many as four, to a
// thirtieth at the least; past that, the last line ends in an ellipsis.
export function setTitle(text: string, box: Box, place: string | null, font: Font, short: number, tone: TextLayer["tone"] = "ink"): TextLayer | undefined {
  const f = face(font)
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
  if (!words.length) return undefined
  const most = Math.min(short / 7, box.h)
  const display = short / 11
  const least = short / 30
  // From the caps of the first line to the descenders of the last.
  const tall = (count: number, size: number) => (f.cap + (count - 1) * setting(font, size, display).leading + f.descent) * size
  let size = most
  let lines: string[] = []
  let tracking = setting(font, size, display).tracking
  for (; size >= least; size *= 0.94) {
    tracking = setting(font, size, display).tracking
    lines = balance(words, box.w / size, f, tracking)
    const room = size > display ? 2 : MOST_LINES
    if (lines.length <= room && tall(lines.length, size) <= box.h && lines.every((line) => width(line, f, tracking) * size <= box.w)) break
  }
  if (size < least) {
    size = least
    tracking = setting(font, size, display).tracking
    lines = fill(words, box.w / size, f, tracking).slice(0, MOST_LINES)
    let last = lines.at(-1)!
    while (last.length > 1 && width(`${last}…`, f, tracking) * size > box.w) last = last.slice(0, -1).trimEnd()
    lines[lines.length - 1] = `${last}…`
  }
  const at = place ?? "bottom-left"
  const align = at.endsWith("left") ? "start" : at.endsWith("right") ? "end" : "middle"
  const lead = setting(font, size, display).leading * size
  const block = tall(lines.length, size)
  // The first baseline sits a cap height below the block's top, so the
  // type's own top meets the area's edge rather than its line box.
  const top = at.startsWith("top") ? box.y : at.startsWith("bottom") ? box.y + box.h - block : box.y + (box.h - block) / 2
  const x = align === "start" ? box.x : align === "end" ? box.x + box.w : box.x + box.w / 2
  return {
    kind: "text",
    id: "title",
    font,
    size,
    ...(tracking ? { tracking } : null),
    tone,
    align,
    lines: lines.map((line, index) => ({
      text: line,
      x,
      y: top + f.cap * size + index * lead,
      width: width(line, f, tracking) * size,
    })),
  }
}

// Where each character of a run starts, in ems from the run's start, kerned
// and tracked as `width` measures it: for drawing a line's outlines.
export function positions(text: string, font: Font, tracking = 0) {
  const f = face(font)
  const placed: { code: number; x: number }[] = []
  let x = 0
  let before = ""
  for (const char of text) {
    x += (f.kern.get(before + char) ?? 0) / 1000
    placed.push({ code: char.codePointAt(0)!, x })
    x += (f.advance.get(char.codePointAt(0)!) ?? 0) / 1000 + tracking
    before = char
  }
  return placed
}

// A run's width in ems, kerned: for setting a label by hand.
export const measure = (text: string, font: Font) => width(text, face(font))
