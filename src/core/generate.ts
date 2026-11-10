import { CANVAS_SIDE, DEFAULT_SIZE, MAX_RATIO, areaShare, scaleBox } from "./intent.ts"
import type { Area, Detail, Grain, Mood, MotionLevel, Place, Theme } from "./intent.ts"
import { contrast, luminance } from "./color.ts"
import { lerp } from "./math.ts"
import { makePalette } from "./palette.ts"
import { createRng, hash } from "./random.ts"
import type { Recipe } from "./recipe.ts"
import type { Box, Layer, Motion, Palette, Scene, TextLayer } from "./scene.ts"
import { colorAt, toHex } from "./judge.ts"
import { logoColours, readLogo } from "./image.ts"
import type { ImageInput } from "./image.ts"
import { micrographics } from "../overlays/micro.ts"
import { STYLES } from "../styles/index.ts"
import { lineBoxes, setTitle, useFont } from "./type.ts"
import type { TitleFont } from "../type/fontfile.ts"
import type { Font } from "./type.ts"
import { validate } from "./validate.ts"
import type { StyleName } from "../styles/index.ts"

/**
 * One exact cover. Every value is a word from a fixed list or a size; a
 * wrong one throws an error that names the fix. For a site's covers, make a
 * brand with `createBrand` instead: it writes this input for you.
 */
export type SurfaceInput = {
  /** The look, such as "riso" or "halftone". `catalog` lists every style with what it looks like. */
  style: StyleName
  /** A stable name for this one drawing, such as the page's slug. The same seed always draws the same art. */
  seed: string | number
  /** The brand colour, as hex: "#635bff" or "#63f". The only colour given; the rest are chosen from it. Default "#5b5bd6". */
  color?: string
  /** Output width in pixels, given with `height`. Default 1600 by 900. The art only cares about the shape. */
  width?: number
  /** Output height in pixels, given with `width`. */
  height?: number
  /** Where content goes over the art. With none, the art fills the canvas. */
  areas?: readonly Area[]
  /** "calm" keeps to the quiet end of what the style does and "bold" to the loud end. Left out, the seed ranges over all of it. */
  mood?: Mood
  /** How much film grain: "smooth" (a little; never none), "natural" (the default) or "heavy". */
  grain?: Grain
  /** "micro" lays a technical drawing's small print over the art: crop marks, a ruler. Default "none". */
  detail?: Detail
  /** "light" (the default), "dark", or "auto": both, following the reader's light or dark mode. An image file has one theme, so not "auto". */
  theme?: Theme | "auto"
  /** "once" arrives and stays, "loop" then keeps moving gently; only `toHtml` shows it. Default "none". Styles with `moves: false` in `catalog` stay still. */
  motion?: MotionLevel
  /** One of the style's shapes, listed in `catalog`. The seed picks one otherwise. */
  shape?: string
  /**
   * Words drawn into the art, in the largest area it goes around: for images
   * nothing else can set words on, such as link previews and email. Needs an
   * area. On a page, set the title in HTML over `scene.areas[0]` instead.
   */
  title?: string
  /** The face `title` is drawn in: "sans" (Inter Bold, the default), "serif" (Fraunces), or a site's own font from `loadFont()`. */
  font?: Font | TitleFont
  /**
   * The brand's own logo, drawn as it is in a small area at `place` that the
   * art keeps clear: an SVG file's text, or a PNG, JPEG or WebP. `dark` is
   * the one for a dark cover, for a logo whose colours a dark ground loses.
   */
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
/**
 * Draws one cover as a `Scene`: plain data, the same in every runtime, for
 * `toHtml`, `toSvg`, `toPng` or `toJpeg` to render. Anything wrong with the
 * input throws, all at once, each problem with its fix.
 */
export function generate(input: SurfaceInput): Scene {
  const { errors, warnings } = validate(input)
  if (errors.length) throw new Error(errors.join("\n"))
  for (const warning of warnings) warn(warning)
  return draw(input)
}

// Says a warning once: a page of covers with one trivial seed says it once.
// A cover is drawn the same in every runtime, one with no console included,
// so a warning there is dropped rather than stopping the drawing.
function warn(warning: string) {
  if (warned.has(warning)) return
  warned.add(warning)
  if (typeof console !== "undefined" && typeof console.warn === "function") console.warn(`surfaces: ${warning}`)
}

// The art filling the whole canvas, composed to its middle, with no areas,
// for a mark cut from it, such as a round one. The input is checked by the
// caller.
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
    motion,
    mood,
    p,
    shape,
    seed: String(seed),
    rng: root.fork("compose"),
  }
  let layers: Layer[]
  let art: { subject?: Scene["subject"] } = {}
  {
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

  // The title, laid out before the ground that goes under it, so that ground
  // can follow its lines. It sits in the main area, whose ink was chosen to
  // read there.
  const main = input.title ? areas.find((area) => area.box === safe && area.art === "around") : undefined
  const title = main && input.title ? setTitle(input.title, main.box, main.place, typeof input.font === "object" ? useFont(input.font) : input.font ?? "sans", Math.min(w, h)) : undefined

  // The logo, in its own area, the last, kept clear of the art.
  let logo: Extract<Layer, { kind: "logo" }> | undefined
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
    const beside = titled && safe !== box && areas.find((area) => area.box === safe)?.place
    const edge =
      beside && align === "start" && beside.endsWith("left") ? safe.x - box.x
      : beside && align === "end" && beside.endsWith("right") ? safe.x + safe.w - (box.x + box.w)
      : 0
    // A logo whose every colour would vanish on this ground, and with no
    // version given for it, is drawn reversed: in one colour, the cover's
    // ink, as a brand's one-colour logo is for a ground its own colours lose.
    const lost = typeof image === "string" && !input.logo.dark && fadesInto(image, palette.ground)
    if (lost) warn(lost)
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
    const below = beside && safe.y >= box.y + box.h && safe.y - (box.y + box.h) < h * 0.12 && edge !== 0
    logo = { kind: "logo", id: "logo", href, x: left, y: below ? box.y + box.h - tall : box.y + (box.h - tall) / 2, w: wide, h: tall, align }
  }

  // Any area besides the main one gets a soft patch of ground under it, over
  // the art and under the grain, so what sits there reads in any style: the
  // art was composed round the main area alone. The logo's is no larger than
  // the logo, so the art shows right up to it.
  const logoArea = logo && areas.at(-1)!.box
  const about = logo && { x: logo.x - logo.h * 0.3, y: logo.y - logo.h * 0.3, w: logo.w + logo.h * 0.6, h: logo.h * 1.6 }
  const patches = [
    // The page's words get ground under their whole area; a title drawn in
    // brings its own, round its letters.
    ...(behind && !title ? clearingUnder(behind.box, palette, layers) : []),
    ...kept.filter((box) => box !== safe).flatMap((box, index): Layer[] => patch(box === logoArea ? about! : box, index)),
  ]
  if (patches.length) {
    // Under a paper frame, if the style lays one round the art, so a patch
    // never spills over it; else over the art and under the grain.
    const frame = layers.findIndex((layer) => layer.id === "paper")
    const last = layers.length - 1
    layers.splice(frame >= 0 ? frame : layers[last]?.kind === "grain" ? last : last + 1, 0, ...patches)
  }

  // The title and the logo over everything, the grain included, so their
  // edges stay clean.
  if (title) layers.push(onArt(title, palette, layers))
  if (logo) layers.push(logo)

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
    .replace(/\b(fill|stroke|stop-color)\s*:\s*([^;"'}]+)/gi, (_, name: string, value: string) => `${name}:${paint(value)}`)
}

// Why an SVG logo would vanish on a ground, when every colour it is drawn in
// falls short of the 3:1 a graphic needs to be seen, with a little over for
// the grain that settles on the ground; nothing when it reads, or when its
// colours can't be read.
function fadesInto(svg: string, ground: string) {
  const colours = logoColours(svg)
  if (!colours.length || colours.some((colour) => contrast(colour, ground) >= 3.3)) return ""
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

// What words on the art are held to, wherever they stand on it: past the 4.5
// they need, so the art under them is quiet and not merely legible.
const READS = 7

// How much ground words need under them to read on the art, from none to
// nearly all: measured on the art that is really there, in each of `regions`,
// so quiet art is left as it is and nothing is covered that didn't have to
// be. It is read at every point the judge reads a cover at (see
// worstTitleContrast, at its own spacing and the tests' coarser one), edges
// included, and twice as closely across a whole area, where a thin mark
// could otherwise pass between two of them.
function groundNeeded(regions: Box[], close: boolean, palette: Palette, art: Layer[]) {
  const under = new Set<string>()
  for (const region of regions) {
    for (const [across, down] of [[close ? 28 : 14, 14], [8, 8]] as const) {
      for (let i = 0; i <= across; i++) {
        for (let j = 0; j <= down; j++) {
          under.add(toHex(colorAt({ palette, layers: art }, region.x + (region.w * i) / across, region.y + (region.h * j) / down)))
        }
      }
    }
  }
  const colours = [...under]
  for (let step = 0; step <= 32; step++) {
    const opacity = Math.min(step * 0.03, 0.97)
    if (colours.every((colour) => contrast(palette.ink, over(palette.ground, colour, opacity)) >= READS)) return opacity
  }
  return 0.97
}

// A title drawn into the art, with what it needs to read there: where the art
// under its lines is too strong for it, a halo of ground round the letters
// themselves, only as strong as that art calls for. The art shows right up
// to the words, and where it is quiet already the title has no halo at all.
function onArt(title: TextLayer, palette: Palette, art: Layer[]): TextLayer {
  const opacity = groundNeeded(lineBoxes(title), false, palette, art)
  return opacity > 0 ? { ...title, halo: { opacity, reach: 0.15, soft: 0.07 } } : title
}

// Ground under a large area in the middle whose words are the page's: they
// may stand anywhere in it, so the ground covers the area's own box, past it
// by twice the blur so the area itself is solid, and softens out from there.
// Only as strong as the art under the area needs. (A title drawn in needs no
// such ground: it carries a halo of its own, see `onArt`.)
function clearingUnder(box: Box, palette: Palette, art: Layer[]): Layer[] {
  // Laid even at no strength at all, which a renderer leaves out: light and
  // dark, and one brand colour and another, then stay one drawing, layer for
  // layer, whichever of them needed it.
  const paint = { type: "solid", tone: "ground", opacity: groundNeeded([box], true, palette, art) } as const
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
          paint,
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
