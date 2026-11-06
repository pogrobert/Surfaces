import { contrast, fromOklch, luminance, toOklch } from "./core/color.ts"
import { formats } from "./core/intent.ts"
import type { Area, Grain, Mood, MotionLevel, Theme } from "./core/intent.ts"
import type { Font } from "./core/type.ts"
import { nearest } from "./core/validate.ts"
import { STYLES } from "./styles/index.ts"
import type { StyleName } from "./styles/index.ts"

// What a page shows, and the look a brand takes from it when it doesn't
// decide for itself: its colour, its light or dark, and the style that suits
// how the page looks and what it says. Every choice is a rule on what the page
// shows, so one page always gives one look, and each comes with why, in words
// an agent can pass on.

// Where the cover goes on the page, which sets its size and where its title is.
export const USES = ["post", "card", "hero", "og", "x", "linkedin", "email", "icon"] as const
export type Use = (typeof USES)[number]

export type PageFacts = {
  // Colours the site uses, as hex, most used first; a brand colour first of all.
  colors?: readonly string[]
  background?: string
  text?: string
  // Whether the site has a dark mode of its own.
  darkMode?: boolean
  // Font families, as CSS gives them.
  fonts?: { heading?: string; body?: string }
  // What the page says: its title, headline, tagline or description.
  words?: string
  // Covers the site already has. A new one joins them.
  covers?: readonly { style: StyleName; color?: string }[]
}

export type Look = {
  style: StyleName
  color?: string
  theme: Theme | "auto"
  mood?: Mood
  grain?: Grain
  font: Font
  // One plain sentence for each choice, starting with what it chose.
  why: string[]
  // Every style, best suited first.
  ranked: StyleName[]
}

export const FACTS = ["colors", "background", "text", "darkMode", "fonts", "words", "covers"] as const
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

// How the type looks, by its first family. Mono first, and sans before
// serif, so "sans-serif" isn't read as a serif.
type Face = "serif" | "mono" | "rounded" | "grotesk"
const FACES: readonly [Face, RegExp][] = [
  ["mono", /mono|code|courier|consolas|menlo|monaco|iosevka|^hack$/],
  ["rounded", /rounded|nunito|quicksand|comfortaa|varela|poppins|fredoka|baloo|rubik|manrope|dm sans|outfit|lexend|figtree|jakarta|sora/],
  ["grotesk", /sans|inter|helvetica|arial|geist|system-ui|roboto|segoe|-apple-system|blinkmacsystemfont|grotesk|neue/],
  ["serif", /serif|garamond|caslon|baskerville|georgia|times|playfair|lora|merriweather|fraunces|newsreader|tiempos|ivar|crimson|spectral|cormorant|bodoni|didot|literata|recoleta|canela|freight|charter/],
]

// A family the lists don't know is read by the generic it falls back to, and
// gives no signal without one.
function face(family: string | undefined): Face | undefined {
  // A family named through a variable reads by the variable's name, as
  // `var(--font-dm-sans)` does; hyphens read as spaces.
  const stack = (family ?? "")
    .split(",")
    .map((name) => name.trim().replace(/^["']|["']$/g, "").replace(/^var\(--(?:font-)?|\)$/g, "").replace(/-/g, " ").toLowerCase())
  const known = FACES.find(([, pattern]) => pattern.test(stack[0] ?? ""))?.[0]
  if (known) return known
  if (stack.includes("monospace")) return "mono"
  if (stack.includes("serif")) return "serif"
  if (stack.some((name) => name === "sans-serif" || name === "system-ui")) return "grotesk"
  return undefined
}

// What the page talks like, by the words it uses.
type Tone = "technical" | "editorial" | "playful" | "warm" | "glossy" | "calm"
const TONES: Record<Tone, RegExp> = {
  technical: /\b(apis?|sdks?|developers?|devtools?|infrastructure|deploy\w*|databases?|data|code|open source|platform|engineering|cli|cloud|latency|observability|ai|ml)\b/g,
  editorial: /\b(journal|essays?|stor(y|ies)|notes|magazine|writing|newsletter|reviews?|reading|books?|letters|archive)\b/g,
  playful: /\b(fun|play\w*|creative|indie|zines?|music|games?|weird|party|hey|hello)\b/g,
  warm: /\b(communit(y|ies)|nonprofit|non-profit|together|care|home|food|craft\w*|handmade|people|neighbou?rhoods?|local|fair\w*|kind|famil(y|ies)|bookings?|appointments?|customers|clients|guests)\b/g,
  glossy: /\b(premium|luxury|beauty|fashion|studio|hardware|devices?)\b/g,
  calm: /\b(calm|wellness|meditation|health|mindful\w*|sleep|quiet|slow|rest|therapy|focus)\b/g,
}

// How much each signal leans toward each style. Judged by eye from the
// catalog: what each style looks like and what it suits.
// A bright brand colour is one a deep ink would lose: the engraver's and the
// mezzotinter's plates print the brand as its darkest shade, so a light
// amber comes out brown. It leans toward styles that show the colour as it is.
const LEANS: Record<Face | Tone | "dark" | "bright", Partial<Record<StyleName, number>>> = {
  serif: { engraving: 3, mezzotint: 2, aquatint: 2, marbling: 2, halftone: 1 },
  mono: { linework: 3, dither: 3, halftone: 1, photocopy: 1 },
  rounded: { stencil: 3, riso: 3, screenprint: 2, underpaint: 2, strata: 1 },
  grotesk: { underpaint: 2, halftone: 2, fluted: 1, sfumato: 1, riso: 1 },
  technical: { linework: 3, dither: 2, engraving: 1, moire: 1 },
  editorial: { halftone: 2, engraving: 2, mezzotint: 2, marbling: 1, photocopy: 1 },
  playful: { riso: 3, screenprint: 3, photocopy: 2, stencil: 2, endpaper: 1 },
  warm: { stencil: 3, underpaint: 2, marbling: 1, strata: 1 },
  glossy: { chrome: 3, glass: 3, fluted: 2, sfumato: 1 },
  calm: { underpaint: 3, sfumato: 2, aquatint: 2 },
  dark: { mezzotint: 1, moire: 1, sfumato: 1, chrome: 1 },
  bright: { stencil: 2, riso: 2, screenprint: 2, underpaint: 1, strata: 1, halftone: 1, marbling: 1, engraving: -2, mezzotint: -2, aquatint: -1, moire: -1 },
}

const SAID: Record<Face | Tone | "bright", string> = {
  serif: "is set in a serif",
  mono: "is set in a monospaced face",
  rounded: "is set in a rounded, friendly sans",
  grotesk: "is set in a plain sans",
  technical: "talks about building software",
  editorial: "reads like writing to be read",
  playful: "sounds playful",
  warm: "sounds warm and about people",
  glossy: "sounds like a polished product",
  calm: "sounds calm",
  bright: "has a bright brand colour that a deep ink would lose",
}

// Where a cover goes. A banner's title is its own choice: with one, it is set
// in the banner's area; without, the banner is art alone, and so is an icon.
export const PLACING: Record<Use, { size: { width: number; height: number }; areas: Area[]; motion?: MotionLevel; said: string; optional?: true; keep?: Area[] }> = {
  post: { size: { width: 1600, height: 900 }, areas: [{ place: "bottom-left", size: "lg" }], said: "a post's cover carries its title at the bottom left" },
  card: { size: { width: 1600, height: 900 }, areas: [], said: "a card's title sits beside the cover, so the art fills it" },
  hero: { size: { width: 2400, height: 1200 }, areas: [{ place: "center", size: "lg" }], motion: "loop", said: "a hero carries its title in the middle and is the one cover on the page that moves" },
  og: { size: formats.og, areas: [{ place: "left", size: "lg" }], said: "a link preview carries its title on the left" },
  // A profile's header. X lays the profile's photo over its bottom left, so
  // the art always keeps clear of it.
  x: { size: { width: 1500, height: 500 }, areas: [{ place: "center", size: "md" }], optional: true, keep: [{ place: "bottom-left", size: "sm" }], said: "an X header" },
  linkedin: { size: { width: 1584, height: 396 }, areas: [{ place: "center", size: "md" }], optional: true, said: "a LinkedIn banner" },
  // A newsletter's header, at twice the 600 by 200 an email shows it at.
  email: { size: { width: 1200, height: 400 }, areas: [{ place: "left", size: "lg" }], optional: true, said: "an email header" },
  // An app's icon or a site's favicon: the brand's mark filling a square.
  icon: { size: { width: 512, height: 512 }, areas: [], optional: true, said: "an icon" },
}

// Every problem with the facts given, each with its fix.
export function checkFacts(given: Record<string, unknown>): string[] {
  const errors: string[] = []
  for (const name of ["background", "text"] as const) {
    if (given[name] !== undefined && (typeof given[name] !== "string" || !HEX.test(given[name] as string))) errors.push(`"${name}" should be a hex colour such as #ffffff`)
  }
  if (given.colors !== undefined) {
    if (!Array.isArray(given.colors)) errors.push(`"colors" should be a list of hex colours, most used first`)
    else given.colors.forEach((color, index) => {
      if (typeof color !== "string" || !HEX.test(color)) errors.push(`colors[${index}] "${String(color)}" isn't a hex colour; give colours as #rrggbb`)
    })
  }
  if (given.covers !== undefined && !Array.isArray(given.covers)) errors.push(`"covers" should be a list such as [{ style: "riso" }]`)
  if (Array.isArray(given.covers)) {
    for (const cover of given.covers as { style?: unknown }[]) {
      if (!(String(cover?.style) in STYLES)) errors.push(`A cover's style "${String(cover?.style)}" isn't a style.${nearest(String(cover?.style), Object.keys(STYLES))}`)
    }
  }
  return errors
}

const expand = (hex: string) =>
  (hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}` : hex).toLowerCase()

// The brand colour: the first strong colour the page uses that is neither its
// background nor its text. Strong means an ink: real chroma at a middle
// lightness or vivid, so a pale tint from the brand's ramp, used for washes,
// never stands in for the brand. A page with none gives its deepest other colour.
function brandOf(facts: PageFacts): { color?: string; said: string } {
  const background = facts.background && expand(facts.background)
  const text = facts.text && expand(facts.text)
  const seen = [...new Set((facts.colors ?? []).map(expand))].filter(
    (color) => color !== background && color !== text && (!background || contrast(color, background) > 1.2)
  )
  const strong = seen.find((color) => {
    const { l, c } = toOklch(color)
    // A vivid yellow is light by nature, and still an ink.
    return c >= 0.06 && l >= 0.3 && (l <= 0.86 || c >= 0.12)
  })
  if (strong) return { color: strong, said: `${strong}: the first strong colour the page uses that isn't its background or text` }
  const other = seen.sort((a, b) => luminance(a) - luminance(b))[0]
  if (other) return { color: other, said: `${other}: the page has no strong colour, so its deepest other one` }
  return { said: "the library's default: the page gave no colour of its own" }
}

// The look a page gives, from facts already checked.
export function choose(facts: PageFacts): Look {
  const why: string[] = []

  const dark = Boolean(facts.background && luminance(expand(facts.background)) < 0.2)
  const theme: Theme | "auto" = facts.darkMode ? "auto" : dark ? "dark" : "light"
  why.push(
    `theme ${theme}: ${facts.darkMode ? "the page has a dark mode, so the cover follows the reader" : dark ? "the page is dark" : "the page is light"}`
  )

  // The site's own covers outrank anything read off the page: a new cover in
  // another style would break the set.
  const kept = facts.covers?.length ? mostCommon(facts.covers.map((cover) => cover.style)) : undefined
  const brand = brandOf(facts)
  const color = (kept && facts.covers?.find((cover) => cover.style === kept && cover.color)?.color) || brand.color
  why.push(`color ${color && color !== brand.color ? `${color}: the colour the site's covers already use` : brand.said}`)

  const { signals, tones } = signalsOf(facts, color, dark)
  const ranked = rank(signals)
  const best = ranked[0]!.score > 0 ? ranked[0]!.style : "underpaint"
  const style = kept ?? best
  if (kept) why.push(`style ${style}: the site's covers already use it, and a new one joins the set`)
  else why.push(styleReason(style, signals))

  // A tone that clearly leads sets the mood; otherwise the seed's own.
  const lead = tones[0] && (!tones[1] || tones[0].hits > tones[1].hits) ? tones[0].tone : undefined
  const mood: Mood | undefined = lead === "calm" || lead === "editorial" ? "calm" : lead === "playful" ? "bold" : undefined
  if (mood) why.push(`mood ${mood}: the page ${SAID[lead!]}`)
  const grain: Grain | undefined = lead === "glossy" ? "smooth" : undefined
  if (grain) why.push(`grain ${grain}: a polished product reads cleaner without film grain`)

  // Titles drawn into images are set in a serif when the page's headings
  // are, and in a sans otherwise.
  const font: Font = face(facts.fonts?.heading ?? facts.fonts?.body) === "serif" ? "serif" : "sans"
  if (font === "serif") why.push("font serif: the page's headings are set in a serif")

  return {
    style,
    ...(color ? { color } : null),
    theme,
    ...(mood ? { mood } : null),
    ...(grain ? { grain } : null),
    font,
    why,
    ranked: ranked.map((entry) => entry.style),
  }
}

type Signal = Face | Tone | "dark" | "bright"

// What leans the page's style, and how hard: its type, its words, its ground
// and its colour.
function signalsOf(facts: PageFacts, color: string | undefined, dark: boolean) {
  const signals = new Map<Signal, number>()
  const heading = face(facts.fonts?.heading ?? facts.fonts?.body)
  const body = face(facts.fonts?.body)
  if (heading) signals.set(heading, 1)
  if (body && body !== heading) signals.set(body, 0.5)
  // "No code" says the page is for people who don't write it.
  const words = (facts.words ?? "").toLowerCase().replace(/\bno[- ]code\b/g, " ")
  const tones = (Object.keys(TONES) as Tone[])
    .map((tone) => ({ tone, hits: words.match(TONES[tone])?.length ?? 0 }))
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits)
  for (const { tone, hits } of tones) signals.set(tone, Math.min(hits, 2))
  if (dark) signals.set("dark", 1)
  if (color) {
    const { l, c } = toOklch(color)
    if (c >= 0.13 && l >= 0.6) signals.set("bright", 1)
  }
  return { signals, tones }
}

// Every style, most leaned toward first; ties keep the catalog's order.
function rank(signals: Map<Signal, number>) {
  const score = (style: StyleName) => [...signals].reduce((sum, [signal, weight]) => sum + (LEANS[signal][style] ?? 0) * weight, 0)
  return (Object.keys(STYLES) as StyleName[])
    .map((style, index) => ({ style, score: score(style), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
}

// Why a style suits the page, in the page's own terms where it leans that way.
export function styleReason(style: StyleName, signals: Map<Signal, number>) {
  // Of the two faces, the heading's speaks for the type.
  const faces = new Set<Signal>(["serif", "mono", "rounded", "grotesk"])
  const lead = [...signals].filter(([signal]) => faces.has(signal)).sort((a, b) => b[1] - a[1])[0]?.[0]
  const reasons = [...signals.keys()]
    .filter((signal): signal is Exclude<Signal, "dark"> => signal !== "dark" && (LEANS[signal][style] ?? 0) > 0)
    .filter((signal) => !faces.has(signal) || signal === lead)
    .map((signal) => SAID[signal])
  return reasons.length
    ? `style ${style}: the page ${list(reasons)}`
    : `style ${style}: nothing on the page leans another way, and it suits any page`
}

// The leans of a page, for a caller that ranks styles itself.
export function leansOf(facts: PageFacts) {
  const dark = Boolean(facts.background && luminance(expand(facts.background)) < 0.2)
  return signalsOf(facts, brandOf(facts).color, dark).signals
}

function mostCommon<T>(items: readonly T[]): T {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]![0]
}

const list = (parts: string[]) =>
  parts.length < 3 ? parts.join(" and ") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`

// What a page shows, read from its HTML and CSS as text: no browser, nothing
// fetched. It reads the usual places, CSS variables named for a brand, the
// rules on html, body and headings, Google Fonts links, the title and meta
// description, and leaves out what it can't find. Add the slug and the use,
// then hand it to createBrand(); correct any fact it got wrong first.
export function readPage(html = "", css = ""): Omit<PageFacts, "covers"> {
  const source = `${html}\n${css}`
  const facts: Omit<PageFacts, "covers"> = {}

  const COLOR = String.raw`(#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)|oklch\([^)]*\))`
  const variable = (names: string) => source.match(new RegExp(String.raw`--(?:color-)?(?:${names})\s*:\s*${COLOR}`, "i"))?.[1]
  const rule = (selector: string, property: string, value = COLOR) =>
    source.match(new RegExp(String.raw`(?:^|[}\s,;])(?:${selector})\s*(?:,[^{]*)?\{[^}]*?(?<![-\w])${property}\s*:\s*${value}`, "i"))?.[1]

  const background = hex(variable("background|bg|surface") ?? rule("html|body|:root", "background(?:-color)?"))
  if (background) facts.background = background
  const text = hex(variable("foreground|fg|text") ?? rule("body|html|:root", "color"))
  if (text) facts.text = text

  // Every colour, most used first, with colours named for the brand ahead:
  // "brand" before "primary" before "accent", a plain name before a specific
  // one, and from a ramp of shades the one nearest its middle. A framework's
  // own palette, declared whole whether the site uses it or not, isn't
  // counted.
  const used = source.replace(/--color-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\s*:[^;}]*/gi, "")
  const counts = new Map<string, number>()
  for (const match of used.matchAll(new RegExp(String.raw`(?<![&\w])${COLOR}`, "g"))) {
    const color = hex(match[1]!)
    if (color) counts.set(color, (counts.get(color) ?? 0) + 1)
  }
  const rank = (name: string) => {
    const kind = ["brand", "primary", "accent"].findIndex((word) => name.includes(word))
    const shade = Number(name.match(/-(\d{2,3})$/)?.[1] ?? 500)
    return kind * 1e6 + Math.abs(shade - 500) * 1000 + name.length
  }
  // Named in a CSS variable, an SCSS variable, or a key of a config such as
  // Tailwind's.
  const named = [...source.matchAll(new RegExp(String.raw`(?:--|\$|\b)([\w-]*(?:brand|primary|accent)[\w-]*)["']?\s*:\s*["']?${COLOR}`, "gi"))]
    .map((match) => ({ name: match[1]!.toLowerCase(), color: hex(match[2]!) }))
    .filter((entry): entry is { name: string; color: string } => Boolean(entry.color))
    .sort((a, b) => rank(a.name) - rank(b.name))
    .map((entry) => entry.color)
  const colors = [...new Set([...named, ...[...counts].sort((a, b) => b[1] - a[1]).map(([color]) => color)])]
  if (colors.length) facts.colors = colors

  if (/prefers-color-scheme\s*:\s*dark|\.dark\b|data-theme=["']?dark/i.test(source)) facts.darkMode = true

  const FAMILY = String.raw`([^;}]+)`
  const fontVariable = (names: string) => source.match(new RegExp(String.raw`--font-(?:${names})\s*:\s*${FAMILY}`, "i"))?.[1]?.trim()
  const google = [...source.matchAll(/fonts\.googleapis\.com\/css2?\?[^"'\s>]*/g)].flatMap((match) =>
    [...match[0].matchAll(/family=([^:&"']+)/g)].map((family) => decodeURIComponent(family[1]!.replace(/\+/g, " ")))
  )
  const heading = fontVariable("heading|display|title|headline") ?? rule("h1|h2|h3", "font-family", FAMILY)?.trim() ?? google[0]
  const body = fontVariable("sans|body|text") ?? rule("body|html|:root", "font-family", FAMILY)?.trim() ?? google[1] ?? google[0]
  if (heading || body) facts.fonts = { ...(heading ? { heading } : null), ...(body ? { body } : null) }

  const plain = (text: string) => text.replace(/<[^>]+>/g, " ").replace(/&\w+;/g, " ").replace(/\s+/g, " ").trim()
  const words = [
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)/i)?.[1],
    html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)/i)?.[1],
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  ]
    .filter((part): part is string => Boolean(part))
    .map(plain)
  if (words.length) facts.words = [...new Set(words)].join(". ")
  return facts
}

// A CSS colour as hex, or nothing for one this can't read.
function hex(color: string | undefined): string | undefined {
  if (!color) return undefined
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(color)) return expand(color)
  const rgb = color.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i)
  if (rgb) return `#${rgb.slice(1, 4).map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, "0")).join("")}`
  const oklch = color.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i)
  if (oklch) {
    const l = Number(oklch[1]) / (oklch[2] ? 100 : 1)
    return fromOklch({ l, c: Number(oklch[3]), h: Number(oklch[4]) })
  }
  return undefined
}
