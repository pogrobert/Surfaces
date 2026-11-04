import type { Box, Stop, Tone } from "../core/scene.ts"

// What a cover keeps clear for content: one box, or several. Every helper
// here that takes one takes the other, and with a single box gives exactly
// what it always did.
export type Keep = Box | readonly Box[]
const each = (keep: Keep): readonly Box[] => ("x" in keep ? [keep] : keep)

// The middle of a box; of several, the middle of their area.
export function center(keep: Keep) {
  const boxes = each(keep)
  if (boxes.length === 1) {
    const box = boxes[0]!
    return { x: box.x + box.w / 2, y: box.y + box.h / 2 }
  }
  const area = boxes.reduce((sum, box) => sum + box.w * box.h, 0)
  const weight = (box: Box) => (area > 0 ? (box.w * box.h) / area : 1 / boxes.length)
  return boxes.reduce(
    (sum, box) => ({ x: sum.x + (box.x + box.w / 2) * weight(box), y: sum.y + (box.y + box.h / 2) * weight(box) }),
    { x: 0, y: 0 }
  )
}

// Whether a box meets any of the boxes kept clear.
export const boxesTouch = (a: Box, keep: Keep) =>
  each(keep).some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)

const grow = (box: Box, by: number): Box => ({
  x: box.x - by,
  y: box.y - by,
  w: box.w + by * 2,
  h: box.h + by * 2,
})
export function inflate(box: Box, by: number): Box
export function inflate(boxes: readonly Box[], by: number): Box[]
export function inflate(keep: Keep, by: number): Box | Box[] {
  return "x" in keep ? grow(keep, by) : keep.map((box) => grow(box, by))
}

// How far a point lies outside the nearest box, 0 when it is inside one.
export function distanceFrom(keep: Keep, x: number, y: number) {
  let least = Infinity
  for (const box of each(keep)) {
    const dx = Math.max(box.x - x, 0, x - (box.x + box.w))
    const dy = Math.max(box.y - y, 0, y - (box.y + box.h))
    least = Math.min(least, Math.sqrt(dx * dx + dy * dy))
  }
  return least
}

// The largest clear area beside the boxes, by the side of the biggest square
// that fits in it.
export function clearArea(keep: Keep, w: number, h: number): Box {
  const boxes = each(keep)
  const roomier = (best: Box, side: Box) => (Math.min(side.w, side.h) > Math.min(best.w, best.h) ? side : best)
  if (boxes.length === 1) {
    const safe = boxes[0]!
    const right = safe.x + safe.w
    const bottom = safe.y + safe.h
    const sides: Box[] = [
      { x: 0, y: 0, w: safe.x, h },
      { x: right, y: 0, w: w - right, h },
      { x: 0, y: 0, w, h: safe.y },
      { x: 0, y: bottom, w, h: h - bottom },
    ]
    return sides.reduce(roomier)
  }
  // Every rectangle whose sides lie on the canvas's edges or the boxes' own,
  // that meets none of them. If keeping clear of them all leaves much less
  // room than keeping clear of the largest, the art keeps clear of the
  // largest alone, where the title is: squeezed between areas it would spill
  // into the title, and any other area gets a patch of its own instead.
  const largest = boxes.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a))
  const alone = clearArea(largest, w, h)
  const xs = [...new Set([0, w, ...boxes.flatMap((box) => [box.x, box.x + box.w])])].sort((a, b) => a - b)
  const ys = [...new Set([0, h, ...boxes.flatMap((box) => [box.y, box.y + box.h])])].sort((a, b) => a - b)
  let best: Box = { x: 0, y: 0, w: 0, h: 0 }
  for (const [i, x1] of xs.entries()) {
    for (const x2 of xs.slice(i + 1)) {
      for (const [j, y1] of ys.entries()) {
        for (const y2 of ys.slice(j + 1)) {
          const side = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
          if (!boxesTouch(side, boxes)) best = roomier(best, side)
        }
      }
    }
  }
  return Math.min(best.w, best.h) >= Math.min(alone.w, alone.h) * 0.75 ? best : alone
}

// How far the boxes reach in a direction.
export function furthestAlong(keep: Keep, { x, y }: { x: number; y: number }) {
  const reach = (px: number, py: number) => px * x + py * y
  return Math.max(
    ...each(keep).flatMap((box) => [
      reach(box.x, box.y),
      reach(box.x + box.w, box.y),
      reach(box.x, box.y + box.h),
      reach(box.x + box.w, box.y + box.h),
    ])
  )
}

export const stops = (
  tone: Tone,
  ...points: readonly (readonly [number, number])[]
): Stop[] => points.map(([at, opacity]) => ({ at, tone, opacity }))
