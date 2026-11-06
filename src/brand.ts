import { avatar as drawAvatar, AVATAR_STYLES } from "./avatar.ts"
import type { AvatarStyle } from "./avatar.ts"
import { generate } from "./core/generate.ts"
import { hash } from "./core/random.ts"
import type { SurfaceInput } from "./core/generate.ts"
import { GRAINS, MOODS, THEMES } from "./core/intent.ts"
import { FONTS } from "./core/type.ts"
import type { Font } from "./core/type.ts"
import type { Grain, Mood, Theme } from "./core/intent.ts"
import { coverage, HAIRLINE, worstTitleContrast } from "./core/judge.ts"
import type { Scene } from "./core/scene.ts"
import { nearest } from "./core/validate.ts"
import { STYLES } from "./styles/index.ts"
import type { StyleName } from "./styles/index.ts"
import { checkFacts, choose, FACTS, leansOf, PLACING, styleReason } from "./page.ts"
import type { PageFacts, Use } from "./page.ts"

// A brand: the decisions a design studio makes once, its style, colour, light
// or dark and mood, so every image after them follows from the content
// alone. A cover is drawn from the brand and its title: the same title in one
// brand is always the same art, and two brands never share a drawing, since
// the brand's name is in every seed.
//
//   const brand = createBrand({ name: "acme.dev", color: "#635bff" })
//   brand.cover({ title: post.title })
//
// Anything not decided is chosen from what the page shows (see suggest.ts):
//
//   const brand = createBrand({ name: "acme.dev", ...readPage(html, css) })

export type BrandChoices = PageFacts & {
  // The brand's own name, such as its domain.
  name: string
  color?: string
  style?: StyleName
  theme?: Theme | "auto"
  mood?: Mood
  grain?: Grain
  // One of the style's shapes, for every cover: a mark the brand always
  // makes. Without it each title draws its own.
  shape?: string
  // The face titles are drawn in, where an image carries its own title.
  font?: Font
}

// What a cover is about: its title, or an id that names it, such as the
// post's slug, so its art stays when the title is edited. `tag` is the
// post's category: every cover with one tag makes one mark, so a category
// reads as a family while each title still draws its own. `drawTitle` sets
// the title into the image itself, for a cover that goes out as a file; a
// link preview always does, since nothing else can show it there.
export type Content = { title?: string; id?: string; tag?: string; drawTitle?: boolean }

export type Brand = {
  name: string
  // The decisions, as plain data: keep them to rebuild the brand exactly.
  look: { style: StyleName; color?: string; theme: Theme | "auto"; mood?: Mood; grain?: Grain; shape?: string; font?: Font }
  // Why each decision that wasn't given was made, one sentence each.
  why: string[]
  // A post's cover, with its title at the bottom left.
  cover(content: Content): Scene
  // A cover for a card in a list, its title beside it: art only.
  card(content: Content): Scene
  // The page's hero: its title in the middle, and the one cover that moves.
  hero(content: Content): Scene
  // A link preview, 1200x630.
  og(content: Content): Scene
  // A profile's or a newsletter's header: X (1500x500), LinkedIn (1584x396)
  // or email (1200x400). With a title it is set in; without, art alone.
  banner(content: Content & { for: "x" | "linkedin" | "email" }): Scene
  // A person's mark, from their id or handle.
  avatar(person: string | number, options?: { size?: number; square?: boolean }): Scene
  // The input any of those draws, for the components and the HTTP handler.
  input(use: Use, content?: Content): SurfaceInput
}

const OPTIONS = ["name", "color", "style", "theme", "mood", "grain", "shape", "font", ...FACTS] as const

// The avatar style nearest each cover style in look, for a brand whose style
// is too fine to read at 24 pixels.
const AVATAR_OF: Record<StyleName, AvatarStyle> = {
  underpaint: "underpaint",
  halftone: "riso",
  endpaper: "riso",
  aquatint: "aquatint",
  mezzotint: "aquatint",
  sfumato: "sfumato",
  engraving: "aquatint",
  riso: "riso",
  moire: "sfumato",
  strata: "strata",
  marbling: "marbling",
  linework: "riso",
  dither: "riso",
  fluted: "sfumato",
  photocopy: "riso",
  chrome: "sfumato",
  glass: "sfumato",
  stencil: "riso",
  screenprint: "riso",
}

// Every problem with the choices, each with its fix.
function check(choices: unknown): string[] {
  if (typeof choices !== "object" || choices === null || Array.isArray(choices)) {
    return [`Expected the brand's choices as an object, such as { name: "acme.dev", color: "#635bff" }`]
  }
  const given = choices as Record<string, unknown>
  const errors: string[] = []
  for (const key of Object.keys(given)) {
    if (!(OPTIONS as readonly string[]).includes(key)) {
      const hint = key === "seed" || key === "slug" ? ` A brand has no seed: give each cover its title.` : nearest(key, OPTIONS)
      errors.push(`Unknown choice "${key}".${hint}`)
    }
  }
  if (typeof given.name !== "string" || !given.name.trim()) {
    errors.push(`Missing "name": give the brand's name, such as its domain, so no other brand shares its drawings`)
  }
  if (given.style !== undefined && !(String(given.style) in STYLES)) {
    errors.push(`Unknown style "${String(given.style)}".${nearest(String(given.style), Object.keys(STYLES))}`)
  }
  if (given.color !== undefined && (typeof given.color !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(given.color))) {
    errors.push(`"color" should be the brand's hex colour, such as #635bff`)
  }
  for (const [name, values] of [["theme", [...THEMES, "auto"]], ["mood", MOODS], ["grain", GRAINS], ["font", FONTS]] as const) {
    if (given[name] !== undefined && !(values as readonly unknown[]).includes(given[name])) {
      errors.push(`Unknown ${name} "${String(given[name])}". Use ${values.map((value) => `"${value}"`).join(", ")}.`)
    }
  }
  return [...errors, ...checkFacts(given)]
}

// The decisions a brand makes and what it leaves to its page, resolved.
function resolve(choices: BrandChoices) {
  const errors = check(choices)
  if (errors.length) throw new Error(errors.join("\n"))
  const { name, color, style, theme, mood, grain, shape, font, ...facts } = choices
  // What wasn't decided is chosen from the page; a given colour is a fact
  // like any other, and the first one the page uses.
  const page = { ...facts, colors: color ? [color, ...(facts.colors ?? [])] : facts.colors }
  const chosen = choose(page)
  const look: Brand["look"] = {
    style: style ?? chosen.style,
    ...((color ?? chosen.color) ? { color: color ?? chosen.color } : null),
    theme: theme ?? chosen.theme,
    ...((mood ?? chosen.mood) ? { mood: mood ?? chosen.mood } : null),
    ...((grain ?? chosen.grain) ? { grain: grain ?? chosen.grain } : null),
    ...(shape !== undefined ? { shape } : null),
    ...((font ?? chosen.font) !== "sans" ? { font: font ?? chosen.font } : null),
  }
  const shapes = (STYLES[look.style].shapes ?? []) as readonly string[]
  if (shape !== undefined && !shapes.includes(shape)) {
    throw new Error(
      shapes.length
        ? `"${shape}" isn't a ${look.style} shape. Use ${shapes.map((one) => `"${one}"`).join(", ")}.${nearest(String(shape), shapes)}`
        : `${look.style} has no shapes to choose from: leave "shape" out, or choose a style that has them`
    )
  }
  // Reasons only for what the brand didn't decide itself; each starts with
  // the name of what it chose.
  const decided: Record<string, unknown> = { style, color, theme, mood, grain, shape, font }
  const why = chosen.why.filter((reason) => decided[reason.split(" ")[0]!] === undefined)
  return { name, look, why, decided, page, ranked: chosen.ranked }
}

export function createBrand(choices: BrandChoices): Brand {
  const { name, look, why } = resolve(choices)
  return build(name, look, why)
}

function build(name: string, look: Brand["look"], why: string[]): Brand {
  const input = (use: Use, content: Content = {}): SurfaceInput => {
    const placing = PLACING[use]
    // A banner is one of a kind, so it needs no name of its own.
    const about = content?.id ?? content?.title ?? (placing.optional ? use : undefined)
    if (typeof about !== "string" || !about.trim()) {
      throw new Error(`Give the ${use} a "title", or an "id" that names it, such as the post's slug`)
    }
    const drawn = content.drawTitle ?? (use === "og" || (placing.optional === true && Boolean(content.title?.trim())))
    if (drawn && !content.title?.trim()) throw new Error(`A ${use} drawn with its title needs a "title"`)
    if (drawn && !placing.areas.length) throw new Error(`A ${use} has no area for a title; draw it as a "post" or "og" instead`)
    return {
      style: look.style,
      seed: `${name}/${about.trim()}`,
      ...(look.color ? { color: look.color } : null),
      ...placing.size,
      ...areasOf(placing, drawn),
      theme: look.theme,
      ...(look.mood ? { mood: look.mood } : null),
      ...(look.grain ? { grain: look.grain } : null),
      ...(look.shape ? { shape: look.shape } : content.tag?.trim() ? familyShape(look.style, name, content.tag.trim()) : null),
      ...(drawn ? { title: content.title!.trim(), ...(look.font ? { font: look.font } : null) } : null),
      ...(placing.motion && !drawn ? { motion: placing.motion } : null),
    }
  }
  const draw = (use: Use) => (content: Content) => generate(input(use, content))

  return {
    name,
    look,
    why,
    cover: draw("post"),
    card: draw("card"),
    hero: draw("hero"),
    og: draw("og"),
    banner: ({ for: where, ...content }) => {
      if (!["x", "linkedin", "email"].includes(where)) throw new Error(`Unknown banner "${String(where)}". Use "x", "linkedin" or "email".`)
      return generate(input(where, content))
    },
    avatar: (person, options = {}) =>
      drawAvatar({
        style: (AVATAR_STYLES as readonly string[]).includes(look.style) ? (look.style as AvatarStyle) : AVATAR_OF[look.style],
        seed: `${name}/${person}`,
        ...(look.color ? { color: look.color } : null),
        theme: look.theme,
        ...(look.mood ? { mood: look.mood } : null),
        ...(look.grain ? { grain: look.grain } : null),
        ...options,
      }),
    input,
  }
}

// A use's areas: its title's when it has one or always does, and any it
// always keeps clear, such as the photo over an X header.
function areasOf(placing: (typeof PLACING)[Use], drawn: boolean) {
  const areas = [...(placing.areas.length && (!placing.optional || drawn) ? placing.areas : []), ...(placing.keep ?? [])]
  return areas.length ? { areas } : null
}

// The mark every cover with a tag makes, picked by the tag so it stays when
// posts come and go; nothing for a style without shapes.
function familyShape(style: StyleName, name: string, tag: string) {
  const shapes = (STYLES[style].shapes ?? []) as readonly string[]
  return shapes.length ? { shape: shapes[hash(`${name}/tag/${tag.toLowerCase()}`) % shapes.length]! } : null
}

// Styles in kinds that look alike, so a set of directions can show one of
// each kind before it shows two of any.
const KINDS: readonly (readonly StyleName[])[] = [
  ["stencil", "screenprint", "riso", "photocopy", "halftone", "dither"],
  ["engraving", "linework", "moire"],
  ["underpaint", "sfumato", "fluted"],
  ["aquatint", "mezzotint", "chrome", "glass"],
  ["marbling", "strata", "endpaper"],
]
const kindOf = (style: StyleName) => KINDS.findIndex((kind) => kind.includes(style))

// Titles every direction is tried on before it is offered, short and long,
// so a direction that only flatters one length never shows.
const TRIALS = ["Hello", "What we learned from ten thousand bookings in our first year"]

// Whether a look holds in every theme it shows in: content reads on a post's
// cover and a link preview at both lengths of title, and the art is neither
// blank nor a wall. Each style is held to far more by its own tests; what a
// direction adds is the brand's own colour, which is what this tries.
function holds(name: string, look: Brand["look"]) {
  const themes = look.theme === "auto" ? (["light", "dark"] as const) : [look.theme]
  for (const theme of themes) {
    const brand = build(name, { ...look, theme }, [])
    for (const [index, title] of TRIALS.entries()) {
      for (const draw of [brand.cover, brand.og]) {
        const scene = draw({ title })
        if (worstTitleContrast(scene, 6) < 4.5) return false
        if (index === 0 && draw === brand.cover) {
          const covered = coverage(scene, 15)
          if ((covered <= 0.04 && !HAIRLINE.has(look.style)) || covered >= 0.98) return false
        }
      }
    }
  }
  return true
}

// Several brands for one site, each a direction a studio might show: varied,
// and each judged on a spread of titles before it is offered. The first is
// the one createBrand() picks. Whatever the choices decide holds in every
// direction, so with a style decided they vary the mark it always makes, then
// its mood and grain: the way to see more like one direction is to decide its
// style.
//
//   const options = directions({ name: "acme.dev", ...readPage(html, css) })
//   createBrand({ name: "acme.dev", ...options[2].look })
export function directions(choices: BrandChoices, { count = 6 }: { count?: number } = {}): Brand[] {
  const { name, look, why, decided, page, ranked } = resolve(choices)
  const leans = leansOf(page)
  const looks: { look: Brand["look"]; why: string[] }[] = [{ look, why }]
  if (decided.style === undefined) {
    // One of each kind, best suited first, then the rest.
    const seen = new Set([kindOf(look.style)])
    const spread = ranked.filter((style) => style !== look.style && !seen.has(kindOf(style)) && seen.add(kindOf(style)))
    const rest = ranked.filter((style) => style !== look.style && !spread.includes(style))
    for (const style of [...spread, ...rest]) {
      looks.push({ look: { ...look, style }, why: why.map((reason) => (reason.startsWith("style ") ? styleReason(style, leans) : reason)) })
    }
  } else {
    // The same style, each time with a different mark it always makes, then
    // quieter, louder, cleaner and rougher. A mark shows at a glance; mood and
    // grain only tune the same drawing.
    const shapes = decided.shape === undefined ? ((STYLES[look.style].shapes ?? []) as readonly string[]) : []
    const turns: Partial<Brand["look"]>[] = [
      ...shapes.map((shape) => ({ shape })),
      { mood: "calm" },
      { mood: "bold" },
      { grain: "smooth" },
      { grain: "heavy" },
      { mood: "calm", grain: "smooth" },
      { mood: "bold", grain: "heavy" },
    ]
    for (const turn of turns) {
      if ((turn.mood && decided.mood !== undefined) || (turn.grain && decided.grain !== undefined)) continue
      const next = { ...look, ...turn }
      if (looks.some((other) => JSON.stringify(other.look) === JSON.stringify(next))) continue
      const said = [
        turn.shape && `shape ${turn.shape}: every cover makes this one mark`,
        turn.mood && `mood ${turn.mood}: ${turn.mood === "calm" ? "quieter" : "louder"} than the first`,
        turn.grain && `grain ${turn.grain}: ${turn.grain === "smooth" ? "cleaner" : "rougher"} than the first`,
      ]
      looks.push({ look: next, why: [...why, ...said.filter((reason): reason is string => Boolean(reason))] })
    }
  }
  const chosen: Brand[] = []
  for (const candidate of looks) {
    if (chosen.length >= count) break
    if (holds(name, candidate.look)) chosen.push(build(name, candidate.look, candidate.why))
  }
  return chosen
}

