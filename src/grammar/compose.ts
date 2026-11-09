import { HAIRLINE } from "../core/judge.ts"
import { BASE_PALETTE } from "../core/palette.ts"
import type { PaletteSpec } from "../core/palette.ts"
import type { Range } from "../core/random.ts"
import type { Art, Piece, Recipe } from "../core/recipe.ts"
import type { Motion } from "../core/scene.ts"
import { inflate } from "../layouts/geometry.ts"
import { clearing } from "../layouts/stage.ts"
import { FIGURES } from "./figures.ts"
import { FILLS } from "./fills.ts"
import { GROUNDS } from "./grounds.ts"
import type { Context, PartBase } from "./parts.ts"
import { PROCESSES } from "./processes.ts"
import { RELATIONS } from "./relations.ts"

// Every answer the grammar has, by layer (see parts.ts).
export const GRAMMAR = {
  ground: GROUNDS,
  figure: FIGURES,
  fill: FILLS,
  relation: RELATIONS,
  process: PROCESSES,
}

export type Layers = { [L in keyof typeof GRAMMAR]: keyof (typeof GRAMMAR)[L] }

export type Preset = Layers & {
  style: string
  version: number
  // The palette before the ground and the process have their say.
  palette?: PaletteSpec
  marksOnly?: boolean
}

type Ranges = Record<string, Range>

// A preset made into a recipe: the parts' ranges side by side, their moods and
// grain levels merged, and a layout that seats the figure, paints the fill,
// joins the two and lays them on the ground. The recipe is an ordinary one, so
// everything downstream, from validation to alt text, treats it as any other.
// Throws when two parts can't go together, naming them.
export function compose(preset: Preset): Recipe & { layers: Layers } {
  const ground = GRAMMAR.ground[preset.ground]
  const figure = GRAMMAR.figure[preset.figure]
  const fill = GRAMMAR.fill[preset.fill]
  const relation = GRAMMAR.relation[preset.relation]
  const process = GRAMMAR.process[preset.process]
  const parts: PartBase[] = [ground, figure, fill, relation, process]

  for (const part of parts) {
    for (const other of parts) {
      if (part.avoid?.includes(other.name)) {
        throw new Error(`${preset.style}: "${part.name}" doesn't work with "${other.name}"; choose another ${layerOf(other.name)}`)
      }
    }
  }

  const ranges: Ranges = {}
  const moods: Recipe["moods"] = { calm: {}, bold: {} }
  const grain: Recipe["grain"] = { smooth: {}, heavy: {} }
  for (const part of parts) {
    for (const [name, range] of Object.entries(part.ranges)) {
      if (name in ranges) throw new Error(`${preset.style}: two parts both tune "${name}"`)
      ranges[name] = range
    }
    for (const mood of ["calm", "bold"] as const) Object.assign(moods[mood], part.moods?.[mood])
  }
  for (const level of ["smooth", "heavy"] as const) Object.assign(grain[level], process.grain?.[level])

  if (fill.hairline) HAIRLINE.add(preset.style)

  const base = ground.palette(preset.palette ?? BASE_PALETTE)
  const palette = process.palette ? process.palette(base) : base

  return {
    style: preset.style,
    version: preset.version,
    layers: { ground: preset.ground, figure: preset.figure, fill: preset.fill, relation: preset.relation, process: preset.process },
    ranges,
    moods,
    grain,
    palette,
    shapes: figure.shapes,
    ...(preset.marksOnly ? { marksOnly: true } : null),

    layout(context): Art {
      const { w, h, p } = context
      const stage = context.fill ? { area: { x: 0, y: 0, w, h }, away: { x: 0, y: -1 } } : clearing(context)
      const drawn = figure.draw(context as Context, stage, context.shape!, p)
      // A little past the figure, so a fill that drifts never shows its edge.
      const region = inflate(drawn.subject, drawn.subject.w * 0.06)
      const joined = relation.join(context as Context, drawn, fill.paint(context as Context, region, p))
      const pieces = joined.pieces?.map((piece, index): Piece =>
        context.motion === "none" ? piece : { ...piece, motion: arrival(index, drawn.subject.w, context.rng.fork(`motion${index}`).next()) }
      )
      return {
        under: ground.under(context, p),
        marks: joined.marks,
        ...(pieces ? { pieces } : null),
        over: [...(joined.over ?? []), ...(ground.over?.(context, p, [drawn.subject]) ?? [])],
        subject: drawn.subject,
      }
    },
    finish: (art, context) => process.finish(art, context as Context),
  }
}

// Each piece comes up one after another, then its paint drifts slowly inside
// it, each on a clock of its own.
function arrival(index: number, side: number, turn: number): Motion {
  const reach = side * 0.025
  return {
    enter: { kind: "fade", delay: 0.15 + index * 0.16, duration: 1.4, scale: 0.94 },
    loop: { kind: "drift", dx: reach * (turn < 0.5 ? 1 : -1), dy: reach * 0.6, period: 16 + index * 2.5 },
  }
}

function layerOf(name: string) {
  return (Object.keys(GRAMMAR) as (keyof typeof GRAMMAR)[]).find((layer) => name in GRAMMAR[layer]) ?? "part"
}
