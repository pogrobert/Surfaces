import { cos, PI, sin, TAU } from "../core/math.ts"
import type { Box } from "../core/scene.ts"
import { boxesTouch, inflate } from "../layouts/geometry.ts"
import type { Frame } from "../core/recipe.ts"

// What every style that draws one subject beside a title needs, whether it is
// made from the grammar's parts or written whole: outlines as flat points,
// set into the square a subject is seated in, kept clear of the title, and
// sized to show round a title in the middle. See seated.ts for the seating.

export type Points = number[]

export const STEPS = 144

// A closed curve from a function of the turn round it, 0 to 1.
export const curve = (at: (t: number) => [number, number], steps = STEPS): Points => {
  const points: Points = []
  for (let i = 0; i < steps; i++) points.push(...at(i / steps))
  return points
}

export const circle = (cx: number, cy: number, r: number, steps = STEPS) => curve((t) => [cx + cos(t * TAU) * r, cy + sin(t * TAU) * r], steps)

// An arc from one angle to the next, its ends included.
export function arc(cx: number, cy: number, r: number, from: number, to: number, steps: number): Points {
  const points: Points = []
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps
    points.push(cx + cos(a) * r, cy + sin(a) * r)
  }
  return points
}

// A doorway: a round top over straight sides, standing on the square's foot.
export function archOf(left: number, right: number, top: number, bottom = 1): Points {
  const r = (right - left) / 2
  const cx = left + r
  return [left, bottom, ...arc(cx, top + r, r, PI, TAU, 48), right, bottom]
}

// Unit points set into the square at x, y of `side`, turned `angle` about its
// middle.
export function placeIn(points: Points, x: number, y: number, side: number, angle: number): Points {
  const c = cos(angle)
  const s = sin(angle)
  const out: Points = []
  for (let i = 0; i < points.length; i += 2) {
    const u = (points[i]! - 0.5) * side
    const v = (points[i + 1]! - 0.5) * side
    out.push(x + u * c - v * s, y + u * s + v * c)
  }
  return out
}

export function boundsOf(points: Points): Box {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let i = 0; i < points.length; i += 2) {
    x0 = Math.min(x0, points[i]!)
    y0 = Math.min(y0, points[i + 1]!)
    x1 = Math.max(x1, points[i]!)
    y1 = Math.max(y1, points[i + 1]!)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export const union = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return { x, y, w: Math.max(...boxes.map((box) => box.x + box.w)) - x, h: Math.max(...boxes.map((box) => box.y + box.h)) - y }
}

// Outlines drawn a little smaller about their middle until they come no
// nearer the title than the square they were seated in may: a turned
// outline reaches past its square at the corners.
export function keptClear(context: Pick<Frame, "w" | "h" | "keep" | "titled" | "fill" | "calm">, outlines: Points[], away: { x: number; y: number }): Points[] {
  const { w, h, keep, titled, fill, calm } = context
  if (!titled || fill || calm.length) return outlines
  const margin = Math.min(w, h) * 0.06
  const avoid = inflate(keep, margin / 2)
  let drawn = outlines
  let shrunk = false
  for (let attempt = 0; attempt < 8; attempt++) {
    const box = union(drawn.map(boundsOf))
    if (!boxesTouch(box, avoid)) break
    // Drawn in toward its far side, away from the title, so it backs off
    // the title and keeps as much of its size as the room allows.
    const cx = box.x + box.w / 2 + (away.x * box.w) / 2
    const cy = box.y + box.h / 2 + (away.y * box.h) / 2
    drawn = drawn.map((points) => points.map((v, i) => (i % 2 ? cy + (v - cy) * 0.92 : cx + (v - cx) * 0.92)))
    shrunk = true
  }
  if (!shrunk) return drawn
  // Drawn smaller, it may have been left hanging off an edge it no longer
  // needs to run off: it is slid back onto the canvas as far as it can go
  // without coming nearer the title.
  const box = union(drawn.map(boundsOf))
  const toward = (start: number, size: number, side: number) =>
    start < 0 ? Math.min(-start, side - (start + size)) : start + size > side ? -Math.min(start + size - side, start) : 0
  const dx = toward(box.x, box.w, w)
  const dy = toward(box.y, box.h, h)
  for (const share of [1, 0.75, 0.5, 0.25]) {
    const moved = { ...box, x: box.x + dx * share, y: box.y + dy * share }
    if (boxesTouch(moved, avoid)) continue
    return drawn.map((points) => points.map((v, i) => v + (i % 2 ? dy : dx) * share))
  }
  return drawn
}

// How large a figure is drawn behind a title in the middle: past the
// clearing on every side, `reach` of the way from its edge to the canvas's,
// so it shows all round the title and still leaves ground beyond.
export function behind({ calm, w, h }: Pick<Frame, "calm" | "w" | "h">, side: number, reach: number) {
  const box = calm[0]
  if (!box) return side
  return Math.max(side, box.w + (w - box.w) * reach, box.h + (h - box.h) * reach)
}
