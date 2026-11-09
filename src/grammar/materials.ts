import { clamp, cos, lerp, PI, sin, TAU } from "../core/math.ts"
import type { Rng } from "../core/random.ts"
import type { Box, Mark, Shape, Tone } from "../core/scene.ts"
import { CAP, KEYS } from "./keys.ts"
import type { FillPart } from "./parts.ts"

// Fills made of a material, each painting a box the way that material is
// made: cut into a block, struck on a typewriter, drawn along a current,
// woven, or set in stone.

const distance = (dx: number, dy: number) => Math.sqrt(dx * dx + dy * dy)

const rect = (box: Box): Shape => ({ type: "rect", ...box, radii: [0, 0, 0, 0] })

const solid = (id: string, tone: Tone, shapes: Shape[], opacity = 1): Mark => ({ kind: "shapes", id, paint: { type: "solid", tone, opacity }, shapes })

// Marks gathered by tone, one mark each, in the order the tones came.
function byTone(id: string, items: { tone: Tone; shape: Shape }[], opacity = 1): Mark[] {
  const groups = new Map<Tone, Shape[]>()
  for (const { tone, shape } of items) groups.set(tone, [...(groups.get(tone) ?? []), shape])
  return [...groups].map(([tone, shapes]) => solid(`${id}-${tone}`, tone, shapes, opacity))
}

// A smooth field over the box, -1 to 1: a few slow waves at angles of their
// own, the same for every fill that asks with the same stream.
function field(rng: Rng, box: Box, waves = 4) {
  const side = Math.max(box.w, box.h)
  const parts = Array.from({ length: waves }, (_, i) => {
    const a = rng.next() * TAU
    const k = (TAU / side) * rng.between([0.5, 1.4]) * (1 + i * 0.45)
    return { cx: cos(a) * k, cy: sin(a) * k, phase: rng.next() * TAU, amp: 1 / (1 + i * 0.6) }
  })
  const total = parts.reduce((sum, part) => sum + part.amp, 0)
  return (x: number, y: number) => parts.reduce((sum, part) => sum + part.amp * sin(part.cx * x + part.cy * y + part.phase), 0) / total
}

// A gouge's stroke along a path: thin at both ends, full in the middle, as a
// V-tool goes in and comes out of the block.
function stroke(points: number[], width: number): Shape {
  const ribbon: number[] = []
  const count = points.length / 2
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5
    ribbon.push(points[i * 2]!, points[i * 2 + 1]!, width * sin(PI * t))
  }
  return { type: "ribbon", points: ribbon }
}

// A block of ink with lines cut out of it, which print as paper: rings round
// one point, rays from it, or rows across, each broken into strokes of the
// gouge. The block is the deepest ink; a relief process prints it.
export const gouge: FillPart = {
  name: "gouge",
  // A block is cut whole: it isn't a stack, a window or a slab with a hole,
  // and its cuts are paper, which a wash, a press, a plate or a lift loses.
  avoid: ["cut", "cutout", "stacked", "wash", "press", "plate", "lift"],
  ranges: {
    spacing: [0.026, 0.04],
    cut: [0.18, 0.28],
    gaps: [0.12, 0.3],
  },
  moods: {
    calm: { spacing: [0.032, 0.04], gaps: [0.2, 0.3] },
    bold: { spacing: [0.026, 0.032], cut: [0.23, 0.28] },
  },

  paint(context, region, p) {
    const rng = context.rng.fork("gouge")
    const side = Math.max(region.w, region.h)
    const spacing = side * p.spacing!
    const width = spacing * p.cut!
    const cx = region.x + region.w * rng.between([0.3, 0.7])
    const cy = region.y + region.h * rng.between([0.3, 0.7])
    const reach = Math.sqrt(region.w * region.w + region.h * region.h)
    const pattern = rng.pick(["rings", "rings", "rays", "rows"] as const)
    // Light from one side: a printmaker cuts away more there, and leaves the
    // far side nearer solid, so the cuts shade the form.
    const lit = rng.next() * TAU
    const lightAt = (x: number, y: number) =>
      clamp(0.5 + (((x - region.x - region.w / 2) * cos(lit) + (y - region.y - region.h / 2) * sin(lit)) / side) * 1.4, 0, 1)
    // A small block is cut more sparingly, so it still prints as a block.
    const small = clamp((region.w * region.h) / (context.w * context.h) / 0.22, 0.55, 1)
    const strokes: Shape[] = []
    // A path cut into strokes a few spacings long, with gaps between, fewer
    // and finer away from the light.
    const cutInto = (path: number[]) => {
      let i = 0
      const count = path.length / 2
      while (i < count - 1) {
        const length = Math.max(3, Math.round(rng.between([4, 14])))
        const piece = path.slice(i * 2, Math.min(i + length, count) * 2)
        const middle = Math.floor(piece.length / 4) * 2
        const light = lightAt(piece[middle]!, piece[middle + 1]!)
        const keep = rng.next() > p.gaps! * 0.5 && rng.next() < (0.16 + 0.78 * light) * small
        if (piece.length >= 4 && keep) strokes.push(stroke(piece, width * rng.between([0.7, 1.1]) * lerp(0.55, 1.1, light)))
        i += length + (rng.next() < p.gaps! ? Math.round(rng.between([1, 4])) : 0)
      }
    }
    const step = spacing * 0.45
    if (pattern === "rings") {
      const wobble = field(rng.fork("rings"), region, 3)
      for (let r = spacing * 0.8; r < reach; r += spacing) {
        const steps = Math.max(8, Math.round((TAU * r) / step))
        const path: number[] = []
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * TAU
          const x = cx + cos(a) * r
          const y = cy + sin(a) * r
          const rr = r + spacing * 0.22 * wobble(x, y)
          path.push(cx + cos(a) * rr, cy + sin(a) * rr)
        }
        cutInto(path)
      }
    } else if (pattern === "rays") {
      const count = Math.round((TAU * reach * 0.5) / (spacing * 1.6))
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + rng.between([-0.02, 0.02])
        const path: number[] = []
        for (let r = spacing * rng.between([0.6, 3]); r < reach; r += step) path.push(cx + cos(a) * r, cy + sin(a) * r)
        cutInto(path)
      }
    } else {
      const angle = rng.between([-0.5, 0.5])
      const along = { x: cos(angle), y: sin(angle) }
      const wave = field(rng.fork("rows"), region, 3)
      for (let d = -reach / 2; d < reach / 2; d += spacing) {
        const path: number[] = []
        for (let t = -reach / 2; t < reach / 2; t += step) {
          const x = cx + along.x * t - along.y * d
          const y = cy + along.y * t + along.x * d
          const lift = spacing * 0.3 * wave(x, y)
          path.push(x - along.y * lift, y + along.x * lift)
        }
        cutInto(path)
      }
    }
    return [solid("block", "ink", [rect(region)]), solid("cuts", "ground", strokes)]
  },
}

// A typewriter's picture: rows of characters struck in a grid, each heavier
// where the picture is darker, as typists drew with the keys they had. The
// picture is light falling on the figure from one side, under a slow field.
export const type: FillPart = {
  name: "type",
  hairline: true,
  // Characters are struck on a sheet in one pass: they read only whole, in
  // one form, under nothing but grain.
  avoid: ["tiles", "cut", "cutout", "stacked", "wash", "press", "plate", "block", "lift"],
  ranges: {
    columns: [22, 30],
    contrast: [0.85, 1.15],
    light: [0, 360],
  },
  moods: {
    calm: { columns: [26, 30], contrast: [0.85, 0.95] },
    bold: { columns: [22, 25], contrast: [1.05, 1.15] },
  },

  paint(context, region, p) {
    const rng = context.rng.fork("type")
    const cell = region.w / Math.round(p.columns!)
    // Rows a little closer than a typewriter's single spacing, as typists
    // drawing with it set them.
    const line = cell * 1.3
    const size = cell / 0.62
    const scale = size / 1000
    const lit = (p.light! / 180) * PI
    const texture = field(rng, region, 4)
    const cx = region.x + region.w / 2
    const cy = region.y + region.h / 2
    const r = Math.max(region.w, region.h) / 2
    const items: { tone: Tone; shape: Shape }[] = []
    for (let y = region.y; y < region.y + region.h; y += line) {
      for (let x = region.x; x < region.x + region.w; x += cell) {
        const mx = x + cell / 2
        const my = y + line / 2
        // A round thing lit from `lit`, a little in front: bright where it
        // faces the light, deep where it turns away. Every cell inside the
        // form strikes at least a full stop, so the form keeps its edge.
        const u = (mx - cx) / r
        const v = (my - cy) / r
        const z = Math.sqrt(Math.max(0, 1 - u * u - v * v))
        const facing = Math.max(0, (u * cos(lit) + v * sin(lit)) * 0.62 + z * 0.78)
        const ink = clamp(0.12 + 0.88 * (1 - facing * p.contrast!) + texture(mx, my) * 0.12, 0.02, 0.999)
        const key = KEYS[Math.floor(ink * KEYS.length)]!
        const left = mx - (key.advance * scale) / 2
        const base = my + (CAP * scale) / 2
        const tone: Tone = ink > 0.8 ? "ink" : ink > 0.56 ? "strong" : ink > 0.32 ? "accent" : "body"
        for (const contour of key.contours) {
          const points: number[] = []
          for (let i = 0; i < contour.length; i += 2) points.push(left + contour[i]! * scale, base - CAP * scale + contour[i + 1]! * scale)
          items.push({ tone, shape: { type: "polygon", points } })
        }
      }
    }
    return byTone("keys", items)
  },
}

// Lines drawn along a current, evenly apart, the way iron filings lie round a
// magnet or wind lies over a map: each from a seed point both ways along the
// flow until it comes too near another, swelling in the middle.
export const flow: FillPart = {
  name: "flow",
  hairline: true,
  // Fine lines, drawn once: a wash would blur them, a press, plate or block
  // would print them as a slab, and a stack would hide them.
  avoid: ["cut", "cutout", "stacked", "wash", "press", "plate", "block", "lift"],
  ranges: {
    gap: [0.012, 0.018],
    weight: [0.2, 0.34],
    curl: [1.2, 2.2],
  },
  moods: {
    calm: { gap: [0.015, 0.018], curl: [1.2, 1.6] },
    bold: { gap: [0.012, 0.014], weight: [0.28, 0.34] },
  },

  paint(context, region, p) {
    const rng = context.rng.fork("flow")
    const side = Math.max(region.w, region.h)
    const gap = side * p.gap!
    const step = gap * 0.5
    const turn = field(rng.fork("turn"), region, 4)
    const shade = field(rng.fork("shade"), region, 3)
    const base = rng.next() * TAU
    const angleAt = (x: number, y: number) => base + turn(x, y) * p.curl!
    // Where lines have been, on a grid half a gap across, so a line stops
    // before it runs into another.
    const cols = Math.ceil(region.w / (gap * 0.5)) + 1
    const rows = Math.ceil(region.h / (gap * 0.5)) + 1
    const taken = new Uint8Array(cols * rows)
    const slot = (x: number, y: number) => {
      const i = Math.floor((x - region.x) / (gap * 0.5))
      const j = Math.floor((y - region.y) / (gap * 0.5))
      return i < 0 || j < 0 || i >= cols || j >= rows ? -1 : j * cols + i
    }
    const near = (x: number, y: number, own: Set<number>) => {
      const i = Math.floor((x - region.x) / (gap * 0.5))
      const j = Math.floor((y - region.y) / (gap * 0.5))
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const at = (j + dj) * cols + (i + di)
          if (i + di >= 0 && j + dj >= 0 && i + di < cols && j + dj < rows && taken[at] && !own.has(at)) return true
        }
      }
      return false
    }
    const trace = (x0: number, y0: number, way: number, own: Set<number>) => {
      const path: number[] = []
      let x = x0
      let y = y0
      for (let i = 0; i < 160; i++) {
        const a = angleAt(x, y)
        x += cos(a) * step * way
        y += sin(a) * step * way
        const at = slot(x, y)
        if (at < 0 || near(x, y, own)) break
        own.add(at)
        path.push(x, y)
      }
      return path
    }
    const items: { tone: Tone; shape: Shape }[] = []
    const seeds: [number, number][] = []
    for (let y = region.y; y < region.y + region.h; y += gap * 1.4) {
      for (let x = region.x; x < region.x + region.w; x += gap * 1.4) seeds.push([x + rng.next() * gap, y + rng.next() * gap])
    }
    // In a shuffled order, so no corner fills first.
    for (let i = seeds.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1))
      ;[seeds[i], seeds[j]] = [seeds[j]!, seeds[i]!]
    }
    for (const [x, y] of seeds) {
      const start = slot(x, y)
      if (start < 0 || taken[start] || near(x, y, new Set())) continue
      const own = new Set([start])
      const back = trace(x, y, -1, own)
      const ahead = trace(x, y, 1, own)
      const path: number[] = []
      for (let i = back.length - 2; i >= 0; i -= 2) path.push(back[i]!, back[i + 1]!)
      path.push(x, y, ...ahead)
      for (const at of own) taken[at] = 1
      if (path.length < 16) continue
      const s = shade(x, y)
      const tone: Tone = s > 0.35 ? "strong" : s > -0.1 ? "accent" : s > -0.45 ? "body" : "soft"
      items.push({ tone, shape: stroke(path, gap * p.weight! * lerp(0.8, 1.3, (s + 1) / 2)) })
    }
    return byTone("flow", items)
  },
}

// Threads, the colours they come in, in order, repeating: plain stripes,
// checks of two, and a tartan's longer count.
const SETTS: readonly { warp: Tone[]; weft: Tone[] }[] = [
  { warp: ["accent"], weft: ["soft"] },
  { warp: ["accent", "accent", "soft", "soft"], weft: ["accent", "accent", "soft", "soft"] },
  { warp: ["strong", "accent", "accent", "partner", "accent", "accent"], weft: ["strong", "accent", "accent", "partner", "accent", "accent"] },
  { warp: ["accent", "body"], weft: ["soft", "soft", "accent"] },
]

// Which thread is on top at a crossing: plain weave, a twill's steps, or a
// basket's pairs.
const WEAVES = {
  plain: (i: number, j: number) => (i + j) % 2 === 0,
  twill: (i: number, j: number) => (i + j) % 4 < 2,
  basket: (i: number, j: number) => (Math.floor(i / 2) + Math.floor(j / 2)) % 2 === 0,
}

// Cloth: threads one way and the other, crossing over and under, each
// darker where it dips under the next.
export const weave: FillPart = {
  name: "weave",
  // Cloth is its own colour and texture, under nothing but grain.
  avoid: ["cut", "cutout", "stacked", "wash", "press", "plate", "block", "lift"],
  ranges: {
    threads: [20, 32],
    thread: [0.86, 0.93],
    tilt: [-0.12, 0.12],
  },
  moods: {
    calm: { threads: [26, 32] },
    bold: { threads: [20, 24], thread: [0.9, 0.93] },
  },

  paint(context, region, p) {
    const rng = context.rng.fork("weave")
    const pitch = Math.max(region.w, region.h) / Math.round(p.threads!)
    const thick = pitch * p.thread!
    const sett = rng.pick(SETTS)
    const over = WEAVES[rng.pick(["plain", "plain", "twill", "basket"] as const)]
    const angle = p.tilt! + (rng.next() < 0.3 ? PI / 4 : 0)
    const c = cos(angle)
    const s = sin(angle)
    const cx = region.x + region.w / 2
    const cy = region.y + region.h / 2
    // A box in the cloth's own turned grid, as four corners on the page.
    const quad = (u: number, v: number, w: number, h: number): Shape => {
      const at = (a: number, b: number) => [cx + a * c - b * s, cy + a * s + b * c]
      return { type: "polygon", points: [...at(u, v), ...at(u + w, v), ...at(u + w, v + h), ...at(u, v + h)] }
    }
    const reach = Math.sqrt(region.w * region.w + region.h * region.h) / 2
    const n = Math.ceil(reach / pitch) + 1
    const items: { tone: Tone; shape: Shape }[] = []
    const dips: Shape[] = []
    // A thread is round: a little light runs along its middle.
    const sheen: Shape[] = []
    const inset = (pitch - thick) / 2
    const dip = pitch * 0.22
    const shine = thick * 0.24
    for (let j = -n; j < n; j++) {
      for (let i = -n; i < n; i++) {
        const u = i * pitch
        const v = j * pitch
        const index = (k: number, length: number) => ((k % length) + length) % length
        if (over(i + n, j + n)) {
          const tone = sett.warp[index(i, sett.warp.length)]!
          items.push({ tone, shape: quad(u + inset, v, thick, pitch) })
          dips.push(quad(u + inset, v, thick, dip), quad(u + inset, v + pitch - dip, thick, dip))
          sheen.push(quad(u + inset + (thick - shine) / 2, v + dip, shine, pitch - dip * 2))
        } else {
          const tone = sett.weft[index(j, sett.weft.length)]!
          items.push({ tone, shape: quad(u, v + inset, pitch, thick) })
          dips.push(quad(u, v + inset, dip, thick), quad(u + pitch - dip, v + inset, dip, thick))
          sheen.push(quad(u + dip, v + inset + (thick - shine) / 2, pitch - dip * 2, shine))
        }
      }
    }
    // Between the threads and where they dip, the dark under the cloth: deep
    // ink on paper, the ground itself on black.
    const under: Tone = context.theme === "dark" ? "ground" : "ink"
    const light: Tone = context.theme === "dark" ? "ink" : "ground"
    return [
      solid("backing", under, [rect(region)], 0.85),
      ...byTone("threads", items),
      solid("dips", under, dips, context.theme === "dark" ? 0.32 : 0.16),
      solid("sheen", light, sheen, context.theme === "dark" ? 0.1 : 0.18),
    ]
  },
}

// Terrazzo: chips of stone in several colours set in a pale ground and
// ground flat, large ones few and small ones many, none touching.
export const stone: FillPart = {
  name: "stone",
  // Stone is its own colours, under nothing but grain, in one form: a
  // tile of it is too small a piece to read as stone.
  avoid: ["tiles", "cut", "cutout", "stacked", "wash", "press", "plate", "block", "lift"],
  ranges: {
    chips: [70, 120],
    largest: [0.07, 0.11],
    specks: [160, 260],
  },
  moods: {
    calm: { chips: [70, 90], largest: [0.07, 0.085] },
    bold: { chips: [100, 120], largest: [0.095, 0.11] },
  },

  paint(context, region, p) {
    const rng = context.rng.fork("stone")
    const side = Math.max(region.w, region.h)
    const TONES: readonly Tone[] = ["accent", "accent", "strong", "partner", "partner", "body", "ink"]
    const placed: { x: number; y: number; r: number }[] = []
    const items: { tone: Tone; shape: Shape }[] = []
    const chip = (x: number, y: number, r: number, corners: number) => {
      const turn = rng.next() * TAU
      const angles = Array.from({ length: corners }, (_, k) => turn + ((k + rng.between([-0.3, 0.3])) / corners) * TAU).sort((a, b) => a - b)
      const points: number[] = []
      for (const a of angles) {
        const rr = r * rng.between([0.62, 1])
        points.push(x + cos(a) * rr, y + sin(a) * rr * rng.between([0.75, 1]))
      }
      return { type: "polygon", points } as Shape
    }
    const count = Math.round(p.chips!)
    for (let k = 0, tries = 0; k < count && tries < count * 30; tries++) {
      // Sizes fall off steeply: a few large chips among many small.
      const size = rng.next()
      const r = side * p.largest! * lerp(0.18, 1, size * size * size)
      const x = region.x + rng.next() * region.w
      const y = region.y + rng.next() * region.h
      if (placed.some((other) => distance(other.x - x, other.y - y) < (other.r + r) * 1.08)) continue
      placed.push({ x, y, r })
      items.push({ tone: rng.pick(TONES), shape: chip(x, y, r, rng.int(5, 8)) })
      k++
    }
    const specks: { tone: Tone; shape: Shape }[] = []
    for (let k = 0; k < Math.round(p.specks!); k++) {
      const x = region.x + rng.next() * region.w
      const y = region.y + rng.next() * region.h
      specks.push({ tone: rng.pick(["body", "strong", "accent"] as const), shape: chip(x, y, side * rng.between([0.003, 0.008]), 5) })
    }
    // The ground the chips are set in: a step off the paper, so the slab keeps
    // its edge.
    return [
      solid("matrix", "soft", [rect(region)]),
      // A little of the colour's body in it, so a pale brand's ground still
      // stands off the paper.
      solid("tint", "body", [rect(region)], 0.14),
      ...byTone("chips", items),
      ...byTone("specks", specks, 0.75),
    ]
  },
}
