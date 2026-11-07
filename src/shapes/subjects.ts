import { cos, PI, sin, TAU } from "../core/math.ts"
import type { Rng } from "../core/random.ts"
import type { Box, Mark, Pool, Shapes } from "../core/scene.ts"
import { center, distanceFrom, stops } from "../layouts/geometry.ts"
import type { Keep } from "../layouts/geometry.ts"

// One clear subject. Each has one crisp edge, and everything else about it is
// drawn as opacity, so a finish can dissolve it into grain or blur.
export const SUBJECTS = [
  "orb",
  "ring",
  "arch",
  "limb",
  "fold",
  "eclipse",
  "beam",
] as const
export type Subject = (typeof SUBJECTS)[number]

export type Stage = {
  w: number
  h: number
  // Every box kept clear for content.
  safe: Keep
  area: Box
  // Unit vector pointing away from the title.
  away: { x: number; y: number }
  // The side the light comes from, and the angle the grain gathers on: the
  // same on black, the far side on paper.
  lit: number
  light: number
  size: number
  peak: number
  rng: Rng
  // Where a framed subject sits, when the cover frames it (see framing.ts).
  at?: { x: number; y: number }
}

export type SubjectParams = {
  ringWeight: number
  limbScale: number
  sag: number
}

export type Drawn = { light: Mark[]; subject?: Box; cx: number; cy: number }

// Pushes a subject's box away from the title until it clears it, and lets it
// bleed off the far edge of the canvas if it has to.
export function seat(
  stage: Pick<Stage, "area" | "safe" | "w" | "h" | "away" | "at">,
  radius: number
) {
  if (stage.at) return stage.at
  const { area, safe, w, h } = stage
  const margin = Math.min(w, h) * 0.06
  const middle = center(area)
  let x = middle.x
  let y = middle.y
  if (area.x > 0) x = Math.max(x, area.x + radius + margin)
  else if (area.x + area.w < w) x = Math.min(x, area.x + area.w - radius - margin)
  if (area.y > 0) y = Math.max(y, area.y + radius + margin)
  else if (area.y + area.h < h) y = Math.min(y, area.y + area.h - radius - margin)
  // A subject beside a wide title also keeps off the title's end.
  if (distanceFrom(safe, x, y) < radius + margin) {
    x += stage.away.x * margin
    y += stage.away.y * margin
  }
  return { x, y }
}

const halo = (x: number, y: number, r: number, peak: number): Pool => ({
  kind: "pool",
  id: "halo",
  cx: x,
  cy: y,
  rx: r,
  ry: r,
  rotate: 0,
  tone: "strong",
  opacity: peak,
  core: 0.1,
})

function orb(stage: Stage, _: SubjectParams): Drawn {
  const r = Math.min(stage.area.w, stage.area.h) * 0.5 * stage.size
  const { x, y } = seat(stage, r)
  return {
    cx: x,
    cy: y,
    subject: { x: x - r, y: y - r, w: r * 2, h: r * 2 },
    light: [
      halo(x, y, r * 1.5, 0.16),
      {
        kind: "shapes",
        id: "orb",
        paint: {
          type: "radial",
          cx: x + cos(stage.light) * r * 0.62,
          cy: y + sin(stage.light) * r * 0.62,
          r: r * 1.78,
          stops: stops(
            "strong",
            [0, stage.peak],
            [0.36, stage.peak * 0.72],
            [0.72, stage.peak * 0.26],
            [1, 0]
          ),
        },
        shapes: [{ type: "circle", cx: x, cy: y, r }],
      },
    ],
  }
}

function ring(stage: Stage, { ringWeight }: SubjectParams): Drawn {
  const r = Math.min(stage.area.w, stage.area.h) * 0.5 * stage.size
  const { x, y } = seat(stage, r)
  const dx = cos(stage.light) * r
  const dy = sin(stage.light) * r
  return {
    cx: x,
    cy: y,
    subject: { x: x - r, y: y - r, w: r * 2, h: r * 2 },
    light: [
      // The glow sits at the lit edge of the band, not over the middle.
      halo(
        x + cos(stage.lit) * r * 0.95,
        y + sin(stage.lit) * r * 0.95,
        r * 0.75,
        0.22
      ),
      {
        kind: "shapes",
        id: "ring",
        paint: {
          type: "linear",
          x1: x + dx,
          y1: y + dy,
          x2: x - dx,
          y2: y - dy,
          stops: stops(
            "strong",
            [0, stage.peak],
            [0.5, stage.peak * 0.5],
            [1, 0.12]
          ),
        },
        shapes: [{ type: "ring", cx: x, cy: y, r, inner: r * ringWeight }],
      },
    ],
  }
}

function arch(stage: Stage, _: SubjectParams): Drawn {
  // Never past the area: an arch that loses its crown to the frame is a box.
  const span =
    Math.min(stage.area.h * 0.86, stage.area.w * 0.9) * Math.min(stage.size, 1)
  const width = span * 0.62
  const { x, y } = seat(stage, span / 2)
  const box = { x: x - width / 2, y: y - span / 2, w: width, h: span }
  return {
    cx: x,
    cy: y,
    subject: box,
    light: [
      halo(x, y - (span / 2) * 0.5, width * 1.15, 0.16),
      {
        kind: "shapes",
        id: "arch",
        paint: {
          type: "linear",
          // Always from the crown, so its foot melts away and never ends in
          // a hard lit line.
          x1: x,
          y1: y - span / 2,
          x2: x,
          y2: y + span / 2,
          stops: stops(
            "strong",
            [0, stage.peak],
            [0.5, stage.peak * 0.5],
            [1, 0.03]
          ),
        },
        shapes: [
          {
            type: "rect",
            ...box,
            radii: [width / 2, width / 2, 0, 0],
          },
        ],
      },
    ],
  }
}

// The rim of something far larger than the frame.
function limb(stage: Stage, { limbScale }: SubjectParams): Drawn {
  const { w, h, area, away } = stage
  const r = Math.max(w, h) * limbScale
  const middle = center(area)
  const rimX = middle.x - away.x * area.w * 0.12
  const rimY = middle.y - away.y * area.h * 0.12
  const x = rimX + away.x * r
  const y = rimY + away.y * r
  return {
    cx: rimX,
    cy: rimY,
    light: [
      halo(rimX, rimY, Math.min(area.w, area.h) * 0.9, 0.16),
      {
        kind: "shapes",
        id: "limb",
        paint: {
          type: "radial",
          cx: x,
          cy: y,
          r,
          stops: stops(
            "strong",
            [0.66, 0],
            [0.88, stage.peak * 0.22],
            [0.97, stage.peak * 0.68],
            [1, stage.peak]
          ),
        },
        shapes: [{ type: "circle", cx: x, cy: y, r }],
      },
    ],
  }
}

// Sheets of light turning over: a long slow wave of crisp edge, a body that
// thins out away from the title, and a second sheet behind it, out of step.
function fold(stage: Stage, { sag }: SubjectParams): Drawn {
  const { w, h, area, away, safe, rng } = stage
  const across = { x: -away.y, y: away.x }
  const span = Math.sqrt(w * w + h * h) * 0.75
  const reach = Math.min(area.w, area.h)
  const swell = reach * sag
  const waves = rng.between([0.9, 1.5])
  const phase = rng.next() * TAU
  const margin = Math.min(w, h) * 0.05
  const depth = reach * 0.62

  const edge = (ox: number, oy: number, height: number, shift: number) => {
    const points: { x: number; y: number }[] = []
    for (let i = 0; i <= 72; i++) {
      const along = -span + (2 * span * i) / 72
      const lift = height * sin((PI * waves * along) / span + shift)
      points.push({
        x: ox + across.x * along + away.x * lift,
        y: oy + across.y * along + away.y * lift,
      })
    }
    return points
  }

  // The edge stays clear of the title by moving away from it.
  const middle = center(area)
  let x = middle.x - away.x * reach * 0.12
  let y = middle.y - away.y * reach * 0.12
  for (let step = 0; step < 32; step++) {
    if (
      edge(x, y, swell, phase).every(
        (point) => distanceFrom(safe, point.x, point.y) > margin
      )
    ) {
      break
    }
    x += away.x * margin
    y += away.y * margin
  }

  const sheet = (
    id: string,
    ox: number,
    oy: number,
    height: number,
    shift: number,
    peak: number
  ): Shapes => {
    const line = edge(ox, oy, height, shift)
    const far = Math.max(w, h) * 2
    const first = line[0]!
    const last = line[line.length - 1]!
    return {
      kind: "shapes",
      id,
      paint: {
        type: "linear",
        x1: ox - away.x * height,
        y1: oy - away.y * height,
        x2: ox + away.x * (depth + height),
        y2: oy + away.y * (depth + height),
        stops: stops(
          "strong",
          [0, peak],
          [0.2, peak * 0.74],
          [0.52, peak * 0.2],
          [1, 0]
        ),
      },
      shapes: [
        {
          type: "polygon",
          points: [
            ...line.flatMap((point) => [point.x, point.y]),
            last.x + away.x * far,
            last.y + away.y * far,
            first.x + away.x * far,
            first.y + away.y * far,
          ],
        },
      ],
    }
  }

  const behind = reach * 0.3
  return {
    cx: x + away.x * reach * 0.2,
    cy: y + away.y * reach * 0.2,
    light: [
      sheet(
        "fold-back",
        x + away.x * behind,
        y + away.y * behind,
        swell * 0.8,
        phase + 1.5,
        stage.peak * 0.58
      ),
      sheet("fold", x, y, swell, phase, stage.peak),
    ],
  }
}

// A disc lit only at its rim, as the moon is in an eclipse.
function eclipse(stage: Stage, _: SubjectParams): Drawn {
  const r = Math.min(stage.area.w, stage.area.h) * 0.5 * stage.size
  const { x, y } = seat(stage, r)
  // The gradient is centred off toward the dark side, so only the lit rim
  // reaches its bright end.
  const cx = x - cos(stage.light) * r * 0.32
  const cy = y - sin(stage.light) * r * 0.32
  return {
    cx: x,
    cy: y,
    subject: { x: x - r, y: y - r, w: r * 2, h: r * 2 },
    light: [
      halo(x + cos(stage.lit) * r * 0.9, y + sin(stage.lit) * r * 0.9, r * 0.9, 0.24),
      {
        kind: "shapes",
        id: "eclipse",
        paint: {
          type: "radial",
          cx,
          cy,
          r: r * 1.32,
          stops: // The dark face keeps a little light, as the moon's does from the earth.
          stops("strong", [0, stage.peak * 0.12], [0.5, stage.peak * 0.12], [0.74, stage.peak * 0.4], [0.9, stage.peak * 0.85], [1, stage.peak]),
        },
        shapes: [{ type: "circle", cx: x, cy: y, r }],
      },
    ],
  }
}

// A wedge of light falling into the open area from beyond its far edge.
function beam(stage: Stage, _: SubjectParams): Drawn {
  const { area, away, w, h } = stage
  const across = { x: -away.y, y: away.x }
  const unit = Math.min(area.w, area.h)
  const middle = center(area)
  const reach = Math.max(w, h) * 0.9
  const turn = (stage.rng.next() - 0.5) * 0.9
  const dirX = -away.x + across.x * turn
  const dirY = -away.y + across.y * turn
  const length = Math.sqrt(dirX * dirX + dirY * dirY)
  const ux = dirX / length
  const uy = dirY / length
  // From a point past the far edge, toward the title, stopping short of it.
  const sx = middle.x - ux * reach * 0.55
  const sy = middle.y - uy * reach * 0.55
  const span = reach * 0.78
  const narrow = unit * 0.06 * stage.size
  const wide = unit * 0.42 * stage.size
  const px = -uy
  const py = ux
  const ex = sx + ux * span
  const ey = sy + uy * span
  return {
    cx: middle.x,
    cy: middle.y,
    light: [
      {
        kind: "shapes",
        id: "beam",
        paint: {
          type: "linear",
          x1: sx,
          y1: sy,
          x2: ex,
          y2: ey,
          stops: stops("strong", [0, stage.peak], [0.4, stage.peak * 0.62], [0.82, stage.peak * 0.12], [1, 0]),
        },
        shapes: [
          {
            type: "polygon",
            points: [
              sx + px * narrow, sy + py * narrow,
              ex + px * wide, ey + py * wide,
              ex - px * wide, ey - py * wide,
              sx - px * narrow, sy - py * narrow,
            ],
          },
        ],
      },
    ],
  }
}

export const DRAW_SUBJECT: Record<
  Subject,
  (stage: Stage, params: SubjectParams) => Drawn
> = { orb, ring, arch, limb, fold, eclipse, beam }
