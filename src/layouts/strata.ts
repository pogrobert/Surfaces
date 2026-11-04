import { sin, TAU } from "../core/math.ts"
import type { Rng } from "../core/random.ts"
import type { Art, Frame, Piece } from "../core/recipe.ts"
import type { Box, Mark, Motion, Shape, Tone } from "../core/scene.ts"
import { placeDiscs } from "./discs.ts"
import type { DiscFrame } from "./discs.ts"

// Bands of colour stacked like a horizon, their borders broken into fine spikes
// that a finish then pulls up and down, each disc's bands its own.

export type StrataParams = {
  size: number
  // How far the borders wander, in slow swells and in sharp spikes.
  swell: number
  spike: number
  jag: number
  // How evenly the bands share the height, 0 being evenly.
  uneven: number
}

// Bands from top to bottom, chosen by hand. The partner is what turns a ramp
// of one hue into a sky.
const RAMPS: readonly (readonly Tone[])[] = [
  ["strong", "body", "soft", "quiet"],
  ["quiet", "partner", "body", "strong"],
  ["strong", "partner", "soft", "quiet"],
  ["quiet", "soft", "body", "strong"],
  ["body", "partner", "soft", "quiet"],
  ["soft", "body", "strong"],
]

const SAMPLES = 220
const MOST_BORDERS = 3

const solid = (id: string, tone: Tone, shapes: Shape[]): Mark => ({
  kind: "shapes",
  id,
  paint: { type: "solid", tone, opacity: 1 },
  shapes,
})

// The bands for one shape, filling `box` and well past it, so that a smear
// never pulls in an empty edge.
function bands(
  id: string,
  box: Box,
  ramp: readonly Tone[],
  rng: Rng,
  p: StrataParams
): Mark[] {
  const borders = ramp.length - 1
  const pad = box.h * 0.3 + 60
  const left = box.x - pad
  const width = box.w + pad * 2
  const bottom = box.y + box.h + pad
  const marks: Mark[] = [
    solid(`${id}-0`, ramp[0]!, [
      {
        type: "rect",
        x: left,
        y: box.y - pad,
        w: width,
        h: box.h + pad * 2,
        radii: [0, 0, 0, 0],
      },
    ]),
  ]
  for (let k = 1; k <= MOST_BORDERS; k++) {
    // Every border takes its draws, used or not, so a ramp of three bands and
    // a ramp of four share the rest of the drawing.
    const share = (k + (rng.next() * 2 - 1) * p.uneven) / (borders + 1)
    const rateA = (rng.between([0.8, 1.6]) * TAU) / width
    const rateB = (rng.between([2.2, 3.8]) * TAU) / width
    const phaseA = rng.next() * TAU
    const phaseB = rng.next() * TAU
    const points: number[] = []
    for (let i = 0; i <= SAMPLES; i++) {
      const x = left + (width * i) / SAMPLES
      const r = rng.next()
      const jitter = rng.next() * 2 - 1
      // Spikes point up, into the band above, like a treeline against sky.
      const y =
        box.y +
        box.h * share +
        p.swell * (sin(x * rateA + phaseA) + 0.45 * sin(x * rateB + phaseB)) -
        r * r * p.spike +
        jitter * p.jag
      points.push(x, y)
    }
    if (k > borders) continue
    points.push(left + width, bottom, left, bottom)
    marks.push(solid(`${id}-${k}`, ramp[k]!, [{ type: "polygon", points }]))
  }
  return marks
}

// A moving cover's bands. The disc's whole stack sinks into place as it fades
// in, then rises and falls a little, like water against a shore. It moves as
// one, so it stays one softened layer, as a still cover draws it, and a
// browser slides that layer without drawing it again. The second disc of a
// pair follows a moment behind, and every disc rises and falls on one clock.
const BEHIND = 0.35
const ARRIVAL = 2.4

function moveBands(marks: Mark[], box: Box, index: number, discs: number, frame: Frame, period: number): Mark[] {
  const unit = Math.min(box.w, box.h, frame.w, frame.h)
  const settled = 0.1 + BEHIND * (discs - 1) + ARRIVAL
  const motion: Motion = {
    enter: { kind: "fade", delay: 0.1 + BEHIND * index, duration: ARRIVAL, dy: -unit * 0.06 },
    loop: { kind: "drift", dx: 0, dy: -unit * 0.03, period: period * 0.75, start: settled },
  }
  return marks.map((mark): Mark => ({ ...mark, motion }))
}

export function strata(frame: Frame, shape: DiscFrame, p: StrataParams): Art {
  const { w, h, rng } = frame
  const ramps = rng.fork("ramp")
  const first = ramps.int(0, RAMPS.length - 1)
  // The second disc of a pair never repeats the first one's ramp.
  const second = (first + ramps.int(1, RAMPS.length - 1)) % RAMPS.length
  const lines = rng.fork("borders")
  // Filling the canvas, one disc wide enough to cover it, its bands across
  // the canvas itself, so nothing is left bare round the edge.
  const { discs, subject } = frame.fill
    ? { discs: [{ x: w / 2, y: h / 2, r: Math.sqrt(w * w + h * h) / 2 }], subject: undefined }
    : placeDiscs(frame, shape, p.size)
  // One way and one period for every disc, from a stream of its own, so a
  // moving cover is the same drawing as a still one.
  const moves = rng.fork("motion")
  const period = moves.between([18, 24])

  const pieces = discs.map(({ x, y, r }, index): Piece => {
    const id = `disc${index}`
    // A rim's bands run across the part of it on the canvas, so a shallow rim
    // still shows its whole ramp.
    const left = Math.max(0, x - r)
    const top = Math.max(0, y - r)
    const box = frame.fill
      ? { x: 0, y: 0, w, h }
      : shape === "rise"
        ? {
            x: left,
            y: top,
            w: Math.min(w, x + r) - left,
            h: Math.min(h, y + r) - top,
          }
        : { x: x - r, y: y - r, w: r * 2, h: r * 2 }
    const marks = bands(id, box, RAMPS[index ? second : first]!, lines.fork(id), p)
    return {
      id,
      clip: { type: "circle", cx: x, cy: y, r },
      marks:
        frame.motion === "none"
          ? marks
          : moveBands(marks, box, index, discs.length, frame, period),
    }
  })

  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks: [],
    pieces,
    over: [],
    ...(subject ? { subject } : null),
  }
}
