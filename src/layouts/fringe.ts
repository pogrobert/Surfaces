import { atan2, PI, sin, smoothstep, TAU } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Enter, Layer, Mark, Shapes } from "../core/scene.ts"
import { center, furthestAlong } from "./geometry.ts"
import { lines } from "./lines.ts"
import { clearing } from "./stage.ts"

// One huge soft mass with its edge breaking up into fine fringes, the pattern
// light makes on a slow surface: the lines stand at right angles to the edge,
// waver as they leave it, and thin away into the light. The mass stays clear of
// the title by as far as its longest fringe.
export type FringeParams = {
  length: number
  swing: number
  breadth: number
  spacing: number
  hair: number
  swell: number
  waver: number
  wavelength: number
  lean: number
  glow: number
  // How out of focus the finish draws the fringes, which a copy of them drawn
  // outside it has to match.
  focus: number
}


const MARGIN = 40
// How far into the mass a line starts.
const ROOT = 120

export function fringe(frame: Frame, p: FringeParams): Art {
  const { w, h, safe, titled, rng } = frame
  let { area, away } = clearing(frame)
  // On a wide cover with the title low, half the seeds hang the mass from the
  // top edge instead of the far side, as the tall covers do, so wide covers
  // aren't all one picture.
  const top = rng.fork("side").next() < 0.5
  if (titled && top && w > h * 1.3 && safe.y > h * 0.35) {
    area = { x: 0, y: 0, w, h: safe.y }
    away = { x: 0, y: -1 }
  }
  const out = (x: number, y: number) => x * away.x + y * away.y
  const along = (x: number, y: number) => -x * away.y + y * away.x
  const point = (a: number, o: number) => ({
    x: away.x * o - away.y * a,
    y: away.y * o + away.x * a,
  })

  // How much canvas lies past the title, which everything here has to share.
  const start = titled ? furthestAlong(safe, away) : out(w / 2, h / 2) - 200
  const room = furthestAlong({ x: 0, y: 0, w, h }, away) - start - MARGIN
  // Fringes long enough to carry the cover, on an edge calm enough not to
  // compete with them.
  const reach = Math.min(p.length, room * 0.52)
  const swing = Math.min(p.swing, room * 0.08)
  const base = start + MARGIN + reach + swing
  const breadth = room * p.breadth

  const curve = rng.fork("edge")
  const span = Math.sqrt(w * w + h * h)
  const middle = along(...(Object.values(center(area)) as [number, number]))
  const bendRate = (curve.between([0.5, 0.95]) * TAU) / (span * 0.9)
  const bendPhase = curve.next() * TAU
  const swellRate = (curve.between([0.6, 1.2]) * TAU) / (span * 0.9)
  const swellPhase = curve.next() * TAU
  const edge = (a: number) => base + swing * sin(a * bendRate + bendPhase)
  const depth = (a: number) =>
    breadth * (0.72 + 0.28 * sin(a * swellRate + swellPhase))

  // The mass, far enough along its edge to leave the frame at both ends.
  const steps = 56
  const near: number[] = []
  const far: number[][] = []
  for (let i = 0; i <= steps; i++) {
    const a = middle - span + (2 * span * i) / steps
    const at = point(a, edge(a))
    const back = point(a, edge(a) + depth(a))
    near.push(at.x, at.y)
    far.unshift([back.x, back.y])
  }

  // Where along the edge the fringes grow. They come in patches: an edge that
  // frays everywhere reads as a texture, not as something happening.
  const grain = rng.fork("fringe")
  const patchRate = (grain.between([0.9, 1.6]) * TAU) / (span * 0.75)
  const patchPhase = grain.next() * TAU
  const patch = (a: number) =>
    smoothstep(0.6 + 0.9 * sin(a * patchRate + patchPhase))
  const lengthRate = (grain.between([1.5, 2.6]) * TAU) / span
  const lengthPhase = grain.next() * TAU
  // Fringes shorten to nothing at the ends of a patch, so a patch has no end to
  // see: it grows out of the edge and goes back into it.
  const length = (a: number) =>
    reach * patch(a) * (0.72 + 0.28 * sin(a * lengthRate + lengthPhase))
  const driftRate = (grain.between([0.8, 1.5]) * TAU) / span
  const driftPhase = grain.next() * TAU
  const waveRate = TAU / p.wavelength
  const leanRate = (grain.between([0.7, 1.3]) * TAU) / span
  const leanPhase = grain.next() * TAU

  // How far a point stands out from the edge toward the title.
  const standing = (x: number, y: number) => {
    const a = along(x, y)
    return { a, d: edge(a) - out(x, y) }
  }

  const presence = (x: number, y: number) => {
    const { a, d } = standing(x, y)
    const long = length(a)
    if (long < 8) return 0
    // Rooted in the mass, so a line has no visible start, and only as deep as
    // the fringe is long, so both go at once at the end of a patch.
    const root = ROOT * Math.min(1, long / (reach * 0.5))
    return smoothstep((d + root) / root) * smoothstep(1 - d / long)
  }

  const shapes = lines(
    frame,
    {
      shift(x, y) {
        const { a, d } = standing(x, y)
        const leave = smoothstep((d + 40) / 120)
        const wave = sin(
          d * waveRate + sin(a * driftRate + driftPhase) * PI * 1.4
        )
        const fan = (d / reach) * p.lean * sin(a * leanRate + leanPhase)
        return leave * (p.waver * wave + fan)
      },
      weight(x, y) {
        const { a, d } = standing(x, y)
        return smoothstep(1 - d / (Math.max(length(a), 1) * 0.8))
      },
    },
    {
      angle: (atan2(away.y, away.x) / PI) * 180,
      spacing: p.spacing,
      hair: p.hair,
      swell: p.swell,
      shortest: 24,
    },
    presence
  )

  const lineMark: Shapes = {
    kind: "shapes",
    id: "lines",
    paint: { type: "solid", tone: "strong", opacity: 1 },
    shapes,
  }

  // Only finished layers move, never the marks inside them: moving a mark
  // inside the softening would have the browser blur it again on every
  // frame, where a finished layer it only moves. The mass comes up first, as
  // a print does in the tray, and the fringes follow it, sliding the last of
  // the way across themselves, along the edge rather than out of it, so
  // nothing travels toward the title on the way in.
  let moves: Art["moves"]
  const over: Layer[] = []
  if (frame.motion !== "none") {
    const turning = rng.fork("motion")
    const way = turning.next() < 0.5 ? 1 : -1
    const settle = p.spacing * 1.4 * way
    const enter: Enter = {
      kind: "fade",
      delay: 0.6,
      duration: 2,
      dx: away.y * settle,
      dy: -away.x * settle,
    }
    // Every loop keeps one clock, from the moment the fringes are in place.
    const settled = 2.6
    if (frame.motion === "loop") {
      // A second set of the same fringes, hidden in the still drawing, comes
      // up as it slides across its own lines and goes again as it slides
      // back. Where the two sets cross they make the bands that give the
      // style its name, and the bands sweep as the copy moves. It slides
      // rather than turns: a browser moves a softened layer for nothing but
      // redraws one that turns.
      const period = 12
      over.push({
        kind: "clip",
        id: "ghost",
        shape: { type: "rect", x: 0, y: 0, w, h, radii: [0, 0, 0, 0] },
        opacity: 0,
        layers: [
          {
            kind: "soften",
            id: "ghost-fine",
            radius: p.focus,
            layers: [{ ...lineMark, id: "ghost-lines" }],
            motion: {
              loop: {
                kind: "drift",
                dx: -away.y * p.spacing * 1.5 * way,
                dy: away.x * p.spacing * 1.5 * way,
                period,
                start: settled,
              },
            },
          },
        ],
        motion: {
          loop: {
            kind: "fades",
            points: [
              [0, 0],
              [0.2, 0.25],
              [0.35, 0.7],
              [0.5, 0.85],
              [0.65, 0.7],
              [0.8, 0.25],
              [1, 0],
            ],
            period,
            start: settled,
          },
        },
      })
    }
    moves = {
      plate: { enter: { kind: "fade", delay: 0, duration: 1.8 } },
      second: { enter },
    }
  }

  const glowAt = point(middle, base + breadth * 0.5)
  // With no title the area is the whole canvas, and the ground still has to show.
  const glow = Math.min(area.w, area.h) * (titled ? 1.3 : 0.7)
  const mass: Mark = {
    kind: "shapes",
    id: "form",
    paint: { type: "solid", tone: "strong", opacity: 1 },
    shapes: [{ type: "polygon", points: [...near, ...far.flat()] }],
  }
  return {
    under: [
      { kind: "fill", id: "ground", tone: "ground" },
      {
        kind: "pool",
        id: "glow",
        cx: glowAt.x,
        cy: glowAt.y,
        rx: glow,
        ry: glow,
        rotate: 0,
        tone: "quiet",
        opacity: p.glow,
        core: 0.2,
      },
    ],
    marks: [mass],
    second: [lineMark],
    over,
    ...(moves ? { moves } : null),
  }
}
