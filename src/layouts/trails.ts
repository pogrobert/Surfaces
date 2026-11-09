import { clamp, cos, PI, sin, TAU } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Layer, Mark, Shape, Tone } from "../core/scene.ts"
import { behind, boundsOf, circle, keptClear } from "../grammar/kit.ts"
import type { Points } from "../grammar/kit.ts"
import { stroke } from "../grammar/materials.ts"
import { seated } from "../grammar/seated.ts"
import { inflate } from "./geometry.ts"
import { clearing } from "./stage.ts"

// Lights moving through a long exposure: each leaves a streak, thin where it
// came into the frame and where it left it, in the greys of a night street,
// and one of them hot, in the brand's colour, glowing. A bundle sweeping
// across the sheet in a long curve, trails orbiting one point in tilted
// rings, a bundle bending round a corner, or short streaks drifting one way.

export const SUBJECTS = ["sweep", "orbit", "bend", "drift"] as const
export type Subject = (typeof SUBJECTS)[number]

export type TrailParams = {
  size: number
  // Streaks in the bundle.
  streaks: number
  // The width of a streak, as a share of the subject.
  width: number
  // How far the glow round the hot streak reaches, as a share of its width.
  glow: number
  turn: number
}

const GREYS: readonly Tone[] = ["soft", "body", "body", "strong", "quiet"]

export function trails(frame: Frame, subject: Subject, p: TrailParams): Art {
  const { w, h, titled, keep, rng, theme } = frame
  const draw = rng.fork("trails")
  const stage = frame.fill ? { area: { x: 0, y: 0, w, h }, away: { x: 0, y: -1 } } : clearing(frame)
  const seat = seated(frame, stage, p.size, draw)
  const first = behind(frame, seat.side, 0.85)
  const outline = circle(seat.x, seat.y, first / 2, 72)
  const whole = subject === "sweep" || subject === "drift" || subject === "bend"
  const [fitted] = whole ? [outline] : (keptClear(frame, [outline], stage.away) as [Points])
  const at = boundsOf(fitted)
  const side = first * (at.w / boundsOf(outline).w)
  const cx = at.x + at.w / 2
  const cy = at.y + at.h / 2
  // Streaks across the whole sheet are as wide as its area says.
  const scale = whole ? Math.sqrt(w * h) : side
  const width = scale * p.width
  const clear = [...(titled ? inflate(keep, width * 6) : []), ...inflate(frame.calm, width * 3)]
  const onTitle = (x: number, y: number) => clear.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)

  // Every streak a path, broken where it would cross the title, and drawn
  // tapering at each end of each piece, as a light comes in and goes out.
  const groups = new Map<Tone, Shape[]>()
  const put = (tone: Tone, path: number[], k: number) => {
    const pieces: number[][] = [[]]
    for (let i = 0; i < path.length; i += 2) {
      const x = path[i]!
      const y = path[i + 1]!
      if (onTitle(x, y)) {
        if (pieces.at(-1)!.length) pieces.push([])
        continue
      }
      pieces.at(-1)!.push(x, y)
    }
    for (const piece of pieces) if (piece.length >= 12) groups.set(tone, [...(groups.get(tone) ?? []), stroke(piece, width * k)])
  }
  // The hot streak, kept for last, glowing.
  let hot: number[] = []

  const n = Math.round(p.streaks)
  const pick = draw.fork("tones")
  const along = (points: (t: number) => [number, number], from: number, to: number, steps = 90) => {
    const path: number[] = []
    for (let i = 0; i <= steps; i++) path.push(...points(from + ((to - from) * i) / steps))
    return path
  }
  if (subject === "sweep") {
    // A long S across the sheet, the bundle loose at its edges and tight in
    // its middle, each light in it for a stretch of the way.
    const a = p.turn * 0.6
    const ux = cos(a)
    const uy = sin(a)
    const length = Math.sqrt(w * w + h * h) * 1.1
    const swing = Math.min(w, h) * draw.between([0.14, 0.22])
    const phase = draw.next() * TAU
    const spread = Math.min(w, h) * 0.32
    const hotAt = draw.int(Math.floor(n * 0.3), Math.floor(n * 0.7))
    for (let k = 0; k < n; k++) {
      const offset = (((k + 0.5) / n - 0.5) * 2) ** 3 * spread + draw.between([-0.5, 0.5]) * width * 3
      const from = draw.between([-0.1, 0.35])
      const to = from + draw.between([0.45, 0.9])
      const path = along((t) => {
        const s = (t - 0.5) * length
        const bend = sin(t * PI * 1.6 + phase) * swing
        return [w / 2 + s * ux - (offset + bend) * uy, h / 2 + s * uy + (offset + bend) * ux]
      }, from, Math.min(to, 1.1), 120)
      if (k === hotAt) hot = path
      else put(pick.pick(GREYS), path, pick.between([0.5, 1.1]))
    }
  } else if (subject === "orbit") {
    // Lights circling one point, seen at a slant: tilted rings, each light
    // round part of its way.
    const flat = draw.between([0.34, 0.5])
    const tilt = p.turn
    const r = side / 2
    const hotAt = draw.int(Math.floor(n * 0.4), n - 2)
    for (let k = 0; k < n; k++) {
      const ring = r * (0.28 + (0.68 * (k + 0.5)) / n)
      const start = draw.next() * TAU
      const span = draw.between([0.8, 1.7]) * PI
      const path = along((t) => {
        const u = cos(t) * ring
        const v = sin(t) * ring * flat
        return [cx + u * cos(tilt) - v * sin(tilt), cy + u * sin(tilt) + v * cos(tilt)]
      }, start, start + span, 100)
      if (k === hotAt) hot = path
      else put(pick.pick(GREYS), path, pick.between([0.5, 1]))
    }
  } else if (subject === "bend") {
    // A bundle coming in along one edge and turning out through the next,
    // round the corner furthest from the title.
    const corners = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ] as const
    const far = titled ? corners.reduce((best, corner) => (Math.hypot(corner[0] - (keep[0]!.x + keep[0]!.w / 2), corner[1] - (keep[0]!.y + keep[0]!.h / 2)) > Math.hypot(best[0] - (keep[0]!.x + keep[0]!.w / 2), best[1] - (keep[0]!.y + keep[0]!.h / 2)) ? corner : best)) : draw.pick(corners)
    const [ox, oy] = far
    // The turn from one edge to the next about that corner, a quarter round.
    const start = Math.atan2(h / 2 - oy, w / 2 - ox) - PI / 4
    const base = Math.min(w, h) * draw.between([0.42, 0.62])
    const spread = Math.min(w, h) * 0.3
    const hotAt = draw.int(Math.floor(n * 0.3), Math.floor(n * 0.7))
    for (let k = 0; k < n; k++) {
      const radius = base + (((k + 0.5) / n - 0.5) * 2) * spread + draw.between([-0.5, 0.5]) * width * 2
      const from = draw.between([-0.05, 0.15])
      const to = draw.between([0.85, 1.05])
      const path = along((t) => {
        const a = start + t * (PI / 2)
        return [ox + cos(a) * radius, oy + sin(a) * radius]
      }, from, to, 110)
      if (k === hotAt) hot = path
      else put(pick.pick(GREYS), path, pick.between([0.5, 1.1]))
    }
  } else {
    // Short streaks all drifting one way across the sheet, as lights seen
    // from a moving train, and one long one among them.
    const a = p.turn
    const ux = cos(a)
    const uy = sin(a)
    const count = n * 3
    for (let k = 0; k < count; k++) {
      const x = draw.next() * w
      const y = draw.next() * h
      const length = Math.min(w, h) * draw.between([0.08, 0.3])
      const path = along((t) => [x + (t - 0.5) * length * ux, y + (t - 0.5) * length * uy], 0, 1, 24)
      put(pick.pick(GREYS), path, pick.between([0.4, 1]))
    }
    const length = Math.max(w, h) * 0.9
    const y = h * draw.between([0.3, 0.7])
    hot = along((t) => [w / 2 + (t - 0.5) * length * ux, y + (t - 0.5) * length * uy], 0, 1, 90)
  }

  // The hot streak: a wide glow of the brand's colour under it, its colour,
  // and a white-hot core.
  const glow: Shape[] = []
  const core: Shape[] = []
  const lit: Shape[] = []
  const hotPieces: number[][] = [[]]
  for (let i = 0; i < hot.length; i += 2) {
    if (onTitle(hot[i]!, hot[i + 1]!)) {
      if (hotPieces.at(-1)!.length) hotPieces.push([])
      continue
    }
    hotPieces.at(-1)!.push(hot[i]!, hot[i + 1]!)
  }
  for (const piece of hotPieces) {
    if (piece.length < 12) continue
    glow.push(stroke(piece, width * 2.4 * p.glow))
    lit.push(stroke(piece, width * 2.2))
    core.push(stroke(piece, width * 0.7))
  }
  const marks: Mark[] = [...groups].map(([tone, shapes]) => ({ kind: "shapes", id: `streaks-${tone}`, paint: { type: "solid", tone, opacity: 0.9 }, shapes }))
  const over: Layer[] = glow.length
    ? [
        { kind: "soften", id: "glow", radius: clamp(width * p.glow * 1.4, 2, 40), layers: [{ kind: "shapes", id: "glow-light", paint: { type: "solid", tone: "accent", opacity: 0.55 }, shapes: glow }] },
        { kind: "shapes", id: "hot", paint: { type: "solid", tone: "accent", opacity: 1 }, shapes: lit },
        { kind: "shapes", id: "hot-core", paint: { type: "solid", tone: theme === "dark" ? "ink" : "ground", opacity: 0.85 }, shapes: core },
      ]
    : []
  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks,
    // Above the grain's plate, the hot light stays clean.
    over,
    ...(whole ? null : { subject: { x: cx - side / 2, y: cy - side / 2, w: side, h: side } }),
  }
}
