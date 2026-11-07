import { cos, lerp, sin, smoothstep, TAU } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Layer, Mark, Motion, Shape, Tone } from "../core/scene.ts"
import { cellRadii } from "../shapes/cells.ts"
import type { Cell } from "../shapes/cells.ts"
import { framing } from "./framing.ts"
import { center, clearArea, distanceFrom } from "./geometry.ts"

// A seeded field of cells laid out like a print screen, every other row half a
// cell along. Tone is carried by size, as in a halftone: cells shrink to
// specks toward the field's edge, and only the faintest edge is thinned. The
// field gathers toward one place, so the eye gets a subject instead of
// confetti, and the brand's accent appears only at the very heart of it.
export type FieldParams = {
  cell: number
  gap: number
  round: number
  reach: number
  toneSpread: number
  accentShare: number
  heart: number
  warp: number
  glow: number
}

// bloom: from the far corner; wall: from the far edge; disc: a round screen in
// the open area; sweep: a diagonal across the far side.
const KINDS = ["bloom", "wall", "disc", "sweep"] as const

// The smallest a cell gets before it goes, as a share of a full one.
const SPECK = 0.16

const TONE_ORDER: readonly Tone[] = ["soft", "body", "strong", "accent"]

type Placed = {
  col: number
  row: number
  tone: Tone
  scale: number
  tail: number
}

export function field(
  frame: Frame,
  shape: Cell,
  p: FieldParams
): Art {
  const { w, h, safe, keep, calm, titled, rng, motion } = frame
  const cell = p.cell
  const cols = Math.ceil(w / cell)
  const rows = Math.ceil(h / cell)
  const offsetX = (w - cols * cell) / 2
  const offsetY = (h - rows * cell) / 2
  const inner = cell * (1 - p.gap)

  const layout = rng.fork("layout")
  const kind = layout.pick(KINDS)
  const area = clearArea(keep, w, h)
  const text = center(safe)

  // The corner furthest from the title; on a tie the seed picks.
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: 0, y: h },
    { x: w, y: h },
  ].map((corner) => ({
    ...corner,
    away: distanceFrom(keep, corner.x, corner.y),
  }))
  const furthest = Math.max(...corners.map((corner) => corner.away))
  const corner = layout.pick(
    corners.filter((item) => item.away > furthest * 0.96)
  )
  const toward = layout.between([0.74, 0.96])
  const focus = {
    x: lerp(text.x, corner.x, toward),
    y: lerp(text.y, corner.y, toward),
  }
  // A centred title leaves the corners close to it, and the field still needs
  // room to fall off.
  const radius = Math.max(furthest, Math.min(w, h) * 0.8) * p.reach
  // With nothing to keep clear, most tone discs are framed large and on a
  // third, running off the edges (see framing.ts).
  const framed = kind === "disc" ? framing(frame, rng.fork("field")) : undefined
  const middle = framed ?? center(area)
  // Round where the open area is square, and stretched along it, up to about
  // twice as long as it is tall, where the area is a band.
  const discR = framed ? (framed.reach * Math.min(w, h)) / 2 : Math.min(area.w, area.h) * 0.62
  const discX = framed ? discR : Math.min(Math.max(area.w * 0.4, discR), discR * 1.9)
  const discY = framed ? discR : Math.min(Math.max(area.h * 0.4, discR), discR * 1.9)
  // Where the field is fullest: its glow and its accent sit here.
  const heart = kind === "disc" ? middle : focus
  const tall = area.h >= h && area.w < w
  // Which way the open area lies from the title, judged by their middles: a
  // band across the whole width starts at the left edge whatever side the
  // title is on.
  const farRight = area.x + area.w / 2 > text.x
  const farDown = area.y + area.h / 2 > text.y

  // A slow wave across the field keeps its edge from reading as a circle or a
  // ruler.
  const waveX = (layout.between([1.1, 2.2]) * TAU) / w
  const waveY = (layout.between([0.9, 2]) * TAU) / h
  const phaseX = layout.next() * TAU
  const phaseY = layout.next() * TAU

  const strength = (x: number, y: number) => {
    let t: number
    if (kind === "bloom") {
      const dx = x - focus.x
      const dy = y - focus.y
      t = 1 - Math.sqrt(dx * dx + dy * dy) / radius
    } else if (kind === "disc") {
      const dx = (x - middle.x) / discX
      const dy = (y - middle.y) / discY
      t = 1.3 - Math.sqrt(dx * dx + dy * dy)
    } else if (kind === "sweep") {
      // A diagonal across the far side.
      const ax = farRight ? 1 : -1
      const ay = farDown ? 1 : -1
      t = (((x - text.x) * ax) / w + ((y - text.y) * ay) / h) / 0.96
    } else if (tall) {
      // A wall at the far edge, thinning toward the title's side.
      t = (farRight ? (x - area.x) / area.w : (area.x + area.w - x) / area.w) * 1.4 + 0.15
    } else {
      t = (farDown ? (y - area.y) / area.h : (area.y + area.h - y) / area.h) * 1.4 + 0.15
    }
    t += sin(x * waveX + phaseX) * sin(y * waveY + phaseY) * p.warp
    // Under a title the art passes behind, the screen lightens to nothing, as
    // a halftone does toward white, rather than being veiled.
    if (calm.length) t *= smoothstep(distanceFrom(calm, x, y) / (cell * 3))
    return Math.max(0, Math.min(1, t))
  }

  // Every other row half a cell along, as a print screen is laid out.
  const shift = (row: number) => (row % 2 ? cell / 2 : 0)

  const seeded = rng.fork("field")
  const placed = new Map<string, Placed>()
  const key = (col: number, row: number) => `${col}:${row}`
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Every draw is taken for every cell, so a change to the field moves
      // cells in and out without recolouring the ones that stay.
      const place = seeded.next()
      const colour = seeded.next()
      const tail = Math.floor(seeded.next() * 4)
      const x = offsetX + (col + 0.5) * cell + shift(row)
      const y = offsetY + (row + 0.5) * cell
      const t = strength(x, y)
      // A cell stays while there is any tone, and only the faintest edge is
      // thinned at random. The field fades out before the title.
      const margin = titled ? smoothstep(distanceFrom(keep, x, y) / (cell * 2.5)) : 1
      if (t * margin < 0.06 || (t * margin < 0.18 && place > 0.5)) continue
      if (titled && distanceFrom(keep, x, y) < cell) continue

      const dx = x - heart.x
      const dy = y - heart.y
      const inHeart =
        Math.sqrt(dx * dx + dy * dy) < radius * p.heart &&
        colour < p.accentShare
      const rank = t + (colour - 0.5) * p.toneSpread
      placed.set(key(col, row), {
        col,
        row,
        tail,
        tone: inHeart
          ? "accent"
          : rank > 0.74
            ? "strong"
            : rank > 0.44
              ? "body"
              : "soft",
        scale: lerp(SPECK, 1, smoothstep(t * 1.15)),
      })
    }
  }

  // A cell with no neighbour reads as a mistake, not as sparseness. On a
  // staggered screen a cell in the next row a column over can be a cell and a
  // half away, so neighbours are judged by how far apart they really are.
  const hasNeighbour = (item: Placed) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const other = placed.get(key(item.col + dx, item.row + dy))
        if (!other || other === item) continue
        const across = dx * cell + shift(other.row) - shift(item.row)
        if (Math.abs(across) <= cell * 1.05) return true
      }
    }
    return false
  }
  const cells = [...placed.values()].filter(hasNeighbour)

  // On a moving cover the cells go in bands by how far they lie from the
  // heart, so the field can arrive and pulse outward from it.
  const moves = motion !== "none"
  const BANDS = moves ? 40 : 1
  const centreOf = (item: Placed) => ({
    x: offsetX + (item.col + 0.5) * cell + shift(item.row),
    y: offsetY + (item.row + 0.5) * cell,
  })
  const fromHeart = (item: Placed) => {
    const at = centreOf(item)
    const dx = at.x - heart.x
    const dy = at.y - heart.y
    return Math.sqrt(dx * dx + dy * dy)
  }
  const far = Math.max(1, ...cells.map(fromHeart))
  const bandOf = (item: Placed) => Math.min(BANDS - 1, Math.floor((fromHeart(item) / far) * BANDS))
  // The field arrives from its heart outward. Bands start close together
  // and each fades in evenly over many times the gap between them, so at any
  // moment dozens are part way in and the front is one soft edge sliding
  // outward, not ring after ring.
  const enterOf = (band: number) =>
    ({ kind: "fade", delay: 0.1 + band * 0.03, duration: 1, even: true }) as const
  const arrived = 0.1 + (BANDS - 1) * 0.03 + 1

  // Then the light wanders. The screen stays where it is, as a printed
  // screen does, and the tone under it drifts round a slow circle, so each
  // dot grows a little as the light comes its way and shrinks as it goes.
  //
  // A browser redraws a shape that changes size on every frame, but only
  // blends a layer that changes opacity. So the dots the light changes are
  // drawn at each of a few places on the light's circle, and the cover
  // cross-fades between them: from one place to the next, whichever size is
  // bigger fades over the smaller one, so a dot never dims on the way. Only
  // one stretch between two places shows at once, and the dots the light
  // leaves alone stay put.
  const SAMPLES = 6
  const PERIOD = 26
  const wander = radius * 0.05
  const offsets = Array.from({ length: SAMPLES }, (_, k) => {
    const a = (k / SAMPLES) * TAU
    return { x: wander * (cos(a) - 1), y: wander * sin(a) }
  })
  const scaleAt = (x: number, y: number) => lerp(SPECK, 1, smoothstep(strength(x, y) * 1.15))
  const quantise = (value: number) => Math.round(value * 12) / 12
  // A dot's size at each place, as a share of its still size.
  const lightOf = (item: Placed): number[] | null => {
    const { x, y } = centreOf(item)
    // Held back by the same margin that thins the field before the title.
    const margin = titled ? smoothstep(distanceFrom(keep, x, y) / (cell * 2.5)) : 1
    const scales = offsets.map(({ x: ox, y: oy }) =>
      quantise(1 + (scaleAt(x - ox, y - oy) / item.scale - 1) * margin)
    )
    return scales.some((scale) => Math.abs(scale - 1) >= 0.1) ? scales : null
  }
  const cellShape = (item: Placed, share = 1): Shape => {
    const size = inner * item.scale * share
    return {
      type: "rect",
      x: offsetX + (item.col + 0.5) * cell + shift(item.row) - size / 2,
      y: offsetY + (item.row + 0.5) * cell - size / 2,
      w: size,
      h: size,
      radii: cellRadii(shape, item.tail, size, size * p.round, size * 0.08),
    }
  }

  const lights = new Map<Placed, number[]>()
  if (motion === "loop") {
    for (const item of cells) {
      const scales = lightOf(item)
      if (scales) lights.set(item, scales)
    }
  }

  const marks: Mark[] = TONE_ORDER.flatMap((tone): Mark[] => {
    const inTone = cells.filter((item) => item.tone === tone)
    const paint = { type: "solid", tone, opacity: 1 } as const
    if (!moves) return [{ kind: "shapes", id: tone, paint, shapes: inTone.map((item) => cellShape(item)) }]
    return Array.from({ length: BANDS }, (_, band): Mark[] => {
      const here = inTone.filter((item) => bandOf(item) === band)
      const still = here.filter((item) => !lights.has(item))
      const lit = here.filter((item) => lights.has(item))
      return [
        ...(still.length
          ? [{ kind: "shapes", id: `${tone}${band}`, paint, shapes: still.map((item) => cellShape(item)), motion: { enter: enterOf(band) } } as Mark]
          : []),
        // The dots the light will change arrive with the rest, and hand over
        // to the cross-fades the moment the light starts.
        ...(lit.length
          ? [{ kind: "shapes", id: `${tone}${band}l`, paint, shapes: lit.map((item) => cellShape(item)), motion: { enter: enterOf(band), exit: arrived } } as Mark]
          : []),
      ]
    }).flat()
  })

  // From place k to the next, three layers, each hidden outside its own
  // stretch of the period. Beneath, what shows the whole stretch: the dots
  // that hold, and each changing dot at the smaller of its two sizes. Over
  // it, a growing dot's bigger size fades in, and a shrinking dot's bigger
  // size fades out.
  const crossings: Layer[] = []
  if (lights.size) {
    const lit = [...lights.entries()]
    const gap = 0.0004
    for (let k = 0; k < SAMPLES; k++) {
      const next = (k + 1) % SAMPLES
      const from = k / SAMPLES
      const to = (k + 1) / SAMPLES
      // Opacity over the period: hidden outside [from, to), and inside it
      // going from `start` to `end`.
      const window = (start: number, end: number): [number, number][] => {
        const inside: [number, number][] = [[from, start], [to === 1 ? 1 : to - gap, end]]
        const before: [number, number][] = from > 0 ? [[0, 0], [from - gap, 0]] : []
        const after: [number, number][] = to < 1 ? [[to, 0], [1, 0]] : []
        return [...before, ...inside, ...after]
      }
      const group = (id: string, dots: [Placed, number][], points: [number, number][]): Layer[] =>
        dots.length
          ? [
              {
                kind: "clip",
                id: `light${k}${id}`,
                shape: { type: "rect", x: 0, y: 0, w, h, radii: [0, 0, 0, 0] },
                opacity: 0,
                motion: { loop: { kind: "fades", points, period: PERIOD, start: arrived } },
                layers: TONE_ORDER.map((tone): Mark => ({
                  kind: "shapes",
                  id: `light${k}${id}${tone}`,
                  paint: { type: "solid", tone, opacity: 1 },
                  shapes: dots.filter(([item]) => item.tone === tone).map(([item, size]) => cellShape(item, size)),
                })).filter((mark) => mark.kind === "shapes" && mark.shapes.length > 0),
              },
            ]
          : []
      const grows = lit.filter(([, scales]) => scales[next]! > scales[k]!)
      const shrinks = lit.filter(([, scales]) => scales[next]! < scales[k]!)
      const steady = lit.map(([item, scales]): [Placed, number] => [item, Math.min(scales[k]!, scales[next]!)])
      crossings.push(
        ...group("h", steady, window(1, 1)),
        ...group("G", grows.map(([item, scales]) => [item, scales[next]!]), window(0, 1)),
        ...group("S", shrinks.map(([item, scales]) => [item, scales[k]!]), window(1, 0))
      )
    }
  }

  return {
    under: [
      { kind: "fill", id: "ground", tone: "ground" },
      {
        kind: "pool",
        id: "glow",
        cx: heart.x,
        cy: heart.y,
        rx: radius * 0.8,
        ry: radius * 0.8,
        rotate: 0,
        tone: "quiet",
        opacity: p.glow,
        core: 0.25,
        // The glow is the light itself, and wanders with it.
        ...(moves && motion === "loop"
          ? { motion: { loop: { kind: "orbit", rx: wander, ry: wander, period: PERIOD, start: arrived } } as Motion }
          : null),
      },
    ],
    marks,
    // Above the marks, where the cross-fades take over the dots they hand
    // off.
    over: crossings,
  }
}
