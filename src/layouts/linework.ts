import { atan2, cos, PI, sin, TAU } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Loop, Motion, Shape } from "../core/scene.ts"
import { seat } from "../shapes/subjects.ts"
import { boxesTouch, inflate } from "./geometry.ts"
import { framing } from "./framing.ts"
import { clearing } from "./stage.ts"

// Diagrams drawn in hairlines of one ink, the small print of science and
// engineering: orbits, a fan of lines to a vanishing point, a barcode, a coil,
// contour lines round a peak, an instrument dial, a wireframe globe, a spiral,
// an oscilloscope figure and a plotted chart. No fills and no colour, so the
// drawing is all in where the lines go.
export const DIAGRAMS = [
  "orbits",
  "fan",
  "bars",
  "coil",
  "contour",
  "dial",
  "globe",
  "spiral",
  "lissajous",
  "chart",
] as const
export type Diagram = (typeof DIAGRAMS)[number]

export type LineworkParams = {
  size: number
  hair: number
  // How many lines a diagram is drawn with, from 0 to 1 of its own range.
  count: number
}

type Point = { x: number; y: number }

// A line of constant width, as the flat x, y, half-width triples a ribbon takes.
const line = (points: Point[], width: number): Shape => ({
  type: "ribbon",
  points: points.flatMap(({ x, y }) => [x, y, width / 2]),
})

function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  turn: number,
  steps = 180
): Point[] {
  const c = cos(turn)
  const s = sin(turn)
  const points: Point[] = []
  // Two steps past the start, so the ends of the loop overlap and leave no gap.
  for (let i = 0; i <= steps + 2; i++) {
    const t = (TAU * i) / steps
    const u = cos(t) * rx
    const v = sin(t) * ry
    points.push({ x: cx + u * c - v * s, y: cy + u * s + v * c })
  }
  return points
}

const circle = (cx: number, cy: number, r: number): Shape => ({
  type: "circle",
  cx,
  cy,
  r,
})

// Diagrams that run along a band rather than sit round a point. On a wide
// cover with the title low they take the band across the top.
const BANDS: readonly Diagram[] = ["coil", "chart"]
// The diagrams drawn round a centre, which a cover can frame.
const SEATED: readonly Diagram[] = ["orbits", "contour", "dial", "globe", "spiral", "lissajous", "bars"]

export function linework(frame: Frame, diagram: Diagram, p: LineworkParams): Art {
  const { w, h, safe, keep, titled, rng } = frame
  let { area, away } = clearing(frame)
  const wide = w > h * 1.3
  if (wide && BANDS.includes(diagram) && titled && safe.y > h * 0.35) {
    area = { x: 0, y: 0, w, h: safe.y }
    away = { x: 0, y: -1 }
  }
  // Wide covers leave a narrow strip beside the title, where a diagram drawn
  // to fit reads small, so it is drawn larger and may run off the far edge.
  const scale = wide ? 1.3 : 1
  // With nothing to keep clear, most diagrams drawn round a centre are framed
  // large and on a third, running off the edges (see framing.ts); a diagram
  // reaches about 0.46 of its unit from its centre.
  const framed = SEATED.includes(diagram) ? framing(frame, rng.fork("linework")) : undefined
  const unit = framed ? (framed.reach * Math.min(w, h)) / 0.92 : Math.min(area.w, area.h) * scale
  const seatAt = (radius: number) => framed ?? seat({ area, safe: keep, w, h, away }, radius)
  const margin = Math.min(w, h) * 0.05
  const draw = rng.fork("diagram")
  const across = { x: -away.y, y: away.x }
  const shapes: Shape[] = []
  const dots: Shape[] = []
  let subject: Box | undefined

  if (diagram === "orbits") {
    const r = unit * 0.48 * p.size
    const { x, y } = seatAt(r)
    const rings = 4 + Math.floor(p.count * 4)
    // Like an atom drawn in a textbook: every orbit shares the centre, turned
    // evenly round it, and each carries a body somewhere along it.
    for (let i = 0; i < 8; i++) {
      const rx = r * draw.between([0.72, 1])
      const ry = rx * draw.between([0.2, 0.46])
      const turn = (i * PI) / rings + draw.between([-0.12, 0.12])
      const at = draw.next() * TAU
      const carries = draw.next() < 0.5
      if (i >= rings) continue
      shapes.push(line(ellipse(x, y, rx, ry, turn), p.hair))
      if (carries) {
        const u = cos(at) * rx
        const v = sin(at) * ry
        dots.push(
          circle(x + u * cos(turn) - v * sin(turn), y + u * sin(turn) + v * cos(turn), p.hair * 3.2)
        )
      }
    }
    dots.push(circle(x, y, p.hair * 4.5))
    subject = { x: x - r, y: y - r, w: r * 2, h: r * 2 }
  } else if (diagram === "fan") {
    // Lines from one point near the title out to the far side, crossed by
    // verticals that crowd together as they recede.
    const depth = (area.w * Math.abs(away.x) + area.h * Math.abs(away.y)) * 0.9
    const spread =
      Math.min(area.w * Math.abs(across.x) + area.h * Math.abs(across.y), w + h) *
      0.9 *
      p.size
    const middle = { x: area.x + area.w / 2, y: area.y + area.h / 2 }
    const at = (u: number, v: number): Point => ({
      x: middle.x + away.x * u + across.x * v,
      y: middle.y + away.y * u + across.y * v,
    })
    // The point the fan grows from keeps clear of the title's margin, or every
    // line it sends out would touch the title and be dropped.
    const near = -depth / 2 + margin * 2.2
    const far = depth / 2
    const origin = draw.between([-0.45, 0.45]) * spread
    const rays = 14 + Math.floor(p.count * 16)
    for (let i = 0; i <= rays; i++) {
      const v = -spread / 2 + (spread * i) / rays
      shapes.push(line([at(near, origin), at(far, v)], p.hair))
    }
    const rungs = 5 + Math.floor(p.count * 5)
    for (let i = 1; i <= rungs; i++) {
      // Spaced as the square of their place, so they read as going away.
      const share = (i / rungs) * (i / rungs)
      const u = near + depth * share
      const half = (spread / 2) * share
      shapes.push(
        line([at(u, origin * (1 - share) - half), at(u, origin * (1 - share) + half)], p.hair)
      )
    }
    dots.push(circle(at(near, origin).x, at(near, origin).y, p.hair * 3.2))
  } else if (diagram === "contour") {
    // Nested rings around a peak, like a map's contour lines.
    const r = unit * 0.5 * p.size
    const { x, y } = seatAt(r)
    const rings = 7 + Math.floor(p.count * 6)
    const a1 = draw.between([0.06, 0.12])
    const a2 = draw.between([0.03, 0.07])
    const p1 = draw.next() * TAU
    const p2 = draw.next() * TAU
    const lean = draw.next() * TAU
    for (let k = 1; k <= rings; k++) {
      const share = k / rings
      // Inner rings drift toward one side, so the peak is off centre.
      const ox = x + cos(lean) * r * 0.22 * (1 - share)
      const oy = y + sin(lean) * r * 0.22 * (1 - share)
      const points: Point[] = []
      for (let i = 0; i <= 182; i++) {
        const t = (TAU * i) / 180
        const rr = r * share * (1 + a1 * sin(3 * t + p1) + a2 * sin(5 * t + p2))
        points.push({ x: ox + cos(t) * rr, y: oy + sin(t) * rr })
      }
      shapes.push(line(points, k === rings ? p.hair * 1.4 : p.hair))
    }
    dots.push(circle(x + cos(lean) * r * 0.22, y + sin(lean) * r * 0.22, p.hair * 3))
    subject = { x: x - r * 1.15, y: y - r * 1.15, w: r * 2.3, h: r * 2.3 }
  } else if (diagram === "dial") {
    // An instrument face: rings, a scale of ticks, and one reading marked.
    const r = unit * 0.48 * p.size
    const { x, y } = seatAt(r)
    for (const share of [1, 0.84, 0.46]) {
      shapes.push(line(ellipse(x, y, r * share, r * share, 0), p.hair))
    }
    const ticks = 60
    for (let i = 0; i < ticks; i++) {
      const t = (TAU * i) / ticks
      const long = i % 5 === 0
      const inner = r * (long ? 0.88 : 0.93)
      shapes.push(
        line(
          [
            { x: x + cos(t) * inner, y: y + sin(t) * inner },
            { x: x + cos(t) * r * 0.98, y: y + sin(t) * r * 0.98 },
          ],
          long ? p.hair * 1.3 : p.hair * 0.8
        )
      )
    }
    // The marked reading faces the middle of the cover, so it is never the
    // part of the dial that runs off the edge.
    const span = draw.between([0.6, 1.6])
    const from = atan2(h / 2 - y, w / 2 - x) - span / 2 + (draw.next() - 0.5) * 0.8
    const arc: Point[] = []
    for (let i = 0; i <= 60; i++) {
      const t = from + (span * i) / 60
      arc.push({ x: x + cos(t) * r * 0.65, y: y + sin(t) * r * 0.65 })
    }
    shapes.push(line(arc, p.hair * 5))
    shapes.push(
      line(
        [
          { x, y },
          { x: x + cos(from + span) * r * 0.8, y: y + sin(from + span) * r * 0.8 },
        ],
        p.hair * 1.2
      )
    )
    dots.push(circle(x, y, p.hair * 3.5))
    subject = { x: x - r, y: y - r, w: r * 2, h: r * 2 }
  } else if (diagram === "globe") {
    // A globe seen from a little above, turned and tilted: its meridians and
    // parallels projected from a sphere, and only the face toward us drawn.
    const r = unit * 0.46 * p.size
    const { x, y } = seatAt(r)
    const tilt = draw.between([-0.4, 0.4])
    const lift = draw.between([0.25, 0.55])
    const spin = draw.next() * TAU
    const ct = cos(tilt)
    const st = sin(tilt)
    const ce = cos(lift)
    const se = sin(lift)
    // A point on the sphere, by latitude and longitude, on the page, and
    // whether it faces us.
    const project = (lat: number, lon: number) => {
      const px = cos(lat) * sin(lon + spin)
      const py = sin(lat)
      const pz = cos(lat) * cos(lon + spin)
      const vy = py * ce - pz * se
      const vz = py * se + pz * ce
      const sx = px * r
      const sy = -vy * r
      return { x: x + sx * ct - sy * st, y: y + sx * st + sy * ct, front: vz >= 0 }
    }
    const trace = (at: (t: number) => { x: number; y: number; front: boolean }, steps: number) => {
      let run: Point[] = []
      for (let i = 0; i <= steps; i++) {
        const point = at(i / steps)
        if (point.front) run.push(point)
        else if (run.length) {
          if (run.length > 1) shapes.push(line(run, p.hair))
          run = []
        }
      }
      if (run.length > 1) shapes.push(line(run, p.hair))
    }
    const meridians = 8 + Math.floor(p.count * 6)
    for (let k = 0; k < meridians; k++) {
      const lon = (k * PI) / meridians * 2
      trace((t) => project(-PI / 2 + PI * t, lon), 90)
    }
    for (const lat of [-60, -40, -20, 0, 20, 40, 60]) {
      trace((t) => project((lat / 180) * PI, TAU * t), 180)
    }
    shapes.push(line(ellipse(x, y, r, r, 0), p.hair * 1.4))
    subject = { x: x - r, y: y - r, w: r * 2, h: r * 2 }
  } else if (diagram === "spiral") {
    // An Archimedean spiral: even turns, like a record's groove.
    const r = unit * 0.42 * p.size
    const { x, y } = seatAt(r)
    const turns = 6 + Math.floor(p.count * 6)
    const start = draw.next() * TAU
    const points: Point[] = []
    const samples = turns * 90
    for (let i = 0; i <= samples; i++) {
      const t = (TAU * turns * i) / samples
      const rr = (r * i) / samples
      points.push({ x: x + cos(t + start) * rr, y: y + sin(t + start) * rr })
    }
    shapes.push(line(points, p.hair))
    dots.push(circle(x, y, p.hair * 3))
    subject = { x: x - r, y: y - r, w: r * 2, h: r * 2 }
  } else if (diagram === "lissajous") {
    // The figure an oscilloscope draws from two tones at a simple ratio.
    const r = unit * 0.4 * p.size
    const { x, y } = seatAt(r)
    const [a, b] = draw.pick([
      [3, 2],
      [5, 4],
      [3, 4],
      [5, 6],
      [7, 6],
      [4, 5],
    ] as const)
    const phase = draw.between([0.2, 1.3])
    const points: Point[] = []
    const samples = 900
    for (let i = 0; i <= samples; i++) {
      const t = (TAU * i) / samples
      points.push({ x: x + sin(a * t + phase) * r, y: y + sin(b * t) * r * 0.86 })
    }
    shapes.push(line(points, p.hair))
    subject = { x: x - r, y: y - r, w: r * 2, h: r * 2 }
  } else if (diagram === "chart") {
    // A plotted line on axes, with a light grid and its readings marked.
    const box = inflate(area, -margin * 1.4)
    const left = box.x
    const bottom = box.y + box.h
    shapes.push(line([{ x: left, y: box.y }, { x: left, y: bottom }, { x: box.x + box.w, y: bottom }], p.hair * 1.3))
    const columns = 8 + Math.floor(p.count * 6)
    const rows = 4
    for (let i = 1; i <= columns; i++) {
      const x = left + (box.w * i) / columns
      shapes.push(line([{ x, y: bottom }, { x, y: bottom + margin * 0.3 }], p.hair))
    }
    for (let j = 1; j <= rows; j++) {
      const y = bottom - (box.h * j) / (rows + 0.4)
      // Dotted, so the grid stays behind the line.
      for (let x = left; x < box.x + box.w; x += margin * 0.5) {
        shapes.push(line([{ x, y }, { x: x + margin * 0.18, y }], p.hair * 0.6))
      }
    }
    const rise = draw.between([0.35, 0.7])
    const f = draw.between([1.5, 3.2])
    const ph = draw.next() * TAU
    // Its readings run from -0.08 to 1.02 at the very most, fitted between
    // the axis and the top of the chart so the line never crosses either.
    const reading = (u: number) =>
      0.12 + rise * u + 0.14 * sin(u * f * TAU + ph) + 0.06 * sin(u * 11 + ph * 2)
    const value = (u: number) => 0.04 + ((reading(u) + 0.08) * 0.92) / 1.1
    const points: Point[] = []
    for (let i = 0; i <= 120; i++) {
      const u = i / 120
      points.push({ x: left + box.w * u, y: bottom - box.h * value(u) })
    }
    shapes.push(line(points, p.hair * 1.6))
    for (let i = 1; i <= columns; i++) {
      const u = i / columns
      dots.push(circle(left + box.w * u, bottom - box.h * value(u), p.hair * 2.6))
    }
    subject = box
  } else if (diagram === "bars") {
    // A barcode: verticals of a few fixed widths, thinning out to one side.
    const side = unit * 0.92 * p.size
    const { x, y } = seatAt(side / 2)
    const box: Box = { x: x - side / 2, y: y - side / 2, w: side, h: side }
    const widths = [1, 1, 1, 2, 2, 4, 7]
    let cursor = box.x
    let index = 0
    while (cursor < box.x + box.w && index < 400) {
      const width = p.hair * draw.pick(widths)
      const gap = p.hair * draw.between([1.5, 6]) * (1 + ((cursor - box.x) / box.w) * 2.5)
      const tall = draw.next()
      const share = (cursor - box.x) / box.w
      // A few bars stop short, in a slow wave, like a waveform.
      const height = box.h * (tall < 0.75 ? 1 : 0.35 + 0.65 * (0.5 + 0.5 * sin(share * PI * 3)))
      if (cursor + width <= box.x + box.w) {
        shapes.push({
          type: "rect",
          x: cursor,
          y: box.y + box.h - height,
          w: width,
          h: height,
          radii: [0, 0, 0, 0],
        })
      }
      cursor += width + gap
      index++
    }
    subject = box
  } else {
    // A trochoid: a point on a wheel bigger than the circle it rolls on, which
    // draws a row of loops. It runs along the clear area's long side.
    const flat = area.w >= area.h
    const run = { x: flat ? 1 : 0, y: flat ? 0 : 1 }
    const rise = { x: flat ? 0 : 1, y: flat ? 1 : 0 }
    const long = Math.max(area.w, area.h)
    const short = Math.min(area.w, area.h)
    const loops = 4 + Math.floor(p.count * 5)
    // At least a fifth of the short side tall, or many loops in a squarish
    // area each shrink to a sliver.
    const r = Math.max(
      Math.min(((long * 0.84) / loops) * draw.between([0.55, 0.85]), short * 0.36),
      short * 0.2
    )
    // Its ends overshoot by most of a loop, and must stop short of the title's
    // margin, or the whole line would be dropped.
    const length = Math.min(
      Math.min(long * 0.84, short * loops * 0.6) * p.size,
      long - 2 * (r * 0.7 + margin * 1.6)
    )
    const step = length / loops / TAU
    const middle = { x: area.x + area.w / 2, y: area.y + area.h / 2 }
    const points: Point[] = []
    const samples = loops * 72
    for (let i = 0; i <= samples; i++) {
      const t = (TAU * loops * i) / samples
      const u = -length / 2 + step * t - r * 0.62 * sin(t)
      const v = r * cos(t)
      points.push({
        x: middle.x + run.x * u + rise.x * v,
        y: middle.y + run.y * u + rise.y * v,
      })
    }
    shapes.push(line(points, p.hair * 1.2))
    const ex = (flat ? length / 2 + r * 0.7 : r)
    const ey = (flat ? r : length / 2 + r * 0.7)
    subject = { x: middle.x - ex, y: middle.y - ey, w: ex * 2, h: ey * 2 }
  }

  // Nothing is drawn on the title. A fan or a coil can cross its edge, so the
  // shapes that would are dropped rather than clipped.
  const clear = (shape: Shape) => {
    if (!titled) return true
    const zone = inflate(keep, margin)
    if (shape.type === "ribbon") {
      for (let i = 0; i < shape.points.length; i += 3) {
        const half = shape.points[i + 2]!
        const box = { x: shape.points[i]! - half, y: shape.points[i + 1]! - half, w: half * 2, h: half * 2 }
        if (boxesTouch(box, zone)) return false
        // A long straight line can cross the title between two points that
        // are both clear of it.
        if (i >= 3 && zone.some((area) => crosses(shape.points[i - 3]!, shape.points[i - 2]!, shape.points[i]!, shape.points[i + 1]!, inflate(area, half)))) return false
      }
      return true
    }
    if (shape.type === "rect") return !boxesTouch(shape, zone)
    if (shape.type === "polygon") {
      for (let i = 0; i < shape.points.length; i += 2) {
        const box = { x: shape.points[i]!, y: shape.points[i + 1]!, w: 0, h: 0 }
        if (boxesTouch(box, zone)) return false
      }
      return true
    }
    if (shape.type === "circle") {
      return !boxesTouch({ x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 }, zone)
    }
    return true
  }
  if (subject && titled && boxesTouch(subject, inflate(keep, 0))) subject = undefined

  // A soft light behind the diagram, so the ground isn't flat paper.
  const lit = subject ?? { x: area.x, y: area.y, w: area.w, h: area.h }
  const glow = Math.max(lit.w, lit.h) * 0.95
  const under: Art["under"] = [
    { kind: "fill", id: "ground", tone: "ground" },
    {
      kind: "pool",
      id: "glow",
      cx: lit.x + lit.w / 2,
      cy: lit.y + lit.h / 2,
      rx: glow,
      ry: glow,
      rotate: 0,
      tone: "soft",
      opacity: 0.5,
      core: 0.1,
    },
  ]

  // A diagram is drawn on line by line, the way a plotter draws it, and its
  // dots follow. A round one then turns slowly about its middle; the rest
  // swing a little. Only one that keeps clear of the title moves at all.
  const lines = shapes.filter(clear)
  const moves = frame.motion !== "none"
  const stagger = Math.min(0.08, 1.1 / Math.max(lines.length, 1))
  const drawn = 0.2 + 1.4 + stagger * Math.max(lines.length - 1, 0)
  const ROUND: readonly Diagram[] = ["orbits", "spiral", "lissajous"]
  const loop: Loop | undefined =
    moves && subject
      ? ROUND.includes(diagram)
        ? { kind: "spin", cx: subject.x + subject.w / 2, cy: subject.y + subject.h / 2, period: 120 }
        : { kind: "swing", degrees: 3, cx: subject.x + subject.w / 2, cy: subject.y + subject.h / 2, period: 16 }
      : undefined
  const lineMotion: Motion | undefined = moves
    ? { enter: { kind: "draw", delay: 0.2, duration: 1.4, stagger }, ...(loop ? { loop } : null) }
    : undefined
  const dotMotion: Motion | undefined = moves
    ? { enter: { kind: "fade", delay: drawn - 0.4, duration: 0.6 }, ...(loop ? { loop } : null) }
    : undefined

  return {
    under,
    marks: [
      {
        kind: "shapes",
        id: "lines",
        paint: { type: "solid", tone: "strong", opacity: 1 },
        shapes: lines,
        ...(lineMotion ? { motion: lineMotion } : null),
      },
      {
        kind: "shapes",
        id: "dots",
        paint: { type: "solid", tone: "strong", opacity: 1 },
        shapes: dots.filter(clear),
        ...(dotMotion ? { motion: dotMotion } : null),
      },
    ],
    over: [],
    ...(subject ? { subject } : null),
  }
}

// Whether the segment from a to b passes through the box, by clipping it to
// the box's sides in turn (Liang and Barsky's way).
function crosses(ax: number, ay: number, bx: number, by: number, box: Box) {
  let from = 0
  let to = 1
  const dx = bx - ax
  const dy = by - ay
  for (const [p, q] of [[-dx, ax - box.x], [dx, box.x + box.w - ax], [-dy, ay - box.y], [dy, box.y + box.h - ay]] as const) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) from = Math.max(from, t)
    else to = Math.min(to, t)
    if (from > to) return false
  }
  return true
}
