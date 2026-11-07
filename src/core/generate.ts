import { CANVAS_SIDE, DEFAULT_SIZE, MAX_RATIO, areaShare, scaleBox } from "./intent.ts"
import type { Area, Detail, Grain, Mood, MotionLevel, Place, Theme } from "./intent.ts"
import { contrast, luminance } from "./color.ts"
import { lerp } from "./math.ts"
import { makePalette } from "./palette.ts"
import { createRng, hash } from "./random.ts"
import type { Recipe } from "./recipe.ts"
import type { Box, Layer, Motion, Scene } from "./scene.ts"
import { readImage, readLogo } from "./image.ts"
import type { ImageInput } from "./image.ts"
import { facing, veil } from "../layouts/veil.ts"
import { micrographics } from "../overlays/micro.ts"
import { STYLES } from "../styles/index.ts"
import { setTitle } from "./type.ts"
import type { Font } from "./type.ts"
import { validate } from "./validate.ts"
import type { StyleName } from "../styles/index.ts"

export type SurfaceInput = {
  style: StyleName
  seed: string | number
  color?: string
  // The size of the output; the art only cares about its shape.
  width?: number
  height?: number
  // Where content goes. With none, the art fills the canvas.
  areas?: readonly Area[]
  mood?: Mood
  grain?: Grain
  detail?: Detail
  // "auto" draws both, and the cover follows the reader's light or dark mode.
  theme?: Theme | "auto"
  // Whether the art moves: not at all, once as it arrives, or on a loop.
  motion?: MotionLevel
  // One of the shapes the style has been judged with. The seed picks otherwise.
  shape?: string
  // A photo to print in the style's own inks, for the styles that take one.
  image?: ImageInput
  // Words set into the art in the largest area it goes around, for images
  // nothing else can set them on: link previews, files, email.
  title?: string
  // The face it is set in. Default "sans".
  font?: Font
  // The brand's own logo, drawn as it is in a small area at `place` that the
  // art keeps clear: an SVG file's text, or a PNG, JPEG or WebP. `dark` is
  // the one for a dark cover, for a logo whose colours a dark ground loses.
  logo?: { image: string | ImageInput; dark?: string | ImageInput; place: Place }
}

const DEFAULT_COLOR = "#5b5bd6"

function outputSize(input: SurfaceInput, fallback: { w: number; h: number }) {
  const { width, height } = input
  if ((width === undefined) !== (height === undefined)) {
    throw new Error("Give both width and height, or neither")
  }
  const w = Math.round(width ?? fallback.w)
  const h = Math.round(height ?? fallback.h)
  if (!(w > 0 && h > 0)) {
    throw new Error(`Expected a positive size, got ${width} by ${height}`)
  }
  if (w / h > MAX_RATIO || h / w > MAX_RATIO) {
    throw new Error(`Expected a size within ${MAX_RATIO}:1, got ${w} by ${h}`)
  }
  return { w, h }
}

const warned = new Set<string>()

// A cover from an input, checked first: anything wrong throws, all of it at
// once, each with how to fix it (see validate.ts).
export function generate(input: SurfaceInput): Scene {
  const { errors, warnings } = validate(input)
  if (errors.length) throw new Error(errors.join("\n"))
  for (const warning of warnings) {
    // Once each: a page of covers with one trivial seed says it once.
    if (warned.has(warning)) continue
    warned.add(warning)
    console.warn(`surfaces: ${warning}`)
  }
  return draw(input)
}

// The art filling the whole canvas, composed to its middle, with no areas:
// what an avatar is cut from. The input is checked by the caller.
export const drawFilled = (input: SurfaceInput) => draw(input, true)

// A cover from a recipe that isn't a style, such as a combination of the
// grammar's parts being judged before it is offered. Unchecked, and only for
// the library's own tests and tools.
export const drawRecipe = (recipe: Recipe, input: Omit<SurfaceInput, "style">) =>
  draw({ ...input, style: recipe.style as StyleName }, false, recipe)

function draw(input: SurfaceInput, fill = false, recipe: Recipe = STYLES[input.style]): Scene {
  if (input.theme === "auto") {
    const light = draw({ ...input, theme: "light" }, fill, recipe)
    const dark = draw({ ...input, theme: "dark" }, fill, recipe)
    // Named for the drawing, so two covers on one page never share it.
    const inkVar = `--surface-ink-${hash(`${input.style}:${input.seed}:${input.color ?? DEFAULT_COLOR}`).toString(36)}`
    return {
      ...light,
      areas: light.areas.map((area) => ({ ...area, ink: `var(${inkVar}, ${light.ink})` })),
      dark: { palette: dark.palette, ink: dark.ink, layers: dark.layers, inkVar },
    }
  }
  const {
    style,
    seed,
    color = DEFAULT_COLOR,
    theme = "light",
    grain = "natural",
    detail = "none",
    motion = "none",
    mood,
  } = input

  const output = outputSize(input, DEFAULT_SIZE)
  const aspect = output.w / output.h
  const scale = CANVAS_SIDE / Math.sqrt(output.w * output.h)
  const w = output.w * scale
  const h = output.h * scale

  // Each area as a box on the canvas. The art keeps clear of those it goes
  // around, and reads the largest of them as where the title is.
  const asked: readonly Area[] = [...(input.areas ?? []), ...(input.logo ? [{ place: input.logo.place, size: "sm" as const }] : [])]
  const areas = asked.map((area) => ({
    place: area.box ? null : area.place ?? null,
    size: area.box ? null : area.size ?? "md",
    art: area.art ?? "around",
    box: scaleBox(area.box ?? areaShare(area.place!, area.size ?? "md", aspect), w, h),
  }))
  const kept = areas.filter((area) => area.art === "around").map((area) => area.box)
  const titled = kept.length > 0
  // With nothing kept clear, a point in the corner, which the layouts read as
  // a title too small to matter.
  const corner = { x: 0, y: h, w: 0, h: 0 }
  const safe = titled
    ? kept.reduce((largest, box) => (box.w * box.h > largest.w * largest.h ? box : largest))
    : corner
  // The art settles into the space all of them leave, and measures how far
  // it reaches from the main one; any other area also gets a patch of ground
  // over the art, in case the art still comes near (see `patches`).
  const keep = titled ? kept : [safe]
  // A large area in the middle would leave the art only thin bands round it,
  // so the art is drawn behind it instead, as on a cover with nothing to keep
  // clear, and a clearing of ground goes under the area (see `clearingUnder`).
  // Any other area then gets a patch, as it would beside a title.
  // On a strip a centred area leaves room enough at its ends, so the art goes
  // round it there as it does any other.
  const thin = (box: Box) =>
    Math.max(box.x, w - box.x - box.w, box.y, h - box.y - box.h) < Math.min(w, h) * 0.6
  const behind = recipe.aroundCentre
    ? undefined
    : areas.find((area) => area.box === safe && area.place === "center" && area.size !== "sm" && thin(area.box))

  // Only the style and the seed feed the root. The theme, the mood and the
  // grain stay out so that light and dark, calm and bold, are the same drawing. The colour
  // stays out too: a brand change repaints a cover, it does not redraw it. And
  // so does the size, so a post's cover and its OG image are one drawing.
  const root = createRng(`${style}:${recipe.version}:${seed}`)

  const paramRng = root.fork("params")
  const p: Record<string, number> = {}
  for (const name of Object.keys(recipe.ranges)) {
    const [low, high] =
      (grain !== "natural" && recipe.grain[grain][name]) ||
      (mood && recipe.moods[mood][name]) ||
      recipe.ranges[name]!
    p[name] = lerp(low, high, paramRng.next())
  }

  const palette = makePalette(
    color,
    theme,
    recipe.palette,
    root.fork(`palette:${theme}`)
  )

  // The draw is taken either way, so choosing a shape moves nothing else.
  const seeded = recipe.shapes && root.fork("shape").pick(recipe.shapes)
  const shape = input.shape ?? seeded

  const context = {
    w,
    h,
    ...(behind ? { safe: corner, keep: [corner], titled: false } : { safe, keep, titled }),
    fill,
    calm: behind ? [behind.box] : [],
    theme,
    // A photo stays still.
    motion: input.image ? ("none" as const) : motion,
    mood,
    p,
    shape,
    rng: root.fork("compose"),
  }
  let layers: Layer[]
  let art: { subject?: Scene["subject"] } = {}
  if (input.image && recipe.picture) {
    const { href, fit } = readImage(input.image)
    // The photo fills the canvas and the title gets the same veil the pools
    // do, at full strength in its core, so it sits on paper whatever the photo.
    layers = [
      { kind: "fill", id: "ground", tone: "ground" },
      { kind: "picture", id: "photo", href, fit, treatments: recipe.picture(context) },
      // Only the veil's core: its wide outer haze would wash out half the
      // photo, and the core alone holds the title's box.
      ...veil(context, facing(context), {
        veil: 1,
        veilShift: 0.3,
        veilTilt: 0,
        veilRatio: 1,
      }).filter((pool) => pool.id === "veil"),
    ]
  } else {
    const drawn = recipe.layout(context)
    art = drawn
    layers = recipe.finish(drawn, context)
  }
  // Small print goes over the art and under the grain, so it is printed with
  // the rest. Its own stream, so asking for it moves nothing in the art.
  if (detail === "micro") {
    const small = micrographics({
      w,
      h,
      keep: kept,
      subject: art.subject,
      output,
      rng: root.fork("micro"),
      marksOnly: recipe.marksOnly ?? false,
    })
    const last = layers.length - 1
    layers.splice(layers[last]?.kind === "grain" ? last : last + 1, 0, ...small)
  }

  // Any area besides the main one gets a soft patch of ground under it, over
  // the art and under the grain, so what sits there reads in any style: the
  // art was composed round the main area alone.
  const patches = [
    ...(behind ? clearingUnder(behind.box, palette) : []),
    ...kept.filter((box) => box !== safe).flatMap((box, index): Layer[] => patch(box, index)),
  ]
  if (patches.length) {
    // Under a paper frame, if the style lays one round the art, so a patch
    // never spills over it; else over the art and under the grain.
    const frame = layers.findIndex((layer) => layer.id === "paper")
    const last = layers.length - 1
    layers.splice(frame >= 0 ? frame : layers[last]?.kind === "grain" ? last : last + 1, 0, ...patches)
  }

  // The title, over everything, the grain included, so its edges stay clean.
  // It sits in the main area, whose ink was chosen to read there.
  if (input.title) {
    const main = areas.find((area) => area.box === safe && area.art === "around")
    const text = main && setTitle(input.title, main.box, main.place, input.font ?? "sans", Math.min(w, h))
    if (text) layers.push(text)
  }

  // The logo over everything too, in its own area, the last, kept clear of
  // the art and given a patch of ground like any area beside the title.
  if (input.logo) {
    const { box } = areas.at(-1)!
    const place = input.logo.place
    const given = theme === "dark" ? input.logo.dark ?? input.logo.image : input.logo.image
    // A logo drawn in currentColor takes the colour of the text around it,
    // which an image has none of: here it takes the cover's ink, as the title
    // does, dark on paper and light on black.
    const image = typeof given === "string" ? given.replace(/currentColor/gi, palette.ink) : given
    const align = place.endsWith("left") ? "start" : place.endsWith("right") ? "end" : "middle"
    // On the title's side, it lines up with the title's edge.
    const title = titled && safe !== box && areas.find((area) => area.box === safe)?.place
    const edge =
      title && align === "start" && title.endsWith("left") ? safe.x - box.x
      : title && align === "end" && title.endsWith("right") ? safe.x + safe.w - (box.x + box.w)
      : 0
    // A logo whose every colour would vanish on this ground, and with no
    // version given for it, is drawn reversed: in one colour, the cover's
    // ink, as a brand's one-colour logo is for a ground its own colours lose.
    const lost = typeof image === "string" && !input.logo.dark && fadesInto(image, palette.ground)
    if (lost && !warned.has(lost)) {
      warned.add(lost)
      console.warn(`surfaces: ${lost}`)
    }
    const shown = lost && typeof image === "string" ? reversed(image, palette.ink) : image
    // Drawn at its own shape: a mark about half the area's height, a wordmark
    // as tall as the area's width allows, never more than a cap's height
    // above the title.
    const { href, aspect } = readLogo(shown)
    const tall = Math.min(box.h * (aspect < 1.6 ? 0.5 : 0.4), box.w / aspect)
    const wide = tall * aspect
    const left = align === "start" ? box.x + edge : align === "end" ? box.x + box.w + edge - wide : box.x + (box.w - wide) / 2
    // Just over a title below it in the same column, as a lockup's logo
    // sits; otherwise in the middle of its area.
    const below = title && safe.y >= box.y + box.h && safe.y - (box.y + box.h) < h * 0.12 && edge !== 0
    layers.push({ kind: "logo", id: "logo", href, x: left, y: below ? box.y + box.h - tall : box.y + (box.h - tall) / 2, w: wide, h: tall, align })
  }

  // A layout says how its art arrives and how it then moves; a cover asked
  // only to arrive keeps the first.
  if (motion === "once") layers = layers.map(still)

  return {
    format: 1,
    style,
    recipe: recipe.version,
    seed: String(seed),
    size: { w, h },
    output,
    palette,
    ink: palette.ink,
    // In output pixels, for whoever lays content over the cover.
    areas: areas.map((area) => ({
      place: area.place,
      size: area.size,
      art: area.art,
      clear: area.art === "around" && area !== behind,
      ink: palette.ink,
      x: area.box.x / scale,
      y: area.box.y / scale,
      width: area.box.w / scale,
      height: area.box.h / scale,
    })),
    ...(shape ? { shape } : null),
    ...(art.subject ? { subject: art.subject } : null),
    layers,
  }
}

// An SVG logo in one colour: every paint it gives, in attributes and styles,
// set to `ink`, and "none" left as it is.
function reversed(svg: string, ink: string) {
  const paint = (value: string) => (/^\s*(none|transparent)\s*$/i.test(value) ? value : ink)
  return svg
    .replace(/<svg\b(?![^>]*\sfill=)/i, `<svg fill="${ink}"`)
    .replace(/\b(fill|stroke|stop-color)\s*=\s*"([^"]*)"/gi, (_, name: string, value: string) => `${name}="${paint(value)}"`)
    .replace(/\b(fill|stroke|stop-color)\s*:\s*([^;"']+)/gi, (_, name: string, value: string) => `${name}:${paint(value)}`)
}

// Why an SVG logo would vanish on a ground, when every colour it is drawn in
// falls short of the 3:1 a graphic needs to be seen; nothing when it reads,
// or when its colours aren't written as hex.
function fadesInto(svg: string, ground: string) {
  const written = [...new Set([...svg.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map((match) => match[0].length === 4 ? `#${[...match[0].slice(1)].map((d) => d + d).join("")}` : match[0]))]
  // One that paints with no colour of its own is drawn black.
  const colours = written.length || /\b(fill|stroke)\s*[=:]/i.test(svg) ? written : ["#000000"]
  if (!colours.length || colours.some((colour) => contrast(colour, ground) >= 3)) return ""
  return `The logo's colours (${colours.slice(0, 3).join(", ")}) barely show on the ${luminance(ground) < 0.18 ? "dark" : "light"} ground, so it is drawn in one colour there; give logo: { light, dark } to set your own.`
}

// A soft patch of ground over the art at `box`: solid across the box, fading
// out a little beyond it, round and level so it reads as light, not a shape.
function patch(box: Box, index: number): Layer[] {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  // An ellipse that holds the box's corners in its solid core.
  const core = 0.62
  const rx = (box.w / 2) * Math.SQRT2 / core
  const ry = (box.h / 2) * Math.SQRT2 / core
  const base = { kind: "pool", cx, cy, rotate: 0, tone: "ground" } as const
  return [
    { ...base, id: `patch${index}-outer`, rx: rx * 1.25, ry: ry * 1.25, opacity: 0.5, core: 0.34 },
    { ...base, id: `patch${index}`, rx, ry, opacity: 0.96, core },
  ]
}

// Ground under a large area in the middle, so the art behind shows all round
// the title and the title reads: the area's own box, past it by twice the
// blur so the area itself is solid, and softened out from there. As solid as
// keeps the title well clear of the darkest art there could be on paper, or
// the lightest on black (11:1, past the 4.5 it needs, so the art under the
// text is quiet and not merely legible), and no more, so the art still shows
// through faded rather than wiped out.
function clearingUnder(box: Box, palette: { ground: string; ink: string }): Layer[] {
  // The worst is the far end from the ground: a print can be dark in a light
  // theme, as a mezzotint plate is.
  const worst = luminance(palette.ground) < 0.18 ? "#ffffff" : "#000000"
  let opacity = 0.97
  for (let step = 0.4; step < 0.97; step += 0.03) {
    if (contrast(palette.ink, over(palette.ground, worst, step)) >= 11) {
      opacity = step
      break
    }
  }
  const radius = Math.min(box.w, box.h) * 0.15
  const pad = radius * 2
  const round = Math.min(box.w, box.h) / 2 + pad
  return [
    {
      kind: "soften",
      id: "clearing",
      radius,
      layers: [
        {
          kind: "shapes",
          id: "clearing-box",
          paint: { type: "solid", tone: "ground", opacity },
          shapes: [
            {
              type: "rect",
              x: box.x - pad,
              y: box.y - pad,
              w: box.w + pad * 2,
              h: box.h + pad * 2,
              radii: [round, round, round, round],
            },
          ],
        },
      ],
    },
  ]
}

// `top` laid at `opacity` over `under`, as a browser blends them.
function over(top: string, under: string, opacity: number) {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16)
  const byte = (at: number) =>
    Math.round(channel(top, at) * opacity + channel(under, at) * (1 - opacity))
      .toString(16)
      .padStart(2, "0")
  return `#${byte(1)}${byte(3)}${byte(5)}`
}

// The same layer without its loops.
function still<T extends Layer>(layer: T): T {
  const { motion, ...rest } = layer as T & { motion?: Motion }
  const kept = motion?.enter ? { ...rest, motion: { enter: motion.enter } } : rest
  return ("layers" in kept && Array.isArray(kept.layers)
    ? { ...kept, layers: kept.layers.map(still) }
    : kept) as T
}
