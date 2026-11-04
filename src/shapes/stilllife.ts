import { PI, sin, TAU } from "../core/math.ts"
import type { Mark, Paint, Shape } from "../core/scene.ts"
import { stops } from "../layouts/geometry.ts"

// The objects of a still life, each as the light on it: a mezzotint plate is
// black wherever nothing is scraped, so only the light is drawn. Light comes
// from `side` (-1 left, 1 right) and a little from in front. Every object
// stands, or lies, with its lowest point at `base`, and gives the outline it
// hides things behind it with, and how far it spans, for its shadow.

export type Thing = { marks: Mark[]; hides: Shape[]; span: [number, number] }

const cos = (a: number) => sin(a + TAU / 4)
const square = (x: number) => x * x
const shapes = (id: string, paint: Paint, list: Shape[]): Mark => ({ kind: "shapes", id, paint, shapes: list })
const light = (opacity: number): Paint => ({ type: "solid", tone: "strong", opacity })

// A soft light on a round thing: brightest at a spot toward the light,
// falling away into the black. `glossy` adds a small hard shine.
function roundLit(id: string, outline: number[], x: number, y: number, reach: number, peak: number, glossy = 0): Mark[] {
  const marks: Mark[] = [
    shapes(id, { type: "radial", cx: x, cy: y, r: reach, stops: stops("strong", [0, peak], [0.14, peak * 0.86], [0.34, peak * 0.42], [0.55, peak * 0.1], [0.75, peak * 0.02], [1, 0]) }, [
      { type: "polygon", points: outline },
    ]),
  ]
  if (glossy) {
    const r = reach * 0.09
    marks.push(shapes(`${id}-shine`, { type: "radial", cx: x, cy: y - r * 0.5, r, stops: stops("strong", [0, glossy], [1, 0]) }, [{ type: "circle", cx: x, cy: y - r * 0.5, r }]))
  }
  return marks
}

const spanOf = (points: number[]): [number, number] => {
  let low = Infinity
  let high = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    low = Math.min(low, points[i]!)
    high = Math.max(high, points[i]!)
  }
  return [low, high]
}

// The outline of a thing turned on a wheel: `radius(t)` its half-width at a
// share `t` of its height, in units of its height.
function turned(cx: number, base: number, height: number, radius: (t: number) => number, steps = 48) {
  const points: number[] = []
  for (let i = 0; i <= steps; i++) points.push(cx + radius(i / steps) * height, base - (i / steps) * height)
  for (let i = steps; i >= 0; i--) points.push(cx - radius(i / steps) * height, base - (i / steps) * height)
  return points
}

// A profile through knots of height and half-width, as one smooth curve
// through all of them (Catmull-Rom), so a turned form has no flat spots.
function eased(knots: readonly (readonly [number, number])[]) {
  const last = knots.length - 1
  return (t: number) => {
    let i = 0
    while (i < last - 1 && t > knots[i + 1]![0]) i++
    const [t1, p1] = knots[i]!
    const [t2, p2] = knots[i + 1]!
    const p0 = knots[Math.max(0, i - 1)]![1]
    const p3 = knots[Math.min(last, i + 2)]![1]
    const u = Math.min(1, Math.max(0, (t - t1) / (t2 - t1)))
    return 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u)
  }
}

// An ellipse as a line of points with a half-width at each, for a ribbon.
function arc(cx: number, cy: number, rx: number, ry: number, half: number, steps = 40) {
  const points: number[] = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU
    points.push(cx + rx * cos(a), cy + ry * sin(a), half)
  }
  return points
}

export function pear(x: number, base: number, height: number, side: number, peak: number): Thing {
  // Round at the bottom, sitting on a flattened base, and tapering in a long
  // soft waist to a narrow top.
  const radius = eased([[0, 0.12], [0.06, 0.3], [0.26, 0.37], [0.5, 0.27], [0.7, 0.17], [0.88, 0.12], [1, 0.03]])
  const outline = turned(x, base, height, radius)
  const stalk: number[] = []
  for (let i = 0; i <= 6; i++) {
    const k = i / 6
    stalk.push(x - side * height * 0.01 + side * height * 0.05 * k * k, base - height * (0.98 + 0.12 * k), height * 0.013 * (1 - k * 0.4))
  }
  return {
    marks: [
      ...roundLit("pear", outline, x + side * height * 0.13, base - height * 0.36, height * 0.75, peak, peak * 0.6),
      shapes("pear-stalk", light(peak * 0.4), [{ type: "ribbon", points: stalk }]),
    ],
    hides: [{ type: "polygon", points: outline }],
    span: spanOf(outline),
  }
}

// Lying on its side: half as long as `length`, `tall` high, rounder at one
// end (an egg) or pointed at both (a lemon).
function lying(id: string, x: number, base: number, length: number, tall: number, side: number, peak: number, kind: "egg" | "lemon"): Thing {
  const a = length / 2
  const b = tall / 2
  const cy = base - b
  const points: number[] = []
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * TAU
    const c = cos(t)
    const s = sin(t)
    if (kind === "egg") {
      // Fuller at the end away from the light.
      points.push(x + a * c, cy + b * s * (1 - 0.13 * c * side))
    } else {
      // A lemon's nub at each end.
      const nub = square(square(square(c)))
      points.push(x + a * c * (1 + 0.12 * nub), cy + b * s * (1 - 0.08 * nub))
    }
  }
  return {
    marks: roundLit(id, points, x + side * a * 0.32, cy - b * 0.32, Math.max(a, b) * 1.5, peak, kind === "egg" ? peak * 0.35 : peak * 0.5),
    hides: [{ type: "polygon", points }],
    span: spanOf(points),
  }
}

export const egg = (x: number, base: number, length: number, side: number, peak: number) => lying("egg", x, base, length, length * 0.76, side, peak, "egg")
export const lemon = (x: number, base: number, length: number, side: number, peak: number) => lying("lemon", x, base, length, length * 0.66, side, peak, "lemon")

// Two cherries on stems that meet above them.
export function cherries(x: number, base: number, size: number, side: number, peak: number): Thing {
  const r = size / 2
  const marks: Mark[] = []
  const hides: Shape[] = []
  const joint = { x: x + side * r * 0.4, y: base - size * 2.5 }
  for (const [k, dx] of [[0, -r * 1.05], [1, r * 1.05]] as const) {
    const cx = x + dx
    const cy = base - r
    const ring: number[] = []
    for (let i = 0; i < 40; i++) {
      const t = (i / 40) * TAU
      // A little dent at the top, where the stem goes in.
      const dent = 1 - 0.1 * square(square(Math.max(0, -sin(t))))
      ring.push(cx + r * cos(t), cy + r * sin(t) * dent)
    }
    marks.push(...roundLit(`cherry${k}`, ring, cx + side * r * 0.35, cy - r * 0.35, r * 1.7, peak * 0.7, peak))
    hides.push({ type: "polygon", points: ring })
    const stem: number[] = []
    for (let i = 0; i <= 8; i++) {
      const q = i / 8
      stem.push(cx + (joint.x - cx) * q + sin(q * PI) * r * 0.5 * (k ? 1 : -1), cy - r * 0.9 + (joint.y - (cy - r * 0.9)) * q, r * 0.07)
    }
    marks.push(shapes(`cherry${k}-stem`, light(peak * 0.42), [{ type: "ribbon", points: stem }]))
  }
  return { marks, hides, span: [x - r * 2.1, x + r * 2.1] }
}

// A thing with an open mouth, turned: a jar, a jug, a bowl. Its body reads by
// the light across it, brightest a third of the way in from the lit side;
// its mouth is dark inside, under a lit rim. `inside` shows the far inner
// wall, as a wide bowl does.
function vessel(id: string, x: number, base: number, height: number, radius: (t: number) => number, side: number, peak: number, tilt: number, inside = 0): Thing {
  const lip = radius(1) * height
  const top = base - height
  const ry = lip * tilt
  const outline = turned(x, base, height, radius)
  const half = outline.length / 2
  // Up the right side, along the near edge of the mouth, down the left.
  const front: number[] = []
  for (let i = 1; i < 24; i++) {
    const a = (i / 24) * PI
    front.push(x + lip * cos(a), top + ry * sin(a))
  }
  const body = [...outline.slice(0, half), ...front, ...outline.slice(half)]
  const widest = Math.max(...[0, 0.2, 0.4, 0.6, 0.8, 1].map(radius)) * height
  const marks: Mark[] = []
  if (inside) {
    // The inner wall facing the light is the one across from it.
    marks.push(shapes(`${id}-in`, { type: "linear", x1: x + side * lip, y1: 0, x2: x - side * lip, y2: 0, stops: stops("strong", [0, 0], [0.55, peak * inside * 0.3], [1, peak * inside]) }, [
      { type: "ellipse", cx: x, cy: top, rx: lip, ry },
    ]))
  }
  marks.push(
    shapes(id, { type: "linear", x1: x + side * widest, y1: 0, x2: x - side * widest, y2: 0, stops: stops("strong", [0, peak * 0.25], [0.24, peak * 0.9], [0.46, peak * 0.32], [0.7, peak * 0.03], [0.9, 0], [1, peak * 0.1]) }, [
      { type: "polygon", points: body },
    ]),
    shapes(`${id}-shine`, { type: "radial", cx: x + side * widest * 0.42, cy: base - height * 0.45, r: height * 0.22, stops: stops("strong", [0, peak * 0.45], [1, 0]) }, [{ type: "polygon", points: body }]),
    shapes(`${id}-rim`, { type: "linear", x1: x + side * lip, y1: 0, x2: x - side * lip, y2: 0, stops: stops("strong", [0, peak], [0.6, peak * 0.5], [1, peak * 0.2]) }, [
      { type: "ribbon", points: arc(x, top, lip, ry, Math.max(1, height * 0.011)) },
    ]),
  )
  return {
    marks,
    hides: [{ type: "polygon", points: body }, { type: "ellipse", cx: x, cy: top, rx: lip, ry }],
    span: [x - widest, x + widest],
  }
}

export const jar = (x: number, base: number, height: number, side: number, peak: number) =>
  vessel("jar", x, base, height, eased([[0, 0.34], [0.06, 0.38], [0.8, 0.4], [0.92, 0.37], [1, 0.4]]), side, peak, 0.22)

export const bowl = (x: number, base: number, height: number, side: number, peak: number) =>
  vessel("bowl", x, base, height, eased([[0, 0.42], [0.07, 0.46], [0.16, 0.62], [0.55, 1.18], [1, 1.45]]), side, peak, 0.3, 0.7)

export function jug(x: number, base: number, height: number, side: number, peak: number): Thing {
  const radius = eased([[0, 0.25], [0.18, 0.35], [0.44, 0.38], [0.74, 0.22], [0.88, 0.2], [1, 0.25]])
  const thing = vessel("jug", x, base, height, radius, side, peak, 0.24)
  // The handle on the shadowed side, its ends sunk into the body so it grows
  // out of it.
  const away = -side
  const handle: number[] = []
  for (let i = 0; i <= 20; i++) {
    const k = i / 20
    const t = 0.8 - k * 0.48
    handle.push(x + away * (radius(t) * height - height * 0.05 + sin(k * PI) * height * 0.2), base - t * height, height * (0.028 - 0.006 * sin(k * PI)))
  }
  thing.marks.push(shapes("jug-handle", { type: "linear", x1: 0, y1: base - height * 0.8, x2: 0, y2: base - height * 0.32, stops: stops("strong", [0, peak * 0.5], [1, peak * 0.1]) }, [{ type: "ribbon", points: handle }]))
  thing.hides.push({ type: "ribbon", points: handle })
  return thing
}

export function bottle(x: number, base: number, height: number, side: number, peak: number): Thing {
  const radius = eased([[0, 0.16], [0.03, 0.17], [0.56, 0.17], [0.68, 0.13], [0.74, 0.065], [0.78, 0.05], [0.96, 0.05], [1, 0.06]])
  const outline = turned(x, base, height, radius)
  const r = 0.17 * height
  const streak: number[] = []
  for (let i = 0; i <= 10; i++) {
    const t = 0.08 + (0.5 * i) / 10
    streak.push(x + side * r * 0.5, base - t * height, r * 0.07 * sin((i / 10) * PI))
  }
  return {
    marks: [
      shapes("bottle", { type: "linear", x1: x + side * r, y1: 0, x2: x - side * r, y2: 0, stops: stops("strong", [0, peak * 0.2], [0.26, peak * 0.85], [0.5, peak * 0.3], [0.75, peak * 0.03], [0.92, 0], [1, peak * 0.08]) }, [
        { type: "polygon", points: outline },
      ]),
      shapes("bottle-streak", light(peak * 0.7), [{ type: "ribbon", points: streak }]),
    ],
    hides: [{ type: "polygon", points: outline }],
    span: [x - r, x + r],
  }
}

// A wine glass: almost nothing of its own, only the light on its edges, a
// streak down the bowl, and a little wine at the bottom with a flat top.
export function glass(x: number, base: number, height: number, side: number, peak: number): Thing {
  const bottom = 0.5
  const widest = 0.82
  const width = 0.19
  const bowlAt = (t: number) => (t < bottom ? 0 : t < widest ? width * Math.sqrt(Math.max(0, 1 - square((widest - t) / (widest - bottom)))) : width)
  const edge = (direction: number, half: number) => {
    const points: number[] = []
    for (let i = 0; i <= 30; i++) {
      const t = bottom + ((1 - bottom) * i) / 30
      points.push(x + direction * bowlAt(t) * height, base - t * height, half)
    }
    return points
  }
  const streak: number[] = []
  for (let i = 0; i <= 12; i++) {
    const t = 0.62 + (0.3 * i) / 12
    streak.push(x + side * bowlAt(t) * height * 0.5, base - t * height, height * 0.011 * sin((i / 12) * PI))
  }
  const rx = width * height
  const level = 0.6
  const wineR = bowlAt(level) * height
  const wine = turned(x, base, height, (t) => (t < bottom || t > level ? 0 : bowlAt(t)), 24)
  return {
    marks: [
      shapes("glass-body", light(peak * 0.05), [{ type: "polygon", points: turned(x, base, height, bowlAt, 40) }]),
      shapes("glass-wine", { type: "radial", cx: x + side * wineR * 0.3, cy: base - height * 0.56, r: wineR * 1.4, stops: stops("strong", [0, peak * 0.42], [1, peak * 0.06]) }, [{ type: "polygon", points: wine }]),
      shapes("glass-wine-top", { type: "linear", x1: x + side * wineR, y1: 0, x2: x - side * wineR, y2: 0, stops: stops("strong", [0, peak * 0.55], [1, peak * 0.15]) }, [
        { type: "ellipse", cx: x, cy: base - level * height, rx: wineR, ry: wineR * 0.18 },
      ]),
      shapes("glass-near", light(peak * 0.85), [{ type: "ribbon", points: edge(side, height * 0.008) }]),
      shapes("glass-far", light(peak * 0.36), [{ type: "ribbon", points: edge(-side, height * 0.006) }]),
      shapes("glass-streak", light(peak * 0.6), [{ type: "ribbon", points: streak }]),
      shapes("glass-rim", { type: "linear", x1: x + side * rx, y1: 0, x2: x - side * rx, y2: 0, stops: stops("strong", [0, peak * 0.8], [1, peak * 0.3]) }, [
        { type: "ribbon", points: arc(x, base - height, rx, rx * 0.17, height * 0.006) },
      ]),
      shapes("glass-stem", { type: "linear", x1: x + side * height * 0.012, y1: 0, x2: x - side * height * 0.012, y2: 0, stops: stops("strong", [0, peak * 0.7], [1, peak * 0.2]) }, [
        { type: "ribbon", points: [x, base - height * 0.02, height * 0.013, x, base - height * 0.3, height * 0.008, x, base - height * bottom, height * 0.011] },
      ]),
      shapes("glass-foot", { type: "linear", x1: x + side * rx * 0.8, y1: 0, x2: x - side * rx * 0.8, y2: 0, stops: stops("strong", [0, peak * 0.6], [1, peak * 0.12]) }, [
        { type: "ellipse", cx: x, cy: base - height * 0.012, rx: rx * 0.8, ry: height * 0.02 },
      ]),
    ],
    // Glass hides nothing behind it.
    hides: [],
    span: [x - rx, x + rx],
  }
}
