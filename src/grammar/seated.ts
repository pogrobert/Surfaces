import { clamp } from "../core/math.ts"
import type { Rng } from "../core/random.ts"
import { framing } from "../layouts/framing.ts"
import { boxesTouch, inflate } from "../layouts/geometry.ts"
import { seat } from "../shapes/subjects.ts"
import type { Context, FigureStage } from "./parts.ts"

// Where a figure goes and how large, as a square: seated as a round subject
// would be beside the title, large and off the edges where the title leaves
// only thin bands, centred behind a title in the middle, and framed on a
// third when nothing is kept clear. `size` is its share of the open area.
export function seated(context: Context, stage: FigureStage, size: number, rng: Rng) {
  const { w, h, keep } = context
  const margin = Math.min(w, h) * 0.06
  // Behind a large title in the middle, the mark is drawn large, so its
  // tiles frame the title round the clearing instead of hiding under it.
  const start = context.fill
    ? Math.min(w, h) * 0.66
    : context.calm.length
      ? Math.min(w, h) * 1.06
    : Math.min(Math.min(stage.area.w, stage.area.h) * size, Math.min(w, h) * 0.78)
  // Seated as a round subject would be, kept on the canvas by `bleed` of
  // its side or more, and, shrinking if it must, off every area.
  const fit = (bleed: number, from: number) => {
    let side = from
    let x = w / 2
    let y = h / 2
    for (let attempt = 0; attempt < 12; attempt++) {
      // Behind a title in the middle, it is centred on the title, larger
      // than the canvas is tall, so its ends show above and below it.
      if (context.calm.length) break
      if (!context.fill) {
        const at = seat({ area: stage.area, safe: keep, w, h, away: stage.away }, side / 2)
        const edge = side / 2 + margin - side * bleed
        x = clamp(at.x, edge, w - edge)
        y = clamp(at.y, edge, h - edge)
      }
      const box = { x: x - side / 2, y: y - side / 2, w: side, h: side }
      if (context.fill || !context.titled || !boxesTouch(box, inflate(keep, margin / 2))) break
      side *= 0.9
    }
    return { x, y, side }
  }
  // Whole on the canvas when there is room; where a title leaves only thin
  // bands, large and running off the edge rather than small.
  // That large mark starts from the canvas, not from the thin band, and the
  // edge may take up to 40% of it.
  // A mark that would come out under half the short side is a timid one
  // beside a title: it is drawn large instead, as a poster's would be.
  let placed = fit(0, start)
  if (placed.side < Math.min(w, h) * 0.52) placed = fit(0.4, Math.min(w, h) * 0.7)
  // Beside a title at an edge, the mark is drawn large too, running off the
  // far edges, as long as it comes no nearer the title than a whole one.
  if (context.titled && !context.fill && !context.calm.length) {
    const large = fit(0.35, Math.min(w, h) * 1.12)
    if (large.side > placed.side * 1.15) placed = large
  }
  // With nothing to keep clear, the whole frame is the mark's (see
  // framing.ts).
  const framed = framing(context, rng)
  if (framed) placed = { x: framed.x, y: framed.y, side: Math.min(w, h) * framed.reach }
  return placed
}
