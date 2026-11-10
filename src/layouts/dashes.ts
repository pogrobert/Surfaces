import { clamp, cos, radians, sin, smoothstep, TAU } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Mark, Tone } from "../core/scene.ts"
import { behind, boundsOf, circle, keptClear } from "../grammar/kit.ts"
import type { Points } from "../grammar/kit.ts"
import { seated } from "../grammar/seated.ts"
import { inflate } from "./geometry.ts"
import { clearing } from "./stage.ts"

// A form made only of short level dashes in rows, as a plotter or a weather
// map draws one: where the form rises the dashes run longer, heavier and
// deeper in tone, and where it falls away they shrink to specks and stop.
// Each row is pushed a little sideways by a slow drift, so the rows ripple
// like heat over ground. A lit orb, a cumulus cloud, two ranges of hills in
// mist, or a field of relief across the whole sheet.

export const SUBJECTS = ["orb", "cloud", "hills", "field"] as const
export type Subject = (typeof SUBJECTS)[number]

export type DashParams = {
  size: number
  // Rows of dashes across the subject.
  rows: number
  // How far a row drifts sideways, as a share of a dash's cell.
  drift: number
  // Where the light comes from, for the orb, in degrees.
  light: number
}

// Three weights of dash, each its own tone, deeper as the form rises.
const WEIGHTS: readonly { tone: Tone; share: number }[] = [
  { tone: "body", share: 0.2 },
  { tone: "accent", share: 0.32 },
  { tone: "strong", share: 0.46 },
]

// A slow, smooth wander of a few waves, -1 to 1.
function wander(rng: Frame["rng"], scale: number, count = 3) {
  const waves = Array.from({ length: count }, (_, i) => {
    const a = rng.next() * TAU
    const k = (TAU / scale) * rng.between([0.6, 1.3]) * (1 + i * 0.7)
    return { kx: cos(a) * k, ky: sin(a) * k, phase: rng.next() * TAU, amp: 1 / (1 + i * 0.8) }
  })
  const total = waves.reduce((sum, wave) => sum + wave.amp, 0)
  return (x: number, y: number) => waves.reduce((sum, wave) => sum + wave.amp * sin(wave.kx * x + wave.ky * y + wave.phase), 0) / total
}

export function dashes(frame: Frame, subject: Subject, p: DashParams): Art {
  const { w, h, titled, keep, rng } = frame
  const draw = rng.fork("dashes")
  const stage = frame.fill ? { area: { x: 0, y: 0, w, h }, away: { x: 0, y: -1 } } : clearing(frame)
  const seat = seated(frame, stage, p.size, draw)
  const first = behind(frame, seat.side, 0.85)
  // The subject's round fitted clear of the title, and drawn wherever and
  // however large that leaves it.
  // Hills stand in a wide box, to its corners; the rest stay inside a round.
  const half = first / 2
  const [hw, hh] = [half * 1.4, half * 0.8]
  const outline = subject === "hills" ? [seat.x - hw, seat.y - hh, seat.x + hw, seat.y - hh, seat.x + hw, seat.y + hh, seat.x - hw, seat.y + hh] : circle(seat.x, seat.y, half, 72)
  const [fitted] = subject === "field" ? [outline] : (keptClear(frame, [outline], stage.away) as [Points])
  const at = boundsOf(fitted)
  const side = first * (at.w / boundsOf(outline).w)
  const cx = at.x + at.w / 2
  const cy = at.y + at.h / 2
  const r = side / 2

  // The rows are spaced by the subject, or for a field by the whole sheet's
  // area, so a thin strip is no denser than a card.
  const pitch = subject === "field" ? Math.sqrt(w * h) / p.rows : side / p.rows
  const cell = pitch * 1.9
  // Where words go, no dash is drawn. Round it the drawing thins out as it
  // does at a form's own edges: over a few rows fewer and fewer dashes are
  // drawn, and more of those that are become pale specks, so the words stand
  // in a clearing with a ragged edge of the drawing's own making, and not in
  // a box cut out of it. `beside` is how far in that goes at a point: 0 at
  // the words, 1 where the drawing is whole.
  const clear = [...(titled ? inflate(keep, pitch * 0.5) : []), ...inflate(frame.calm, pitch * 0.5)]
  const onTitle = (x0: number, x1: number, y: number) => clear.some((b) => x1 > b.x && x0 < b.x + b.w && y > b.y - pitch * 0.5 && y < b.y + b.h)
  const fade = pitch * 9
  const beside = (x: number, y: number) => {
    let most = 1
    for (const b of clear) {
      const dx = Math.max(b.x - x, 0, x - (b.x + b.w))
      const dy = Math.max(b.y - y, 0, y - (b.y + b.h))
      most = Math.min(most, smoothstep(clamp(Math.sqrt(dx * dx + dy * dy) / fade, 0, 1)))
    }
    return most
  }

  // How high the form stands at a point, 0 to 1: the dashes follow it.
  let height: (x: number, y: number) => number
  let region: Box
  if (subject === "orb") {
    // A sphere lit from one side, its dark side falling to nothing.
    const a = radians(p.light)
    const [lx, ly, lz] = [cos(a) * 0.62, sin(a) * 0.62, 0.48]
    height = (x, y) => {
      const u = (x - cx) / (r * 0.9)
      const v = (y - cy) / (r * 0.9)
      const d = u * u + v * v
      if (d >= 1) return 0
      const lit = Math.max(0, u * lx + v * ly + Math.sqrt(1 - d) * lz)
      return clamp(0.1 + lit * 0.95, 0, 1) * smoothstep(clamp((1 - d) * 14, 0, 1))
    }
    region = { x: cx - r, y: cy - r, w: side, h: side }
  } else if (subject === "cloud") {
    // A cumulus: a long flat base of small puffs side by side, and larger
    // ones heaped over the middle, each its own round, so the top reads as
    // a row of separate billows and never as one dome.
    const base = cy + r * 0.36
    const puffs: { x: number; y: number; s: number }[] = []
    const low = draw.int(4, 5)
    for (let i = 0; i < low; i++) {
      const t = (i + 0.5) / low - 0.5
      puffs.push({ x: cx + t * r * 1.62 + draw.between([-0.04, 0.04]) * r, y: base - r * 0.17, s: r * draw.between([0.14, 0.18]) })
    }
    const high = draw.int(3, 4)
    for (let i = 0; i < high; i++) {
      const t = (i + 0.5) / high - 0.5
      const middle = 1 - Math.abs(t) * 1.6
      puffs.push({ x: cx + t * r * 1.05 + draw.between([-0.05, 0.05]) * r, y: base - r * (0.38 + middle * draw.between([0.2, 0.34])), s: r * draw.between([0.17, 0.23]) })
    }
    height = (x, y) => {
      // Each puff a round with a soft edge; the cloud is the most any one
      // gives, so the billows keep their own outlines.
      let most = 0
      for (const puff of puffs) most = Math.max(most, 1 - Math.sqrt((x - puff.x) * (x - puff.x) + (y - puff.y) * (y - puff.y)) / (puff.s * 1.55))
      const body = smoothstep(clamp(most * 4, 0, 1))
      const foot = y > base ? 0 : smoothstep(clamp((base - y) / (r * 0.05), 0, 1))
      // Lit from above: the tops fuller than the shade along the base.
      const top = clamp(0.4 + (base - y) / (r * 0.8), 0.3, 1)
      return body * foot * top
    }
    region = { x: cx - r, y: cy - r, w: side, h: side }
  } else if (subject === "hills") {
    // Two ranges standing on the foot of a wide box: the far one paler and
    // higher, the near one full, each solid from its crest down, as land
    // is, with a little mist where the far range meets the near.
    const [bw, bh] = [r * 1.4, r * 0.8]
    // Each crest sinks to the ground toward the ends of the box, so a range
    // slopes away at its ends instead of stopping at a wall.
    const ground = cy + bh
    const ridge = (low: number, rise: number, seed: string, reach: number) => {
      const line = wander(draw.fork(seed), bw * 1.1, 3)
      return (x: number) => {
        const crest = cy + bh * low - (0.5 + 0.5 * line(x, 0)) * bh * rise
        const envelope = smoothstep(clamp((1 - Math.abs((x - cx) / bw)) * reach, 0, 1))
        return ground - (ground - crest) * envelope
      }
    }
    const far = ridge(0.1, 0.85, "far", 1.6)
    const near = ridge(0.62, 0.62, "near", 2.4)
    height = (x, y) => {
      const du = (x - cx) / bw
      if (Math.abs(du) > 1 || y > cy + bh) return 0
      const n = near(x)
      if (y >= n) return 0.78 + 0.22 * clamp(1 - (y - n) / (bh * 0.25), 0, 1)
      const f = far(x)
      if (y >= f) return 0.42 - 0.14 * clamp((y - f) / (n - f + 1), 0, 1)
      return 0
    }
    region = { x: cx - bw, y: cy - bh, w: bw * 2, h: bh * 2 }
  } else {
    // Relief across the whole sheet, read as a map reads it: in terraces,
    // each a step higher, the highest heaviest.
    const relief = wander(draw.fork("relief"), Math.max(w, h) * 0.9, 4)
    height = (x, y) => {
      const raw = 0.5 + 0.5 * relief(x, y)
      return clamp(Math.round(raw * 5) / 5, 0.12, 1)
    }
    region = { x: 0, y: 0, w, h }
  }

  // Every row drifts sideways by a slow wave, so the rows ripple; each
  // dash a little longer or shorter than its neighbour.
  const drift = wander(draw.fork("drift"), Math.max(region.w, region.h) * 0.7, 2)
  const jitter = draw.fork("jitter")
  // Which dashes thin out beside the words: a stream of its own, drawn from
  // for every dash whether or not there are words, so a title thins the
  // drawing round it and moves nothing else in it.
  const thin = draw.fork("thin")
  const rows = WEIGHTS.map(() => [] as number[])
  const specks: number[] = []
  const speck = pitch * 0.14
  const top = Math.max(region.y, 0)
  const foot = Math.min(region.y + region.h, h)
  const left = Math.max(region.x, 0)
  const right = Math.min(region.x + region.w, w)
  for (let y = top + pitch * 0.5; y < foot; y += pitch) {
    // Each row starts where its drift and a step of its own put it, so the
    // dashes never line up in columns.
    const shift = (drift(left, y) * p.drift + jitter.next()) * cell
    for (let x = left - cell * 2 + (((shift % cell) + cell) % cell); x < right; x += cell) {
      const mx = x + cell / 2 + jitter.between([-0.14, 0.14]) * cell
      const level = height(mx, y)
      const chance = thin.next()
      const whole = beside(mx, y)
      // Nearer the words, fewer are drawn at all.
      if (level < 0.08 || chance > whole) {
        jitter.next()
        continue
      }
      // And of those, the nearer ones are specks: short, thin and pale.
      const faint = chance > whole * whole
      const length = cell * (faint ? 0.14 + whole * 0.2 : clamp((0.18 + level * 0.74) * jitter.between([0.7, 1.15]), 0.12, 0.96))
      if (faint) jitter.next()
      const x0 = Math.max(mx - length / 2, 0)
      const x1 = Math.min(mx + length / 2, w)
      if (x1 - x0 < pitch * 0.2 || onTitle(x0, x1, y)) continue
      if (faint) {
        specks.push(Math.round(x0 * 2) / 2, Math.round((y - speck / 2) * 2) / 2, Math.round((x1 - x0) * 2) / 2)
        continue
      }
      const k = level < 0.36 ? 0 : level < 0.7 ? 1 : 2
      const thick = pitch * WEIGHTS[k]!.share
      rows[k]!.push(Math.round(x0 * 2) / 2, Math.round((y - thick / 2) * 2) / 2, Math.round((x1 - x0) * 2) / 2)
    }
  }
  const marks: Mark[] = [
    ...(specks.length ? [{ kind: "shapes", id: "dashes-specks", paint: { type: "solid", tone: "body", opacity: 0.55 }, shapes: [{ type: "blocks", h: speck, points: specks }] } satisfies Mark] : []),
    ...WEIGHTS.flatMap(({ tone, share }, k): Mark[] =>
      rows[k]!.length ? [{ kind: "shapes", id: `dashes-${tone}`, paint: { type: "solid", tone, opacity: 1 }, shapes: [{ type: "blocks", h: pitch * share, points: rows[k]! }] }] : []
    ),
  ]

  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks,
    over: [],
    ...(subject === "field" ? null : { subject: region }),
  }
}
