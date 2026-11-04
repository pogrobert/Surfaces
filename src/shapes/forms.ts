import { clamp, cos, lerp, PI, sin, smoothstep, TAU } from "../core/math.ts"
import type { Rng } from "../core/random.ts"
import type { Box } from "../core/scene.ts"
import type { LineForm } from "../layouts/lines.ts"
import { center } from "../layouts/geometry.ts"
import type { Keep } from "../layouts/geometry.ts"
import { seat } from "./subjects.ts"

// Forms drawn by lines alone, the way an engraver models a surface: the lines
// bend over it and swell where it turns from the light.
export const FORMS = ["orb", "wave", "arc", "column", "ripple"] as const
export type Form = (typeof FORMS)[number]

export type FormStage = {
  w: number
  h: number
  // Every box kept clear for content.
  safe: Keep
  area: Box
  away: { x: number; y: number }
  // The angle the light comes from.
  lit: number
  size: number
  bulge: number
  rng: Rng
}

export type DrawnForm = LineForm & { subject?: Box }

function orb(stage: FormStage, angle: number): DrawnForm {
  const r = Math.min(stage.area.w, stage.area.h) * 0.5 * stage.size
  const { x: cx, y: cy } = seat(stage, r)
  const lightX = cos(stage.lit)
  const lightY = sin(stage.lit)
  const acrossX = -sin(angle)
  const acrossY = cos(angle)
  return {
    subject: { x: cx - r, y: cy - r, w: r * 2, h: r * 2 },
    shift(x, y) {
      const dx = (x - cx) / r
      const dy = (y - cy) / r
      const inside = dx * dx + dy * dy
      if (inside >= 1) return 0
      // Spread from the middle and bowed like lines of latitude, and both fall
      // to nothing at the rim, so a line leaves the form without a kink.
      const spread = (dx * acrossX + dy * acrossY) * stage.bulge
      return r * (1 - inside) * (spread + 0.18)
    },
    weight(x, y) {
      const dx = (x - cx) / r
      const dy = (y - cy) / r
      const inside = dx * dx + dy * dy
      if (inside >= 1) return 0
      const turned = clamp(0.5 - 0.5 * (dx * lightX + dy * lightY), 0, 1)
      // A rim only a few units soft: crisp as a shape, but a line can't catch
      // it at a different step from its neighbour and leave a saw edge.
      return smoothstep(turned * 1.25) * smoothstep((1 - inside) / 0.07)
    },
  }
}

function wave(stage: FormStage): DrawnForm {
  const { area, away, rng } = stage
  const reach = Math.min(area.w, area.h)
  const middle = center(area)
  const across = { x: -away.y, y: away.x }
  const waves = rng.between([1.1, 1.8])
  const phase = rng.next() * TAU
  const height = reach * stage.bulge * 2
  const span = Math.sqrt(area.w * area.w + area.h * area.h) * 0.7
  // How far along and how far out a point sits, in the area's own terms.
  const place = (x: number, y: number) => ({
    along: ((x - middle.x) * across.x + (y - middle.y) * across.y) / span,
    out: ((x - middle.x) * away.x + (y - middle.y) * away.y) / reach,
  })
  return {
    shift(x, y) {
      const { along, out } = place(x, y)
      const envelope = smoothstep((out + 0.9) / 0.8) * smoothstep(1.7 - Math.abs(along))
      return height * sin(along * PI * waves + phase) * envelope
    },
    weight(x, y) {
      const { along, out } = place(x, y)
      const slope = 0.5 + 0.5 * cos(along * PI * waves + phase + out * 2)
      return slope * slope * smoothstep((out + 0.5) / 0.7)
    },
  }
}

function arc(stage: FormStage): DrawnForm {
  const { w, h, area, away } = stage
  const r = Math.max(w, h) * lerp(0.62, 0.86, clamp(stage.size - 0.9, 0, 1))
  const middle = center(area)
  const rimX = middle.x - away.x * area.w * 0.12
  const rimY = middle.y - away.y * area.h * 0.12
  const cx = rimX + away.x * r
  const cy = rimY + away.y * r
  const depth = Math.min(area.w, area.h) * 0.9
  const inward = (x: number, y: number) => {
    const dx = x - cx
    const dy = y - cy
    return (r - Math.sqrt(dx * dx + dy * dy)) / depth
  }
  return {
    shift(x, y) {
      const t = inward(x, y)
      return t < 0 ? 0 : -depth * stage.bulge * smoothstep(t) * (1 - t * 0.5)
    },
    weight(x, y) {
      const t = inward(x, y)
      // Its rim a few units soft, like the orb's, so lines don't swell in steps.
      return t < 0 ? 0 : (1 - smoothstep(t * 0.9)) * smoothstep(t / 0.03)
    },
  }
}

// One ring raised in relief, as where a drop has landed: the lines lift over
// its crest and sink a little at its middle, and the slope away from the light
// is cut deeper.
function ripple(stage: FormStage, angle: number): DrawnForm {
  const r = Math.min(stage.area.w, stage.area.h) * 0.5 * stage.size
  const { x: cx, y: cy } = seat(stage, r)
  const crest = 0.62
  const width = 0.3
  // Low enough that lines over the crest don't crowd into a smudge.
  const amp = r * stage.bulge * 0.4
  const lx = cos(stage.lit)
  const ly = sin(stage.lit)
  void angle
  // Where a point sits across the crest, from -1 inside to 1 outside.
  const across = (d: number) => (d - crest) / width
  const bump = (t: number) => (Math.abs(t) >= 1 ? 0 : (1 - t * t) * (1 - t * t))
  const dip = (d: number) => 1 - smoothstep(d / 0.4)
  return {
    subject: { x: cx - r, y: cy - r, w: r * 2, h: r * 2 },
    shift(x, y) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy) / r
      if (d >= 1) return 0
      return amp * (bump(across(d)) - 0.3 * dip(d))
    },
    weight(x, y) {
      const dx = (x - cx) / r
      const dy = (y - cy) / r
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d >= 1 || d === 0) return 0
      const t = across(d)
      if (Math.abs(t) >= 1) return 0
      // The outer slope faces out and the inner slope faces in; whichever
      // faces away from the light is in shadow, and steepest is darkest.
      const facing = ((dx * lx + dy * ly) / d) * (t > 0 ? 1 : -1)
      const steep = Math.abs(t) * (1 - t * t) * 2.6
      return clamp(0.5 - 0.6 * facing, 0, 1) * clamp(steep, 0, 1) * 0.75
    },
  }
}

// A column standing in the clear area: the lines bow over it as over a
// cylinder, and darken on the side away from the light.
function column(stage: FormStage, angle: number): DrawnForm {
  const { area, w, h, safe, away } = stage
  const half = Math.min(area.w * 0.32, area.h * 0.6) * stage.size
  const { x: cx } = seat({ area, safe, w, h, away }, half)
  const across = { x: cos(angle), y: sin(angle) }
  const toward = cos(stage.lit) * across.x + sin(stage.lit) * across.y > 0 ? 1 : -1
  return {
    subject: { x: cx - half, y: area.y, w: half * 2, h: area.h },
    shift(x) {
      const u = (x - cx) / half
      if (Math.abs(u) >= 1) return 0
      return half * stage.bulge * 0.9 * Math.sqrt(1 - u * u)
    },
    weight(x) {
      const u = (x - cx) / half
      if (Math.abs(u) >= 1) return 0
      // The rim is a few units soft, so lines don't end in a saw edge.
      return smoothstep(0.5 - 0.6 * u * toward) * smoothstep((1 - u * u) / 0.06)
    },
  }
}

export function drawForm(form: Form, stage: FormStage, angle: number) {
  if (form === "orb") return orb(stage, angle)
  if (form === "ripple") return ripple(stage, angle)
  if (form === "column") return column(stage, angle)
  return form === "wave" ? wave(stage) : arc(stage)
}
