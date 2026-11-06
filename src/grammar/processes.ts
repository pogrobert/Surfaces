import { cos, radians, sin } from "../core/math.ts"
import type { Art, Piece } from "../core/recipe.ts"
import { print } from "../finishes/index.ts"
import type { Layer, Mark, Tone } from "../core/scene.ts"
import type { ProcessPart } from "./parts.ts"

// How the print was made: what happens to every mark on the way to paper. A
// process takes any art, pieces and all, so any figure and fill go through it.

const grainLayer = (amount: number, scale: number, seed: number): Layer => ({
  kind: "grain",
  id: "grain",
  amount,
  scale,
  seed,
})

// Each piece cut to its shape, its marks made into layers by `inner`.
const cut = (art: Art, inner: (piece: Piece) => Layer[]) =>
  (art.pieces ?? []).map(
    (piece): Layer => ({
      kind: "clip",
      id: piece.id,
      shape: piece.clip,
      layers: inner(piece),
      ...(piece.motion ? { motion: piece.motion } : null),
    })
  )

const GRAIN_RANGES = { grain: [0.22, 0.34], grainScale: [0.62, 0.8] } as const
const GRAIN_LEVELS = {
  smooth: { grain: [0.05, 0.09] },
  heavy: { grain: [0.5, 0.62], grainScale: [0.55, 0.65] },
} as const

// Printed as it is, under film grain.
export const film: ProcessPart = {
  name: "film",
  ranges: { ...GRAIN_RANGES },
  grain: GRAIN_LEVELS,
  finish: (art, { p, rng }) => [
    ...art.under,
    ...art.marks,
    ...cut(art, (piece) => piece.marks),
    ...art.over,
    grainLayer(p.grain!, p.grainScale!, rng.fork("grain").int(1, 9999)),
  ],
}

// Wet: every piece's marks run softly into each other inside the piece,
// while the piece itself keeps a sharp edge, as paint does inside a stencil.
export const wash: ProcessPart = {
  name: "wash",
  ranges: { blur: [1.2, 3.2], ...GRAIN_RANGES },
  moods: { calm: { blur: [2.4, 3.2] }, bold: { blur: [1.2, 2] } },
  grain: GRAIN_LEVELS,
  // A flat coat has nothing to run into.
  avoid: ["flat"],
  finish: (art, { p, rng }) => [
    ...art.under,
    ...art.marks,
    ...cut(art, (piece) => [{ kind: "soften", id: `${piece.id}-wash`, radius: p.blur!, layers: piece.marks }]),
    ...art.over,
    grainLayer(p.grain!, p.grainScale!, rng.fork("grain").int(1, 9999)),
  ],
}

// How densely a one-ink plate holds each tone: the deeper the tone, the more
// ink, so a fill in many tones prints as one ink in many densities.
const DENSITY: Record<Tone, number> = {
  ground: 0,
  quiet: 0.1,
  soft: 0.22,
  body: 0.42,
  accent: 0.58,
  strong: 0.85,
  partner: 0.42,
  ink: 1,
}

const asDensity = (marks: Mark[]): Mark[] =>
  marks.map((mark) =>
    mark.kind === "shapes" && mark.paint.type === "solid"
      ? { ...mark, paint: { ...mark.paint, opacity: mark.paint.opacity * DENSITY[mark.paint.tone] } }
      : mark
  )

// An aquatint plate: one ink, laid as grain, dense where the tone is deep.
export const plate: ProcessPart = {
  name: "plate",
  ranges: {
    grainSize: [0.6, 0.8],
    hardness: [1.7, 3.2],
    wash: [0.46, 0.68],
    film: [0.14, 0.24],
  },
  moods: {
    calm: { hardness: [1.7, 2.2], wash: [0.58, 0.68] },
    bold: { hardness: [2.6, 3.2] },
  },
  grain: {
    smooth: { grainSize: [0.82, 0.95], hardness: [1.3, 1.8], wash: [0.9, 0.96], film: [0.04, 0.08] },
    heavy: { grainSize: [0.5, 0.62], hardness: [2.8, 3.8], wash: [0.3, 0.42], film: [0.3, 0.4] },
  },
  avoid: ["flat"],
  // One deep ink, as an etcher's is.
  palette: (spec) => ({
    ...spec,
    maxChroma: Math.min(spec.maxChroma, 0.12),
    light: { ...spec.light, strong: { l: [0.24, 0.3], c: [0.8, 1], turn: 12 } },
    dark: { ...spec.dark, strong: { l: [0.9, 0.95], c: [0.3, 0.45], turn: -8 } },
  }),
  finish(art, { p, rng }) {
    const seeds = rng.fork("grain")
    const seed = seeds.int(1, 9999)
    return [
      ...art.under,
      ...art.marks,
      ...cut(art, (piece) => [
        {
          kind: "stipple",
          id: `${piece.id}-plate`,
          tone: "strong",
          scale: p.grainSize!,
          hardness: p.hardness!,
          wash: p.wash!,
          seed,
          layers: asDensity(piece.marks),
        },
      ]),
      ...art.over,
      grainLayer(p.film!, 0.74, seeds.int(1, 9999)),
    ]
  },
}

// Two inks through a stencil duplicator, as Riso's own print is: each piece
// printed whole in the brand's ink, every other one again in its partner,
// out of line with the first, so the overlap makes a third colour. A piece
// prints as its own shape, so the fill inside it has to be one flat coat.
export const press: ProcessPart = {
  name: "press",
  ranges: {
    register: [6, 14],
    registerAngle: [0, 360],
    grainSize: [0.62, 0.8],
    hardness: [2.2, 3.6],
    wash: [0.44, 0.66],
    paper: [0.08, 0.16],
  },
  moods: {
    calm: { register: [6, 8], wash: [0.56, 0.66], paper: [0.08, 0.11] },
    bold: { register: [10, 14], hardness: [3, 3.6], paper: [0.12, 0.16] },
  },
  grain: {
    smooth: { grainSize: [0.82, 0.95], hardness: [1.6, 2.2], wash: [0.92, 0.97], paper: [0.02, 0.05] },
    heavy: { grainSize: [0.52, 0.62], hardness: [3.4, 4.4], wash: [0.3, 0.4], paper: [0.2, 0.28] },
  },
  avoid: ["paint"],
  // The first ink is the brand colour itself, as a spot ink is; the second
  // its partner, and never grey.
  palette: (spec) => ({
    ...spec,
    maxChroma: Math.max(spec.maxChroma, 0.2),
    partnerFloor: 0.09,
    accent: { light: [0.55, 0.82], dark: [0.5, 0.84] },
    light: { ...spec.light, partner: { l: [0.74, 0.82], c: [0.8, 1] } },
    dark: { ...spec.dark, partner: { l: [0.58, 0.66], c: [0.8, 1] } },
  }),
  finish(art, { p, rng, theme }) {
    const shapes = (art.pieces ?? []).map((piece) => ({
      kind: "shapes" as const,
      id: piece.id,
      paint: { type: "solid" as const, tone: "accent" as const, opacity: 1 },
      shapes: [piece.clip],
    }))
    const second = shapes.length < 2 ? shapes : shapes.filter((_, index) => index % 2 === 1)
    const seeds = rng.fork("press")
    const angle = radians(p.registerAngle!)
    return print(
      { ...art, marks: [...art.marks, ...shapes], second, pieces: [] },
      {
        scale: p.grainSize!,
        hardness: p.hardness!,
        wash: p.wash!,
        seed: seeds.int(1, 9998),
        dx: cos(angle) * p.register!,
        dy: sin(angle) * p.register!,
        blend: theme === "dark" ? "screen" : "multiply",
        paper: p.paper!,
        paperSeed: seeds.int(1, 9999),
      }
    )
  },
}

export const PROCESSES = { film, wash, plate, press }
