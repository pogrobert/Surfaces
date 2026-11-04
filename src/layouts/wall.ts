import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Loop, Mark, Shape, Tone } from "../core/scene.ts"
import { cellRadii } from "../shapes/cells.ts"
import type { Cell } from "../shapes/cells.ts"
import { smoothstep } from "../core/math.ts"
import { boxesTouch, distanceFrom, inflate } from "./geometry.ts"
import { clearing } from "./stage.ts"

// A dense wall of one shape, one idea repeated, in the ground's own tint and two
// tones of the brand. The wall thins out as it nears the title and leaves the
// title's box bare, so there is no faint rectangle of cells under the text.
export type WallParams = {
  cell: number
  gap: number
  open: number
  tight: number
  empty: number
  wide: number
  quietShare: number
  bodyShare: number
}

const TONE_ORDER: readonly Tone[] = ["quiet", "body", "strong", "accent"]

type Placed = { tone: Tone; wide: boolean; span: number; shape: Shape }

export function wall(
  frame: Frame,
  shape: Cell,
  p: WallParams
): Art {
  const { w, h, keep, titled, rng, motion } = frame
  const cols = Math.max(4, Math.round(w / p.cell))
  const cell = w / cols
  const rows = Math.ceil(h / cell)
  const top = (h - rows * cell) / 2
  const gap = cell * p.gap
  const size = cell - gap * 2
  const open = size * p.open
  const tight = size * p.tight

  const titleZone = inflate(keep, cell * 0.2)
  const edgeZone = inflate(keep, cell * 0.9)
  const place = rng.fork("wall")
  const cells: Placed[] = []
  let wideAbove = new Set<number>()

  for (let row = 0; row < rows; row++) {
    const wideHere = new Set<number>()
    const last = cols - 1
    for (let col = 0; col <= last; col++) {
      const roll = place.next()
      // The wall thins out toward the title: near it, a cell is more likely to
      // be left empty.
      const near = titled
        ? 1 - smoothstep(distanceFrom(keep, (col + 0.5) * cell, top + (row + 0.5) * cell) / (cell * 2.6))
        : 0
      // The outer columns stay full away from the title, or a lone cell can
      // end the wall.
      const outer = (col === 0 || col === last) && near === 0
      if (roll < p.empty + (1 - p.empty) * near && !outer) continue
      const wide = roll > 1 - p.wide && col < last
      const tail = Math.floor(place.next() * 4)
      const start = col
      if (wide) col++
      // Two wide cells on top of each other read as one heavy block, so the
      // lower one is laid as two ordinary cells instead. Leaving them empty
      // could empty a whole row of a narrow wall.
      const stacked = wide && (wideAbove.has(start) || wideAbove.has(col))
      if (wide && !stacked) wideHere.add(start).add(col)

      const share = (roll - p.empty) / (1 - p.empty - p.wide)
      const lay = (at: number, span: number) => {
        const box: Box = {
          x: at * cell + gap,
          y: top + row * cell + gap,
          w: span * cell - gap * 2,
          h: size,
        }
        // Nothing touches the title; the fade has already thinned the cells
        // round it.
        if (titled && boxesTouch(box, titleZone)) return
        const nearText = titled && boxesTouch(box, edgeZone)
        // The lightest cells are the ground's own tint, never white.
        const tone: Tone =
          wide || share >= p.quietShare + p.bodyShare
            ? "strong"
            : share < p.quietShare
              ? "quiet"
              : "body"
        cells.push({
          tone,
          span,
          wide: span === 2 && !nearText,
          shape: {
            type: "rect",
            ...box,
            radii: cellRadii(shape, tail, size, open, tight),
          },
        })
      }
      if (stacked) {
        lay(start, 1)
        lay(col, 1)
      } else {
        lay(start, wide ? 2 : 1)
      }
    }
    wideAbove = wideHere
  }

  // One wide cell clear of the title carries the accent, and only one.
  const wideCells = cells.filter((item) => item.wide)
  if (wideCells.length > 0) rng.fork("accent").pick(wideCells).tone = "accent"

  const drawn = new Map<Tone, Shape[]>()
  for (const item of cells) {
    drawn.set(item.tone, [...(drawn.get(item.tone) ?? []), item.shape])
  }
  let marks: Mark[] = TONE_ORDER.map((tone) => ({
    kind: "shapes",
    id: tone,
    paint: { type: "solid", tone, opacity: 1 },
    shapes: drawn.get(tone) ?? [],
  }))

  if (motion !== "none") {
    // The tiles go up one by one, from the corner furthest from the title
    // toward it, each growing into place. Every tile is a shape of its own,
    // so each grows and turns about its own middle.
    const { away } = clearing(frame)
    const reach = (item: Placed) => {
      const box = item.shape as Extract<Shape, { type: "rect" }>
      return (box.x + box.w / 2) * away.x + (box.y + box.h / 2) * away.y
    }
    const reaches = cells.map(reach)
    const near = Math.min(...reaches)
    const far = Math.max(...reaches)
    // 0 at the far corner, 1 nearest the title.
    const order = (item: Placed) => (far - reach(item)) / Math.max(far - near, 1)
    const arrived = 0.1 + 1.3 + 0.7
    const turning = rng.fork("motion")
    // Half the walls turn a tile here and there; the other half turn in a
    // wave that crosses the whole wall.
    const wave = turning.next() < 0.5
    const step = (value: number) => Math.round(value * 40) / 40
    marks = cells.map((item, index): Mark => {
      const o = order(item)
      const pick = turning.next()
      const moments = [turning.next(), turning.next(), turning.next(), turning.next()].sort((a, b) => a - b)
      const square = item.span === 1
      // A square tile turns a quarter at a time, four times a period, so it
      // ends where it began. In a wave, every square tile turns as the wave
      // passes it, four waves a period; otherwise one tile in five turns, at
      // moments of its own. A wide tile turned would cross its neighbours.
      const loop: Loop | undefined = !square
        ? undefined
        : wave
          ? { kind: "turns", degrees: 90, at: [0, 0.25, 0.5, 0.75].map((at) => step(at + o * 0.12)), period: 64, start: arrived }
          : pick < 0.2
            ? { kind: "turns", degrees: 90, at: moments.map(step), period: 40, start: arrived }
            : undefined
      return {
        kind: "shapes",
        id: `tile${index}`,
        paint: { type: "solid", tone: item.tone, opacity: 1 },
        shapes: [item.shape],
        motion: {
          enter: { kind: "fade", delay: 0.1 + step(o) * 1.3, duration: 0.7, scale: 0.4 },
          ...(loop ? { loop } : null),
        },
      }
    })
  }

  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks,
    over: [],
  }
}
