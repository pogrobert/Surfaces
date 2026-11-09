import { cos, lerp, sin, TAU } from "../core/math.ts"
import type { Box, Mark, Shape, Tone } from "../core/scene.ts"
import { flow, gouge, stone, type, weave } from "./materials.ts"
import type { FillPart } from "./parts.ts"

// What the ink is. A fill knows nothing of the figure it will end up inside:
// it paints a box, and the relation cuts it.

// Tones a blot of paint is laid in, weighted: mostly the colour and its light
// side, now and then its deep shade.
const BLOTS: readonly Tone[] = ["accent", "accent", "accent", "strong", "strong", "soft", "soft", "body"]

// Loose blots of paint over a coat of the colour, in three coats so the
// blots overlap and deepen as wet paint does where it pools.
export const paint: FillPart = {
  name: "paint",
  ranges: {
    blots: [26, 40],
    blotScale: [0.85, 1.2],
    wobble: [0.22, 0.36],
    opacity: [0.62, 0.9],
  },
  moods: {
    calm: { blots: [26, 31], wobble: [0.22, 0.28], opacity: [0.62, 0.74] },
    bold: { blots: [34, 40], opacity: [0.78, 0.9] },
  },

  paint(context, region, p) {
    const rng = context.rng.fork("paint")
    const side = Math.max(region.w, region.h)
    const count = Math.round(p.blots!)
    const blots = Array.from({ length: count }, () => {
      const size = rng.next()
      return {
        cx: region.x + rng.next() * region.w,
        cy: region.y + rng.next() * region.h,
        r: side * lerp(0.04, 0.2, size * Math.sqrt(size)) * p.blotScale!,
        stretch: rng.between([0.6, 1.6]),
        tilt: rng.next() * TAU,
        tone: rng.pick(BLOTS),
        coat: rng.int(0, 3),
        // Low waves give a blot its lobes, high ones its torn edge.
        wave: [2, 3, 4, 5, 7, 9].map((k) => ({ k, amp: (p.wobble! * rng.between([0.3, 1])) / Math.sqrt(k - 1), phase: rng.next() * TAU })),
      }
    })
    // Largest first, so the small blots sit on top.
    blots.sort((a, b) => b.r - a.r)
    const coats = new Map<string, { tone: Tone; coat: number; shapes: Shape[] }>()
    for (const blot of blots) {
      const points: number[] = []
      const across = cos(blot.tilt)
      const down = sin(blot.tilt)
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * TAU
        let rr = blot.r
        for (const { k, amp, phase } of blot.wave) rr += blot.r * amp * sin(k * a + phase)
        const u = cos(a) * Math.max(rr, blot.r * 0.25) * blot.stretch
        const v = sin(a) * Math.max(rr, blot.r * 0.25)
        points.push(blot.cx + u * across - v * down, blot.cy + u * down + v * across)
      }
      const key = `coat${blot.coat}-${blot.tone}`
      const coat = coats.get(key) ?? { tone: blot.tone, coat: blot.coat, shapes: [] }
      coat.shapes.push({ type: "polygon", points })
      coats.set(key, coat)
    }
    const base: Mark = {
      kind: "shapes",
      id: "paint",
      paint: { type: "solid", tone: "body", opacity: 1 },
      shapes: [{ type: "rect", ...region, radii: [0, 0, 0, 0] }],
    }
    return [
      base,
      ...[...coats.entries()]
        .sort(([, a], [, b]) => a.coat - b.coat)
        .map(([key, coat]): Mark => ({
          kind: "shapes",
          id: key,
          paint: { type: "solid", tone: coat.tone, opacity: p.opacity! },
          shapes: coat.shapes,
        })),
    ]
  },
}

// One flat coat of the brand's colour, as a screen print lays it.
export const flat: FillPart = {
  name: "flat",
  ranges: {},
  paint: (_, region: Box) => [
    {
      kind: "shapes",
      id: "flat",
      paint: { type: "solid", tone: "accent", opacity: 1 },
      shapes: [{ type: "rect", ...region, radii: [0, 0, 0, 0] }],
    },
  ],
}

export const FILLS = { paint, flat, gouge, type, flow, weave, stone }
