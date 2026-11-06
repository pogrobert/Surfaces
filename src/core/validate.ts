import { AREA_ART, AREA_SIZES, DETAILS, GRAINS, MAX_RATIO, MOODS, MOTIONS, PLACES, THEMES, areaShare } from "./intent.ts"
import type { Box } from "./scene.ts"
import { FONTS, missing } from "./type.ts"
import type { Font } from "./type.ts"
import { STYLES } from "../styles/index.ts"

// Everything wrong with an input, each said with how to put it right, so a
// person or an agent can fix it in one go. Nothing is ever quietly dropped or
// guessed: an option the library doesn't know is an error, not ignored.
export type Problems = { errors: string[]; warnings: string[] }

const OPTIONS = [
  "style",
  "seed",
  "color",
  "width",
  "height",
  "areas",
  "theme",
  "mood",
  "grain",
  "detail",
  "motion",
  "shape",
  "image",
  "title",
  "font",
] as const
const AREA_OPTIONS = ["place", "size", "box", "art"] as const

// Seeds people reach for when they don't mean one. They work, but every site
// that uses them gets the same cover.
const TRIVIAL = new Set(["0", "1", "42", "123", "1234", "seed", "test", "default", "example", "abc", "foo", ""])

// The fewest single-letter edits between two words, two letters swapped
// counting as one, since that is the commonest slip.
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1)
    }
  }
  return d[a.length]![b.length]!
}

// "Did you mean …?" when one of the choices is close.
export function nearest(value: string, choices: readonly string[]) {
  const close = choices
    .map((choice) => ({ choice, d: distance(value.toLowerCase(), choice.toLowerCase()) }))
    .filter(({ choice, d }) => d <= Math.max(1, Math.floor(choice.length / 3)))
    .sort((a, b) => a.d - b.d)[0]
  return close ? ` Did you mean "${close.choice}"?` : ""
}

const list = (choices: readonly string[]) => {
  const quoted = choices.map((choice) => `"${choice}"`)
  return quoted.length > 1 ? `${quoted.slice(0, -1).join(", ")} or ${quoted.at(-1)}` : quoted.join("")
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export function validate(input: unknown): Problems {
  const errors: string[] = []
  const warnings: string[] = []
  if (!isObject(input)) {
    return { errors: [`Expected an object such as { style: "riso", seed: "my-post", color: "#635bff" }.`], warnings }
  }

  for (const key of Object.keys(input)) {
    if (!(OPTIONS as readonly string[]).includes(key)) {
      const hint = nearest(key, OPTIONS)
      errors.push(`Unknown option "${key}".${hint || ` Options are ${list(OPTIONS)}.`}`)
    }
  }

  // One of a set of words.
  const word = (name: string, choices: readonly string[], required = false) => {
    const value = input[name]
    if (value === undefined) {
      if (required) errors.push(`Missing "${name}". Use ${list(choices)}.`)
      return
    }
    if (typeof value !== "string" || !choices.includes(value)) {
      const hint = typeof value === "string" ? nearest(value, choices) : ""
      errors.push(`Unknown ${name} ${JSON.stringify(value)}.${hint} Use ${list(choices)}.`)
    }
  }

  const styles = Object.keys(STYLES)
  word("style", styles, true)
  word("theme", [...THEMES, "auto"])
  word("mood", MOODS)
  word("grain", GRAINS)
  word("detail", DETAILS)
  word("motion", MOTIONS)
  word("font", FONTS)

  // A title drawn into the art: for images, where nothing else can set it.
  const title = input.title
  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      errors.push(`"title" must be the words to set, such as the post's title.`)
    } else {
      if (title.length > 160) errors.push(`"title" is ${title.length} characters; keep it to 160, as a headline is.`)
      const asked = Array.isArray(input.areas) ? input.areas : []
      if (!asked.some((area) => isObject(area) && area.art !== "behind")) {
        errors.push(`A "title" needs an area to sit in: add areas: [{ place: "bottom-left", size: "lg" }].`)
      }
      const font = (typeof input.font === "string" && (FONTS as readonly string[]).includes(input.font) ? input.font : "sans") as Font
      const lost = missing(title, font)
      if (lost.length) warnings.push(`The ${font} face can't draw ${lost.map((char) => JSON.stringify(char)).join(", ")}; the title is set without ${lost.length > 1 ? "them" : "it"}.`)
    }
  } else if (input.font !== undefined) {
    warnings.push(`"font" sets the title, and there is no "title"; give one, or leave "font" out.`)
  }

  const seed = input.seed
  if (seed === undefined) {
    errors.push(`Missing "seed". Use something stable that names the page, such as its slug: seed: "my-post".`)
  } else if (typeof seed !== "string" && typeof seed !== "number") {
    errors.push(`"seed" must be a string or a number, such as the page's slug.`)
  } else if (TRIVIAL.has(String(seed).trim().toLowerCase())) {
    warnings.push(`Seed ${JSON.stringify(seed)} is one many sites use, so their covers will match yours. Use something that names the page, such as its slug.`)
  }

  const color = input.color
  if (color !== undefined && (typeof color !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color))) {
    errors.push(`"color" must be a hex colour such as "#635bff" or "#63f", got ${JSON.stringify(color)}.`)
  }

  const { width, height } = input
  let aspect = 1600 / 900
  if ((width === undefined) !== (height === undefined)) {
    errors.push(`Give both "width" and "height", or neither (the default is 1600 by 900).`)
  } else if (width !== undefined) {
    if (typeof width !== "number" || typeof height !== "number" || !(width > 0) || !(height > 0)) {
      errors.push(`"width" and "height" must be positive numbers of pixels.`)
    } else {
      aspect = width / height
      if (aspect > MAX_RATIO || 1 / aspect > MAX_RATIO) {
        errors.push(`${width} by ${height} is longer than ${MAX_RATIO}:1; no style has been judged that narrow.`)
      }
    }
  }

  const style = typeof input.style === "string" ? STYLES[input.style as keyof typeof STYLES] : undefined
  if (style && input.shape !== undefined) {
    const shapes = (style.shapes ?? []) as readonly string[]
    if (typeof input.shape !== "string" || !shapes.includes(input.shape)) {
      errors.push(
        shapes.length
          ? `Style "${input.style}" has no shape ${JSON.stringify(input.shape)}.${typeof input.shape === "string" ? nearest(input.shape, shapes) : ""} Use ${list(shapes)}, or leave it out and the seed picks one.`
          : `Style "${input.style}" has no shapes to choose from; leave "shape" out.`
      )
    }
  }
  if (style && input.image !== undefined && !style.picture) {
    const takers = Object.values(STYLES)
      .filter((item) => item.picture)
      .map((item) => item.style)
    errors.push(`Style "${input.style}" does not take an image; ${list(takers)} do.`)
  }

  const areas = input.areas
  if (areas !== undefined) {
    if (!Array.isArray(areas)) {
      errors.push(`"areas" must be a list, such as [{ place: "bottom-left", size: "lg" }].`)
    } else {
      const boxes: { box: Box; name: string }[] = []
      areas.forEach((area, index) => {
        const name = `Area ${index + 1}`
        if (!isObject(area)) {
          errors.push(`${name} must be an object, such as { place: "bottom-left", size: "lg" }.`)
          return
        }
        for (const key of Object.keys(area)) {
          if (!(AREA_OPTIONS as readonly string[]).includes(key)) {
            errors.push(`${name} has an unknown option "${key}".${nearest(key, AREA_OPTIONS) || ` Areas take ${list(AREA_OPTIONS)}.`}`)
          }
        }
        const { place, size, art, box } = area
        if (art !== undefined && (typeof art !== "string" || !(AREA_ART as readonly string[]).includes(art))) {
          errors.push(`${name} has an unknown art ${JSON.stringify(art)}. Use "around" (content sits on the art) or "behind" (content covers it).`)
        }
        if (box !== undefined) {
          if (place !== undefined || size !== undefined) {
            errors.push(`${name} has both a "box" and a "place" or "size"; use one: a place and size, or an exact box.`)
          }
          if (!isObject(box) || !["x", "y", "w", "h"].every((key) => typeof box[key] === "number")) {
            errors.push(`${name}'s "box" must be { x, y, w, h } in shares of the canvas, such as { x: 0.06, y: 0.6, w: 0.5, h: 0.3 }.`)
            return
          }
          const { x, y, w, h } = box as Box
          if (w < 0.05 || h < 0.05) errors.push(`${name}'s box is too small; make "w" and "h" at least 0.05.`)
          if (x < 0.02 || y < 0.02 || x + w > 0.98 || y + h > 0.98) {
            errors.push(`${name}'s box reaches past the canvas margin; keep it between 0.02 and 0.98.`)
          }
          boxes.push({ box: box as Box, name })
          return
        }
        if (place === undefined) {
          errors.push(`${name} needs a "place": ${list(PLACES)}.`)
          return
        }
        if (typeof place !== "string" || !(PLACES as readonly string[]).includes(place)) {
          errors.push(`${name} has an unknown place ${JSON.stringify(place)}.${typeof place === "string" ? nearest(place, PLACES) : ""} Use ${list(PLACES)}.`)
          return
        }
        if (size !== undefined && (typeof size !== "string" || !(AREA_SIZES as readonly string[]).includes(size))) {
          errors.push(`${name} has an unknown size ${JSON.stringify(size)}. Use ${list(AREA_SIZES)}.`)
          return
        }
        boxes.push({
          box: areaShare(place as (typeof PLACES)[number], (size ?? "md") as (typeof AREA_SIZES)[number], aspect),
          name: `${name} ("${place}")`,
        })
      })
      for (const [i, a] of boxes.entries()) {
        for (const b of boxes.slice(i + 1)) {
          const meet = a.box.x < b.box.x + b.box.w && b.box.x < a.box.x + a.box.w && a.box.y < b.box.y + b.box.h && b.box.y < a.box.y + a.box.h
          if (meet) errors.push(`${a.name} and ${b.name} overlap; make one smaller ("sm") or move it to another place.`)
        }
      }
    }
  }
  return { errors, warnings }
}
