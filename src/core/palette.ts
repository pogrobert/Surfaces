import { fromLinear, fromOklch, linearRgb, toOklch, turnToward } from "./color.ts"
import { clamp, lerp } from "./math.ts"
import { hash } from "./random.ts"
import type { Range, Rng } from "./random.ts"
import type { Palette, Tone } from "./scene.ts"
import type { Theme } from "./intent.ts"

export type ToneSpec = {
  // OKLCH lightness.
  l: Range
  // Share of the brand's chroma, itself capped at the recipe's maxChroma.
  c: Range
  // Degrees of hue the tone may turn. Shadows turn cool, highlights warm: a
  // ramp that keeps one hue looks printed flat.
  turn?: number
}

type ThemeSpec = Record<Exclude<Tone, "accent" | "partner">, ToneSpec> & {
  // Drawn at the brand's colour partner. Without it the tone is `body`.
  partner?: ToneSpec
}

export type PaletteSpec = {
  maxChroma: number
  light: ThemeSpec
  dark: ThemeSpec
  // The least chroma the partner may have. Without it, a grey brand's partner
  // is grey too, and a style built on a pair of colours goes flat.
  partnerFloor?: number
  // The accent is the brand colour itself, moved only as far as these
  // lightness limits need so that it can be seen on the ground.
  accent: { light: Range; dark: Range }
}

const COOL = 265
const WARM = 85
const RED = 40

// How a second colour is chosen beside a brand's, from what is known of
// colour pairs (docs/colour.md has the sources):
// - Harmony rises as two hues come closer (Schloss & Palmer 2011): a calm
//   brand takes a neighbour, 25 to 65 degrees round the wheel.
// - Contrast is for a second colour that stands out: a bold brand takes one
//   85 to 155 degrees away, warm against cool where it can, and never the
//   opposite hue, which inks mix to mud (Munsell).
// - Where two inks print over each other, as in Riso and Screenprint, the
//   pair has to overprint as a colour, not a grey: each is scored by how
//   colourful their overlap stays, and the partner is a real riso ink, as a
//   print shop would load.
// - A yellow is only yellow when light, so a style that draws its partner
//   at a middling lightness takes none.
const NEIGHBOUR: readonly [number, number] = [25, 65]
const CONTRAST: readonly [number, number] = [85, 155]
const WARM_HUES = (h: number) => h >= 20 && h <= 115
const COOL_HUES = (h: number) => h >= 170 && h <= 300

// Riso inks with a colour of their own, as print shops list them.
export const RISO_INKS: readonly (readonly [string, string])[] = [
  ["Blue", "#0078bf"], ["Medium Blue", "#3255a4"], ["Federal Blue", "#3d5588"], ["Cornflower", "#62a8e5"],
  ["Aqua", "#5ec8e5"], ["Teal", "#00838a"], ["Light Teal", "#009da5"], ["Mint", "#82d8d5"],
  ["Turquoise", "#00aa93"], ["Green", "#00a95c"], ["Kelly Green", "#67b346"], ["Yellow", "#ffe800"],
  ["Sunflower", "#ffb511"], ["Flat Gold", "#bb8b41"], ["Orange", "#ff6c2f"], ["Fluorescent Orange", "#ff7477"],
  ["Bright Red", "#f15060"], ["Crimson", "#e45d50"], ["Fluorescent Pink", "#ff48b0"], ["Bubble Gum", "#f984ca"],
  ["Violet", "#9d7ad2"], ["Purple", "#765ba7"], ["Orchid", "#aa60bf"], ["Burgundy", "#914e72"],
]

// Two inks printed one over the other, light passing through both: their
// transmittances multiply, in linear light, as a thin ink layer's do. On a
// dark ground the inks are light on dark, and add as a screen does.
/** How colourful the overlap of two inks stays, light and dark both: low is mud. */
export function overprint(a: string, b: string) {
  const [x, y] = [linearRgb(a), linearRgb(b)]
  const over = toOklch(fromLinear(x.map((c, i) => c * y[i]!)))
  const lit = toOklch(fromLinear(x.map((c, i) => 1 - (1 - c) * (1 - y[i]!))))
  return Math.min(over.c, lit.c * 1.4)
}

const isRed = (h: number) => h < 50 || h > 345
const isGreen = (h: number) => h >= 120 && h <= 175
const apartOf = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
const isHex = (color: unknown): color is string => typeof color === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)
const full = (hex: string) => (hex.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex).toLowerCase()

export type PartnerOptions = {
  /** The style it is for: an overprinting style (riso, screenprint) takes real riso inks whose overlap with the brand's stays a colour. */
  style?: string
  /** "calm" takes a neighbouring hue, "bold" a contrasting one; left out, either. */
  mood?: "calm" | "bold"
}

/**
 * The second colours that sit well beside a brand colour, as hex, best first:
 * two or three to offer as choices, the ones a brand picks its partner from.
 * A calm brand gets neighbours, a bold one contrasts, warm against cool; for
 * a style that overprints its inks, real riso inks that overlap cleanly.
 *
 *   partners("#0078bf")                      // a violet, a teal, a pink…
 *   partners("#f59e0b", { style: "riso" })   // riso inks that overprint amber cleanly
 */
export function partners(color: string, options: PartnerOptions = {}): string[] {
  if (!isHex(color)) throw new Error(`partners() takes the brand's hex colour, such as "#635bff", got ${JSON.stringify(color)}`)
  const brand = toOklch(color)
  const grey = brand.c < 0.03
  const print = options.style === "riso" || options.style === "screenprint"
  const ranges = options.mood === "calm" ? [NEIGHBOUR] : options.mood === "bold" ? [CONTRAST] : [NEIGHBOUR, CONTRAST]
  // Every candidate hue, as a print shop's ink or as a colour drawn for it.
  const candidates = print
    ? RISO_INKS.map(([, hex]) => ({ hex, h: toOklch(hex).h, c: toOklch(hex).c }))
    : Array.from({ length: 36 }, (_, i) => i * 10)
        .filter((h) => !(h >= 80 && h <= 120))
        .map((h) => ({ hex: fromOklch({ l: 0.7, c: 0.16, h }), h, c: 0.16 }))
  const scored = candidates
    // A weak ink (a flat gold, a grey) prints brown beside a colour, and a
    // yellow ink reads as olive in a stipple: neither is offered.
    .filter((one) => one.c >= (print ? 0.12 : 0.08) && !(print && one.h >= 95 && one.h <= 115) && full(one.hex) !== full(color))
    .map((one) => {
      const apart = grey ? 120 : apartOf(one.h, brand.h)
      const within = ranges.some(([low, high]) => apart >= low && apart <= high)
      const near = apart <= NEIGHBOUR[1]
      // Neighbours are best near the middle of their range; contrasts near 120.
      let score = near ? 1 - Math.abs(apart - 45) / 40 : 1 - Math.abs(apart - 120) / 60
      if (!near && ((WARM_HUES(brand.h) && COOL_HUES(one.h)) || (COOL_HUES(brand.h) && WARM_HUES(one.h)))) score += 0.25
      const overlap = print ? overprint(full(color), one.hex) : 0.12
      if (print) score = score * 0.5 + Math.min(1, overlap / 0.12) * 0.5
      return { ...one, within, score, overlap }
    })
    // Red against green is the pair a colour-blind reader, about one man in
    // twelve, can't tell apart: never offered.
    .filter((one) => !(isRed(brand.h) && isGreen(one.h)) && !(isGreen(brand.h) && isRed(one.h)))
    .filter((one) => (grey || one.within) && one.overlap >= 0.06)
    .sort((a, b) => b.score - a.score)
  const picked: typeof scored = []
  for (const one of scored) if (picked.length < 3 && picked.every((other) => apartOf(other.h, one.h) >= 30)) picked.push(one)
  return picked.map((one) => full(one.hex))
}

// Without a brand to pick it, the colour does, so the same colour always
// gets the same partner.
const pickHue = (color: string) => {
  const each = partners(full(color))
  return toOklch(each[hash(`${color.toLowerCase()}/partner`) % each.length] ?? "#e58212").h
}

/**
 * A partner for a colour, as hex, picked by `key`, the brand's name, among
 * `partners(color, options)`, so a brand keeps one on all its covers.
 */
export function partnerFor(color: string, key: string, options: PartnerOptions = {}): string {
  const each = partners(color, options)
  return each[hash(`${key}/partner`) % each.length] ?? partners(color)[0]!
}

export const BASE_PALETTE: PaletteSpec = {
  maxChroma: 0.17,
  light: {
    ground: { l: [0.965, 0.98], c: [0.08, 0.14] },
    quiet: { l: [0.93, 0.95], c: [0.16, 0.22] },
    soft: { l: [0.85, 0.89], c: [0.38, 0.48] },
    body: { l: [0.68, 0.75], c: [0.8, 1] },
    strong: { l: [0.38, 0.45], c: [0.8, 1], turn: 16 },
    ink: { l: [0.18, 0.21], c: [0.32, 0.42], turn: 10 },
  },
  dark: {
    ground: { l: [0.145, 0.175], c: [0.14, 0.22], turn: 8 },
    quiet: { l: [0.2, 0.235], c: [0.22, 0.3], turn: 8 },
    soft: { l: [0.3, 0.36], c: [0.45, 0.6], turn: 8 },
    body: { l: [0.5, 0.58], c: [0.8, 1] },
    strong: { l: [0.76, 0.84], c: [0.55, 0.75], turn: -10 },
    ink: { l: [0.96, 0.98], c: [0.04, 0.08] },
  },
  accent: { light: [0.5, 0.74], dark: [0.62, 0.84] },
}

function tone(
  brand: { c: number; h: number },
  spec: ToneSpec,
  maxChroma: number,
  rng: Rng,
  fixedHue?: number,
  floor = 0
) {
  const l = rng.between(spec.l)
  const share = rng.between(spec.c)
  const chroma = Math.max(Math.min(brand.c, maxChroma) * share, floor)
  const turn = spec.turn ?? 0
  // Yellow has no dark form at its own hue, only olive, so its shadows go
  // toward red instead of toward blue, and further, before they read as one.
  const yellow = brand.h > 70 && brand.h < 125 && l < 0.55
  const h = yellow
    ? turnToward(brand.h, RED, Math.abs(turn) * 3)
    : turn > 0
      ? turnToward(brand.h, COOL, turn)
      : turnToward(brand.h, WARM, -turn)
  return fromOklch({ l, c: chroma, h: fixedHue ?? h })
}

// A partner the brand gave, or picked for it: drawn at its own hue and as
// strong as it is (a grey stays grey), and at its own lightness as near as
// the style allows. A pair reads best with a moderate gap in lightness (Ou &
// Luo), so it is held within a reach of the lightness the style keeps for
// its partner and kept clear of the ground, where it would vanish. On a dark
// ground a strong colour vibrates, so there it is drawn a little lighter and
// softer, as dark themes do with accents. The same fork as a chosen one, so
// giving one recolours and moves nothing else.
const REACH = 0.12
const CLEAR = 0.22
function partnerGiven(partner: { l: number; c: number; h: number }, spec: ToneSpec, palette: PaletteSpec, rng: Rng, dark: boolean, ground: number) {
  const grey = partner.c < 0.03
  const own = rng.fork("partner")
  const share = own.between(spec.c) * (dark ? 0.94 : 1)
  let l = clamp(dark ? partner.l + 0.08 : partner.l, spec.l[0] - REACH, spec.l[1] + REACH)
  if (Math.abs(l - ground) < CLEAR) l = dark ? ground + CLEAR : ground - CLEAR
  const c = Math.max(Math.min(partner.c, palette.maxChroma) * share, grey ? 0 : palette.partnerFloor ?? 0)
  return fromOklch({ l: clamp(l, 0.2, 0.95), c, h: partner.h })
}

export function makePalette(
  color: string,
  theme: Theme,
  spec: PaletteSpec,
  rng: Rng,
  // The brand's own second colour. Only its hue and how strong it is are
  // used: each style keeps the lightness it was judged at, so a given colour
  // can't make a seed unreadable.
  given?: string
): Palette {
  const brand = toOklch(color)
  const tones = spec[theme]
  // A fixed order, one fork per tone: both themes draw alike and a change to
  // one tone leaves the others where they were.
  const make = (name: Exclude<Tone, "accent" | "partner">) =>
    tone(brand, tones[name], spec.maxChroma, rng.fork(name))
  const [low, high] = spec.accent[theme]
  const accent =
    brand.l >= low && brand.l <= high
      ? color.toLowerCase()
      : fromOklch({
          l: clamp(brand.l, low, high),
          c: lerp(brand.c, Math.min(brand.c, spec.maxChroma), 0.5),
          h: brand.h,
        })
  // A dark ground in a warm hue reads as brown, and sinks the colour on it,
  // so an orange, amber or yellow brand prints on a near-black instead: the
  // colour glows on it, as it does on a night sky. It keeps most of its tint, so
  // on a site's own near-black page the cover still has an edge. Cool hues
  // keep their tint.
  const warm = theme === "dark" && brand.h > 35 && brand.h < 115
  const deep = (name: "ground" | "quiet") =>
    warm ? tone(brand, { ...tones[name], c: [tones[name].c[0] * 0.7, tones[name].c[1] * 0.7] }, spec.maxChroma, rng.fork(name)) : make(name)
  const ground = deep("ground")
  return {
    ground,
    quiet: deep("quiet"),
    soft: make("soft"),
    body: make("body"),
    strong: make("strong"),
    accent,
    partner: tones.partner
      ? given
        ? partnerGiven(toOklch(given), tones.partner, spec, rng, theme === "dark", toOklch(ground).l)
        : tone(
          brand,
          tones.partner,
          spec.maxChroma,
          rng.fork("partner"),
          // Without a brand to pick it, the colour does: the same colour
          // always gets the same partner, a little further round or back on
          // each cover. A grey brand pairs with amber or teal.
          ((spec.partnerFloor && brand.c < 0.03 ? 60 : pickHue(color)) +
            rng.fork("partner-hue").between([-8, 8]) +
            360) %
            360,
          spec.partnerFloor ?? 0
        )
      : make("body"),
    ink: make("ink"),
  }
}
