import { fromOklch, toOklch } from "./core/color.ts"
import { drawFilled } from "./core/generate.ts"
import { GRAINS, MOODS, THEMES } from "./core/intent.ts"
import type { Grain, Mood, Theme } from "./core/intent.ts"
import { hash } from "./core/random.ts"
import type { Layer, Scene } from "./core/scene.ts"
import { nearest } from "./core/validate.ts"
import type { Problems } from "./core/validate.ts"

// An avatar: a small mark for a person, a team or a project, from their name
// or id. Only the styles that still read at 24 pixels, with bold forms and
// no hairlines, make avatars; each fills its square, composed to the middle,
// and is cut to a circle unless asked to stay square. People in a list
// should be told apart, so the brand colour is turned a little for each
// seed, staying in the brand's family.
//
//   avatar({ style: "riso", seed: user.id, color: "#635bff" })

export const AVATAR_STYLES = ["riso", "marbling", "strata", "aquatint", "sfumato", "underpaint"] as const
export type AvatarStyle = (typeof AVATAR_STYLES)[number]

export type AvatarInput = {
  style: AvatarStyle
  // A stable name for the person: their id or handle.
  seed: string | number
  color?: string
  // Pixels across. The art is the same at any size; this is what a PNG is
  // drawn at. Default 256.
  size?: number
  theme?: Theme | "auto"
  mood?: Mood
  grain?: Grain
  // Keep the square instead of cutting a circle.
  square?: boolean
}

const OPTIONS = ["style", "seed", "color", "size", "theme", "mood", "grain", "square"] as const
const DEFAULT_COLOR = "#5b5bd6"
const DEFAULT_SIZE = 256

// How far, in degrees either way, a seed turns the brand's hue. Soft styles
// tell people apart by colour more than by shape, so they turn further.
const SPREAD: Record<AvatarStyle, number> = { riso: 30, marbling: 30, strata: 35, aquatint: 40, sfumato: 55, underpaint: 55 }

const list = (choices: readonly string[]) => {
  const quoted = choices.map((choice) => `"${choice}"`)
  return quoted.length > 1 ? `${quoted.slice(0, -1).join(", ")} or ${quoted.at(-1)}` : quoted.join("")
}

// Everything wrong with an avatar input, each with its fix.
export function validateAvatar(input: unknown): Problems {
  const errors: string[] = []
  const warnings: string[] = []
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { errors: [`Expected an object such as { style: "riso", seed: user.id, color: "#635bff" }.`], warnings }
  }
  const value = input as Record<string, unknown>
  for (const key of Object.keys(value)) {
    if (!(OPTIONS as readonly string[]).includes(key)) {
      const hint = key === "width" || key === "height" ? ' Avatars are square: use "size".' : nearest(key, OPTIONS)
      errors.push(`Unknown option "${key}".${hint || ` Options are ${list(OPTIONS)}.`}`)
    }
  }
  const style = value.style
  if (style === undefined) errors.push(`Missing "style". Use ${list(AVATAR_STYLES)}.`)
  else if (typeof style !== "string" || !(AVATAR_STYLES as readonly string[]).includes(style)) {
    const hint = typeof style === "string" ? nearest(style, AVATAR_STYLES) : ""
    errors.push(`Avatars come in ${list(AVATAR_STYLES)}, not ${JSON.stringify(style)}.${hint} The others are too fine to read at avatar sizes.`)
  }
  if (value.seed === undefined) errors.push(`Missing "seed". Use something stable that names the person, such as their id.`)
  else if (typeof value.seed !== "string" && typeof value.seed !== "number") errors.push(`"seed" must be a string or a number, such as the person's id.`)
  const color = value.color
  if (color !== undefined && (typeof color !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color))) {
    errors.push(`"color" must be a hex colour such as "#635bff", got ${JSON.stringify(color)}.`)
  }
  const size = value.size
  if (size !== undefined && (typeof size !== "number" || !Number.isInteger(size) || size < 16 || size > 2048)) {
    errors.push(`"size" must be a whole number of pixels from 16 to 2048, got ${JSON.stringify(size)}.`)
  }
  const word = (name: string, choices: readonly string[]) => {
    const given = value[name]
    if (given === undefined) return
    if (typeof given !== "string" || !choices.includes(given)) {
      errors.push(`Unknown ${name} ${JSON.stringify(given)}.${typeof given === "string" ? nearest(given, choices) : ""} Use ${list(choices)}.`)
    }
  }
  word("theme", [...THEMES, "auto"])
  word("mood", MOODS)
  word("grain", GRAINS)
  if (value.square !== undefined && typeof value.square !== "boolean") errors.push(`"square" must be true or false.`)
  return { errors, warnings }
}

// The brand colour turned a little for this seed.
function tint(color: string, seed: string | number, spread: number) {
  const brand = toOklch(color)
  const turn = ((hash(`avatar:${seed}`) % 10000) / 10000 - 0.5) * 2 * spread
  return fromOklch({ ...brand, h: (brand.h + turn + 360) % 360 })
}

export function avatar(input: AvatarInput): Scene {
  const { errors } = validateAvatar(input)
  if (errors.length) throw new Error(errors.join("\n"))
  const size = input.size ?? DEFAULT_SIZE
  const scene = drawFilled({
    style: input.style,
    seed: input.seed,
    color: tint(input.color ?? DEFAULT_COLOR, input.seed, SPREAD[input.style]),
    width: size,
    height: size,
    ...(input.theme ? { theme: input.theme } : null),
    ...(input.mood ? { mood: input.mood } : null),
    ...(input.grain ? { grain: input.grain } : null),
  })
  if (input.square) return scene
  const { w, h } = scene.size
  const round = (layers: Layer[]): Layer[] => [{ kind: "clip", id: "avatar", shape: { type: "circle", cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2 }, layers }]
  return {
    ...scene,
    layers: round(scene.layers),
    ...(scene.dark ? { dark: { ...scene.dark, layers: round(scene.dark.layers) } } : null),
  }
}
