import { cos, PI, sin, TAU } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Enter, Loop, Mark, Paint, Shape } from "../core/scene.ts"
import { framing } from "./framing.ts"
import { seat } from "../shapes/subjects.ts"
import { center, furthestAlong, stops } from "./geometry.ts"
import { clearing } from "./stage.ts"

// Two simple shapes, one for each ink, overlapping just enough to make a third
// colour. Everything is placed by hand against the clear area beside the title.
export const MOTIFS = ["discs", "arches", "bars", "rise"] as const
// Two more, so far judged only in Riso.
export const RISO_MOTIFS = [...MOTIFS, "sunset", "trio"] as const
export type Motif = (typeof RISO_MOTIFS)[number]

export type OverprintParams = {
  size: number
  // How far toward nothing an ink falls off across its shape.
  fade: number
}

// Where the second ink lands from the first, which only the finish decides.
export type Register = { dx: number; dy: number }

type Sheet = { first: Shape[]; second: Shape[]; box?: Box; along: number }

const circle = (cx: number, cy: number, r: number): Shape => ({
  type: "circle",
  cx,
  cy,
  r,
})

const boxAround = (x: number, y: number, half: number): Box => ({
  x: x - half,
  y: y - half,
  w: half * 2,
  h: half * 2,
})

export function overprint(
  frame: Frame,
  motif: Motif,
  p: OverprintParams,
  // Given only by a print in two inks, whose plates move apart from each other.
  register?: Register,
  // How far a framed motif may reach (see framing.ts): less for one that
  // prints solid, whose mass would otherwise fill the frame.
  most?: number
): Art {
  const { w, h, safe, keep, rng } = frame
  const { area, away } = clearing(frame)
  // Under a title the art passes behind, the print is centred on the title
  // and its two inks part above and below it, as a poster's sun sits behind
  // its headline, so they show round the title rather than under it.
  // Filling the canvas, it is centred as under a title, on the middle half.
  const calm = frame.calm[0] ?? (frame.fill ? { x: w * 0.25, y: h * 0.25, w: w * 0.5, h: h * 0.5 } : undefined)
  const across = calm ? { x: 0, y: 1 } : { x: -away.y, y: away.x }
  // And drawn at least as large as the title is wide, so it reaches past it.
  // With nothing to keep clear, most covers frame it large and on a third
  // (see framing.ts); a motif spans about 0.9 of its unit.
  // Arches are mostly ink, so framed at full reach they would leave no paper.
  const reach = motif === "arches" ? Math.min(most ?? 1.4, 1.2) : most
  const framed = motif === "rise" ? undefined : framing(frame, rng.fork("overprint"), reach ? { most: reach } : {})
  const unit = framed ? (Math.min(w, h) * framed.reach) / 0.9 : Math.max(Math.min(area.w, area.h), calm ? calm.w : 0)
  const seatIn = (radius: number) =>
    calm ? center(calm) : framed ? { x: framed.x, y: framed.y } : seat({ area, safe: keep, w, h, away }, radius)

  const sheets: Record<Motif, () => Sheet> = {
    discs() {
      // The two overlap along the open area, so in a long narrow one, such as
      // the side of a centred title, they take more of its width.
      const along = Math.abs(across.x) * area.w + Math.abs(across.y) * area.h
      const r = Math.max(unit * 0.33, Math.min(unit * 0.42, along * 0.2)) * p.size
      const { x, y } = seatIn(r * 1.5)
      const gap = r * 0.52
      return {
        first: [circle(x - across.x * gap, y - across.y * gap, r)],
        second: [circle(x + across.x * gap, y + across.y * gap, r)],
        box: boxAround(x, y, r * 1.52),
        along: r * 2,
      }
    },
    arches() {
      const breadth = unit * 0.6 * p.size
      const tall = breadth * 1.45
      const { x, y } = seatIn(Math.max(tall, breadth * 1.6) / 2)
      const shift = breadth * 0.34
      const arch = (dx: number, scale: number): Shape => {
        const width = breadth * scale
        const height = tall * scale
        return {
          type: "rect",
          x: x + dx - width / 2,
          y: y + tall / 2 - height,
          w: width,
          h: height,
          radii: [width / 2, width / 2, 0, 0],
        }
      }
      return {
        first: [arch(-shift, 1)],
        second: [arch(shift, 0.82)],
        box: boxAround(x, y, Math.max(tall, breadth * 1.6) / 2),
        along: tall,
      }
    },
    bars() {
      const half = unit * 0.46 * p.size
      const { x, y } = seatIn(half)
      const step = (half * 2) / 5
      const first: Shape[] = []
      for (let bar = 0; bar < 5; bar++) {
        const thick = step * 0.62
        first.push({
          type: "rect",
          x: x - half,
          y: y - half + bar * step + (step - thick) / 2,
          w: half * 2,
          h: thick,
          radii: [thick / 2, thick / 2, thick / 2, thick / 2],
        })
      }
      return {
        first,
        second: [circle(x + half * 0.26, y - half * 0.1, half * 0.62)],
        box: boxAround(x, y, half),
        along: half * 2,
      }
    },
    // A sun half set behind bands of the other ink, as on a travel poster.
    sunset() {
      const half = unit * 0.46 * p.size
      // Behind a title the horizon is the title's foot: the sun rises behind
      // the words and the bands lie below them.
      const seated = seatIn(half)
      const x = seated.x
      const y = calm ? calm.y + calm.h - half * 0.15 : seated.y
      const r = half * 0.82
      const horizon = y + half * 0.15
      const bands: Shape[] = []
      const step = (y + half - horizon) / 3.2
      for (let band = 0; band < 3; band++) {
        const thick = step * (0.8 - band * 0.16)
        bands.push({
          type: "rect",
          x: x - half,
          y: horizon + band * step,
          w: half * 2,
          h: thick,
          radii: [0, 0, 0, 0],
        })
      }
      return {
        first: [
          {
            type: "rect",
            x: x - r,
            y: horizon - r,
            w: r * 2,
            h: r + step * 0.5,
            radii: [r, r, 0, 0],
          },
        ],
        second: bands,
        box: boxAround(x, y, half),
        along: half * 2,
      }
    },
    // Three discs in a loose triangle: two of the first ink, one of the second
    // over where they meet.
    trio() {
      const r = unit * 0.24 * p.size
      const { x, y } = seatIn(r * 2.1)
      const spin = rng.fork("trio").next() * TAU
      const at = (k: number) => ({
        x: x + cos(spin + (k * TAU) / 3) * r * 0.95,
        y: y + sin(spin + (k * TAU) / 3) * r * 0.95,
      })
      const [a, b, c] = [at(0), at(1), at(2)]
      return {
        first: [circle(a.x, a.y, r), circle(b.x, b.y, r)],
        second: [circle(c.x, c.y, r)],
        box: boxAround(x, y, r * 2.1),
        along: r * 3,
      }
    },
    // The rim of a far larger circle, with a smaller one rising over it. The
    // rim starts past the title's furthest corner, so it can't reach the text.
    rise() {
      const r = Math.max(w, h) * 0.9
      const margin = Math.min(w, h) * 0.05
      const middle = center(area)
      const from =
        middle.x * away.x + middle.y * away.y - unit * 0.18
      const rim = Math.max(from, furthestAlong(safe, away) + margin) - from
      const rimX = middle.x - away.x * unit * 0.18 + away.x * rim
      const rimY = middle.y - away.y * unit * 0.18 + away.y * rim
      const small = unit * 0.3 * p.size
      return {
        first: [circle(rimX + away.x * r, rimY + away.y * r, r)],
        second: [
          circle(rimX + away.x * small * 1.1, rimY + away.y * small * 1.1, small),
        ],
        along: unit,
      }
    },
  }
  const sheet = sheets[motif]()
  // The first ink falls off one way and the second the other, so they are at
  // their fullest where they don't meet.
  const drawn = rng.fork("fall").next() * TAU
  // Discs parted above and below a title are fullest at their far ends, the
  // parts that show.
  const fall = calm && motif === "discs" ? PI / 2 : drawn
  const middle = center(sheet.box ?? area)
  const gradient = (direction: number): Paint => {
    const dx = (cos(fall) * sheet.along * direction) / 2
    const dy = (sin(fall) * sheet.along * direction) / 2
    return {
      type: "linear",
      x1: middle.x - dx,
      y1: middle.y - dy,
      x2: middle.x + dx,
      y2: middle.y + dy,
      stops: stops("body", [0, 1], [0.5, 0.82], [1, p.fade]),
    }
  }
  const ink = (id: string, shapes: Shape[], direction: number): Mark => ({
    kind: "shapes",
    id,
    paint: gradient(direction),
    shapes,
  })

  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks: [ink("a", sheet.first, 1)],
    second: [ink("b", sheet.second, -1)],
    over: [],
    ...(sheet.box ? { subject: sheet.box } : null),
    ...(register && frame.motion !== "none" ? { moves: press(frame, register) } : null),
  }
}

// How the two plates move, each as a whole finished layer: a browser slides
// and fades a finished plate cheaply, where moving the shapes inside the grain
// would make it work the grain out again on every frame. The inks come up one
// after the other, overlapping, and then move on one clock, so the print
// reads as one thing moving and not two wiggling apart.
function press(frame: Frame, register: Register): Art["moves"] {
  const { w, h } = frame
  const { away } = clearing(frame)
  const across = { x: -away.y, y: away.x }
  const short = Math.min(w, h)
  const moves = frame.rng.fork("motion")
  // Which way the paper runs through the press. Across the title, never
  // toward it.
  const way = moves.next() < 0.5 ? 1 : -1
  // Each pass slides in along the paper's path through the press as it
  // comes up, the second a beat after the first.
  const lay = (delay: number): Enter => ({
    kind: "fade",
    delay,
    duration: 1.5,
    dx: -across.x * way * short * 0.05,
    dy: -across.y * way * short * 0.05,
  })
  const first = lay(0.1)
  const second = lay(0.8)
  // Then one ink drifts most of the way into register and back, so the
  // third colour narrows to a sliver and opens out again, from the moment the
  // second ink is down. The ink that moves is the one that gets there by
  // going away from the title, so nothing heads toward the text.
  const start = second.delay + second.duration
  const outward = -(register.dx * away.x + register.dy * away.y)
  const share = 0.8
  const loop: Loop =
    outward >= 0
      ? { kind: "drift", dx: -register.dx * share, dy: -register.dy * share, period: 12, start }
      : { kind: "drift", dx: register.dx * share, dy: register.dy * share, period: 12, start }
  return outward >= 0
    ? { plate: { enter: first }, second: { enter: second, loop } }
    : { plate: { enter: first, loop }, second: { enter: second } }
}
