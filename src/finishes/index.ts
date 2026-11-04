import type { Art, Piece } from "../core/recipe.ts"
import type { Layer, Motion } from "../core/scene.ts"

// What a drawing is made of. A finish knows nothing about the marks it is given,
// so any layout can go through any of them.

export type FilmParams = { amount: number; scale: number; seed: number }

// Pieces cut to their shapes, each through `finish`, or drawn plain without one.
const cut = (art: Art, finish = (piece: Piece): Layer[] => piece.marks) =>
  (art.pieces ?? []).map(
    (piece): Layer => ({
      kind: "clip",
      id: piece.id,
      shape: piece.clip,
      layers: finish(piece),
    })
  )

export const film = (art: Art, p: FilmParams): Layer[] => [
  ...art.under,
  ...art.marks,
  ...cut(art),
  ...art.over,
  { kind: "grain", id: "grain", ...p },
]

export type PlateParams = {
  scale: number
  hardness: number
  wash: number
  seed: number
  film: number
  filmSeed: number
}

// The marks become an aquatint plate, grain dense where they are strong.
export const plate = (art: Art, p: PlateParams): Layer[] => [
  ...art.under,
  {
    kind: "stipple",
    id: "plate",
    tone: "strong",
    scale: p.scale,
    hardness: p.hardness,
    wash: p.wash,
    seed: p.seed,
    layers: art.marks,
    ...(art.moves?.plate ? { motion: art.moves.plate } : null),
  },
  ...(art.echo
    ? [
        {
          kind: "stipple",
          id: "echo",
          tone: "strong",
          scale: p.scale,
          hardness: p.hardness,
          wash: p.wash,
          seed: p.seed,
          layers: art.marks,
          opacity: 0,
          ink: { blend: "normal", dx: art.echo.dx, dy: art.echo.dy },
          motion: art.echo.motion,
        } as const,
      ]
    : []),
  ...art.over,
  { kind: "grain", id: "grain", amount: p.film, scale: 0.74, seed: p.filmSeed },
]

export type PrintParams = {
  scale: number
  hardness: number
  wash: number
  seed: number
  // How far the second ink lands from the first.
  dx: number
  dy: number
  // How inks add up: darker on paper, lighter on black.
  blend: "multiply" | "screen"
  paper: number
  paperSeed: number
}

// The marks become two passes of a press. Where the inks overlap they make a
// third colour, which is what gives away a real print.
export const print = (art: Art, p: PrintParams): Layer[] => {
  const pass = (
    id: string,
    tone: "accent" | "partner",
    layers: Art["marks"],
    dx: number,
    dy: number,
    motion?: Motion
  ): Layer => ({
    kind: "stipple",
    id,
    tone,
    scale: p.scale,
    hardness: p.hardness,
    wash: p.wash,
    seed: p.seed + (tone === "accent" ? 0 : 1),
    layers,
    ink: { blend: p.blend, dx, dy },
    ...(motion ? { motion } : null),
  })
  return [
    ...art.under,
    pass("first", "accent", art.marks, 0, 0, art.moves?.plate),
    pass("second", "partner", art.second ?? art.marks, p.dx, p.dy, art.moves?.second),
    ...art.over,
    { kind: "grain", id: "grain", amount: p.paper, scale: 0.74, seed: p.paperSeed },
  ]
}

export type FocusParams = {
  // How far out of focus the marks are, and the second, finer marks.
  mass: number
  fine: number
  amount: number
  scale: number
  seed: number
}

// A photograph of something very soft: nothing in it has an edge, and the grain
// is the only sharp thing in the frame.
export const focus = (art: Art, p: FocusParams): Layer[] => [
  ...art.under,
  { kind: "soften", id: "mass", radius: p.mass, layers: art.marks, ...(art.moves?.plate ? { motion: art.moves.plate } : null) },
  { kind: "soften", id: "fine", radius: p.fine, layers: art.second ?? [], ...(art.moves?.second ? { motion: art.moves.second } : null) },
  ...art.over,
  { kind: "grain", id: "grain", amount: p.amount, scale: p.scale, seed: p.seed },
]

export type ExposureParams = {
  angle: number
  streak: number
  warp: number
  bloom: number
  seed: number
  amount: number
  scale: number
  grainSeed: number
}

// The marks become a long exposure. What sits above the finish stays sharp in
// tone, which is how a title's veil survives it.
export const exposure = (art: Art, p: ExposureParams): Layer[] => [
  {
    kind: "blur",
    id: "exposure",
    angle: p.angle,
    streak: p.streak,
    warp: p.warp,
    bloom: p.bloom,
    seed: p.seed,
    layers: [...art.under, ...art.marks],
    ...(art.moves?.plate ? { motion: art.moves.plate } : null),
  },
  ...art.over,
  {
    kind: "grain",
    id: "grain",
    amount: p.amount,
    scale: p.scale,
    seed: p.grainSeed,
  },
]

export type SmearParams = {
  // How far each piece is pulled across and up and down.
  across: number
  along: number
  amount: number
  scale: number
  seed: number
}

// Each piece softened inside its own shape, more one way than the other, and
// the shape's edge left sharp.
export const smear = (art: Art, p: SmearParams): Layer[] => [
  ...art.under,
  ...art.marks,
  ...cut(art, (piece) => [
    {
      kind: "soften",
      id: `${piece.id}-soft`,
      radius: p.across,
      ry: p.along,
      layers: piece.marks,
    },
  ]),
  ...art.over,
  { kind: "grain", id: "grain", amount: p.amount, scale: p.scale, seed: p.seed },
]
