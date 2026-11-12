import { clamp } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Layer, Motion, Pool, Shape, Tone } from "../core/scene.ts"
import { seat } from "../shapes/subjects.ts"
import { pools } from "./pools.ts"
import type { PoolParams, PoolPlan } from "./pools.ts"
import { clearing } from "./stage.ts"

// Soft colour seen through a pane of fluted glass. Each rib of the glass is a
// small cylindrical lens: it shows the colour behind it squeezed, and shifted
// a little more the further it is from the middle of the pane. The colour is
// drawn again inside every rib with those changes, so the pane is real
// geometry and the same on every renderer.
export const PANES = ["panel", "arch", "band"] as const
export type Pane = (typeof PANES)[number]

export type FlutedParams = PoolParams & {
  size: number
  // Width of one rib, and how hard it squeezes and shifts what is behind it.
  flute: number
  squeeze: number
  bend: number
  // How strongly each rib catches light and shadow.
  sheen: number
}

export function fluted(
  frame: Frame,
  pane: Pane,
  plans: readonly (readonly PoolPlan[])[],
  p: FlutedParams
): Art {
  const { w, h, keep, theme } = frame
  const behind = pools(frame, plans, p)
  const { area, away } = clearing(frame)
  const margin = Math.min(w, h) * 0.05
  const unit = Math.min(area.w, area.h)

  let box: Box
  let outline: Shape
  if (pane === "arch") {
    const width = Math.min(area.w * 0.8, area.h * 0.62) * p.size
    const tall = Math.min(area.h * 0.88, width * 1.55)
    const { x, y } = seat({ area, safe: keep, w, h, away }, Math.max(width, tall) / 2)
    box = { x: x - width / 2, y: y - tall / 2, w: width, h: tall }
    outline = { type: "rect", ...box, radii: [width / 2, width / 2, 0, 0] }
  } else if (pane === "panel") {
    // A window lying on its side, framed with small corners and set in the
    // clear side, so it never reads as the arch standing or the band running
    // off the edges.
    const width = Math.min(area.w * 0.86, area.h * 1.5) * p.size
    const tall = Math.min(area.h * 0.7, width * 0.62)
    const { x, y } = seat({ area, safe: keep, w, h, away }, Math.max(width, tall) / 2)
    box = { x: x - width / 2, y: y - tall / 2, w: width, h: tall }
    const corner = unit * 0.035
    outline = { type: "rect", ...box, radii: [corner, corner, corner, corner] }
  } else {
    // A strip across the clear side, edge to edge where the cover is clear
    // and kept a margin off the title, a third of its height: a band.
    const x = area.x > 0 ? area.x + margin : 0
    const right = area.x + area.w < w ? area.x + area.w - margin : w
    const top = area.y > 0 ? area.y + margin : 0
    const bottom = area.y + area.h < h ? area.y + area.h - margin : h
    const tall = Math.max(unit * 0.22, (bottom - top) * 0.34)
    const middle = top + (bottom - top) * 0.45
    box = { x, y: Math.max(top, middle - tall / 2), w: right - x, h: tall }
    outline = { type: "rect", ...box, radii: [0, 0, 0, 0] }
  }

  // Ribs are as wide as the recipe says, fitted so that a whole number spans
  // the pane.
  const count = Math.max(4, Math.round(box.w / p.flute))
  const rib = box.w / count
  const middle = box.x + box.w / 2
  // What the pane shows: firmer pools than the soft ones around it, placed
  // across the pane itself, so every rib has an edge of colour to break.
  const seen = frame.rng.fork("glass")
  // The deep tone goes in at full size: in a pale palette it is the only
  // thing the ribs have to break against.
  const colour: Pool[] = (["body", "strong", "partner"] as const).map(
    (tone, index): Pool => ({
      kind: "pool",
      id: `seen${index}`,
      // Toward the middle, so the colour fills the pane rather than one corner.
      cx: box.x + box.w * seen.between([0.22, 0.78]),
      cy: box.y + box.h * seen.between([0.22, 0.78]),
      rx: box.w * seen.between([0.4, 0.66]) * (index === 2 ? 0.6 : 1),
      ry: box.h * seen.between([0.3, 0.5]) * (index === 2 ? 0.6 : 1),
      rotate: 0,
      tone,
      opacity: p.strength,
      core: seen.between([0.5, 0.72]),
    })
  )

  const glass: Layer[] = [
    {
      kind: "shapes",
      id: "pane",
      paint: { type: "solid", tone: "ground", opacity: 1 },
      shapes: [{ type: "rect", ...box, radii: [0, 0, 0, 0] }],
    },
  ]
  // The colour behind the glass slides across it, and every rib shows the
  // slide squeezed by as much as it squeezes the colour, so the pane ripples
  // as a real one does when something passes behind it.
  const travel = box.w * 0.3 * p.squeeze
  const slide: Motion | undefined =
    frame.motion !== "none"
      ? {
          enter: { kind: "fade", delay: 0.2, duration: 2.4, dx: -travel },
          loop: { kind: "drift", dx: travel, dy: 0, period: 14 },
        }
      : undefined
  const shade: Shape[] = []
  const shine: Shape[] = []
  for (let i = 0; i < count; i++) {
    const left = box.x + i * rib
    const centre = left + rib / 2
    const shift = (centre - middle) * p.bend * p.squeeze
    glass.push({
      kind: "clip",
      id: `rib${i}`,
      shape: { type: "rect", x: left, y: box.y, w: rib, h: box.h, radii: [0, 0, 0, 0] },
      ...(slide ? { motion: slide } : null),
      layers: colour.map(
        (pool): Pool => ({
          ...pool,
          id: `${pool.id}-r${i}`,
          // The picture keeps its place across the pane, and each rib squeezes
          // a slice several ribs wide into its own width.
          cx: centre + (pool.cx - centre) * p.squeeze - shift,
          rx: pool.rx * p.squeeze,
        })
      ),
    })
    shade.push({ type: "rect", x: left, y: box.y, w: rib * 0.28, h: box.h, radii: [0, 0, 0, 0] })
    shine.push({
      type: "rect",
      x: left + rib * 0.66,
      y: box.y,
      w: rib * 0.12,
      h: box.h,
      radii: [0, 0, 0, 0],
    })
  }
  // Light catches one side of every rib and the other falls into shadow; on
  // black the light is the bright tone, on paper the pale one.
  const light: Tone = theme === "dark" ? "strong" : "quiet"
  const dark: Tone = theme === "dark" ? "ground" : "strong"
  glass.push({
    kind: "soften",
    id: "ribs",
    radius: clamp(rib * 0.12, 1.5, 6),
    layers: [
      {
        kind: "shapes",
        id: "rib-shade",
        paint: { type: "solid", tone: dark, opacity: p.sheen * 0.35 },
        shapes: shade,
      },
      {
        kind: "shapes",
        id: "rib-shine",
        paint: { type: "solid", tone: light, opacity: p.sheen },
        shapes: shine,
      },
    ],
  })

  return {
    under: behind.under,
    marks: behind.marks,
    // Above the title's veil: the pane keeps clear of the title, and under the
    // veil its colour would wash out.
    over: [
      ...behind.over,
      { kind: "clip", id: "glass", shape: outline, layers: glass },
    ],
    subject: box,
  }
}
