import { cos, radians, sin } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Enter, Layer, Mark, Motion, Shape } from "../core/scene.ts"
import { boxesTouch, center, inflate } from "./geometry.ts"
import { MOTIFS, overprint } from "./overprint.ts"
import { clearing } from "./stage.ts"

// Simple shapes run through a tired photocopier: toner too dark in the solids,
// a dark edge where the lid was left open, streaks where the drum ran low on
// ink, and specks of stray toner. Everything that holds ink is a mark, so a
// stipple finish gives it all the same grain.
export type CopyParams = {
  size: number
  fade: number
  // Width of the open lid's edge, as a share of the short side.
  lid: number
  // How many low-ink streaks, and how faint they leave the print.
  streaks: number
  low: number
  specks: number
}

// The shapes a copy can be made of: the ones it shares with Riso, and a page
// laid crooked on the glass.
export const COPY_MOTIFS = [...MOTIFS, "page"] as const
export type CopyMotif = (typeof COPY_MOTIFS)[number]

export function photocopy(frame: Frame, motif: CopyMotif, p: CopyParams): Art {
  const { w, h, keep, titled, rng } = frame
  const art = motif === "page" ? page(frame) : overprint(frame, motif, p)
  const { away } = clearing(frame)
  const keepOff = titled ? inflate(keep, Math.min(w, h) * 0.04) : null

  // One ink: both shapes print in the toner's own tone, the second one
  // lighter, as a second pass through the copier would. The toner runs too
  // dark, so a shape prints nearly solid and only its far edge breaks up.
  const toner =
    (strength: number) =>
    (mark: Mark): Mark =>
      mark.kind === "shapes" && mark.paint.type !== "solid"
        ? {
            ...mark,
            paint: {
              ...mark.paint,
              stops: mark.paint.stops.map((stop) => ({
                ...stop,
                tone: "strong",
                opacity: Math.min(1, stop.opacity * strength * 1.3),
              })),
            },
          }
        : mark

  // The lid left open down the edge furthest from the title: solid at the
  // edge, falling off raggedly into the sheet.
  const band = Math.min(w, h) * p.lid
  const sideways = Math.abs(away.x) >= Math.abs(away.y)
  const far = sideways ? (away.x > 0 ? w : 0) : away.y > 0 ? h : 0
  const inward = far === 0 ? 1 : -1
  const lid: Mark = {
    kind: "shapes",
    id: "lid",
    paint: {
      type: "linear",
      x1: sideways ? far : 0,
      y1: sideways ? 0 : far,
      x2: sideways ? far + inward * band : 0,
      y2: sideways ? 0 : far + inward * band,
      stops: [
        { at: 0, tone: "strong", opacity: 1 },
        { at: 0.4, tone: "strong", opacity: 0.9 },
        { at: 0.7, tone: "strong", opacity: 0.4 },
        { at: 1, tone: "strong", opacity: 0 },
      ],
    },
    shapes: [
      sideways
        ? { type: "rect", x: far === 0 ? 0 : w - band, y: 0, w: band, h, radii: [0, 0, 0, 0] }
        : { type: "rect", x: 0, y: far === 0 ? 0 : h - band, w, h: band, radii: [0, 0, 0, 0] },
    ],
  }

  // Low-ink streaks: soft bands of paper laid back over the print, across the
  // direction the drum turns. They only ever lighten.
  const streaks: Layer[] = []
  const drum = rng.fork("drum")
  for (let i = 0; i < 6; i++) {
    const at = drum.next() * (sideways ? h : w)
    const thick = drum.between([6, 34])
    const strength = drum.between([0.5, 1]) * p.low
    if (i >= p.streaks) continue
    const x = sideways ? 0 : at - thick / 2
    const y = sideways ? at - thick / 2 : 0
    streaks.push({
      kind: "shapes",
      id: `streak${i}`,
      paint: {
        type: "linear",
        x1: sideways ? 0 : x,
        y1: sideways ? y : 0,
        x2: sideways ? 0 : x + thick,
        y2: sideways ? y + thick : 0,
        stops: [
          { at: 0, tone: "ground", opacity: 0 },
          { at: 0.5, tone: "ground", opacity: strength },
          { at: 1, tone: "ground", opacity: 0 },
        ],
      },
      shapes: [
        {
          type: "rect",
          x,
          y,
          w: sideways ? w : thick,
          h: sideways ? thick : h,
          radii: [0, 0, 0, 0],
        },
      ],
    })
  }

  // Stray toner: specks scattered over the sheet, never on the title.
  const dust = rng.fork("dust")
  const specks: Shape[] = []
  for (let i = 0; i < 240; i++) {
    const x = dust.next() * w
    const y = dust.next() * h
    const r = 0.6 + dust.next() * dust.next() * 2.6
    if (i >= p.specks) continue
    if (keepOff && boxesTouch({ x: x - r, y: y - r, w: r * 2, h: r * 2 }, keepOff)) continue
    specks.push({ type: "circle", cx: x, cy: y, r })
  }

  const dirt: Mark = {
    kind: "shapes",
    id: "specks",
    paint: { type: "solid", tone: "strong", opacity: 0.85 },
    shapes: specks,
  }
  const moving = frame.motion !== "none" ? copier(frame) : undefined
  // The streaks and specks are on the copy too, so they arrive with it.
  const arrive = <T extends Layer>(layer: T): T =>
    moving ? { ...layer, motion: { enter: moving.enter } } : layer

  return {
    under: art.under,
    marks: [
      ...art.marks.map(toner(1)),
      ...(art.second ?? []).map(toner(0.55)),
      lid,
    ],
    over: [...streaks.map(arrive), arrive(dirt), ...(moving?.over ?? [])],
    ...(art.subject ? { subject: art.subject } : null),
    ...(moving ? { moves: { plate: moving.plate } } : null),
    ...(moving?.echo ? { echo: moving.echo } : null),
  }
}

// How a copy moves. The toner comes up in place, at one even pace, as a copy
// develops. Its grain then never moves: toner a pixel fine shimmers as it
// crosses the pixels, slowly or quickly, and goes soft where it stops between
// them. Then now and again a faint second copy, a few units out of line, comes
// up and goes, as a sheet fed through twice. Its grain is the same grain, so
// only its opacity moves. The specks and streaks are the machine's, so they
// stay put.
function copier(frame: Frame) {
  const { w, h, motion } = frame
  const { away } = clearing(frame)
  const across = { x: -away.y, y: away.x }
  const way = frame.rng.fork("motion").next() < 0.5 ? 1 : -1
  const enter: Enter = { kind: "fade", delay: 0.1, duration: 2.2, even: true }
  const reach = Math.min(w, h) * 0.012
  const echo: Art["echo"] =
    motion === "loop"
      ? {
          dx: across.x * reach * way,
          dy: across.y * reach * way,
          motion: { loop: { kind: "rise", opacity: 0.38, period: 11, start: enter.delay + enter.duration } },
        }
      : undefined
  return { enter, plate: { enter } as Motion, over: [] as Layer[], echo }
}

// A sheet laid crooked on the glass. Where the lid doesn't cover it, the
// glass copies as solid toner, so the page shows as a pale sheet inside a dark
// frame, with lines of type and a picture block on it.
function page(frame: Frame): Art {
  const { w, h, rng } = frame
  const { area } = clearing(frame)
  const margin = Math.min(w, h) * 0.03
  // The open side, out to the canvas edges it reaches.
  const x = area.x > 0 ? area.x + margin : 0
  const y = area.y > 0 ? area.y + margin : 0
  const right = area.x + area.w < w ? area.x + area.w - margin : w
  const bottom = area.y + area.h < h ? area.y + area.h - margin : h
  const glass: Box = { x, y, w: right - x, h: bottom - y }
  const sheet = rng.fork("page")
  const wide = glass.w > glass.h * 1.2
  // A4 in whichever way round fits the glass.
  const scale = wide
    ? Math.min((glass.w * 0.8) / 1.414, glass.h * 0.8)
    : Math.min(glass.w * 0.8, (glass.h * 0.8) / 1.414)
  const pw = wide ? scale * 1.414 : scale
  const ph = wide ? scale : scale * 1.414
  const mid = center(glass)
  const cx = mid.x + glass.w * sheet.between([-0.04, 0.04])
  const cy = mid.y + glass.h * sheet.between([-0.04, 0.04])
  const turn = radians(sheet.between([3, 7]) * (sheet.next() < 0.5 ? -1 : 1))
  const c = cos(turn)
  const s = sin(turn)
  // A point on the page, from its top left, turned onto the glass.
  const at = (u: number, v: number) => {
    const dx = u - pw / 2
    const dy = v - ph / 2
    return [cx + dx * c - dy * s, cy + dx * s + dy * c]
  }
  const quad = (u: number, v: number, du: number, dv: number): Shape => ({
    type: "polygon",
    points: [...at(u, v), ...at(u + du, v), ...at(u + du, v + dv), ...at(u, v + dv)],
  })

  // The dark frame: four pieces between the glass's corners and the page's.
  const outer = [
    [glass.x, glass.y],
    [glass.x + glass.w, glass.y],
    [glass.x + glass.w, glass.y + glass.h],
    [glass.x, glass.y + glass.h],
  ]
  const inner = [at(0, 0), at(pw, 0), at(pw, ph), at(0, ph)]
  const frameShapes: Shape[] = [0, 1, 2, 3].map((i) => {
    const j = (i + 1) % 4
    return { type: "polygon", points: [...outer[i]!, ...outer[j]!, ...inner[j]!, ...inner[i]!] }
  })

  // Type: a heading, a picture block and lines of text, set in from the edge.
  const edge = pw * 0.12
  const measure = pw - edge * 2
  const line = ph * 0.016
  const lead = ph * 0.042
  const text: Shape[] = [quad(edge, ph * 0.1, measure * sheet.between([0.5, 0.75]), line * 2.2)]
  const pictureH = ph * sheet.between([0.24, 0.32])
  const picture = quad(edge, ph * 0.18, measure, pictureH)
  let v = ph * 0.18 + pictureH + lead
  while (v < ph * 0.88) {
    const last = sheet.next() < 0.18
    text.push(quad(edge, v, measure * (last ? sheet.between([0.3, 0.6]) : sheet.between([0.86, 1])), line))
    v += last ? lead * 1.6 : lead
  }

  const solid = (id: string, opacity: number, shapes: Shape[]): Mark => ({
    kind: "shapes",
    id,
    paint: { type: "solid", tone: "strong", opacity },
    shapes,
  })
  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks: [solid("glass", 0.94, frameShapes), solid("type", 0.9, text)],
    // The picture on the page copies as a mid-tone, the way a photo does.
    second: [solid("picture", 0.6, [picture])],
    over: [],
    subject: glass,
  }
}
