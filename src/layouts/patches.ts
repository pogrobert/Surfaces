import { cos, PI, sin } from "../core/math.ts"
import type { Art, Frame, Piece } from "../core/recipe.ts"
import type { Box, Mark, Shape, Tone } from "../core/scene.ts"
import { behind, boundsOf, circle, curve, insideOf, keptClear, union } from "../grammar/kit.ts"
import type { Points } from "../grammar/kit.ts"
import { seated } from "../grammar/seated.ts"
import { clearing } from "./stage.ts"
import { card } from "./swatchbook.ts"

// Soft plain forms, a circle, a rounded square and a pill, laid over one
// another, each filled with a pattern of its own small marks: dots, rings,
// short dashes or squares on a grid, as a print studio fills shapes from its
// sheets of screen tone. A cluster of them, the same over a large disc of fine
// speckle, a row of pills overlapping, or one large form with a smaller one
// over its corner.

export const SUBJECTS = ["cluster", "disc", "row", "pair"] as const
export type Subject = (typeof SUBJECTS)[number]

export type PatchParams = {
  size: number
  // The pattern's pitch, as a share of the subject.
  pitch: number
  // How large a mark is in its cell.
  fill: number
  tilt: number
}

const PATTERNS = ["dots", "rings", "dashes", "squares"] as const
type Kind = (typeof PATTERNS)[number] | "stagger"
type Pattern = Kind

// A rounded square, a superellipse, at x, y of `side`, turned `angle`.
function squircle(x: number, y: number, side: number, angle: number): Points {
  const c = cos(angle)
  const s = sin(angle)
  return curve((t) => {
    const a = t * 2 * PI
    const ca = cos(a)
    const sa = sin(a)
    const u = (Math.sign(ca) * Math.abs(ca) ** 0.5 * side) / 2
    const v = (Math.sign(sa) * Math.abs(sa) ** 0.5 * side) / 2
    return [x + u * c - v * s, y + u * s + v * c]
  }, 96)
}

const solid = (id: string, tone: Tone, shapes: Shape[], opacity = 1): Mark => ({ kind: "shapes", id, paint: { type: "solid", tone, opacity }, shapes })

// A pattern of small marks over a box, only where they fall inside `outline`.
function pattern(kind: Pattern, box: Box, outline: Points, pitch: number, fill: number): Shape[] {
  const shapes: Shape[] = []
  const r = (pitch * fill) / 2
  const round = (v: number) => Math.round(v * 2) / 2
  for (let j = 0, y = box.y + pitch / 2; y < box.y + box.h + pitch; j++, y += pitch) {
    const shift = kind === "stagger" && j % 2 ? pitch / 2 : 0
    for (let x = box.x + pitch / 2 + shift; x < box.x + box.w + pitch; x += pitch) {
      if (!insideOf([outline], x, y)) continue
      if (kind === "dots" || kind === "stagger") shapes.push({ type: "circle", cx: round(x), cy: round(y), r: round(r) })
      else if (kind === "rings") shapes.push({ type: "ring", cx: round(x), cy: round(y), r: round(r * 1.1), inner: round(r * 0.6) })
      else if (kind === "dashes") shapes.push({ type: "rect", x: round(x - r * 1.3), y: round(y - r * 0.38), w: round(r * 2.6), h: round(r * 0.76), radii: [0, 0, 0, 0] })
      else shapes.push({ type: "rect", x: round(x - r * 0.82), y: round(y - r * 0.82), w: round(r * 1.64), h: round(r * 1.64), radii: [0, 0, 0, 0] })
    }
  }
  return shapes
}

export function patches(frame: Frame, subject: Subject, p: PatchParams): Art {
  const { w, h, rng, theme } = frame
  const draw = rng.fork("patches")
  const stage = frame.fill ? { area: { x: 0, y: 0, w, h }, away: { x: 0, y: -1 } } : clearing(frame)
  const seat = seated(frame, stage, p.size, draw)
  const side = behind(frame, seat.side, 0.85)
  const { x: cx, y: cy } = seat
  const order = [...PATTERNS]
  for (let i = order.length - 1; i > 0; i--) {
    const j = draw.int(0, i)
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  // Each form a coat of one colour and marks of another on it.
  const coats: [Tone, Tone][] = [
    ["accent", "ink"],
    ["partner", "strong"],
    ["soft", "accent"],
    ["body", "ground"],
  ]
  const offset = draw.int(0, coats.length - 1)

  type Form = { outline: Points; pattern: Pattern }
  const forms: Form[] = []
  const add = (outline: Points) => forms.push({ outline, pattern: order[forms.length % order.length]! })
  let disc: Points | undefined
  if (subject === "cluster" || subject === "disc") {
    // Three forms of different kinds and sizes heaped together.
    const turn = p.tilt
    const shapes = [
      (x: number, y: number, s: number) => circle(x, y, s / 2, 96),
      (x: number, y: number, s: number) => squircle(x, y, s, turn),
      (x: number, y: number, s: number) => card(x, y, s * 1.3, s * 0.62, s * 0.31, turn - 0.5),
    ]
    const first = draw.int(0, 2)
    const scale = subject === "disc" ? 0.78 : 1
    const spots = [
      [-0.16, -0.12, 0.52],
      [0.18, -0.02, 0.42],
      [-0.04, 0.2, 0.4],
    ]
    spots.forEach(([u, v, s], k) => add(shapes[(first + k) % 3]!(cx + u! * side * scale, cy + v! * side * scale, s! * side * scale)))
    if (subject === "disc") disc = circle(cx, cy, side * 0.48, 120)
  } else if (subject === "row") {
    // Pills in a row, each over the last, the long way of the space.
    const wide = stage.area.w >= stage.area.h
    const count = 4
    const length = side * 0.44
    const thick = side * 0.3
    for (let k = 0; k < count; k++) {
      const t = (k - (count - 1) / 2) * side * 0.27
      const lean = p.tilt * 0.5 + (wide ? 0.22 : PI / 2 - 0.22)
      add(card(cx + (wide ? t : 0), cy + (wide ? 0 : t), length, thick, thick / 2, lean))
    }
  } else {
    // One large rounded square, and a smaller circle over its corner.
    add(squircle(cx - side * 0.07, cy - side * 0.06, side * 0.6, p.tilt * 0.25))
    add(circle(cx + side * 0.22, cy + side * 0.22, side * 0.19, 96))
  }

  const outlines = keptClear(frame, [...(disc ? [disc] : []), ...forms.map((form) => form.outline)], stage.away)
  const placed = disc ? outlines.slice(1) : outlines
  const shrink = boundsOf(outlines[0]!).w / boundsOf(disc ?? forms[0]!.outline).w
  const pitch = side * shrink * p.pitch
  const pieces: Piece[] = []
  if (disc) {
    // The disc: deep, with a fine speckle of the paper across it.
    const round = outlines[0]!
    pieces.push({ id: "disc", clip: { type: "polygon", points: round }, marks: [solid("disc-coat", theme === "dark" ? "quiet" : "strong", [{ type: "polygon", points: round }]), solid("disc-speckle", theme === "dark" ? "body" : "soft", pattern("stagger", boundsOf(round), round, pitch * 0.55, 0.34), 0.55)] })
  }
  placed.forEach((outline, k) => {
    const [coat, ink] = coats[(k + offset) % coats.length]!
    const id = `form${k}`
    const box = boundsOf(outline)
    pieces.push({
      id,
      clip: { type: "polygon", points: outline },
      marks: [solid(`${id}-coat`, coat, [{ type: "polygon", points: outline }], 0.94), solid(`${id}-marks`, ink, pattern(forms[k]!.pattern, box, outline, pitch * (k % 2 ? 1.3 : 1), p.fill))],
    })
  })
  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks: [],
    pieces,
    over: [],
    subject: union(outlines.map(boundsOf)),
  }
}
