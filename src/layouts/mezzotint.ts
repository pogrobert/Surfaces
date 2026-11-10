import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Enter, Layer, Mark, Motion, Paint, Shape } from "../core/scene.ts"
import { bottle, bowl, cherries, egg, glass, jar, jug, lemon, pear } from "../shapes/stilllife.ts"
import type { Thing } from "../shapes/stilllife.ts"
import { framing } from "./framing.ts"
import { boxesTouch, center, inflate, stops } from "./geometry.ts"
import { clearing } from "./stage.ts"

// A mezzotint still life: a plate rocked all over until it prints a velvet
// black, and the light scraped and burnished back out of it. A few humble
// things on a ledge, grouped as still lifes have long been grouped, lit from
// one side, their shadow falling along the ledge away from the light. The
// marks here are only the light; a plate finish turns them into the grain.

// Groupings found again and again in still lifes: a single pear; lemons;
// eggs; cherries by a bowl; a jug with a lemon; bottles, jars and a bowl, as
// Morandi set them; a glass of wine with cherries.
export const STILL_LIFES = ["pear", "lemons", "eggs", "cherries", "jug", "vessels", "glass"] as const
export type StillLife = (typeof STILL_LIFES)[number]

export type MezzotintParams = {
  // How bright the burnished lights come up.
  peak: number
  // The group's height, as a share of the room it has.
  size: number
  // How much light falls on the wall and the ledge.
  room: number
}

const light = (opacity: number): Paint => ({ type: "solid", tone: "strong", opacity })
const shapes = (id: string, paint: Paint, list: Shape[]): Mark => ({ kind: "shapes", id, paint, shapes: list })

// A grouping, in units of its height `s`: its things in two rows, the back
// row printed first and the front row over it. How far it reaches is
// measured from what it draws.
type Group = {
  draw: (x: number, back: number, front: number, s: number, side: number, peak: number) => { back: Thing[]; front: Thing[] }
}

// The back row stands toward the light and the front row away from it, so
// nothing in front hides the lit side of what is behind.
const GROUPS: Record<StillLife, Group> = {
  pear: { draw: (x, back, _, s, side, peak) => ({ back: [pear(x, back, s, side, peak)], front: [] }) },
  lemons: {
    draw: (x, back, front, s, side, peak) => ({
      back: [lemon(x + side * s * 0.6, back, s * 1.5, side, peak)],
      front: [lemon(x - side * s * 0.62, front, s * 1.36, side, peak)],
    }),
  },
  eggs: {
    draw: (x, back, front, s, side, peak) => ({
      back: [egg(x + side * s * 0.95, back, s * 1.3, side, peak * 0.92), egg(x - side * s * 0.4, back, s * 1.24, side, peak * 0.92)],
      front: [egg(x - side * s * 1.0, front, s * 1.22, side, peak)],
    }),
  },
  cherries: {
    draw: (x, back, front, s, side, peak) => ({
      back: [bowl(x + side * s * 0.35, back, s * 0.62, side, peak)],
      front: [cherries(x - side * s * 1.0, front, s * 0.27, side, peak)],
    }),
  },
  jug: {
    draw: (x, back, front, s, side, peak) => ({
      back: [jug(x + side * s * 0.16, back, s, side, peak)],
      front: [lemon(x - side * s * 0.42, front, s * 0.5, side, peak)],
    }),
  },
  vessels: {
    draw: (x, back, front, s, side, peak) => ({
      back: [bottle(x + side * s * 0.22, back, s, side, peak), jar(x - side * s * 0.26, back, s * 0.46, side, peak * 0.9)],
      front: [bowl(x - side * s * 0.12, front, s * 0.2, side, peak)],
    }),
  },
  glass: {
    draw: (x, back, front, s, side, peak) => ({
      back: [glass(x + side * s * 0.14, back, s, side, peak)],
      front: [cherries(x - side * s * 0.32, front, s * 0.11, side, peak)],
    }),
  },
}

// How far a group really reaches, in units of its height: drawn once with its
// base at 0, at a size where a line's least width is nothing beside it.
// A rim seen from above, a stalk or a stem goes past its nominal height.
const MEASURED = 1000
function measure(group: Group, side: number) {
  const { back, front } = group.draw(0, 0, 0, MEASURED, side, 1)
  let left = 0
  let right = 0
  let top = 0
  const take = (x: number, y: number, pad = 0) => {
    left = Math.min(left, x - pad)
    right = Math.max(right, x + pad)
    top = Math.min(top, y - pad)
  }
  for (const thing of [...back, ...front]) {
    for (const mark of thing.marks) {
      if (mark.kind !== "shapes") continue
      for (const shape of mark.shapes) {
        if (shape.type === "polygon") for (let i = 0; i < shape.points.length; i += 2) take(shape.points[i]!, shape.points[i + 1]!)
        else if (shape.type === "ribbon") for (let i = 0; i < shape.points.length; i += 3) take(shape.points[i]!, shape.points[i + 1]!, shape.points[i + 2]!)
        else if (shape.type === "ellipse") take(shape.cx, shape.cy, Math.max(shape.rx, shape.ry))
        else if (shape.type === "circle") take(shape.cx, shape.cy, shape.r)
      }
    }
  }
  // A little over, for anti-aliasing and the grain.
  return { left: (left * 1.02) / MEASURED, right: (right * 1.02) / MEASURED, headroom: (-top * 1.02) / MEASURED }
}

export function mezzotint(frame: Frame, kind: StillLife, p: MezzotintParams): Art {
  const group = GROUPS[kind]
  const { w, h, safe, keep, titled, rng } = frame
  const unit = Math.min(w, h)
  const margin = unit * 0.05
  const { area, away } = clearing(frame)

  // The ledge: above the title when there is more room over it than under
  // it, so the title is on its front, like a label on a plinth; otherwise
  // low on the canvas, under the title.
  // With the open area beside the title rather than over it, the ledge is
  // low and stops short of the title, and the subject stands beside it.
  const over = titled ? safe.y - margin * 0.7 - unit * 0.08 : 0
  const under = titled ? h * 0.8 - (safe.y + safe.h) - margin : 1
  const sideways = Math.abs(away.x) > Math.abs(away.y)
  const top = titled && over > under && (over >= h * 0.4 || !sideways) ? over : h * 0.78
  // Deep enough for two rows of things.
  const depth = unit * 0.07
  const edge = Math.max(1.5, unit * 0.004)

  // The subject stands on the ledge in the open area, as tall as the room
  // above it allows: the largest size, nearest the open area's middle, that
  // keeps clear of every area and on the canvas. Behind a title in the middle
  // it stands centred under it, rising above it.
  // Light falls from the side of the title, so the lit face turns to it.
  const side = titled ? (center(keep).x < center(area).x ? -1 : 1) : -1
  const reach = measure(group, side)
  const ratio = reach.right - reach.left
  const calm = frame.calm[0]
  const backBase = top + depth * 0.32
  const base = top + depth * 0.78
  // A wide group is held to its share of the width too, or it crowds.
  const tallest = (Math.min((top - margin) * 0.94, unit * 0.64, (w * 0.5) / ratio) * p.size) / reach.headroom
  const boxAt = (x: number, tall: number): Box => ({ x: x + tall * reach.left, y: base - tall * reach.headroom, w: tall * ratio, h: tall * reach.headroom })
  const fits = (box: Box) =>
    box.x >= margin * 0.5 && box.x + box.w <= w - margin * 0.5 && box.y >= margin * 0.5 && !(titled && boxesTouch(box, inflate(keep, margin * 0.6)))
  let height = tallest
  // With nothing to keep clear, the still life stands on a third the cover
  // chooses (see framing.ts), whole on its ledge.
  const framed = framing(frame, rng.fork("still"))
  let cx = calm ? center(calm).x : titled ? center(area).x : framed?.x ?? w * 0.64
  search: for (let tall = tallest; tall > unit * 0.04; tall *= 0.93) {
    // From the preferred spot outward, both ways, in small steps.
    for (let k = 0; k <= 40; k++) {
      for (const sign of k ? [1, -1] : [1]) {
        const x = cx + sign * k * margin * 0.5
        if (fits(boxAt(x, tall))) {
          height = tall
          cx = x
          break search
        }
      }
    }
  }
  const boxOf = () => boxAt(cx, height)


  // Each thing's marks named for its place, so two lemons never share a
  // gradient.
  const named = (things: Thing[], row: string) =>
    things.map((thing, index) => ({ ...thing, marks: thing.marks.map((mark) => ({ ...mark, id: `${row}${index}-${mark.id}` })) }))
  const raw = group.draw(cx, backBase, base, height, side, p.peak)
  const drawn = { back: named(raw.back, "b"), front: named(raw.front, "f") }
  const things = [...drawn.back, ...drawn.front]

  // The ledge's top catches the light, brightest on the lit side, and dips
  // into the subject's shadow on the other.
  // The shadow falls away from the light. It starts under the subject's
  // middle, where the body hides its edge, and fades out along the ledge.
  const from = Math.min(...things.map((thing) => thing.span[0]))
  const to = Math.max(...things.map((thing) => thing.span[1]))
  const width = to - from
  const mid = (from + to) / 2
  const dir = -side
  const at = (x: number) => Math.min(1, Math.max(0, x / w))
  const points: [number, number][] = [
    [0, dir > 0 ? p.room * 1.6 : p.room * 0.6],
    [at(mid - dir * width * 0.2), p.room * 1.2],
    [at(mid + dir * width * 0.1), p.room * 0.12],
    [at(mid + dir * width * 1.8), p.room * 0.85],
    [1, dir > 0 ? p.room * 0.6 : p.room * 1.6],
  ]
  const ledgeStops = stops("strong", ...points.sort((a, b) => a[0] - b[0]))
  // The ledge runs the width of the cover, unless an area stands in its way:
  // then it ends short of the area, as a shelf does, on the subject's side.
  let left = -margin
  let right = w + margin
  const band = { x: -margin, y: top, w: w + margin * 2, h: depth + edge }
  for (const box of inflate(keep, margin * 0.5)) {
    if (!titled || !boxesTouch(band, box)) continue
    if (box.x + box.w <= cx) left = Math.max(left, box.x + box.w)
    else if (box.x >= cx) right = Math.min(right, box.x)
    else left = right
  }
  const across = (y: number, height: number): Shape => ({ type: "rect", x: left, y, w: Math.max(0, right - left), h: height, radii: [0, 0, 0, 0] })
  const ledge: Mark[] = [
    shapes("ledge-top", { type: "linear", x1: 0, y1: 0, x2: w, y2: 0, stops: ledgeStops }, [across(top, depth)]),
    shapes("ledge-edge", { type: "linear", x1: 0, y1: 0, x2: w, y2: 0, stops: stops("strong", [0, p.room * (side < 0 ? 3.4 : 1.6)], [1, p.room * (side < 0 ? 1.6 : 3.4)]) }, [across(top + depth, edge)]),
    shapes("ledge-front", light(p.room * 0.25), [across(top + depth + edge, unit * 0.09)]),
  ]

  // Candlelight on the wall behind, from the light's side.
  const glowX = cx + side * height * 0.6
  const glowY = base - height * 0.7
  const wall: Mark = {
    kind: "pool",
    id: "wall",
    cx: glowX,
    cy: glowY,
    rx: unit * 0.75,
    ry: unit * 0.6,
    rotate: 0,
    tone: "strong",
    opacity: p.room * 0.9,
    core: 0.05,
  }

  let moves: Art["moves"]
  let glow: Motion | undefined
  if (frame.motion !== "none") {
    // The print develops in place; then the candle behind it stirs.
    const enter: Enter = { kind: "fade", delay: 0.1, duration: 2.6, even: true }
    moves = { plate: { enter }, second: { enter } }
    glow = { loop: { kind: "orbit", rx: unit * 0.025, ry: unit * 0.015, period: 14, start: enter.delay + enter.duration } }
  }
  const sway = rng.fork("motion").next()

  return {
    under: [
      { kind: "fill", id: "ground", tone: "ground" },
      {
        kind: "pool",
        id: "candle",
        cx: glowX,
        cy: glowY,
        rx: unit * (0.5 + sway * 0.1),
        ry: unit * 0.45,
        rotate: 0,
        tone: "quiet",
        opacity: 0.9,
        core: 0.1,
        ...(glow ? { motion: glow } : null),
      },
    ],
    marks: [wall, ...ledge, ...drawn.back.flatMap((thing) => thing.marks)],
    // What stands in front hides the back row with the plate's own black,
    // and is printed over it.
    ...(drawn.front.length
      ? {
          between: [
            {
              kind: "shapes",
              id: "hide",
              paint: { type: "solid", tone: "ground", opacity: 1 },
              shapes: drawn.front.flatMap((thing) => thing.hides),
              ...(moves ? { motion: { enter: moves.plate!.enter! } } : null),
            } satisfies Layer,
          ],
          second: drawn.front.flatMap((thing) => thing.marks),
        }
      : null),
    over: [],
    subject: boxOf(),
    ...(moves ? { moves } : null),
  }
}
