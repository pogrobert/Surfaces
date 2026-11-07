import { atan2, cos, radians, sin, smoothstep, TAU } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Layer, Mark, Shape } from "../core/scene.ts"
import { drawForm } from "../shapes/forms.ts"
import { framing } from "./framing.ts"
import type { Form } from "../shapes/forms.ts"
import { center, furthestAlong } from "./geometry.ts"
import { lines } from "./lines.ts"
import type { LineParams } from "./lines.ts"
import { clearing } from "./stage.ts"

// One form on a page of fine parallel lines.
export type PlateLayoutParams = LineParams & {
  size: number
  bulge: number
  lightTurn: number
  glow: number
  // How far the lines take to taper away toward the title.
  taper: number
}

const MARGIN = 14

// Lines belong to the art's side of the canvas and thin away toward the title
// along one long curve. A hole cut around the text reads as a box; this reads as
// the plate running out. The curve starts past the title's furthest corner, so
// no line can reach the title, whatever the seed does to it.
function presenceBeside(
  { safe, titled, rng }: Frame,
  away: { x: number; y: number },
  taper: number
) {
  if (!titled) return () => 1
  const reach = (x: number, y: number) => x * away.x + y * away.y
  const limit = furthestAlong(safe, away)
  const curve = rng.fork("edge")
  const waves = (curve.between([0.9, 1.7]) * TAU) / (taper * 4)
  const phase = curve.next() * TAU
  return (x: number, y: number) => {
    const along = -x * away.y + y * away.x
    // A calm edge, so the line ends make one smooth curve.
    const swing = (taper / 14) * (1 + sin(along * waves + phase))
    return smoothstep((reach(x, y) - limit - MARGIN - swing) / taper)
  }
}

export function linePlate(frame: Frame, form: Form, p: PlateLayoutParams): Art {
  const { w, h, keep, rng } = frame
  const { area, away } = clearing(frame)
  // With nothing to keep clear, most orbs and ripples are framed large and
  // on a third (see framing.ts); the other forms fill the area already.
  const framed = form === "orb" || form === "ripple" ? framing(frame, rng.fork("plate")) : undefined
  const drawn = drawForm(
    form,
    {
      w,
      h,
      safe: keep,
      area,
      away,
      ...(framed ? { at: { x: framed.x, y: framed.y } } : null),
      lit: atan2(away.y, away.x) + radians(p.lightTurn),
      size: framed ? (framed.reach * Math.min(w, h)) / Math.min(area.w, area.h) : p.size,
      bulge: p.bulge,
      rng: rng.fork("form"),
    },
    radians(p.angle)
  )
  const presence = presenceBeside(frame, away, p.taper)
  const middle = center(drawn.subject ?? area)
  // With no title the area is the whole canvas, and the ground still has to
  // show around the form.
  const glow = Math.min(area.w, area.h) * (frame.titled ? 1.2 : 0.66)
  const hatchParams = {
    angle: p.angle + 58,
    spacing: p.spacing * 1.3,
    hair: p.hair * 0.8,
    swell: p.swell * 0.3,
    pointed: true,
  }
  // Only the deepest shadow, so no hatch line strays over the ground.
  const hatchPresence = (x: number, y: number) => (drawn.weight(x, y) >= 0.68 ? presence(x, y) : 0)
  const main = lines(frame, drawn, { ...p, pointed: true }, presence)
  // A second set of lines across the first, only in the deepest shadow, as an
  // engraver cross-hatches to darken a tone.
  const hatch = lines(frame, { shift: () => 0, weight: drawn.weight }, hatchParams, hatchPresence)
  const ink = { type: "solid", tone: "strong", opacity: 1 } as const
  const moving =
    frame.motion === "none"
      ? undefined
      : plateMotion(frame, { main, hatch, middle, away, angle: p.angle }, () => ({
          deepMain: lines(frame, drawn, { ...p, swell: p.swell * 1.4, pointed: true }, presence),
          deepHatch: lines(
            frame,
            { shift: () => 0, weight: drawn.weight },
            hatchParams,
            (x, y) => (drawn.weight(x, y) >= 0.5 ? presence(x, y) : 0)
          ),
        }))
  return {
    under: [
      { kind: "fill", id: "ground", tone: "ground" },
      {
        kind: "pool",
        id: "glow",
        cx: middle.x,
        cy: middle.y,
        rx: glow,
        ry: glow,
        rotate: 0,
        tone: "quiet",
        opacity: p.glow,
        core: 0.32,
      },
    ],
    marks: moving?.marks ?? [{ kind: "shapes", id: "lines", paint: ink, shapes: [...main, ...hatch] }],
    over: moving?.over ?? [],
    ...(drawn.subject ? { subject: drawn.subject } : null),
  }
}

// How an engraving arrives and moves. Each line is cut on along its length,
// as a burin cuts it, in bands moving out from the form, and the
// cross-hatching is cut after as a second pass. Then the shading deepens and
// lifts again: a deeper cut of the same lines, hidden in the still drawing,
// comes up over the first and goes, its cross-hatching reaching a little
// further into the half-tones.

// Bands of lines by how far they lie from the form, so the plate is cut
// outward from it. Fine enough that the front is one soft edge.
const BANDS = 24
// How long the front takes to cross the plate, and how long each line takes.
const SPREAD = 1.2
const CUT = 1.3
// The cross-hatching is a second pass, cut after the lines under it.
const SECOND = 0.5

type Banded = { key: number; shape: Shape }

function plateMotion(
  frame: Frame,
  plate: {
    main: Shape[]
    hatch: Shape[]
    middle: { x: number; y: number }
    away: { x: number; y: number }
    angle: number
  },
  deeper: () => { deepMain: Shape[]; deepHatch: Shape[] }
): { marks: Mark[]; over: Layer[] } {
  const { middle, away } = plate
  // Across the lines, turned to the side away from the title.
  const turn = radians(plate.angle)
  let across = { x: -sin(turn), y: cos(turn) }
  if (across.x * away.x + across.y * away.y < 0) across = { x: -across.x, y: -across.y }
  const offset = (shape: Shape) => {
    if (shape.type !== "ribbon") return 0
    let x = 0
    let y = 0
    const count = shape.points.length / 3
    for (let i = 0; i < shape.points.length; i += 3) {
      x += shape.points[i]!
      y += shape.points[i + 1]!
    }
    return Math.abs((x / count - middle.x) * across.x + (y / count - middle.y) * across.y)
  }
  const far = Math.max(1, ...[...plate.main, ...plate.hatch].map(offset))
  const band = (shapes: Shape[]): Banded[][] => {
    const bands: Banded[][] = Array.from({ length: BANDS }, () => [])
    for (const shape of shapes) {
      const key = offset(shape) / far
      bands[Math.min(BANDS - 1, Math.floor(key * BANDS))]!.push({ key, shape })
    }
    return bands.map((items) => items.sort((a, b) => a.key - b.key))
  }
  const ink = { type: "solid", tone: "strong", opacity: 1 } as const
  const arrived = 0.1 + SPREAD + SECOND + CUT

  // A burin cuts each line from the end by the title away from it, so even
  // the cutting never runs toward the text. Turning a line round changes
  // nothing that is drawn, only which end its draw-on starts from.
  const reach = (x: number, y: number) => x * away.x + y * away.y
  const fromTitle = (shape: Shape): Shape => {
    if (shape.type !== "ribbon" || shape.points.length < 6) return shape
    const n = shape.points.length
    const p = shape.points
    if (reach(p[0]!, p[1]!) <= reach(p[n - 3]!, p[n - 2]!)) return shape
    const turned: number[] = []
    for (let i = n - 3; i >= 0; i -= 3) turned.push(p[i]!, p[i + 1]!, p[i + 2]!)
    return { type: "ribbon", points: turned }
  }

  // Each band's lines are drawn on through a mask, one after another, the
  // front moving out from the form. Once cut they stay as they are: nothing
  // moves in their layer after, so the masks cost nothing more. Swapping them
  // for a plain copy would have the browser draw the whole plate again at
  // that moment, which shows as a stall.
  const cuts: Mark[] = []
  const main = band(plate.main)
  const hatch = band(plate.hatch)
  for (let index = 0; index < BANDS; index++) {
    for (const [id, items, lag] of [
      ["lines", main[index]!, 0],
      ["hatch", hatch[index]!, SECOND],
    ] as const) {
      if (!items.length) continue
      cuts.push({
        kind: "shapes",
        id: `${id}${index}-cut`,
        paint: ink,
        shapes: items.map((item) => fromTitle(item.shape)),
        motion: {
          enter: {
            kind: "draw",
            delay: 0.1 + (index / BANDS) * SPREAD + lag,
            duration: CUT,
            stagger: SPREAD / BANDS / items.length,
          },
        },
      })
    }
  }

  // The deeper cut lies over the plate, one layer faded whole. Under it, the
  // browser would have to blend the whole plate again over every frame of it.
  const deep: Mark[] = []
  if (frame.motion === "loop") {
    const deepened = deeper()
    deep.push({
      kind: "shapes",
      id: "deep",
      paint: ink,
      opacity: 0,
      shapes: [...deepened.deepMain.filter((shape) => shape.type === "ribbon" && widest(shape) > 1.2), ...deepened.deepHatch],
      motion: { loop: { kind: "rise", opacity: 0.9, period: 11, start: arrived } },
    })
  }
  return { marks: cuts, over: deep }
}

function widest(shape: Extract<Shape, { type: "ribbon" }>) {
  let most = 0
  for (let i = 2; i < shape.points.length; i += 3) most = Math.max(most, shape.points[i]!)
  return most
}
