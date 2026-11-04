import type { Frame } from "../core/recipe.ts"
import type { Box } from "../core/scene.ts"
import { seat } from "../shapes/subjects.ts"
import { boxesTouch, center, furthestAlong, inflate } from "./geometry.ts"
import { clearing } from "./stage.ts"

// Where discs go beside a title: one, two side by side, or the rim of a far
// larger one rising in from the edge. Every style built on discs shares these,
// so a disc sits in the same place whatever is drawn inside it.
export const FRAMES = ["disc", "pair", "rise"] as const
export type DiscFrame = (typeof FRAMES)[number]

export type Disc = { x: number; y: number; r: number }

export function placeDiscs(
  frame: Frame,
  shape: DiscFrame,
  size: number
): { discs: Disc[]; subject?: Box } {
  const { w, h, safe, keep, titled, rng } = frame
  let { area, away } = clearing(frame)
  const margin = Math.min(w, h) * 0.05
  // On a wide cover with the title low, half the rims come down from the top
  // edge instead of in from the far side, so rim covers aren't all one picture.
  const top = rng.fork("side").next() < 0.5
  if (
    shape === "rise" &&
    titled &&
    top &&
    w > h * 1.3 &&
    safe.y > h * 0.35
  ) {
    area = { x: 0, y: 0, w, h: safe.y }
    away = { x: 0, y: -1 }
  }
  const unit = Math.min(area.w, area.h)

  if (shape === "disc") {
    const r = unit * 0.5 * size
    const { x, y } = seat({ area, safe: keep, w, h, away }, r)
    return {
      discs: [{ x, y, r }],
      subject: { x: x - r, y: y - r, w: r * 2, h: r * 2 },
    }
  }

  if (shape === "pair") {
    // On a wide cover the pair is sized so both discs fit along the open area
    // with a margin, rather than one spilling off the edge.
    const long = Math.max(area.w, area.h)
    const fitPair = w > h * 1.3
    const r = fitPair
      ? Math.min(unit * 0.44 * size, (long - margin * 2) / 4.3, (unit - margin * 2) / 2)
      : unit * 0.36 * size
    // On a wide cover the pair lies straight along the open area's long side,
    // centred in it, so a slanted area can't tip it off the canvas.
    const flat = area.w >= area.h
    let { x, y } = fitPair
      ? center(area)
      : seat({ area, safe: keep, w, h, away }, r)
    const across = fitPair
      ? { x: flat ? 1 : 0, y: flat ? 0 : 1 }
      : { x: -away.y, y: away.x }
    const gap = r * 1.08
    const boxOf = (): Box => ({
      x: x - Math.abs(across.x * gap) - r,
      y: y - Math.abs(across.y * gap) - r,
      w: Math.abs(across.x * gap) * 2 + r * 2,
      h: Math.abs(across.y * gap) * 2 + r * 2,
    })
    // Side by side the pair is wider than one disc, so it steps away from the
    // title until it is clear. Only the title: stepping clear of every area
    // can walk it off the canvas, and any other area gets a patch instead.
    const clearTitle = () => {
      for (let step = 0; step < 40 && titled; step++) {
        if (!boxesTouch(boxOf(), inflate(safe, margin))) break
        x += away.x * margin
        y += away.y * margin
      }
    }
    clearTitle()
    return {
      discs: [
        { x: x - across.x * gap, y: y - across.y * gap, r },
        { x: x + across.x * gap, y: y + across.y * gap, r },
      ],
      subject: boxOf(),
    }
  }

  // The rim starts past the title's furthest corner, so it can't reach the text
  // whatever its size.
  const r = Math.max(w, h) * 1.1
  const middle = center(area)
  const from = middle.x * away.x + middle.y * away.y - unit * 0.2
  const rim = titled
    ? Math.max(from, furthestAlong(safe, away) + margin) - from
    : 0
  return {
    discs: [
      {
        x: middle.x + away.x * (rim - unit * 0.2 + r),
        y: middle.y + away.y * (rim - unit * 0.2 + r),
        r,
      },
    ],
  }
}
