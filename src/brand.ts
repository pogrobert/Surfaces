import { generate, generateWith, notHere } from "./core/generate.ts"
import type { Recipes } from "./core/generate.ts"
import { hash } from "./core/random.ts"
import { partnerFor } from "./core/palette.ts"
import type { SurfaceInput } from "./core/generate.ts"
import { readLogo } from "./core/image.ts"
import type { ImageInput } from "./core/image.ts"
import type { Place } from "./core/intent.ts"
import { GRAINS, MOODS, PLACES, THEMES } from "./core/intent.ts"
import { FONTS } from "./core/type.ts"
import type { Font } from "./core/type.ts"
import type { Grain, Mood, Theme } from "./core/intent.ts"
import { coverage, HAIRLINE, worstTitleContrast } from "./core/judge.ts"
import type { Scene } from "./core/scene.ts"
import type { TitleFont } from "./type/fontfile.ts"
import { nearest } from "./core/validate.ts"
import { isStyle, PARTNERED, SHAPES, STILL, STYLE_NAMES } from "./styles/names.ts"
import type { StyleName } from "./styles/names.ts"
import { checkFacts, choose, FACTS, leansOf, PLACING, styleReason, USES } from "./page.ts"
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

/**
 * What a brand decides once. Only `name` is needed; whatever is left out is
 * chosen from the page's own facts, most simply spread in from
 * `readPage(html, css)`. `brand.look` is what was decided and `brand.why`
 * the reasons.
 */
export type BrandChoices = PageFacts & {
  /** The brand's own name, such as its domain. It is in every seed, so two brands never share a drawing. */
  name: string
  /** The brand colour, as hex. The others on a cover are chosen from it. */
  color?: string
  /** The brand's second colour, as hex, such as an accent its site uses beside `color`. The styles that set a second hue beside the first use its hue; left out, one is chosen to sit well with `color`. */
  partner?: string
  /** The look, from `catalog`. */
  style?: StyleName
  /** "light", "dark", or "auto" to follow the reader on the site's own pages. Link previews and headers are files, so they are light under "auto". */
  theme?: Theme | "auto"
  /** "calm" or "bold": the quiet or the loud end of what the style does. */
  mood?: Mood
  /** "smooth" (a little grain; never none), "natural" or "heavy". */
  grain?: Grain
  /**
   * One of the style's shapes, for every cover: a mark the brand always
   * makes. Without it each title draws its own.
   */
  shape?: string
  /** The bundled face titles are drawn in, where an image carries its own title: "sans" or "serif". */
  font?: Font
  /**
   * The brand's own logo, set as it is on the pictures a site shows of itself
   * elsewhere: its link previews and its headers. An SVG file's text, or a
   * PNG, JPEG or WebP; `{ light, dark }` gives one for each ground.
   */
  logo?: Logo
}

export type Logo = string | ImageInput | { light: string | ImageInput; dark?: string | ImageInput }

// Where the logo sits on each picture that carries it: over the title, as a
// letterhead's does, on a link preview and an email's header; clear of the
// photo X and LinkedIn lay over a profile header's left.
const LOGO_AT: Partial<Record<Use, Place>> = { og: "top-left", x: "right", linkedin: "right", email: "top-left" }

// What a cover is about: its title, or an id that names it, such as the
// post's slug, so its art stays when the title is edited. `tag` is the
// post's category: every cover with one tag makes one mark, so a category
// reads as a family while each title still draws its own.
//
// The art is the picture; the words are the site's, set in its own type.
// `text` says where they go over the art, so the art keeps a calm place for
// them and the scene's first area gives its box and ink: a link preview's at
// the brand's edge and a hero's in the middle unless told, nowhere on a
// post's cover, a card or a header, whose words sit beside them. "none"
// gives the art the whole frame. `drawTitle` sets the title into the image
// in the library's own face instead, for a file that has to carry it and a
// site that can't set its own.
/** What one cover is about. Nothing else is taken: its size, style and colours are the brand's. */
export type Content = {
  /** What the cover is about. The same title always draws the same art. It is not written on the picture unless `drawTitle` says so. */
  title?: string
  /** A name that outlasts the title, such as the post's slug: the art stays when the title is edited. */
  id?: string
  /** The post's category: every cover with one tag draws the same shape, so a category reads as a family. */
  tag?: string
  /**
   * Where words will go over the art: any place, such as "bottom-left", keeps
   * a calm area there (`scene.areas[0]`, with its box and `ink`); "none"
   * gives the art the whole frame. By default a link preview keeps one at the
   * brand's edge and a hero in the middle; a post's cover, a card and a
   * header keep none.
   */
  text?: Place | "none"
  /**
   * Draws the title into the image itself, for a file that has to carry it,
   * such as a link preview: `true` in a bundled face, or `{ font }` in the
   * site's own from `loadFont()`. On a page, leave it out and set the title
   * in HTML.
   */
  drawTitle?: boolean | { font: TitleFont }
}

/** A site's look, decided once. Each method draws one kind of cover from what it is about. */
export type Brand = {
  name: string
  /** The decisions, as plain data: keep them to rebuild the brand exactly. */
  look: { style: StyleName; color?: string; partner?: string; theme: Theme | "auto"; mood?: Mood; grain?: Grain; shape?: string; font?: Font }
  /** Why each decision that wasn't given was made, one sentence each. */
  why: string[]
  /** A post's cover, 1600x900: the art alone, its title set by the page. The use "post". */
  cover(content: Content): Scene
  /** A cover for a card in a list, 1600x900, its title beside it. */
  card(content: Content): Scene
  /** The page's hero, 2400x1200: room for its title in the middle, and the one cover that moves, where its style does. */
  hero(content: Content): Scene
  /** A link preview, 1200x630, with room for the title at the brand's edge. Always one theme, ready for `toJpeg`. */
  og(content: Content): Scene
  /** A profile's or a newsletter's header: X (1500x500), LinkedIn (1584x396) or email (1200x400), the art alone. */
  banner(content: Content & { for: "x" | "linkedin" | "email" }): Scene
  /**
   * The input any of those draws, to change before drawing: another size,
   * shape or motion, as `generate({ ...brand.input("post", { title }), width, height })`.
   * The uses are "post" (what `cover` draws), "card", "hero", "og", "x", "linkedin" and "email".
   */
  input(use: Use, content?: Content): SurfaceInput
}

const OPTIONS = ["name", "color", "partner", "style", "theme", "mood", "grain", "shape", "font", "logo", ...FACTS] as const

// What a cover is given, and nothing else: a key that isn't one of these is
// a mistake, and is said with where it belongs rather than dropped.
const CONTENT = ["title", "id", "tag", "text", "drawTitle"] as const
function misplaced(key: string, use: Use, called: string) {
  const spread = `generate({ ...brand.input("${use}", { title }), `
  if (key === "slug" || key === "seed" || key === "key" || key === "name") return ` Use "id": it names the ${called}, so its art stays when the title is edited.`
  if (key === "width" || key === "height" || key === "size") return ` A ${called} has its own size; for another, draw its input at that size: ${spread}width, height }).`
  if (key === "shape") return ` Give the brand its "shape" for every cover, createBrand({ name, shape }), or one cover its own: ${spread}shape }).`
  if (["style", "color", "partner", "theme", "mood", "grain", "font", "logo"].includes(key)) return ` That is the brand's own choice: createBrand({ name, ${key} }).`
  if (key === "motion" || key === "detail" || key === "areas") return ` That is an option of the input: ${spread}${key} }).`
  if (key === "place" || key === "position" || key === "area" || key === "align") return ` Use "text" for where words go over the art: a place such as "bottom-left", or "none".`
  if (key === "for") return ` Only a banner is for somewhere: brand.banner({ for: "x" }).`
  if (key === "draw" || key === "titleFont" || key === "drawText") return ` Use "drawTitle": true, or { font } with a font from loadFont().`
  return nearest(key, CONTENT) || ` A ${called} takes ${CONTENT.map((name) => `"${name}"`).join(", ")}.`
}

// Risograph inks, for a brand with no colour: strong, and none of them the
// violet that marks a page nobody chose a colour for.
const INKS = ["#0078bf", "#00838a", "#00a95c", "#f15060", "#ff6c2f", "#3d5588"]

// Every problem with the choices, each with its fix.
function check(choices: unknown): string[] {
  if (typeof choices !== "object" || choices === null || Array.isArray(choices)) {
    return [`Expected the brand's choices as an object, such as { name: "acme.dev", color: "#635bff" }`]
  }
  const given = choices as Record<string, unknown>
  const errors: string[] = []
  for (const key of Object.keys(given)) {
    if (!(OPTIONS as readonly string[]).includes(key)) {
      // Said so the choice can be moved to where it belongs.
      const hint =
        key === "seed" || key === "slug" ? ` A brand has no seed: give each cover its title.`
        : (CONTENT as readonly string[]).includes(key) ? ` That belongs to a cover, not the brand: brand.cover({ ${key} }).`
        : key === "motion" ? ` A brand's hero moves by itself, where its style does; for any other cover, generate({ ...brand.input("post", { title }), motion: "once" }).`
        : key === "width" || key === "height" || key === "size" ? ` Each kind of cover has its own size; for another, generate({ ...brand.input("post", { title }), width, height }).`
        : /^(secondary|accent|second|color2|colour2|secondaryColor|secondaryColour)$/i.test(key) ? ` A brand's second colour is "partner": createBrand({ name, color, partner: "#3730a3" }).`
        : nearest(key, OPTIONS) || ` A brand's choices are ${OPTIONS.map((option) => `"${option}"`).join(", ")}.`
      errors.push(`Unknown choice "${key}".${hint}`)
    }
  }
  if (typeof given.name !== "string" || !given.name.trim()) {
    errors.push(`Missing "name": give the brand's name, such as its domain, so no other brand shares its drawings`)
  }
  if (given.style !== undefined && !isStyle(given.style)) {
    errors.push(`Unknown style "${String(given.style)}".${nearest(String(given.style), STYLE_NAMES)} Use ${STYLE_NAMES.map((style) => `"${style}"`).join(", ")}; \`catalog\` says what each looks like.`)
  }
  if (given.color !== undefined && (typeof given.color !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(given.color))) {
    errors.push(`"color" should be the brand's hex colour, such as #635bff`)
  }
  if (given.partner !== undefined && (typeof given.partner !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(given.partner))) {
    errors.push(`"partner" should be the brand's second colour, as hex, such as #3730a3`)
  }
  for (const [name, values] of [["theme", [...THEMES, "auto"]], ["mood", MOODS], ["grain", GRAINS], ["font", FONTS]] as const) {
    if (given[name] !== undefined && !(values as readonly unknown[]).includes(given[name])) {
      errors.push(`Unknown ${name} "${String(given[name])}". Use ${values.map((value) => `"${value}"`).join(", ")}.`)
    }
  }
  if (given.logo !== undefined) {
    const logo = given.logo as Logo
    const both = typeof logo === "object" && logo !== null && "light" in logo ? logo : { light: logo }
    for (const image of [both.light, both.dark]) {
      if (image === undefined && image !== both.light) continue
      try {
        readLogo(image as string | ImageInput)
      } catch (error) {
        errors.push(`"logo": ${(error as Error).message}`)
      }
    }
  }
  return [...errors, ...checkFacts(given)]
}

// The decisions a brand makes and what it leaves to its page, resolved.
function resolve(choices: BrandChoices) {
  const errors = check(choices)
  if (errors.length) throw new Error(errors.join("\n"))
  const { name, color, partner, style, theme, mood, grain, shape, font, logo, ...facts } = choices
  // What wasn't decided is chosen from the page; a given colour is a fact
  // like any other, and the first one the page uses.
  const page = { ...facts, colors: color ? [color, ...(facts.colors ?? [])] : facts.colors }
  const chosen = choose(page, name)
  // A page with no colour of its own gets a printer's ink, picked by the
  // brand's name, so two such sites still look like two brands.
  const ink = color ?? chosen.color ?? INKS[hash(`${name}/ink`) % INKS.length]!
  if (!color && !chosen.color) {
    chosen.why = chosen.why.map((reason) => (reason.startsWith("color ") ? `color ${ink}: the page gave no colour of its own, so a risograph ink, picked by the brand's name` : reason))
  }
  const look: Brand["look"] = {
    style: style ?? chosen.style,
    color: ink,
    ...(partner ? { partner } : null),
    theme: theme ?? chosen.theme,
    ...((mood ?? chosen.mood) ? { mood: mood ?? chosen.mood } : null),
    ...((grain ?? chosen.grain) ? { grain: grain ?? chosen.grain } : null),
    ...(shape !== undefined ? { shape } : null),
    ...((font ?? chosen.font) !== "sans" ? { font: font ?? chosen.font } : null),
  }
  const shapes = SHAPES[look.style]
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
  return { name, look, why, decided, page, ranked: chosen.ranked, logo }
}

/**
 * A site's brand: `createBrand({ name: "acme.dev", color: "#635bff" })`, or
 * with the page's own facts, `createBrand({ name, ...readPage(html, css) })`.
 * Then `brand.cover({ title })`, `brand.card`, `brand.hero`, `brand.og`,
 * `brand.banner({ for: "x" })`. There is no seed to choose.
 */
export function createBrand(choices: BrandChoices): Brand {
  const { name, look, why, logo } = resolve(choices)
  return build(generate, name, look, why, logo)
}

// The same, drawing only with the recipes given, as a style's own import
// does: a brand there is in that style unless it says otherwise, and one in
// a style the import hasn't is told where to get it.
export function createBrandWith(recipes: Recipes, choices: BrandChoices): Brand {
  const here = STYLE_NAMES.filter((style) => recipes[style])
  const asked = typeof choices === "object" && choices !== null ? (choices as { style?: unknown }).style : undefined
  if (isStyle(asked) && !recipes[asked]) throw new Error(notHere(asked, recipes))
  const given = asked === undefined && here.length === 1 && typeof choices === "object" && choices !== null ? { ...choices, style: here[0]! } : choices
  const { name, look, why, logo } = resolve(given)
  if (!recipes[look.style]) throw new Error(notHere(look.style, recipes))
  return build((input) => generateWith(recipes, input), name, look, why, logo)
}

// The logo as an input takes it: one image, and one for dark covers.
// A link preview's layout, one of three judged for every style, picked by
// the brand's name and kept for all its previews, so a site's link previews
// are one set and two sites' are not alike: the title at the foot with the
// logo over it, at the head with the logo at the foot, or mirrored, the art
// on the left. Each logo sits as a letterhead's does, on the title's edge.
const OG_LAYOUTS: readonly { title: Place; logo: Place }[] = [
  { title: "bottom-left", logo: "top-left" },
  { title: "top-left", logo: "bottom-left" },
  { title: "bottom-right", logo: "top-right" },
  // A lockup: the logo just over the title, read as one.
  { title: "bottom-left", logo: "left" },
]
const ogLayout = (name: string) => OG_LAYOUTS[hash(`${name}/og`) % OG_LAYOUTS.length]!
// How far a title runs, in Latin letters. A Chinese, Japanese or Korean
// character, a fullwidth one or a pictograph is about two letters wide; a mark
// that joins the letter before it is none. Counted per character, with no
// segmenter, so it is the same on every runtime and the same title always
// gets the same picture.
const WIDE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}\u3000-\u303f\uff00-\uff60\uffe0-\uffe6]/u
const JOINS = /[\p{M}\u200d\ufe0e\ufe0f]/u
export function titleWidth(title: string) {
  let width = 0
  for (const char of title.trim()) if (!JOINS.test(char)) width += WIDE.test(char) ? 2 : 1
  return width
}
// A long title gets the large area, so it is set at a size a feed can read,
// and the art gives up a little room; a short one keeps the art large.
const ogSize = (title: string | undefined) => (titleWidth(title ?? "") > 45 ? "lg" : "md")

function logoFor(logo: Logo | undefined, use: Use, name: string, title?: string): SurfaceInput["logo"] {
  // A lockup's logo has no room over a long title's large area, so it goes
  // to the head of the card instead, as a letterhead's does.
  const layout = ogLayout(name)
  const place = use === "og" ? (layout.logo === "left" && ogSize(title) === "lg" ? "top-left" : layout.logo) : LOGO_AT[use]
  if (!logo || !place) return undefined
  const both = typeof logo === "object" && "light" in logo ? logo : { light: logo as string | ImageInput }
  return { image: both.light, ...(both.dark ? { dark: both.dark } : null), place }
}

// Where a use keeps room for words unless told: a link preview and a hero
// carry their title over the art; a post's cover, a card and a header have
// theirs beside them on the page.
const TEXT_AT: Partial<Record<Use, true>> = { og: true, hero: true }

// The uses that are files shown by other sites, never a page of this one: a
// link preview and the headers.
const FILES: Partial<Record<Use, true>> = { og: true, x: true, linkedin: true, email: true }

// Where a use's title goes when it is set over the art, by the page or drawn
// in: the use's own place, and a link preview's at the brand's edge.
// A use's placing, or what the uses are.
function placingOf(use: Use) {
  if (!Object.hasOwn(PLACING, use)) throw new Error(`Unknown use "${String(use)}". Use ${USES.join(", ")}.${nearest(String(use), USES)}`)
  return PLACING[use]
}

export function titleAt(name: string, use: Use): Place | undefined {
  const area = placingOf(use).areas[0]
  if (!area) return undefined
  return use === "og" ? ogLayout(name).title : area.place
}

// What each use is called, for saying what it needs.
const CALLED: Record<Use, string> = { post: "cover", card: "card", hero: "hero", og: "link preview", x: "X header", linkedin: "LinkedIn banner", email: "email header" }

// The longest title drawn in, as generate takes it. A longer one is cut at a
// word and ends in an ellipsis, so one long post doesn't stop a site's build.
const MOST_TITLE = 160
function clipped(title: string) {
  const text = title.replace(/\s+/g, " ").trim()
  if (text.length <= MOST_TITLE) return text
  const cut = text.slice(0, MOST_TITLE - 1)
  const word = cut.lastIndexOf(" ")
  return `${(word > MOST_TITLE / 2 ? cut.slice(0, word) : cut).replace(/[\s,.;:–—-]+$/, "")}…`
}

// `draw` is every style's generate, or a style's own import's, which is why
// it is given and never defaults: a default would bring every style along.
function build(draw: (input: SurfaceInput) => Scene, name: string, given: Brand["look"], said: string[], logo?: Logo): Brand {
  // A style that sets a second hue gets one partner for the whole brand,
  // picked by its name among the hues that sit well beside its colour,
  // unless the brand gave its own; it is in \`look\`, so it shows and is kept.
  const pairs = PARTNERED.has(given.style) && !(given.style === "underpaint" && given.shape === "glow")
  const look = pairs && !given.partner && given.color ? { ...given, partner: partnerFor(given.color, name) } : given
  const why = look === given ? said : [...said, `partner ${look.partner}: a second colour a printer would pair with ${look.color}, picked by the brand's name`]
  const input = (use: Use, content: Content = {}): SurfaceInput => {
    const placing = placingOf(use)
    if (typeof content !== "object" || content === null || Array.isArray(content)) {
      throw new Error(`Give the ${CALLED[use]} what it is about, as an object: { title: post.title }`)
    }
    const unknown = Object.keys(content).filter((key) => !(CONTENT as readonly string[]).includes(key))
    if (unknown.length) throw new Error(unknown.map((key) => `Unknown option "${key}" for a ${CALLED[use]}.${misplaced(key, use, CALLED[use])}`).join("\n"))
    // A banner is one of a kind, so it needs no name of its own.
    const about = content?.id ?? content?.title ?? (placing.optional ? use : undefined)
    if (typeof about !== "string" || !about.trim()) {
      throw new Error(`Give the ${CALLED[use]} a "title", or an "id" that names it, such as the post's slug`)
    }
    // Drawn in the brand's face, or in a site's own font given with it.
    const drawn = content.drawTitle === true || (typeof content.drawTitle === "object" && content.drawTitle !== null)
    const own = typeof content.drawTitle === "object" && content.drawTitle !== null ? content.drawTitle.font : undefined
    if (typeof content.drawTitle === "object" && content.drawTitle !== null && (typeof own !== "object" || own === null || own.kind !== "font")) {
      throw new Error(`drawTitle's "font" is a font read by loadFont(): drawTitle: { font: await loadFont(await readFile("public/fonts/Brand.woff2")) }`)
    }
    if (drawn && (typeof content.title !== "string" || !content.title.trim())) throw new Error(`A ${CALLED[use]} drawn with its title needs a "title"`)
    if (content.text !== undefined && content.text !== "none" && !(PLACES as readonly string[]).includes(content.text)) {
      throw new Error(`Unknown text place "${String(content.text)}". Use one of ${PLACES.map((place) => `"${place}"`).join(", ")}, or "none".${nearest(String(content.text), PLACES)}`)
    }
    if (drawn && content.text === "none") throw new Error(`A title drawn in needs room: leave "text" out, or give it a place`)
    if (drawn && content.text === undefined && !placing.areas.length) throw new Error(`A ${CALLED[use]} has no area for a title; draw it as a cover or a link preview instead, or give "text" a place`)
    // Where the words go: as asked, or the use's own place when it carries
    // words over the art or has them drawn in.
    const at = content.text === "none" ? undefined : content.text ?? (drawn || TEXT_AT[use] ? titleAt(name, use) ?? "bottom-left" : undefined)
    // A link preview's title gets the room its length needs, set by the page
    // or drawn in alike: the page sets a long one as large as a drawn one.
    const size = use === "og" ? ogSize(content.title) : placing.areas[0]?.size ?? "md"
    const areas = [...(at ? [{ place: at, size }] : []), ...(placing.keep ?? [])]
    return {
      style: look.style,
      seed: `${name}/${about.trim()}`,
      ...(look.color ? { color: look.color } : null),
      ...(look.partner ? { partner: look.partner } : null),
      ...placing.size,
      ...(areas.length ? { areas } : null),
      // A picture handed to another site is a file, and a file has one
      // theme: a brand that follows its reader shows its light side there,
      // as it does in every picture the command line writes.
      theme: look.theme === "auto" && FILES[use] ? "light" : look.theme,
      ...(look.mood ? { mood: look.mood } : null),
      ...(look.grain ? { grain: look.grain } : null),
      ...(look.shape ? { shape: look.shape } : content.tag?.trim() ? familyShape(look.style, name, content.tag.trim()) : null),
      ...(drawn ? { title: clipped(content.title!), ...(own ? { font: own } : look.font ? { font: look.font } : null) } : null),
      // A hero moves, where its style does; a still style's stays as drawn.
      ...(placing.motion && !drawn && !STILL.has(look.style) ? { motion: placing.motion } : null),
      ...(logoFor(logo, use, name, drawn ? content.title : undefined) ? { logo: logoFor(logo, use, name, drawn ? content.title : undefined) } : null),
    }
  }
  const of = (use: Use) => (content: Content) => draw(input(use, content))

  const brand: Brand = {
    name,
    look,
    why,
    cover: of("post"),
    card: of("card"),
    hero: of("hero"),
    og: of("og"),
    banner: ({ for: where, ...content }) => {
      if (!["x", "linkedin", "email"].includes(where)) throw new Error(`Unknown banner "${String(where)}". Use "x", "linkedin" or "email".`)
      return draw(input(where, content))
    },
    input,
  }
  made.set(brand, { draw, logo })
  return brand
}

// What a brand was made with beyond its look: the logo, which is an image
// and so not in `look`, and what it draws with. Kept so the brand can be
// drawn again in one theme with both, as the HTTP handler's ?theme= does.
const made = new WeakMap<Brand, { draw: (input: SurfaceInput) => Scene; logo?: Logo }>()

/** The same brand in one theme, its logo and its import's styles kept. */
export function inTheme(brand: Brand, theme: Theme): Brand {
  const own = made.get(brand)
  if (!own) throw new Error(`Expected a brand made by createBrand()`)
  return build(own.draw, brand.name, { ...brand.look, theme }, brand.why, own.logo)
}

// The mark every cover with a tag makes, picked by the tag so it stays when
// posts come and go; nothing for a style without shapes.
function familyShape(style: StyleName, name: string, tag: string) {
  const shapes = SHAPES[style]
  return shapes.length ? { shape: shapes[hash(`${name}/tag/${tag.toLowerCase()}`) % shapes.length]! } : null
}

// Styles in kinds that look alike, so a set of directions can show one of
// each kind before it shows two of any.
const KINDS: readonly (readonly StyleName[])[] = [
  ["stencil", "screenprint", "riso", "photocopy", "halftone", "dither", "linocut", "typewriter"],
  ["engraving", "linework", "moire", "currents", "dashes"],
  ["underpaint", "sfumato", "fluted", "trails", "prism"],
  ["aquatint", "mezzotint", "chrome", "glass"],
  ["marbling", "strata", "endpaper", "patches"],
  ["papercut", "weave", "terrazzo", "swatchbook"],
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
    const brand = build(generate, name, { ...look, theme }, [])
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
/**
 * Several brands for one site to show a person, varied and each already
 * checked; the first is what `createBrand` picks. Keep the chosen one's look:
 * `createBrand({ name, ...options[2].look })`.
 */
export function directions(choices: BrandChoices, { count = 6 }: { count?: number } = {}): Brand[] {
  const { name, look, why, decided, page, ranked, logo } = resolve(choices)
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
    const shapes = decided.shape === undefined ? SHAPES[look.style] : []
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
    if (holds(name, candidate.look)) chosen.push(build(generate, name, candidate.look, candidate.why, logo))
  }
  return chosen
}

