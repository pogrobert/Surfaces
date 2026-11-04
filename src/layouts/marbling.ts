import { sin, TAU } from "../core/math.ts"
import type { Rng } from "../core/random.ts"
import type { Art, Frame, Piece } from "../core/recipe.ts"
import type { Box, Mark, Motion, Shape, Tone } from "../core/scene.ts"
import { placeDiscs } from "./discs.ts"
import { inflate } from "./geometry.ts"

// Marbled paper: drops of ink floated on a bath, each pushing the ones before
// it outward, then pulled through with a comb or stirred, and the sheet laid
// on the cover. Worked as the bath works: every drop is a ring of points, and
// each new drop and each pull of the comb moves every point there is, with
// new points let in wherever an edge stretches. (After the mathematics of
// marbling by Aubrey Jaffer and Shufang Lu.)

// The pattern, and the shape it was judged in.
export const PATTERNS = ["combed", "wavy", "stone", "swirl"] as const
export type Pattern = (typeof PATTERNS)[number]

export type MarblingParams = {
  // Drop size, as a share of the usual.
  scale: number
  // The comb: how far apart its teeth are, and how far it pulls.
  gap: number
  pull: number
  // How far a wave or a stir carries the ink.
  wave: number
  turn: number
}

// Where the sheet goes: beside the title with a sharp edge, a disc of it, or
// the whole cover with a paper label under each piece of content, as on an
// old book.
type Layout = "sheet" | "disc" | "label" | "full"

// A disc of marbling is drawn as large as its clear area holds.
const DISC = 1.2

// The colours dropped in turn, chosen by hand. A drop of ground between the
// inks leaves the pale veins marbled paper is known by.
const RAMPS: readonly (readonly Tone[])[] = [
  ["body", "ground", "partner", "strong", "soft"],
  ["strong", "soft", "body", "ground", "partner"],
  ["partner", "body", "ground", "strong", "body", "soft"],
  ["body", "strong", "ground", "soft", "partner", "ground"],
]

type Ink = { tone: Tone; points: number[] }
type Move = (x: number, y: number) => [number, number]

// An edge longer than this after a move gets a point in the middle, moved
// too, so a curve stays a curve however far it is pulled.
const LONGEST = 8
const DEEPEST = 7

// Moves every point of every ink, letting in points where edges stretch.
function move(inks: Ink[], to: Move) {
  for (const ink of inks) {
    const from = ink.points
    const out: number[] = []
    const count = from.length / 2
    for (let i = 0; i < count; i++) {
      const ax = from[i * 2]!
      const ay = from[i * 2 + 1]!
      const bx = from[((i + 1) % count) * 2]!
      const by = from[((i + 1) % count) * 2 + 1]!
      const a = to(ax, ay)
      out.push(a[0], a[1])
      between(ax, ay, a, bx, by, to(bx, by), to, out, 0)
    }
    ink.points = out
  }
}

function between(ax: number, ay: number, a: [number, number], bx: number, by: number, b: [number, number], to: Move, out: number[], depth: number) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (depth >= DEEPEST || dx * dx + dy * dy <= LONGEST * LONGEST) return
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const m = to(mx, my)
  between(ax, ay, a, mx, my, m, to, out, depth + 1)
  out.push(m[0], m[1])
  between(mx, my, m, bx, by, b, to, out, depth + 1)
}

// A drop of ink at x, y: everything already on the bath is pushed out by
// exactly its area, and it lies there as a circle.
function drop(inks: Ink[], x: number, y: number, r: number, tone: Tone) {
  const r2 = r * r
  move(inks, (px, py) => {
    const dx = px - x
    const dy = py - y
    const d2 = dx * dx + dy * dy
    const k = d2 > 0 ? Math.sqrt(1 + r2 / d2) : 1
    return [x + dx * k, y + dy * k]
  })
  const count = Math.max(24, Math.ceil((TAU * r) / LONGEST))
  const points: number[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU
    points.push(x + r * sin(a + TAU / 4), y + r * sin(a))
  }
  inks.push({ tone, points })
}

// A comb drawn across the bath along `across` (true: left to right), its
// teeth `gap` apart, each pulling the ink near it furthest. With `turn`,
// every other tooth pulls the other way, as a comb drawn back and forth does.
function comb(inks: Ink[], across: boolean, gap: number, pull: number, reach: number, offset: number, turn: boolean) {
  move(inks, (x, y) => {
    const t = (across ? y : x) - offset
    const step = Math.floor(t / gap)
    const d = Math.min(t - step * gap, gap - (t - step * gap))
    // Which tooth is nearest, for the way it pulls.
    const tooth = t - step * gap < gap / 2 ? step : step + 1
    const sign = turn && Math.abs(tooth) % 2 === 1 ? -1 : 1
    const f = (sign * pull * reach) / (d + reach)
    return across ? [x + f, y] : [x, y + f]
  })
}

// A wavy pull: ink moved along one axis by a wave running along the other.
function wave(inks: Ink[], across: boolean, size: number, length: number, phase: number) {
  move(inks, (x, y) => {
    const f = size * sin(((across ? y : x) / length) * TAU + phase)
    return across ? [x + f, y] : [x, y + f]
  })
}

// A stir round x, y: turned most at the middle, less further out.
function stir(inks: Ink[], x: number, y: number, turn: number, reach: number) {
  const r2 = reach * reach
  move(inks, (px, py) => {
    const dx = px - x
    const dy = py - y
    const a = (turn * r2) / (r2 + dx * dx + dy * dy)
    const c = sin(a + TAU / 4)
    const s = sin(a)
    return [x + dx * c - dy * s, y + dx * s + dy * c]
  })
}

// Fewer points where they add nothing: a point is dropped when it lies within
// `tolerance` of the line between its neighbours that are kept.
function simplify(points: number[], tolerance: number) {
  const count = points.length / 2
  if (count < 8) return points
  const keep = new Uint8Array(count)
  keep[0] = 1
  keep[count - 1] = 1
  const spans: [number, number][] = [[0, count - 1]]
  const t2 = tolerance * tolerance
  while (spans.length) {
    const [from, to] = spans.pop()!
    const ax = points[from * 2]!
    const ay = points[from * 2 + 1]!
    const bx = points[to * 2]!
    const by = points[to * 2 + 1]!
    const dx = bx - ax
    const dy = by - ay
    const length2 = dx * dx + dy * dy
    let worst = -1
    let far = 0
    for (let i = from + 1; i < to; i++) {
      const px = points[i * 2]! - ax
      const py = points[i * 2 + 1]! - ay
      const cross = px * dy - py * dx
      const d2 = length2 > 0 ? (cross * cross) / length2 : px * px + py * py
      if (d2 > far) {
        far = d2
        worst = i
      }
    }
    if (worst >= 0 && far > t2) {
      keep[worst] = 1
      spans.push([from, worst], [worst, to])
    }
  }
  const out: number[] = []
  for (let i = 0; i < count; i++) if (keep[i]) out.push(points[i * 2]!, points[i * 2 + 1]!)
  return out
}

const reaches = (points: number[], box: Box) => {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    left = Math.min(left, points[i]!)
    right = Math.max(right, points[i]!)
    top = Math.min(top, points[i + 1]!)
    bottom = Math.max(bottom, points[i + 1]!)
  }
  return right > box.x && left < box.x + box.w && bottom > box.y && top < box.y + box.h
}

// The marbled sheet over `box`, worked in the canvas's own units, where
// `unit` is the canvas's short side.
function marble(box: Box, unit: number, pattern: Pattern, ramp: readonly Tone[], rng: Rng, p: MarblingParams): Ink[] {
  const inks: Ink[] = []
  // Drops land a little past the box, so its edges are marbled too.
  const pad = unit * 0.08
  const area = { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 }
  const size = unit * p.scale
  const tone = (i: number) => ramp[i % ramp.length]!
  const place = rng.fork("drops")
  // Drops scattered until, between them, they would cover the bath `fill`
  // times over: a marbler covers the whole bath before combing, and the
  // veins are drops of the ground's own colour, not bare bath.
  const scatter = (fill: number, radius: () => number, first = 0) => {
    let covered = 0
    let i = first
    while (covered < fill * area.w * area.h && i - first < 280) {
      const r = radius()
      drop(inks, area.x + place.next() * area.w, area.y + place.next() * area.h, r, tone(i++))
      covered += 3.14159 * r * r
    }
    return i
  }

  if (pattern === "swirl") {
    // Drops let fall again and again at one spot make rings, which a stir
    // then winds into a spiral, over a bath already speckled.
    scatter(1, () => size * place.between([0.05, 0.09]), 2)
    const x = area.x + area.w * place.between([0.42, 0.58])
    const y = area.y + area.h * place.between([0.42, 0.58])
    const rings = 14
    const reach = Math.min(area.w, area.h) * 0.42
    for (let i = 0; i < rings; i++) drop(inks, x, y, (reach / Math.sqrt(rings)) * place.between([0.8, 1.2]), tone(i))
    // Drawn through once, then stirred off its middle, so the rings wind
    // into a spiral rather than turning in place.
    wave(inks, place.next() < 0.5, p.wave * 2, Math.max(area.w, area.h) * 0.5, place.next() * TAU)
    const off = reach * 0.3
    const a = place.next() * TAU
    stir(inks, x + off * sin(a + TAU / 4), y + off * sin(a), p.turn, reach * 0.8)
  } else if (pattern === "stone") {
    // Stone: large drops first, smaller ones landing among them, the colours
    // pressed into each other like pebbles.
    let k = 0
    scatter(1.2, () => size * place.between([0.06, 0.12]) * (1.2 - Math.min(1, k++ / 60) * 0.5))
    wave(inks, place.next() < 0.5, p.wave, unit * 0.7, place.next() * TAU)
  } else if (pattern === "wavy") {
    // Wavy: drops over the whole bath, drawn through with a stylus in long
    // waves, then once across, gently.
    const across = place.next() < 0.5
    scatter(1.1, () => size * place.between([0.04, 0.07]))
    wave(inks, across, p.wave * 4, unit * place.between([0.3, 0.42]), place.next() * TAU)
    wave(inks, !across, p.wave * 1.2, unit * place.between([0.5, 0.8]), place.next() * TAU)
  } else {
    // Combed: drops over the whole bath, then the comb drawn through them
    // back and forth, which pulls every drop into a chevron.
    const across = place.next() < 0.5
    scatter(1.05, () => size * place.between([0.035, 0.06]))
    comb(inks, across, p.gap, p.pull, p.gap * 0.3, place.next() * p.gap, true)
    wave(inks, !across, p.wave * 0.7, unit * 0.8, place.next() * TAU)
  }

  return inks
    .filter((ink) => reaches(ink.points, box))
    .map((ink) => ({ tone: ink.tone, points: simplify(ink.points, 0.9) }))
}

// The side of the title with the most room, as a sheet that bleeds off the
// canvas there. Null when no side has room for one.
function sheetBeside(frame: Frame, margin: number): Box | null {
  const { w, h, safe } = frame
  const bleed = margin
  const sides: Box[] = [
    { x: safe.x + safe.w + margin, y: -bleed, w: w - (safe.x + safe.w + margin) + bleed, h: h + bleed * 2 },
    { x: -bleed, y: -bleed, w: safe.x - margin + bleed, h: h + bleed * 2 },
    { x: -bleed, y: safe.y + safe.h + margin, w: w + bleed * 2, h: h - (safe.y + safe.h + margin) + bleed },
    { x: -bleed, y: -bleed, w: w + bleed * 2, h: safe.y - margin + bleed },
  ]
  // The biggest side that is neither a sliver nor a small part of the cover.
  const fit = sides.filter(
    (side) => Math.min(side.w, side.h) - bleed >= Math.min(w, h) * 0.3 && side.w * side.h >= w * h * 0.36
  )
  return fit.length ? fit.reduce((best, side) => (side.w * side.h > best.w * best.h ? side : best)) : null
}

const rect = (box: Box, radius = 0): Shape => ({ type: "rect", ...box, radii: [radius, radius, radius, radius] })

// A paper label under a piece of content: the paper, with a fine rule just
// inside its edge, as a printed label has.
function label(box: Box, index: number, unit: number): Mark[] {
  const rule = Math.max(1.5, unit * 0.0022)
  const inset = unit * 0.009
  return [
    { kind: "shapes", id: `label${index}`, paint: { type: "solid", tone: "ground", opacity: 1 }, shapes: [rect(box)] },
    {
      kind: "shapes",
      id: `rule${index}`,
      paint: { type: "solid", tone: "strong", opacity: 1 },
      shapes: [
        { type: "rect", x: box.x + inset, y: box.y + inset, w: box.w - inset * 2, h: rule, radii: [0, 0, 0, 0] },
        { type: "rect", x: box.x + inset, y: box.y + box.h - inset - rule, w: box.w - inset * 2, h: rule, radii: [0, 0, 0, 0] },
        { type: "rect", x: box.x + inset, y: box.y + inset, w: rule, h: box.h - inset * 2, radii: [0, 0, 0, 0] },
        { type: "rect", x: box.x + box.w - inset - rule, y: box.y + inset, w: rule, h: box.h - inset * 2, radii: [0, 0, 0, 0] },
      ],
    },
  ]
}

export function marbling(frame: Frame, pattern: Pattern, p: MarblingParams): Art {
  const { w, h, keep, titled, rng } = frame
  const unit = Math.min(w, h)
  const margin = unit * 0.05
  const choose = rng.fork("layout").next()
  const ramp = RAMPS[rng.fork("ramp").int(0, RAMPS.length - 1)]!

  // How the sheet sits. A sheet beside the title needs a side with room; a
  // disc, a clear area big enough to hold one.
  let layout: Layout
  let beside: Box | null = null
  if (frame.fill) layout = "full"
  else if (!titled) layout = choose < 0.7 || pattern !== "swirl" ? "full" : "disc"
  else {
    // With no roomy side, as round a title in the middle, the sheet covers
    // everything and the content sits on labels.
    beside = sheetBeside(frame, margin)
    const disc = pattern === "swirl" || choose < 0.2
    layout = !beside ? "label" : disc ? "disc" : choose < 0.62 ? "sheet" : "label"
    if (layout === "disc") {
      // A disc too small, or pushed off the canvas, reads as a mistake.
      const { x, y, r } = placeDiscs(frame, "disc", DISC).discs[0]!
      const off = Math.max(-(x - r), x + r - w, -(y - r), y + r - h)
      if (r < unit * 0.22 || off > r * 0.15) layout = "sheet"
    }
  }

  let shape: Shape
  let subject: Box | undefined
  if (layout === "disc") {
    const placed = placeDiscs(frame, "disc", DISC)
    const { x, y, r } = placed.discs[0]!
    shape = { type: "circle", cx: x, cy: y, r }
    subject = placed.subject
  } else if (layout === "sheet") shape = rect(beside!)
  else shape = rect({ x: -margin, y: -margin, w: w + margin * 2, h: h + margin * 2 })

  // On a moving cover the sheet drifts a little inside its edge, so it is
  // marbled that much further.
  const drift = unit * 0.025
  const bounds =
    shape.type === "circle"
      ? { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 }
      : shape.type === "rect"
        ? { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
        : { x: 0, y: 0, w, h }
  const seen = {
    x: Math.max(bounds.x, -margin) - drift,
    y: Math.max(bounds.y, -margin) - drift,
    w: Math.min(bounds.x + bounds.w, w + margin) - Math.max(bounds.x, -margin) + drift * 2,
    h: Math.min(bounds.y + bounds.h, h + margin) - Math.max(bounds.y, -margin) + drift * 2,
  }

  const inks = marble(seen, unit, pattern, ramp, rng.fork("bath"), p)
  const marks: Mark[] = [
    { kind: "shapes", id: "bath", paint: { type: "solid", tone: ramp.includes("ground") ? "quiet" : "ground", opacity: 1 }, shapes: [rect(seen)] },
    ...inks.map(
      (ink, index): Mark => ({
        kind: "shapes",
        id: `ink${index}`,
        paint: { type: "solid", tone: ink.tone, opacity: 1 },
        shapes: [{ type: "polygon", points: ink.points }],
      })
    ),
  ]

  let motion: Motion | undefined
  if (frame.motion !== "none") {
    const enter = { kind: "fade", delay: 0.1, duration: 1.8, dy: unit * 0.03 } as const
    const along = rng.fork("motion").next() * TAU
    motion = {
      enter,
      loop: { kind: "drift", dx: drift * 0.8 * sin(along + TAU / 4), dy: drift * 0.8 * sin(along), period: 22, start: enter.delay + enter.duration },
    }
  }

  const pieces: Piece[] = [{ id: "sheet", clip: shape, marks }]
  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks: [],
    pieces,
    over: layout === "label" ? inflate(keep, margin * 0.7).flatMap((box, index) => label(box, index, unit)) : [],
    ...(subject ? { subject } : null),
    ...(motion ? { moves: { plate: motion } } : null),
  }
}
