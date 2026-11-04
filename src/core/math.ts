// Every function here gives the same bits in every engine. The language leaves
// Math.sin, Math.cos, Math.pow, Math.cbrt, Math.atan2, Math.hypot, Math.exp and
// Math.log to each engine's approximation, so the same seed could draw
// differently on the server and in the browser. These stick to + - * /,
// Math.sqrt and rounding, and test/exact-math.test.ts bans the rest from src.

export const PI = 3.141592653589793
export const TAU = 2 * PI

export const clamp = (x: number, low: number, high: number) =>
  Math.min(high, Math.max(low, x))

export const lerp = (from: number, to: number, t: number) =>
  from + (to - from) * t

export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

export const radians = (degrees: number) => (degrees / 180) * PI

export function sin(angle: number) {
  // Folded into [-PI/2, PI/2], where the Taylor series is good to 1e-7.
  let x = angle - Math.floor(angle / TAU + 0.5) * TAU
  if (x > PI / 2) x = PI - x
  else if (x < -PI / 2) x = -PI - x
  const y = x * x
  return (
    x *
    (1 +
      y *
        (-1 / 6 +
          y *
            (1 / 120 +
              y * (-1 / 5040 + y * (1 / 362880 + y * (-1 / 39916800))))))
  )
}

export const cos = (angle: number) => sin(angle + PI / 2)

function atan(value: number): number {
  if (value < 0) return -atan(-value)
  if (value > 1) return PI / 2 - atan(1 / value)
  // Two half-angle steps bring it under 0.2, where the series is short.
  let x = value / (1 + Math.sqrt(1 + value * value))
  x = x / (1 + Math.sqrt(1 + x * x))
  const y = x * x
  return (
    4 *
    x *
    (1 +
      y *
        (-1 / 3 +
          y *
            (1 / 5 +
              y * (-1 / 7 + y * (1 / 9 + y * (-1 / 11 + y * (1 / 13)))))))
  )
}

export function atan2(y: number, x: number) {
  if (x > 0) return atan(y / x)
  if (x < 0) return atan(y / x) + (y >= 0 ? PI : -PI)
  if (y > 0) return PI / 2
  if (y < 0) return -PI / 2
  return 0
}

// A fixed count of Newton steps from 1, enough for the smallest colour values
// this library ever feeds it.
function root(x: number, degree: number) {
  if (x <= 0) return 0
  let y = 1
  for (let step = 0; step < 64; step++) {
    let power = 1
    for (let i = 1; i < degree; i++) power *= y
    y = ((degree - 1) * y + x / power) / degree
  }
  return y
}

export const cubeRoot = (x: number) => root(x, 3)

// x^2.4, the sRGB curve: x^2 * (x^2)^(1/5).
export const powSrgb = (x: number) => x * x * root(x * x, 5)

// x^(1/2.4) = x^(5/12) = x^(2/3) / x^(1/4).
export const rootSrgb = (x: number) => {
  if (x <= 0) return 0
  const third = cubeRoot(x)
  return (third * third) / Math.sqrt(Math.sqrt(x))
}
