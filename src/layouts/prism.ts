import { clamp, cos, PI, sin, TAU } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Layer, Mark, Shape, Tone } from "../core/scene.ts"
import { behind, boundsOf, keptClear, union } from "../grammar/kit.ts"
import type { Points } from "../grammar/kit.ts"
import { seated } from "../grammar/seated.ts"
import { clearing } from "./stage.ts"

// Light through glass: wide bands that run from the brand's deepest shade to
// its palest across their width, softly, as a spectrum does, with a fringe of
// the partner colour along one edge and of the brand's along the other, where
// a lens splits light at its edges. One band flowing across in an S, three
// laid in folds over one another, a tilted ring, or a row of upright bars of
// light, as a test card has them.

export const SUBJECTS = ["ribbon", "folds", "ring", "bars"] as const
export type Subject = (typeof SUBJECTS)[number]

export type PrismParams = {
  size: number
  // How wide a band is, as a share of the subject.
  band: number
  // How far the fringes stand out, as a share of a band's width.
  split: number
  turn: number
}

// Across a band from one edge to the other: deep to pale.
const ACROSS: readonly Tone[] = ["strong", "strong", "accent", "accent", "body", "body", "soft", "soft"]

const solid = (id: string, tone: Tone, shapes: Shape[], opacity = 1): Mark => ({ kind: "shapes", id, paint: { type: "solid", tone, opacity }, shapes })

// A band along a centre line: its stripes across, each a polygon, and its
// outline whole. `wide` is its width at each point, 0 to 1 along it.
function band(centre: Points, width: (t: number) => number, stripes: number) {
  const n = centre.length / 2
  const normals: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = Math.max(i - 1, 0)
    const b = Math.min(i + 1, n - 1)
    const dx = centre[b * 2]! - centre[a * 2]!
    const dy = centre[b * 2 + 1]! - centre[a * 2 + 1]!
    const d = Math.hypot(dx, dy) || 1
    normals.push([-dy / d, dx / d])
  }
  const edge = (share: number) => {
    const points: Points = []
    for (let i = 0; i < n; i++) {
      const off = (share - 0.5) * width(i / (n - 1))
      points.push(centre[i * 2]! + normals[i]![0] * off, centre[i * 2 + 1]! + normals[i]![1] * off)
    }
    return points
  }
  const reversed = (points: Points) => {
    const out: Points = []
    for (let i = points.length - 2; i >= 0; i -= 2) out.push(points[i]!, points[i + 1]!)
    return out
  }
  const edges = Array.from({ length: stripes + 1 }, (_, k) => edge(k / stripes))
  return {
    outline: [...edges[0]!, ...reversed(edges[stripes]!)],
    stripes: Array.from({ length: stripes }, (_, k) => [...edges[k]!, ...reversed(edges[k + 1]!)]),
    normals,
  }
}

const shifted = (points: Points, dx: number, dy: number) => points.map((v, i) => v + (i % 2 ? dy : dx))

export function prism(frame: Frame, subject: Subject, p: PrismParams): Art {
  const { w, h, rng } = frame
  const draw = rng.fork("prism")
  const stage = frame.fill ? { area: { x: 0, y: 0, w, h }, away: { x: 0, y: -1 } } : clearing(frame)
  const seat = seated(frame, stage, p.size, draw)
  const side = behind(frame, seat.side, 0.85)
  const { x: cx, y: cy } = seat
  const wide = side * p.band
  const angle = p.turn

  // Each band as a centre line and a width along it.
  const bands: { centre: Points; width: (t: number) => number }[] = []
  // A line through the middle at `angle`, swinging to either side of it.
  const sway = (length: number, swing: number, waves: number, phase: number, dy = 0) => {
    const points: Points = []
    const c = cos(angle)
    const s = sin(angle)
    for (let i = 0; i <= 120; i++) {
      const t = i / 120
      const u = (t - 0.5) * length
      const v = dy + sin(t * PI * waves + phase) * swing
      points.push(cx + u * c - v * s, cy + u * s + v * c)
    }
    return points
  }
  // Round at its ends, full along its middle.
  const ends = (t: number) => wide * clamp(Math.sqrt(Math.max(0, sin(PI * clamp(t, 0, 1)))) * 1.25, 0, 1)
  let bars: { x: number; w: number; top: Tone; foot: Tone }[] = []
  let frameBox = { x: 0, y: 0, w: 0, h: 0 }
  if (subject === "ribbon") {
    bands.push({ centre: sway(side * 0.98, side * 0.16, 2, draw.between([-0.4, 0.4])), width: (t) => ends(t) * 1.4 })
  } else if (subject === "folds") {
    const phase = draw.next() * TAU
    for (let k = 0; k < 3; k++) bands.push({ centre: sway(side * 0.92, side * 0.1, 1.6, phase + k * 0.7, (k - 1) * wide * 0.9), width: ends })
  } else if (subject === "ring") {
    // A ring seen at a slant: the near half of the band wider than the far.
    const r = side * 0.36
    const flat = draw.between([0.42, 0.56])
    const points: Points = []
    // A little past a full turn, so the band's ends overlap and leave no seam.
    for (let i = 0; i <= 150; i++) {
      const a = (i / 144) * TAU
      const u = cos(a) * r
      const v = sin(a) * r * flat
      points.push(cx + u * cos(angle) - v * sin(angle), cy + u * sin(angle) + v * cos(angle))
    }
    bands.push({ centre: points, width: (t) => wide * (0.85 + 0.3 * sin(t * TAU * (144 / 150))) })
  } else {
    // Upright bars of differing widths side by side, each running from one
    // tone at its top to another at its foot.
    const count = draw.int(6, 8)
    const total = side * 0.9
    const widths = Array.from({ length: count }, () => draw.between([0.6, 1.4]))
    const sum = widths.reduce((a, b) => a + b, 0)
    let x = cx - total / 2
    const tones: Tone[] = ["strong", "accent", "partner", "body", "soft", "accent", "strong", "partner"]
    bars = widths.map((share, k) => {
      const bw = (share / sum) * total
      const bar = { x, w: bw, top: tones[k % tones.length]!, foot: tones[(k + 3) % tones.length]! }
      x += bw
      return bar
    })
    frameBox = { x: cx - total / 2, y: cy - side * 0.34, w: total, h: side * 0.68 }
  }

  // Everything is kept clear of the title as one.
  const over: Layer[] = []
  let outlines: Points[]
  if (subject === "bars") {
    const box = frameBox
    const drawn = bars.map((bar) => [bar.x, box.y, bar.x + bar.w, box.y, bar.x + bar.w, box.y + box.h, bar.x, box.y + box.h])
    outlines = keptClear(frame, drawn, stage.away)
    const split = (outlines[0]![2]! - outlines[0]![0]!) * p.split * 1.4
    const fringes: Mark[] = []
    const fills: Mark[] = []
    outlines.forEach((outline, k) => {
      const at = boundsOf(outline)
      const bar = bars[k]!
      // The fringes: the bar again in the partner a little to one side and
      // in the brand's colour a little to the other, under the bar itself.
      if (k === 0) fringes.push(solid(`bar${k}-left`, "partner", [{ type: "polygon", points: shifted(outline, -split, 0) }], 0.9))
      if (k === outlines.length - 1) fringes.push(solid(`bar${k}-right`, "accent", [{ type: "polygon", points: shifted(outline, split, 0) }], 0.9))
      fills.push({ kind: "shapes", id: `bar${k}`, paint: { type: "linear", x1: at.x, y1: at.y, x2: at.x, y2: at.y + at.h, stops: [{ at: 0, tone: bar.top, opacity: 1 }, { at: 1, tone: bar.foot, opacity: 1 }] }, shapes: [{ type: "polygon", points: outline }] })
    })
    // Between bars the light bleeds a little, as it does on a screen.
    const whole = union(outlines.map(boundsOf))
    over.push(...fringes, { kind: "clip", id: "bars", shape: { type: "rect", ...whole, radii: [0, 0, 0, 0] }, layers: [{ kind: "soften", id: "bars-light", radius: clamp(whole.w * 0.004, 1, 8), layers: fills }] })
  } else {
    // The steps across a band are drawn a little past its edges, so when
    // they run softly together inside it its edge keeps its full colour.
    const built = bands.map((each) => ({ ...band(each.centre, (t) => each.width(t) * 1.3, ACROSS.length), outline: band(each.centre, each.width, 1).outline }))
    const all = built.flatMap((each) => [each.outline, ...each.stripes])
    const placed = keptClear(frame, all, stage.away)
    const shrink = boundsOf(placed[0]!).w / boundsOf(all[0]!).w || 1
    const split = wide * shrink * p.split
    const per = ACROSS.length + 1
    outlines = built.map((_, k) => placed[k * per]!)
    built.forEach((each, k) => {
      const outline = placed[k * per]!
      const stripes = placed.slice(k * per + 1, (k + 1) * per)
      // The fringes lie across the band's general way, one either side.
      const [nx, ny] = each.normals[Math.floor(each.normals.length / 2)]!
      over.push(
        solid(`band${k}-fringe-a`, "partner", [{ type: "polygon", points: shifted(outline, nx * split, ny * split) }], 0.9),
        solid(`band${k}-fringe-b`, "accent", [{ type: "polygon", points: shifted(outline, -nx * split, -ny * split) }], 0.8),
        {
          kind: "clip",
          id: `band${k}`,
          shape: { type: "polygon", points: outline },
          layers: [{ kind: "soften", id: `band${k}-light`, radius: clamp(((wide * shrink) / ACROSS.length) * 0.9, 1, 40), layers: ACROSS.map((tone, i) => solid(`band${k}-${i}`, tone, [{ type: "polygon", points: stripes[i]! }])) }],
        }
      )
    })
  }
  const marks: Mark[] = []
  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks,
    over,
    subject: union(outlines.map(boundsOf)),
  }
}
