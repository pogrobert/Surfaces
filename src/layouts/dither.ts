import { atan2, clamp, cos, PI, radians, sin, smoothstep, TAU } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Mark, Shape } from "../core/scene.ts"
import { seat } from "../shapes/subjects.ts"
import { center, distanceFrom, furthestAlong } from "./geometry.ts"
import { framing } from "./framing.ts"
import { clearing } from "./stage.ts"

// A smooth tone, printed as 1-bit cells through an 8 by 8 ordered (Bayer)
// screen: the look of early screens and fax machines. Every cell is decided
// here, as geometry, so it is exactly the same on every renderer.
export const TONES = ["orb", "slope", "bloom", "ring", "waves", "screen"] as const
export type ToneForm = (typeof TONES)[number]

export type DitherParams = {
  size: number
  cell: number
  // Share of a cell left empty around each dot; 0 merges cells into pixels.
  gap: number
  lightTurn: number
  // Lifts or lowers the whole tone before the screen.
  exposure: number
}

const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14,
  46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19,
  59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29,
  53, 21,
]

export function dither(frame: Frame, form: ToneForm, p: DitherParams): Art {
  const { w, h, safe, keep, titled, rng } = frame
  const { area, away } = clearing(frame)
  const unit = Math.min(area.w, area.h)
  const middle = center(area)
  // How deep the open area is, measured away from the title.
  const depth = Math.abs(area.w * away.x) + Math.abs(area.h * away.y)
  const out = (x: number, y: number) =>
    (x - middle.x) * away.x + (y - middle.y) * away.y
  const along = (x: number, y: number) =>
    -(x - middle.x) * away.y + (y - middle.y) * away.x
  const shape = rng.fork("tone")
  let subject: Box | undefined
  // With nothing to keep clear, most orbs and rings are framed large and on
  // a third, running off the edges (see framing.ts).
  const framed = form === "orb" || form === "ring" ? framing(frame, rng.fork("dither")) : undefined
  const seatAt = { area, safe: keep, w, h, away, ...(framed ? { at: { x: framed.x, y: framed.y } } : null) }
  const radius = framed ? (framed.reach * Math.min(w, h)) / 2 : unit * 0.5 * p.size

  // The tone, from 0 to 1, at a point.
  let tone: (x: number, y: number) => number
  if (form === "orb") {
    const r = radius
    const { x: cx, y: cy } = seat(seatAt, r)
    const lit = atan2(away.y, away.x) + PI + radians(p.lightTurn)
    const lx = cos(lit)
    const ly = sin(lit)
    subject = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }
    tone = (x, y) => {
      const dx = (x - cx) / r
      const dy = (y - cy) / r
      const d = dx * dx + dy * dy
      if (d >= 1) return 0
      // A lit sphere: the surface faces the light by how far it leans to it
      // and how much it faces the viewer.
      const lambert = dx * lx + dy * ly + Math.sqrt(1 - d) * 0.55
      return clamp(0.06 + lambert * 0.82, 0.04, 1)
    }
  } else if (form === "slope") {
    const waves = shape.between([0.6, 1.4])
    const phase = shape.next() * TAU
    const span = Math.max(w, h)
    tone = (x, y) => {
      const bend = sin((along(x, y) / span) * TAU * waves + phase) * 0.12
      return clamp(out(x, y) / depth + 0.45 + bend, 0, 1)
    }
  } else if (form === "ring") {
    // A lit torus seen face on: bright where its tube turns to the light.
    const r = radius
    const { x: cx, y: cy } = seat(seatAt, r)
    const lit = atan2(away.y, away.x) + PI + radians(p.lightTurn)
    const lx = cos(lit)
    const ly = sin(lit)
    const tube = 0.3
    subject = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }
    tone = (x, y) => {
      const dx = (x - cx) / r
      const dy = (y - cy) / r
      const d = Math.sqrt(dx * dx + dy * dy)
      const across = (d - (1 - tube)) / tube
      if (Math.abs(across) >= 1) return 0
      // The tube's surface normal, from its centre line outward.
      const nx = d ? (dx / d) * across : 0
      const ny = d ? (dy / d) * across : 0
      const lambert = nx * lx + ny * ly + Math.sqrt(1 - across * across) * 0.55
      return clamp(0.06 + lambert * 0.82, 0.04, 1)
    }
  } else if (form === "waves") {
    // Bands of tone rolling across the open side, like a sound wave.
    const bands = shape.between([2.2, 3.6])
    const phase = shape.next() * TAU
    const tilt = shape.between([-0.35, 0.35])
    tone = (x, y) => {
      const o = out(x, y) / depth
      const wave = 0.5 + 0.5 * sin((o + (along(x, y) / depth) * tilt) * TAU * bands + phase)
      return clamp(wave * smoothstep(o + 0.6), 0, 1)
    }
  } else if (form === "screen") {
    // What lands on the screen behind two slits: a row of bars, brightest in
    // the middle and fading out to either side.
    // The bars stand square to the cover, across the open area's long side;
    // tilted with a diagonal clearing they read as a mistake.
    const level = area.w >= area.h
    const length = p.cell * shape.between([5, 7.5])
    const k = TAU / length
    const half = (level ? area.w : area.h) * shape.between([0.38, 0.46])
    const deep = level ? area.h : area.w
    tone = (x, y) => {
      const a = level ? x - middle.x : y - middle.y
      const o = level ? y - middle.y : x - middle.x
      const envelope = smoothstep(1 - Math.abs(a) / half)
      const ends = smoothstep((deep * 0.5 - Math.abs(o)) / (deep * 0.35))
      return (0.5 + 0.5 * cos(a * k)) * envelope * ends
    }
  } else {
    const reach = Math.max(area.w, area.h) * 0.9 * p.size
    const fx = middle.x + away.x * unit * shape.between([0.1, 0.35])
    const fy = middle.y + away.y * unit * shape.between([0.1, 0.35])
    tone = (x, y) => {
      const dx = x - fx
      const dy = y - fy
      const t = clamp(1 - Math.sqrt(dx * dx + dy * dy) / reach, 0, 1)
      return t * Math.sqrt(t)
    }
  }

  const cell = p.cell
  // How far a point lies out from the title, and a slow swing in the edge a
  // field fades along.
  const limit = furthestAlong(safe, away)
  const curve = rng.fork("edge")
  const waves = curve.between([0.8, 1.6])
  const swingPhase = curve.next() * TAU
  const span = Math.max(w, h)
  const swing = (x: number, y: number) =>
    cell * 3 * (1 + sin(((-x * away.y + y * away.x) / span) * TAU * waves + swingPhase))
  const cols = Math.ceil(w / cell)
  const rows = Math.ceil(h / cell)
  const left = (w - cols * cell) / 2
  const top = (h - rows * cell) / 2
  const inset = cell * p.gap
  // Cells that touch overlap a little, so no hairline of ground shows where
  // their antialiased edges meet.
  const bleed = inset > 0 ? 0 : 0.6
  // Two inks laid by the same screen: the lighter one for the middle tones, so
  // the dark one is kept for the shadows.
  // A moving cover keeps its cells in sixteen groups by their place in the
  // screen, so they can be printed in the screen's own order: the order in
  // which a rising tone turns them on.
  const moves = frame.motion !== "none"
  const GROUPS = moves ? 16 : 1
  const dark: number[][] = Array.from({ length: GROUPS }, () => [])
  const light: number[][] = Array.from({ length: GROUPS }, () => [])
  for (let row = 0; row < rows; row++) {
    // Without a gap, cells of one ink side by side merge into one block.
    const runs = [-1, -1]
    const flush = (ink: 0 | 1, end: number) => {
      const start = runs[ink]!
      if (start < 0) return
      ;(ink ? dark : light)[0]!.push(left + start * cell, top + row * cell, (end - start) * cell + bleed)
      runs[ink] = -1
    }
    for (let col = 0; col < cols; col++) {
      const x = left + (col + 0.5) * cell
      const y = top + (row + 0.5) * cell
      // The tone thins out toward the title and is gone a few cells short of
      // it. A field fades along one long curve past the title, rather than
      // round its box, which would leave a square notch. An orb or ring is
      // already clear of the title and is never cut.
      const fade = !titled
        ? 1
        : subject
          ? smoothstep((distanceFrom(keep, x, y) - cell * 2) / (cell * 6))
          : smoothstep(
              (x * away.x + y * away.y - limit - cell * 2 - swing(x, y)) / (cell * 8)
            )
      // Exposure scales the tone rather than lifting it, so empty ground stays
      // empty instead of filling with the screen's lightest cells.
      const t = clamp(tone(x, y) * (1 + p.exposure), 0, 1) * fade
      const threshold = BAYER[(row % 8) * 8 + (col % 8)]! + 0.5
      // The light ink covers the lower half of the range and the dark one the
      // upper half, each through the whole screen.
      const ink =
        Math.max(t * 2 - 1, 0) * 64 > threshold ? 1 : Math.min(t * 2, 1) * 64 > threshold ? 0 : -1
      if (inset > 0 || moves) {
        if (ink >= 0) {
          ;(ink ? dark : light)[Math.floor(((threshold - 0.5) * GROUPS) / 64)]!.push(
            left + col * cell + inset / 2,
            top + row * cell + inset / 2,
            cell - inset + bleed
          )
        }
        continue
      }
      for (const each of [0, 1] as const) {
        if (each === ink) {
          if (runs[each]! < 0) runs[each] = col
        } else flush(each, col)
      }
    }
    flush(0, cols)
    flush(1, cols)
  }
  const blocks = (points: number[]): Shape[] =>
    points.length ? [{ type: "blocks", h: cell - inset + bleed, points }] : []
  // The light ink prints first and the dark after it, each group popping on
  // in turn. Then now and again a group goes out for a moment, so the screen
  // flickers like a display. Each group is a layer of its own that the
  // browser fades whole.
  const inks = (id: string, tone: "body" | "strong", groups: number[][], first: number): Mark[] =>
    groups.map((points, group) => ({
      kind: "shapes",
      id: moves ? `${id}${group}` : id,
      paint: { type: "solid", tone, opacity: 1 },
      shapes: blocks(points),
      ...(moves
        ? {
            motion: {
              enter: { kind: "fade", delay: 0.15 + (first + group) * 0.06, duration: 0.1, pop: true },
              loop: { kind: "blink", period: tone === "body" ? 7 : 9, at: ((group * 7) % 16) / 16 },
            },
          }
        : null),
    }))

  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks: [...inks("cells-light", "body", light, 0), ...inks("cells", "strong", dark, GROUPS)],
    over: [],
    ...(subject ? { subject } : null),
  }
}
