import { cos, PI, sin, TAU } from "../core/math.ts"
import type { Rng } from "../core/random.ts"
import type { Art, Frame, Piece } from "../core/recipe.ts"
import type { Box, Mark, Shape, Tone } from "../core/scene.ts"
import { arc, behind, boundsOf, keptClear, union } from "../grammar/kit.ts"
import type { Points } from "../grammar/kit.ts"
import { chipsIn, cloth, stroke, streamlines } from "../grammar/materials.ts"
import { seated } from "../grammar/seated.ts"
import { clearing } from "./stage.ts"

// A sample book of the brand's materials: swatches of one colour family, each
// a different surface, as a designer lays out a mood board. Flat colour, a
// soft wash, a halftone screen, stripes, a stream of lines, cloth and
// terrazzo, cut to cards with round corners lying a little above the sheet.
// Laid as a grid, fanned out like a paint deck, scattered loosely, or as one
// paint strip of a colour in steps.

export const SUBJECTS = ["grid", "fan", "scatter", "strip"] as const
export type Subject = (typeof SUBJECTS)[number]

export type SwatchParams = {
  size: number
  // How round a card's corners are, as a share of its shorter side.
  round: number
  tilt: number
}

const MATERIALS = ["flat", "wash", "dots", "stripes", "lines", "cloth", "chips", "fade"] as const
type Material = (typeof MATERIALS)[number]

// A card w by h with round corners, turned `angle` about its middle at x, y.
export function card(x: number, y: number, w: number, h: number, r: number, angle: number): Points {
  const corner = Math.min(r, w / 2, h / 2)
  const local = [
    ...arc(w / 2 - corner, -h / 2 + corner, corner, -PI / 2, 0, 6),
    ...arc(w / 2 - corner, h / 2 - corner, corner, 0, PI / 2, 6),
    ...arc(-w / 2 + corner, h / 2 - corner, corner, PI / 2, PI, 6),
    ...arc(-w / 2 + corner, -h / 2 + corner, corner, PI, (3 * PI) / 2, 6),
  ]
  const c = cos(angle)
  const s = sin(angle)
  const out: Points = []
  for (let i = 0; i < local.length; i += 2) out.push(x + local[i]! * c - local[i + 1]! * s, y + local[i]! * s + local[i + 1]! * c)
  return out
}

const solid = (id: string, tone: Tone, shapes: Shape[], opacity = 1): Mark => ({ kind: "shapes", id, paint: { type: "solid", tone, opacity }, shapes })
const rect = (box: Box): Shape => ({ type: "rect", ...box, radii: [0, 0, 0, 0] })

// One surface filling a box, its grain turned `angle` with its card.
function surface(material: Material, theme: string, rng: Rng, box: Box, angle: number, id: string, side: number, tone: Tone, within: Points): Mark[] {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const c = cos(angle)
  const s = sin(angle)
  const reach = Math.sqrt(box.w * box.w + box.h * box.h) / 2
  // A point in the card's own frame, on the page.
  const at = (u: number, v: number) => [cx + u * c - v * s, cy + u * s + v * c]
  switch (material) {
    case "flat":
      return [solid(`${id}-flat`, tone, [rect(box)])]
    case "fade":
      // One colour running into its partner along the card.
      return [
        {
          kind: "shapes",
          id: `${id}-fade`,
          paint: { type: "linear", x1: at(0, -reach)[0]!, y1: at(0, -reach)[1]!, x2: at(0, reach)[0]!, y2: at(0, reach)[1]!, stops: [{ at: 0, tone, opacity: 1 }, { at: 1, tone: "partner", opacity: 1 }] },
          shapes: [rect(box)],
        },
      ]
    case "wash":
      // Watercolour: soft pools run together on a pale coat.
      return [
        solid(`${id}-coat`, "soft", [rect(box)]),
        ...Array.from({ length: 4 }, (_, k): Mark => ({
          kind: "pool",
          id: `${id}-pool${k}`,
          cx: box.x + rng.between([0.15, 0.85]) * box.w,
          cy: box.y + rng.between([0.15, 0.85]) * box.h,
          rx: reach * rng.between([0.45, 0.8]),
          ry: reach * rng.between([0.3, 0.55]),
          rotate: rng.next() * 180,
          tone: (["accent", "partner", "body", "strong"] as const)[k]!,
          opacity: rng.between([0.6, 0.85]),
          core: 0.2,
        })),
      ]
    case "dots": {
      // A halftone screen at 45 degrees, its dots growing across the card.
      const pitch = side * 0.034
      const dots: Shape[] = []
      const turn = angle + PI / 4
      const ct = cos(turn)
      const st = sin(turn)
      for (let v = -reach; v <= reach; v += pitch) {
        for (let u = -reach; u <= reach; u += pitch) {
          const x = cx + u * ct - v * st
          const y = cy + u * st + v * ct
          if (x < box.x - pitch || x > box.x + box.w + pitch || y < box.y - pitch || y > box.y + box.h + pitch) continue
          const along = ((x - cx) * c + (y - cy) * s) / reach
          const r = pitch * 0.5 * (0.22 + 0.72 * (0.5 + 0.5 * along))
          dots.push({ type: "circle", cx: Math.round(x * 2) / 2, cy: Math.round(y * 2) / 2, r: Math.round(r * 4) / 4 })
        }
      }
      return [solid(`${id}-paper`, "quiet", [rect(box)]), solid(`${id}-dots`, tone, dots)]
    }
    case "stripes": {
      // Awning stripes, two colours, across the card.
      const band = side * rng.between([0.035, 0.05])
      const shapes: Shape[] = []
      for (let u = -reach; u < reach; u += band * 2) shapes.push({ type: "polygon", points: [...at(u, -reach), ...at(u + band, -reach), ...at(u + band, reach), ...at(u, reach)] })
      return [solid(`${id}-under`, "soft", [rect(box)]), solid(`${id}-stripes`, tone, shapes)]
    }
    case "lines": {
      // Fine lines along a slow current, as on marbled endpapers.
      const gap = side * 0.022
      const bend = rng.between([0.6, 1.2])
      const phase = rng.next() * TAU
      const angleAt = (x: number, y: number) => angle + sin(((x - cx) * c + (y - cy) * s) / (reach * 0.5) + phase) * bend * 0.6
      const lines = streamlines(rng, box, angleAt, gap, { steps: 140 }).map(({ path }) => stroke(path, gap * 0.32))
      return [solid(`${id}-ground`, "quiet", [rect(box)]), solid(`${id}-lines`, tone, lines)]
    }
    case "cloth":
      return cloth(theme, rng, box, { threads: Math.max(box.w, box.h) / (side * 0.032), thread: 0.9, tilt: 0 }, { angle, id, within })
    case "chips":
      return chipsIn(rng, box, { chips: 110, largest: 0.06, specks: 220 }, { scale: side, id })
  }
}

export function swatchbook(frame: Frame, subject: Subject, p: SwatchParams): Art {
  const { w, h, theme, rng } = frame
  const draw = rng.fork("swatchbook")
  const stage = frame.fill ? { area: { x: 0, y: 0, w, h }, away: { x: 0, y: -1 } } : clearing(frame)
  const seat = seated(frame, stage, p.size, draw)
  const side = behind(frame, seat.side, 0.85)
  const { x: cx, y: cy } = seat
  // Every card a different surface, in an order of the seed's.
  const shuffled = [...MATERIALS]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = draw.int(0, i)
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  // At most one plain card, after the first: a sample book shows surfaces.
  const plain = (m: Material) => m === "flat" || m === "fade"
  const textured = shuffled.filter((m) => !plain(m))
  const order = [textured[0]!, shuffled.find(plain)!, ...textured.slice(1)]
  // The colours the cards take in turn: the brand, its partner, its deep and
  // pale steps.
  const tones: Tone[] = ["accent", "partner", "strong", "body"]

  type Card = { x: number; y: number; w: number; h: number; angle: number; material: Material; tone: Tone }
  let cards: Card[]
  if (subject === "grid") {
    // Two by two, or three by two the long way of the space it has.
    const wide = stage.area.w >= stage.area.h
    const [across, down] = draw.next() < 0.5 ? [2, 2] : wide ? [3, 2] : [2, 3]
    const gap = side * 0.04
    const cell = (side * 0.92 - gap * (Math.max(across, down) - 1)) / Math.max(across, down)
    cards = []
    for (let j = 0; j < down; j++)
      for (let i = 0; i < across; i++) {
        const k = j * across + i
        cards.push({
          x: cx + (i - (across - 1) / 2) * (cell + gap),
          y: cy + (j - (down - 1) / 2) * (cell + gap),
          w: cell,
          h: cell,
          angle: 0,
          material: order[k % order.length]!,
          tone: tones[k % tones.length]!,
        })
      }
  } else if (subject === "fan") {
    // A deck of long cards held at its foot and fanned open.
    const count = 5
    const length = side * 0.86
    const width = side * 0.27
    const spread = draw.between([0.16, 0.22])
    const pivot = { x: cx, y: cy + side * 0.36 }
    const lean = p.tilt
    cards = Array.from({ length: count }, (_, k) => {
      const a = lean + (k - (count - 1) / 2) * spread
      // Each card's middle, half its length up from the pivot along its turn.
      return { x: pivot.x + sin(a) * length * 0.46, y: pivot.y - cos(a) * length * 0.46, w: width, h: length, angle: a, material: order[k]!, tone: tones[k % tones.length]! }
    })
  } else if (subject === "scatter") {
    // Three or four swatches let fall on a table, overlapping, each turned.
    const count = draw.int(3, 4)
    const size = side * (count === 3 ? 0.5 : 0.44)
    const spots = [
      [-0.2, -0.18],
      [0.21, -0.12],
      [-0.12, 0.2],
      [0.2, 0.22],
    ]
    cards = Array.from({ length: count }, (_, k) => ({
      x: cx + (spots[k]![0]! + draw.between([-0.04, 0.04])) * side,
      y: cy + (spots[k]![1]! + draw.between([-0.04, 0.04])) * side,
      w: size,
      h: size,
      angle: p.tilt + draw.between([-0.2, 0.2]),
      material: order[k]!,
      tone: tones[k % tones.length]!,
    }))
  } else {
    // A paint strip: one colour in five steps from pale to deep, in a row
    // along one card, the long way of the space it has.
    const wide = stage.area.w >= stage.area.h
    const steps: Tone[] = ["soft", "body", "accent", "strong", "ink"]
    const long = side * 0.98
    const short = side * 0.42
    const each = long / steps.length
    cards = steps.map((tone, k) => {
      const offset = (k - (steps.length - 1) / 2) * each
      return { x: cx + (wide ? offset : 0), y: cy + (wide ? 0 : offset), w: wide ? each : short, h: wide ? short : each, angle: 0, material: "flat" as const, tone }
    })
  }

  // Every card kept clear of the title together, as one subject.
  const r = Math.min(...cards.map((each) => Math.min(each.w, each.h))) * p.round
  const outlines = keptClear(
    frame,
    cards.map((each) => card(each.x, each.y, each.w, each.h, subject === "strip" ? 0 : r, each.angle)),
    stage.away
  )
  const pieces: Piece[] = outlines.map((outline, k) => {
    const each = cards[k]!
    const id = `card${k}`
    return { id, clip: { type: "polygon", points: outline }, marks: surface(each.material, theme, draw.fork(id), boundsOf(outline), each.angle, id, side, each.tone, outline) }
  })
  // The strip is one card: its steps lie flat on it, with one shadow under
  // the whole.
  if (subject === "strip") {
    const whole = union(outlines.map(boundsOf))
    const marks = pieces.flatMap((piece) => [solid(`${piece.id}-step`, cards[pieces.indexOf(piece)]!.tone, [piece.clip])])
    const round = Math.min(whole.w, whole.h) * 0.06
    const outline = card(whole.x + whole.w / 2, whole.y + whole.h / 2, whole.w, whole.h, round, 0)
    return {
      under: [{ kind: "fill", id: "ground", tone: "ground" }],
      marks: [],
      pieces: [{ id: "strip", clip: { type: "polygon", points: outline }, marks }],
      over: [],
      subject: whole,
    }
  }
  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks: [],
    pieces,
    over: [],
    subject: union(outlines.map(boundsOf)),
  }
}
