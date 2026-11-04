import { fromOklch, toOklch, turnToward } from "./color.ts"
import { clamp, lerp } from "./math.ts"
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

// Each stretch of the hue circle and the hue it looks best beside, judged by
// eye rather than by the colour wheel: a true complement is often muddy.
const PARTNERS: readonly (readonly [number, number])[] = [
  [40, 195], // reds with teal
  [75, 235], // oranges with slate blue
  [125, 195], // yellows with teal
  [165, 75], // greens with amber
  [215, 45], // teals with rust
  [280, 60], // blues with peach
  [330, 35], // violets with coral
  [360, 195], // magentas with teal
]

const partnerOf = (hue: number) =>
  PARTNERS.find(([upTo]) => hue < upTo)?.[1] ?? 195

export const BASE_PALETTE: PaletteSpec = {
  maxChroma: 0.17,
  light: {
    ground: { l: [0.965, 0.98], c: [0.08, 0.14] },
    quiet: { l: [0.93, 0.95], c: [0.16, 0.22] },
    soft: { l: [0.85, 0.89], c: [0.38, 0.48] },
    body: { l: [0.68, 0.75], c: [0.8, 1] },
    strong: { l: [0.38, 0.45], c: [0.8, 1], turn: 16 },
    ink: { l: [0.18, 0.21], c: [0.12, 0.2], turn: 10 },
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

export function makePalette(
  color: string,
  theme: Theme,
  spec: PaletteSpec,
  rng: Rng
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
  return {
    ground: make("ground"),
    quiet: make("quiet"),
    soft: make("soft"),
    body: make("body"),
    strong: make("strong"),
    accent,
    partner: tones.partner
      ? tone(
          brand,
          tones.partner,
          spec.maxChroma,
          rng.fork("partner"),
          // A grey brand has no hue to pair against, so it pairs with amber.
          ((spec.partnerFloor && brand.c < 0.03 ? 60 : partnerOf(brand.h)) +
            rng.fork("partner-hue").between([-10, 10]) +
            360) %
            360,
          spec.partnerFloor ?? 0
        )
      : make("body"),
    ink: make("ink"),
  }
}
