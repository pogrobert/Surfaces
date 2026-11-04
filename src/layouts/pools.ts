import { cos, radians, sin } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Pool, Tone } from "../core/scene.ts"
import { facing, veil } from "./veil.ts"
import type { VeilParams } from "./veil.ts"

// A few soft pools, placed by hand in shares of the canvas for a title at the
// bottom left. The seed nudges them and never rearranges them.
export type PoolPlan = {
  tone: Tone
  x: number
  y: number
  rx: number
  ry: number
}

export type PoolParams = VeilParams & {
  jitter: number
  spread: number
  core: number
  strength: number
}

// Filling the canvas, as an avatar does: three large pools round the middle,
// a third of a turn apart, so the colour reaches every edge and each seed
// turns them differently.
function filling(rng: Frame["rng"]): PoolPlan[] {
  const fill = rng.fork("fill")
  const turn = fill.next() * 360
  return (["strong", "accent", "soft"] as const).map((tone, index) => {
    const a = radians(turn + index * 120 + fill.between([-25, 25]))
    const d = fill.between([22, 36])
    return { tone, x: 50 + cos(a) * d, y: 50 + sin(a) * d, rx: fill.between([34, 48]), ry: fill.between([34, 48]) }
  })
}

export function pools(
  frame: Frame,
  plans: readonly (readonly PoolPlan[])[],
  p: PoolParams
): Art {
  const { w, h, rng } = frame
  const plan = frame.fill ? filling(rng) : rng.fork("composition").pick(plans)
  const side = facing(frame)
  const place = rng.fork("placement")
  const moves = rng.fork("motion")
  const marks: Pool[] = plan.map((pool, index) => {
    const x = pool.x + (place.next() * 2 - 1) * p.jitter
    const y = pool.y + (place.next() * 2 - 1) * p.jitter
    // The colour wells up, one pool after another, then each circles slowly
    // round where it sits, on a course and a clock of its own, so they never
    // move in step.
    const way = moves.next() < 0.5 ? 1 : -1
    const reach = moves.between([0.04, 0.08]) * Math.min(w, h)
    const period = moves.between([26, 42])
    return {
      kind: "pool",
      id: `pool${index}`,
      cx: ((side.mirrorX ? 100 - x : x) / 100) * w,
      cy: ((side.mirrorY ? 100 - y : y) / 100) * h,
      rx: (pool.rx / 100) * w * p.spread,
      ry: (pool.ry / 100) * h * p.spread,
      rotate: 0,
      tone: pool.tone,
      opacity: p.strength,
      core: p.core,
      ...(frame.motion !== "none"
        ? {
            motion: {
              enter: { kind: "fade", delay: 0.1 + index * 0.25, duration: 2.6, scale: 0.55 },
              loop: { kind: "orbit", rx: reach * 0.9, ry: reach * 0.6 * way, period },
            },
          }
        : null),
    }
  })
  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks,
    over: veil(frame, side, p),
  }
}
