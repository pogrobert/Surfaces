import { clamp, cos, lerp, radians, sin } from "../core/math.ts"
import type { Frame } from "../core/recipe.ts"
import type { Box, Pool } from "../core/scene.ts"
import { center } from "./geometry.ts"

export type VeilParams = {
  veil: number
  veilShift: number
  veilTilt: number
  veilRatio: number
}

// Layouts are written for a title at the bottom left, with their weight at the
// top right. This says how to mirror them for the title they actually have. A
// centred title leaves both sides open, so the seed takes either.
export function facing({ w, h, keep, rng }: Frame) {
  const coins = rng.fork("facing")
  const coinX = coins.next() < 0.5
  const coinY = coins.next() < 0.5
  const text = center(keep)
  const centredX = Math.abs(text.x - w / 2) < w * 0.05
  const centredY = Math.abs(text.y - h / 2) < h * 0.05
  return {
    centredX,
    mirrorX: centredX ? coinX : text.x > w / 2,
    mirrorY: centredY ? coinY : text.y < h / 2,
  }
}

// The vertical radius that puts every corner of a box inside the solid part of
// a tilted ellipse.
function radiusHolding(
  box: Box,
  cx: number,
  cy: number,
  tilt: number,
  ratio: number,
  core: number
) {
  const c = cos(tilt)
  const s = sin(tilt)
  let furthest = 0
  for (const x of [box.x, box.x + box.w]) {
    for (const y of [box.y, box.y + box.h]) {
      const u = ((x - cx) * c + (y - cy) * s) / ratio
      const v = -(x - cx) * s + (y - cy) * c
      furthest = Math.max(furthest, Math.sqrt(u * u + v * v))
    }
  }
  return furthest / core
}

// Colour draws back from the title. The veil leans to the side away from the
// colour and tilts with the seed, so its edge is a different curve on every
// cover, and its solid part always holds the whole safe box. A centred title
// leans less, or the veil would have to grow past the frame; without the lean
// it would read as an oval vignette.
export function veil(
  frame: Frame,
  { centredX, mirrorX, mirrorY }: ReturnType<typeof facing>,
  p: VeilParams
): Pool[] {
  if (!frame.titled) return []
  const { w, h, safe } = frame
  const text = center(safe)
  const core = centredX ? 0.74 : 0.6
  // On a square or tall cover the title sits mid-canvas, and a veil leaning off
  // toward a corner would have to grow over everything to keep holding it.
  const lean = p.veilShift * (w < h * 1.3 ? 0.15 : centredX ? 0.55 : 1)
  const cx = lerp(text.x, mirrorX ? w : 0, lean)
  const cy = lerp(text.y, mirrorY ? 0 : h, lean)
  // Shaped like the title's box, not the canvas: on a tall cover the title
  // is still a wide block, and a tall veil would bury the art above it.
  const ratio = clamp((safe.w / safe.h) * p.veilRatio * 0.75, 0.9, 4)
  // A long, thin veil turned even a little has to grow huge to keep the
  // title's corners inside it, and swallows the art; the longer it is, the
  // less it turns.
  const degrees = p.veilTilt * Math.min(1, 1.4 / ratio)
  const tilt = radians(degrees)
  const ry = radiusHolding(safe, cx, cy, tilt, ratio, core)
  const pool = {
    kind: "pool",
    cx,
    cy,
    rotate: degrees,
    tone: "ground",
  } as const
  return [
    // A wider, fainter veil under it keeps the edge from reading as a shape.
    {
      ...pool,
      id: "veil-outer",
      rx: ry * ratio * 1.24,
      ry: ry * 1.24,
      opacity: p.veil * 0.5,
      core: 0.34,
    },
    { ...pool, id: "veil", rx: ry * ratio, ry, opacity: p.veil, core },
  ]
}
