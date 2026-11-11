import { fromOklch, toOklch, turnToward } from "./color.ts"
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

// Each stretch of the hue circle and the hues that look best beside it, as
// a printer would pair two inks: judged by eye, not by the colour wheel,
// since a true complement is often muddy where the inks overlap. Blue takes
// a fluorescent pink, a coral or an aqua; teal a coral, a violet or a pink;
// green a pink, a blue or a coral. A brand's name picks one of them (see
// partnerFor), so two blue brands are not alike. No yellow yet: drawn at the
// lightness a style keeps for its partner, a yellow prints as khaki.
const PARTNERS: readonly (readonly [number, readonly number[]])[] = [
  [40, [255, 195]], // reds: blue, teal
  [75, [300, 195, 350]], // oranges: violet, teal, pink
  [125, [260, 300, 25]], // yellows: blue, violet, red
  [165, [350, 255, 25]], // greens: pink, blue, coral
  [215, [20, 300, 350]], // teals: coral, violet, pink
  [280, [355, 25, 195]], // blues: fluorescent pink, coral, aqua
  [330, [35, 185]], // violets: coral, teal
  [360, [195, 250]], // magentas: teal, blue
]

/** The partner hues that sit well beside a colour, best first. A grey has no hue to pair against, so it pairs with amber or teal. */
export function partnerHues(color: string): readonly number[] {
  const brand = toOklch(color)
  if (brand.c < 0.03) return [60, 195]
  return PARTNERS.find(([upTo]) => brand.h < upTo)?.[1] ?? [195]
}

/**
 * A partner for a colour, as hex, picked among the hues that sit well beside
 * it by `key`: the brand's name, so a brand keeps one partner on all its
 * covers. Each style draws it at its own lightness; this sets the hue and
 * how strong it is.
 */
const pickHue = (color: string) => {
  const hues = partnerHues(color)
  return hues[hash(`${color.toLowerCase()}/partner`) % hues.length]!
}

export function partnerFor(color: string, key: string): string {
  const hues = partnerHues(color)
  const hue = hues[hash(`${key}/partner`) % hues.length]!
  return fromOklch({ l: 0.7, c: 0.16, h: hue })
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

// A partner the brand gave: drawn at its own hue, as strong as it is (a grey
// partner stays grey), at the lightness the style keeps for its partner. The
// same fork as a chosen one, so giving one recolours and moves nothing else.
function partnerGiven(partner: { c: number; h: number }, spec: ToneSpec, palette: PaletteSpec, rng: Rng) {
  const grey = partner.c < 0.03
  return tone(partner, spec, palette.maxChroma, rng.fork("partner"), partner.h, grey ? 0 : palette.partnerFloor ?? 0)
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
  // colour glows on it, as it does on a night sky. Cool hues keep their tint.
  const warm = theme === "dark" && brand.h > 35 && brand.h < 115
  const deep = (name: "ground" | "quiet") =>
    warm ? tone(brand, { ...tones[name], c: [tones[name].c[0] * 0.3, tones[name].c[1] * 0.3] }, spec.maxChroma, rng.fork(name)) : make(name)
  return {
    ground: deep("ground"),
    quiet: deep("quiet"),
    soft: make("soft"),
    body: make("body"),
    strong: make("strong"),
    accent,
    partner: tones.partner
      ? given
        ? partnerGiven(toOklch(given), tones.partner, spec, rng)
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
