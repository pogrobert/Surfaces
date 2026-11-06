import type { GroundPart } from "./parts.ts"

// What the cover is printed on.

// A plain sheet in the palette's own ground.
export const plain: GroundPart = {
  name: "plain",
  ranges: {},
  palette: (spec) => spec,
  under: () => [{ kind: "fill", id: "ground", tone: "ground" }],
}

// Uncoated paper, warmed whatever the brand, folded once down the middle: a
// soft shadow on one side of the crease and a clean edge on the other. The
// crease crosses the print too, as a real one does.
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
  over({ w, h }, p) {
    const width = w * 0.03
    const x = w / 2 - width
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
