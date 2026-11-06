import type { Mood, Grain } from "../core/intent.ts"
import type { PaletteSpec } from "../core/palette.ts"
import type { Range } from "../core/random.ts"
import type { Art, Frame, RecipeContext } from "../core/recipe.ts"
import type { Box, Layer, Mark, Shape } from "../core/scene.ts"

// The grammar a cover is made in. Almost any printed cover comes apart into
// the same few decisions, each with a short list of answers:
//
//   ground    what it is printed on: paper with a fold, a plain sheet
//   figure    what the subject is: a mark of tiles, an arch, nothing
//   fill      what the ink is: paint, flat colour, lines, dots
//   relation  how figure and fill meet: the fill inside the figure, the
//             figure cut out of the fill
//   process   how it was reproduced: film grain, a two-ink press, a wash
//
// A part is one answer. It brings the ranges inside which it has been judged,
// and narrows them for a mood or a grain level, so a combination of parts is
// as safe as the parts are. A style is then a preset: one combination, named
// and looked at (see compose.ts).

type Ranges = Record<string, Range>

export type PartBase<R extends Ranges = Ranges> = {
  name: string
  // The only tunable numbers, named as a recipe's are. Two parts of one
  // combination may not share a name.
  ranges: R
  moods?: Partial<Record<Mood, Partial<Record<keyof R, Range>>>>
  // Only a process may narrow its numbers for a grain level: grain is what a
  // process is.
  grain?: Partial<Record<Exclude<Grain, "natural">, Partial<Record<keyof R, Range>>>>
  // Parts this one has been seen not to work with, by name.
  avoid?: readonly string[]
}

type P = Record<string, number>
export type Context = RecipeContext<string>

// Where the figure goes: the clear area beside the title, and the way out of
// the title into it.
export type FigureStage = {
  area: Box
  away: { x: number; y: number }
}

// A figure is a few sharp shapes and the box they keep inside. A fill is
// drawn into that box and the relation decides how the two meet. `voids` are
// the openings the shapes close round, such as a round gap in the middle of
// four tiles: a stencil cuts them out with the shapes, or they would print as
// a dot of their own.
export type DrawnFigure = { shapes: Shape[]; voids: Shape[]; subject: Box }

export type FigurePart<R extends Ranges = Ranges> = PartBase<R> & {
  // The variants it can be asked for by `shape`.
  shapes: readonly string[]
  draw(context: Context, stage: FigureStage, shape: string, p: P): DrawnFigure
}

export type FillPart<R extends Ranges = Ranges> = PartBase<R> & {
  // Marks filling `region`, in the scene's tones.
  paint(context: Context, region: Box, p: P): Mark[]
}

export type RelationPart = PartBase<Record<never, Range>> & {
  join(context: Context, figure: DrawnFigure, fill: Mark[]): Pick<Art, "marks" | "pieces"> & { over?: Art["over"] }
}

export type ProcessPart<R extends Ranges = Ranges> = PartBase<R> & {
  // Its palette, when it prints in inks of its own.
  palette?: (spec: PaletteSpec) => PaletteSpec
  finish(art: Art, context: Context): Layer[]
}

export type GroundPart<R extends Ranges = Ranges> = PartBase<R> & {
  palette: (spec: PaletteSpec) => PaletteSpec
  // What lies on the sheet before anything is printed on it, and what the
  // sheet does to the print after, such as a fold across it.
  under(frame: Frame, p: P): Art["under"]
  over?(frame: Frame, p: P): Art["over"]
}
