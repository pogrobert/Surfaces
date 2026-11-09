import { atan2, clamp, cos, PI, sin, smoothstep, TAU } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Mark, Shape, Tone } from "../core/scene.ts"
import { behind } from "../grammar/kit.ts"
import { stroke, streamlines } from "../grammar/materials.ts"
import { seated } from "../grammar/seated.ts"
import { inflate } from "./geometry.ts"
import { clearing } from "./stage.ts"

// Lines drawn along a current, evenly apart, each following a flow that means
// something: a stream parting round a stone, as smoke does in a wind tunnel;
// a whirl drawing in to its eye; two streams meeting and running on as one,
// each keeping its colour; or a field of flow across the whole sheet, parting
// round the title.

export const SUBJECTS = ["obstacle", "vortex", "confluence", "field"] as const
export type Subject = (typeof SUBJECTS)[number]

export type CurrentsParams = {
  size: number
  // The gap between lines, as a share of the subject.
  gap: number
  weight: number
  // The way the current runs, in radians off level.
  turn: number
}

const lines = (id: string, tone: Tone, shapes: Shape[]): Mark => ({ kind: "shapes", id, paint: { type: "solid", tone, opacity: 1 }, shapes })

export function currents(frame: Frame, subject: Subject, p: CurrentsParams): Art {
  const { w, h, titled, keep, rng } = frame
  const draw = rng.fork("currents")
  const stage = frame.fill ? { area: { x: 0, y: 0, w, h }, away: { x: 0, y: -1 } } : clearing(frame)
  const seat = seated(frame, stage, p.size, draw)
  const side = behind(frame, seat.side, 0.85)
  const { x: cx, y: cy } = seat
  const gap = side * p.gap
  // No line crosses the title, or the clearing a title in the middle stands on.
  const clear = [...(titled ? inflate(keep, gap * 2) : []), ...inflate(frame.calm, gap)]
  const onTitle = (x: number, y: number) => clear.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)
  const r = side / 2
  const inRound = (x: number, y: number) => (x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r
  const square: Box = { x: cx - r, y: cy - r, w: side, h: side }
  const groups = new Map<Tone, Shape[]>()
  const put = (tone: Tone, path: number[], k = 1) => groups.set(tone, [...(groups.get(tone) ?? []), stroke(path, gap * p.weight * k)])
  const extra: Mark[] = []
  let own: Box | undefined

  if (subject === "obstacle") {
    // Flow past a cylinder: the lines part round it, crowd and quicken at its
    // sides, and close again behind it, all inside a round window.
    const stone = side * 0.15
    const ux = cos(p.turn)
    const uy = sin(p.turn)
    const velocity = (x: number, y: number) => {
      const a = (x - cx) * ux + (y - cy) * uy
      const b = -(x - cx) * uy + (y - cy) * ux
      const d = a * a + b * b
      const k = (stone * stone) / (d * d)
      return [1 - k * (a * a - b * b), -2 * k * a * b] as const
    }
    const angleAt = (x: number, y: number) => {
      const [u, v] = velocity(x, y)
      return p.turn + atan2(v, u)
    }
    const blocked = (x: number, y: number) => !inRound(x, y) || onTitle(x, y) || (x - cx) * (x - cx) + (y - cy) * (y - cy) < stone * stone * 1.25
    // Let in evenly along the inlet, upstream across the window, and run
    // through to the far side.
    const inlet: [number, number][] = []
    for (let t = -r + gap * 0.8; t < r; t += gap * 1.5) {
      // Just inside the window's edge on the upstream side, at this height.
      const back = Math.sqrt(Math.max(r * r - t * t, 0)) * 0.985
      inlet.push([cx - ux * back - uy * t, cy - uy * back + ux * t])
    }
    for (const { path, x, y } of streamlines(draw.fork("lines"), square, angleAt, gap, { blocked, steps: 400, seeds: inlet, apart: false })) {
      const [u, v] = velocity(x, y)
      const speed = Math.sqrt(u * u + v * v)
      put(speed > 1.35 ? "strong" : speed > 1.08 ? "accent" : "body", path, clamp(speed, 0.8, 1.5))
    }
    extra.push({ kind: "shapes", id: "stone", paint: { type: "solid", tone: "strong", opacity: 1 }, shapes: [{ type: "circle", cx, cy, r: stone }] })
    own = square
  } else if (subject === "vortex") {
    // A whirl: lines turning round a still eye and drawn in toward it, darker
    // and heavier as they near it.
    const eye = side * 0.05
    const spin = p.turn > 0 ? 1 : -1
    const pull = 0.32
    const angleAt = (x: number, y: number) => atan2(y - cy, x - cx) + spin * (PI / 2 + pull)
    const blocked = (x: number, y: number) => !inRound(x, y) || onTitle(x, y) || (x - cx) * (x - cx) + (y - cy) * (y - cy) < eye * eye
    for (const { path, x, y } of streamlines(draw.fork("lines"), square, angleAt, gap, { blocked, steps: 320 })) {
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / r
      put(d < 0.35 ? "strong" : d < 0.7 ? "accent" : "body", path, 1.35 - d * 0.6)
    }
    own = square
  } else if (subject === "confluence") {
    // Two streams coming in at an angle and joining into one that runs on
    // level, each keeping its colour: every line eases from the height it
    // comes in at to a little under half of it, side by side, never crossing.
    const length = side * 1.35
    const height = side * 0.8
    const angle = p.turn * 0.5
    const ux = cos(angle)
    const uy = sin(angle)
    const box: Box = { x: cx - length / 2, y: cy - height / 2, w: length, h: height }
    const at = (a: number, b: number) => [cx + a * ux - b * uy, cy + a * uy + b * ux] as const
    const ripple = draw.next() * TAU
    for (let b0 = -height / 2 + gap * 0.8; b0 < height / 2; b0 += gap * 1.5) {
      const path: number[] = []
      for (let i = 0; i <= 120; i++) {
        const t = i / 120
        const ease = smoothstep(clamp(t * 1.5, 0, 1))
        const b = b0 * (1 - ease * 0.56) + sin(t * PI * 3 + ripple) * gap * 0.5 * ease
        const [x, y] = at(-length / 2 + t * length, b)
        if (onTitle(x, y)) {
          if (path.length >= 8) put(b0 < 0 ? "accent" : "partner", path.splice(0))
          path.length = 0
          continue
        }
        path.push(x, y)
      }
      if (path.length >= 8) put(b0 < 0 ? "accent" : "partner", path)
    }
    own = box
  } else {
    // A field of flow across the whole sheet in a few slow turns, parting
    // round the title.
    const waves = Array.from({ length: 4 }, (_, i) => {
      const a = draw.next() * TAU
      const k = (TAU / Math.max(w, h)) * draw.between([0.5, 1.3]) * (1 + i * 0.45)
      return { kx: cos(a) * k, ky: sin(a) * k, phase: draw.next() * TAU, amp: 1 / (1 + i * 0.6) }
    })
    const total = waves.reduce((sum, wave) => sum + wave.amp, 0)
    const turnAt = (x: number, y: number) => waves.reduce((sum, wave) => sum + wave.amp * sin(wave.kx * x + wave.ky * y + wave.phase), 0) / total
    const angleAt = (x: number, y: number) => p.turn + turnAt(x, y) * 1.6
    // Spaced by the canvas's area, so a thin strip is no denser than a card.
    const field = Math.sqrt(w * h) * p.gap * 1.15
    for (const { path, x, y } of streamlines(draw.fork("lines"), { x: 0, y: 0, w, h }, angleAt, field, { blocked: onTitle, steps: 300 })) {
      const s = turnAt(x + w * 0.17, y - h * 0.11)
      put(s > 0.3 ? "strong" : s > -0.2 ? "accent" : "body", path, (field / gap) * 0.9)
    }
    own = undefined
  }

  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks: [...[...groups].map(([tone, shapes]) => lines(`flow-${tone}`, tone, shapes)), ...extra],
    over: [],
    ...(own ? { subject: own } : null),
  }
}
