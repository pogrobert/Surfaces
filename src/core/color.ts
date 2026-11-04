import {
  atan2,
  clamp,
  cos,
  cubeRoot,
  powSrgb,
  radians,
  rootSrgb,
  sin,
  TAU,
} from "./math.ts"

export type Oklch = { l: number; c: number; h: number }

type Rgb = readonly [number, number, number]

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export function parseHex(color: string): Rgb {
  if (!HEX.test(color)) {
    throw new Error(`Expected a hex colour such as #635bff, got "${color}"`)
  }
  const digits =
    color.length === 4
      ? [...color.slice(1)].map((digit) => digit + digit).join("")
      : color.slice(1)
  return [
    parseInt(digits.slice(0, 2), 16) / 255,
    parseInt(digits.slice(2, 4), 16) / 255,
    parseInt(digits.slice(4, 6), 16) / 255,
  ]
}

const toLinear = (channel: number) =>
  channel <= 0.04045
    ? channel / 12.92
    : powSrgb((channel + 0.055) / 1.055)

const toGamma = (channel: number) =>
  channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * rootSrgb(channel) - 0.055

function toByte(channel: number) {
  return Math.round(clamp(channel, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0")
}

function linearOf(color: string): Rgb {
  const [r, g, b] = parseHex(color)
  return [toLinear(r), toLinear(g), toLinear(b)]
}

export function toOklch(color: string): Oklch {
  const [r, g, b] = linearOf(color)
  const l = cubeRoot(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = cubeRoot(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = cubeRoot(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const hue = atan2(bb, a)
  return {
    l: lightness,
    c: Math.sqrt(a * a + bb * bb),
    h: ((hue < 0 ? hue + TAU : hue) / TAU) * 360,
  }
}

function linearFromOklch({ l, c, h }: Oklch): Rgb {
  const a = c * cos(radians(h))
  const b = c * sin(radians(h))
  const ll = l + 0.3963377774 * a + 0.2158037573 * b
  const mm = l - 0.1055613458 * a - 0.0638541728 * b
  const ss = l - 0.0894841775 * a - 1.291485548 * b
  const lc = ll * ll * ll
  const mc = mm * mm * mm
  const sc = ss * ss * ss
  return [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ]
}

const inGamut = (rgb: Rgb) =>
  rgb.every((channel) => channel >= -0.0005 && channel <= 1.0005)

// Colours outside sRGB keep their lightness and hue and give up chroma.
export function fromOklch(color: Oklch) {
  let rgb = linearFromOklch(color)
  if (!inGamut(rgb)) {
    let low = 0
    let high = color.c
    for (let step = 0; step < 14; step++) {
      const c = (low + high) / 2
      if (inGamut(linearFromOklch({ ...color, c }))) low = c
      else high = c
    }
    rgb = linearFromOklch({ ...color, c: low })
  }
  return `#${toByte(toGamma(rgb[0]))}${toByte(toGamma(rgb[1]))}${toByte(toGamma(rgb[2]))}`
}

export function luminance(color: string) {
  const [r, g, b] = linearOf(color)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contrastOfLuminance = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

export const contrast = (a: string, b: string) =>
  contrastOfLuminance(luminance(a), luminance(b))

// The shortest way round the hue circle from `hue` toward `target`.
export function turnToward(hue: number, target: number, degrees: number) {
  const gap = ((target - hue + 540) % 360) - 180
  const turn = clamp(gap, -Math.abs(degrees), Math.abs(degrees))
  return (hue + turn + 360) % 360
}
