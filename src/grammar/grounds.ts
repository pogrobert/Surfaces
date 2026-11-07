import type { GroundPart } from "./parts.ts"

// What the cover is printed on.

// A plain sheet in the palette's own ground.
export const plain: GroundPart = {
  name: "plain",
  ranges: {},
  palette: (spec) => spec,
  under: () => [{ kind: "fill", id: "ground", tone: "ground" }],
}

// Uncoated paper, warmed whatever the brand, folded once: a soft shadow on
// one side of the crease and a clean edge on the other. The crease runs only
// over clear paper, never through the words or the figure: down the middle
// of the widest clear gap near the centre, and the sheet lies flat when no
// gap there is wide enough.
export const paper: GroundPart = {
  name: "paper",
  ranges: { fold: [0.05, 0.09] },
  moods: { calm: { fold: [0.05, 0.065] } },
  palette: (spec) => ({
    ...spec,
    light: { ...spec.light, ground: { l: [0.955, 0.97], c: [0.06, 0.1], turn: -30 } },
    dark: { ...spec.dark, ground: { l: [0.15, 0.18], c: [0.14, 0.2], turn: 8 } },
  }),
  under: () => [{ kind: "fill", id: "ground", tone: "ground" }],
  over({ w, h, keep, calm }, p, avoid) {
    // A strip, such as a header, isn't a sheet that folds: across it a
    // crease reads as a seam.
    if (w / h >= 2.4) return []
    const width = w * 0.03
    const margin = w * 0.03
    // What the sheet carries, as spans across it, joined where they meet.
    const spans = [...keep, ...calm, ...avoid]
      .filter((box) => box.w > 0 && box.h > 0)
      .map((box) => [box.x - margin, box.x + box.w + margin] as const)
      .sort((a, b) => a[0] - b[0])
    const joined: [number, number][] = []
    for (const [from, to] of spans) {
      const last = joined.at(-1)
      if (last && from <= last[1]) last[1] = Math.max(last[1], to)
      else joined.push([from, to])
    }
    // The clear gaps between them, and the middle of the one nearest the
    // sheet's own middle, if it is in the middle half and wide enough.
    const edges = [0, ...joined.flat(), w]
    const middles: number[] = []
    for (let i = 0; i < edges.length; i += 2) {
      if (edges[i + 1]! - edges[i]! >= width) middles.push((edges[i]! + edges[i + 1]!) / 2)
    }
    const middle = middles
      .filter((at) => at >= w * 0.25 && at <= w * 0.75)
      .sort((a, b) => Math.abs(a - w / 2) - Math.abs(b - w / 2))[0]
    if (middle === undefined) return []
    const crease = middle + width / 2
    const x = crease - width
    return [
      {
        kind: "shapes",
        id: "fold",
        paint: {
          type: "linear",
          x1: x,
          y1: 0,
          x2: x + width,
          y2: 0,
          stops: [
            { at: 0, tone: "strong", opacity: 0 },
            { at: 0.96, tone: "strong", opacity: p.fold! },
            { at: 1, tone: "strong", opacity: 0 },
          ],
        },
        shapes: [{ type: "rect", x, y: 0, w: width, h, radii: [0, 0, 0, 0] }],
      },
    ]
  },
}

export const GROUNDS = { plain, paper }
