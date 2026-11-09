import type { Grain, Mood, MotionLevel, Theme } from "./intent.ts"
import type { PaletteSpec } from "./palette.ts"
import type { Range, Rng } from "./random.ts"
import type { Box, Fill, Layer, Mark, Motion, Shape } from "./scene.ts"

export type Ranges = Record<string, Range>

// What every layout works from.
export type Frame = {
  w: number
  h: number
  // The main box kept clear for content: the largest, where a title goes.
  safe: Box
  // Every box the art keeps clear, the main one among them. The layouts
  // place their art in the space these leave, and measure how far it reaches
  // from the main one, where the title is.
  keep: readonly Box[]
  // Boxes the art passes behind but should go quiet under: a large title in
  // the middle, over a soft clearing. A layout that can thin its art there
  // in its own way, as a halftone screen lightens, does; the clearing does
  // the rest.
  calm: readonly Box[]
  // False when no title was asked for, and the art may use the whole canvas.
  titled: boolean
  // The art fills the whole canvas and is composed to its middle, for a mark
  // cut from it, such as a circle. A layout that places a subject beside
  // a title centres it instead; one that cuts a disc fills the canvas.
  fill: boolean
  theme: Theme
  // Whether the art should move. A layout that moves takes its own stream for
  // it, so a moving cover is the same drawing as a still one.
  motion: MotionLevel
  // A stream of its own for each part of the drawing.
  rng: Rng
}

export type RecipeContext<Params extends string> = Frame & {
  mood: Mood | undefined
  // One drawn value per range, inside the mood's narrower range when it has
  // one. Each takes exactly one draw whatever the mood, so a calm seed keeps
  // its drawing and only gets quieter.
  p: Record<Params, number>
  // The approved shape for this cover, when the recipe has any.
  shape: string | undefined
  // The seed as given, for a style that draws from its words, as a
  // typewriter types the brand's initial: a brand's seed begins with its name.
  seed: string
}

// A layout's result, before a finish has touched it: what the art stands on,
// the marks that make it, and anything that has to stay above the finish.
export type Art = {
  under: (Fill | Mark)[]
  marks: Mark[]
  // Marks for a second ink, where the art is printed in two, or for a second
  // plate printed over the first.
  second?: Mark[]
  // Drawn between the main plate and the second: what stands in front and
  // hides the first plate behind it.
  between?: Layer[]
  // Art kept inside shapes of its own, such as discs, each finished on its own
  // and then cut to its shape, so the shape keeps a sharp edge.
  pieces?: Piece[]
  over: Layer[]
  subject?: Box
  // How the finished drawing moves as a whole, on a moving cover: its main
  // plate (the grain, the blur, the softening, the first ink) and the second
  // one where the finish has two. A finish passes these to its own layers.
  moves?: { plate?: Motion; second?: Motion }
  // The main plate printed again over itself, `dx`, `dy` out of line, its
  // grain the same grain: shown only as `motion` brings it up, from nothing.
  echo?: { dx: number; dy: number; motion: Motion }
}

// Its motion moves what is inside the shape; the shape stays put.
export type Piece = { id: string; clip: Shape; marks: Mark[]; motion?: Motion }

// A style is three separate decisions: a layout places things, a shape says
// what they are, a finish says what they are made of. A recipe is one approved
// combination of the three, with the ranges inside which it has been judged
// safe. Combinations aren't open to callers, because each one has to be looked
// at before it can promise that every seed is good.
export type Recipe<R extends Ranges = Ranges> = {
  style: string
  version: number
  // The only tunable numbers. The seed moves inside them and nowhere else.
  ranges: R
  // Must sit inside `ranges`; test/recipes.test.ts holds them to it.
  moods: Record<Mood, Partial<Record<keyof R, Range>>>
  // The ranges of the finish's own numbers at the other two grain levels; the
  // plain ranges are "natural". A grain level outranks a mood, since it is the
  // narrower choice.
  grain: Record<Exclude<Grain, "natural">, Partial<Record<keyof R, Range>>>
  palette: PaletteSpec
  // The shapes this recipe has been judged with. The seed picks one unless the
  // caller does.
  shapes?: readonly string[]
  // The art goes round a large area in the middle, as it does any other,
  // instead of passing behind it under a clearing of ground: for a pattern
  // that frames the area already, or art with lines of its own that would
  // read as text under the title.
  aroundCentre?: boolean
  // With detail "micro", only the corner marks: for art too soft or too busy
  // to carry a ruler and a label without them reading as noise.
  marksOnly?: boolean
  layout(context: RecipeContext<Extract<keyof R, string>>): Art
  finish(art: Art, context: RecipeContext<Extract<keyof R, string>>): Layer[]
}

export const defineRecipe = <R extends Ranges>(recipe: Recipe<R>) => recipe
