import { cos, radians, sin, TAU } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Enter, Layer, Mark, Motion, Paint, Pool, Shape, Stop, Tone } from "../core/scene.ts"
import { seat } from "../shapes/subjects.ts"
import { clearing } from "./stage.ts"

// One polished object in a pool of light. Chrome shows the world reflected in
// it: a bright sky, a hard horizon, dark ground, all bent round its surface.
// Glass shows what is behind it, magnified, dimmed and upside down, with
// glinting edges. Every effect is gradients and clips, so the object is sharp
// at any size.
export const OBJECTS = ["orb", "ring", "capsule", "arch"] as const
export type ObjectShape = (typeof OBJECTS)[number]

export type Material = "chrome" | "glass"

export type ObjectParams = {
  size: number
  // The angle the reflection runs at, in degrees from upright.
  tilt: number
  // Where the horizon sits across the object, 0 to 1.
  horizon: number
  glow: number
  // How much a glass object magnifies what is behind it.
  lens: number
  rim: number
}

type Placed = { outline: Shape; box: Box }

function place(frame: Frame, shape: ObjectShape, size: number): Placed {
  const { w, h, keep } = frame
  const { area, away } = clearing(frame)
  const unit = Math.min(area.w, area.h)
  if (shape === "capsule") {
    // Lies across the clear area, its long side along it.
    const long = Math.min(Math.max(area.w, area.h) * 0.8, unit * 1.7) * size
    const short = Math.min(long * 0.36, unit * 0.42)
    const flat = area.w >= area.h
    const bw = flat ? long : short
    const bh = flat ? short : long
    const { x, y } = seat({ area, safe: keep, w, h, away }, Math.max(bw, bh) / 2)
    const box = { x: x - bw / 2, y: y - bh / 2, w: bw, h: bh }
    const round = Math.min(bw, bh) / 2
    return { box, outline: { type: "rect", ...box, radii: [round, round, round, round] } }
  }
  if (shape === "arch") {
    const bw = unit * 0.56 * size
    const bh = Math.min(bw * 1.45, area.h * 0.86)
    const { x, y } = seat({ area, safe: keep, w, h, away }, Math.max(bw, bh) / 2)
    const box = { x: x - bw / 2, y: y - bh / 2, w: bw, h: bh }
    return { box, outline: { type: "rect", ...box, radii: [bw / 2, bw / 2, 0, 0] } }
  }
  const r = unit * 0.42 * size
  const { x, y } = seat({ area, safe: keep, w, h, away }, r)
  const box = { x: x - r, y: y - r, w: r * 2, h: r * 2 }
  if (shape === "ring") {
    return { box, outline: { type: "ring", cx: x, cy: y, r, inner: r * 0.56 } }
  }
  return { box, outline: { type: "circle", cx: x, cy: y, r } }
}

// A gradient across the box at an angle: 0 at one side, 1 at the other.
function across(box: Box, tilt: number, stops: Stop[]): Paint {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const reach = Math.max(box.w, box.h) / 2
  const dx = sin(radians(tilt)) * reach
  const dy = cos(radians(tilt)) * reach
  return { type: "linear", x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy, stops }
}

export function object(
  frame: Frame,
  shape: ObjectShape,
  material: Material,
  p: ObjectParams
): Art {
  const { theme, rng } = frame
  const { box, outline } = place(frame, shape, p.size)
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const reach = Math.max(box.w, box.h)
  // With no title the object fills the canvas, and the glow round it must
  // still leave ground showing at the edges.
  const halo = reach * (frame.titled ? 1.05 : 0.7)
  // Pale and dark ends of the palette, the same way round in both themes.
  const light: Tone = theme === "dark" ? "strong" : "quiet"
  const dark: Tone = theme === "dark" ? "quiet" : "strong"
  const mid: Tone = "soft"
  const lit = rng.fork("light")
  const glowX = cx + (lit.next() - 0.5) * box.w * 0.5
  const glowY = cy + (lit.next() - 0.5) * box.h * 0.5

  const glow: Pool[] = [
    {
      kind: "pool",
      id: "glow",
      cx: glowX,
      cy: glowY,
      rx: halo,
      ry: halo,
      rotate: 0,
      tone: "body",
      opacity: p.glow,
      core: 0.05,
    },
    {
      kind: "pool",
      id: "glow2",
      cx: glowX + (cx - glowX) * 2,
      cy: glowY + box.h * 0.3,
      rx: halo * 0.66,
      ry: halo * 0.52,
      rotate: 0,
      tone: "partner",
      opacity: p.glow * 0.8,
      core: 0.05,
    },
  ]

  // On a moving cover the light behind the object wanders, and what the
  // object shows of it wanders with it: a chrome reflection slides along its
  // fall, and glass shows the light moving the other way, as a lens turns it.
  const moves = frame.motion !== "none"
  const wander = rng.fork("motion")
  const way = wander.next() * TAU
  const gx = cos(way) * reach * 0.12
  const gy = sin(way) * reach * 0.08
  const arrive: Enter = { kind: "fade", delay: 0, duration: 1.8 }
  if (moves) {
    for (const pool of glow) pool.motion = { enter: arrive, loop: { kind: "drift", dx: gx, dy: gy, period: 18 } }
  }
  const appear: Motion = { enter: { kind: "fade", delay: 0.3, duration: 1.4 } }

  const solid = (id: string, paint: Paint, shapes: Shape[]): Mark => ({
    kind: "shapes",
    id,
    paint,
    shapes,
  })
  const s = (tone: Tone, at: number, opacity = 1): Stop => ({ at, tone, opacity })

  let body: Layer[]
  if (material === "chrome") {
    // Sky, a hard horizon, ground: the reflection a polished curve shows. A
    // cylinder reflects a level horizon, so a capsule or arch barely tilts.
    const round = shape === "orb" || shape === "ring"
    const tilt = round ? p.tilt : p.tilt * 0.15
    const hz = p.horizon
    const sky = [s(light, 0), s(mid, hz - 0.18), s(light, hz - 0.035)]
    const ground = [
      s(dark, hz),
      s(dark, hz + 0.12),
      s(mid, hz + 0.32),
      s(light, Math.min(hz + 0.42, 0.97)),
      s(dark, 1),
    ]
    // On a ball or a ring the horizon bends round the surface: the sky runs
    // the whole way down, and the ground is laid over it in an arc.
    const reflection: Mark[] = []
    // A reflection that slides needs to reach past the edge it slides from.
    const pad = reach * 0.2
    const cover: Shape = moves
      ? { type: "rect", x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2, radii: [0, 0, 0, 0] }
      : outline
    if (round) {
      const r = box.w / 2
      const dx = sin(radians(tilt))
      const dy = cos(radians(tilt))
      const rx = r * 1.5
      const ry = r * 0.75
      const from = (hz * 2 - 1) * r + ry
      const ox = cx + dx * from
      const oy = cy + dy * from
      const points: number[] = []
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU
        const u = cos(a) * rx
        const v = sin(a) * ry
        // u runs along the horizon, v down across it.
        points.push(ox + u * dy + v * dx, oy - u * dx + v * dy)
      }
      reflection.push(
        solid("chrome", across(box, tilt, [...sky, s(mid, Math.min(hz + 0.3, 0.98)), s(light, 1)]), [cover]),
        solid("ground", across(box, tilt, ground), [{ type: "polygon", points }])
      )
    } else {
      reflection.push(
        solid("chrome", across(box, tilt, [...sky, s(dark, hz - 0.03), ...ground.slice(1)]), [cover])
      )
    }

    // Shading that follows the form, so it reads as a solid and not a flat
    // cut-out: a ball darkens toward its edge, a ring across its tube, a
    // capsule or arch across its width.
    let form: Paint
    if (outline.type === "ring") {
      const inner = outline.inner / outline.r
      const middle = (1 + inner) / 2
      form = {
        type: "radial",
        cx,
        cy,
        r: outline.r,
        stops: [
          s(dark, inner, 0.55),
          s(dark, inner + (middle - inner) * 0.6, 0),
          s(dark, middle + (1 - middle) * 0.4, 0),
          s(dark, 1, 0.55),
        ],
      }
    } else if (round) {
      form = {
        type: "radial",
        cx,
        cy,
        r: box.w / 2,
        stops: [s(dark, 0.62, 0), s(dark, 0.9, 0.3), s(dark, 1, 0.6)],
      }
    } else {
      const flat = box.w > box.h
      form = {
        type: "linear",
        x1: flat ? cx : box.x,
        y1: flat ? box.y : cy,
        x2: flat ? cx : box.x + box.w,
        y2: flat ? box.y + box.h : cy,
        stops: [s(dark, 0, 0.55), s(dark, 0.22, 0), s(dark, 0.7, 0), s(dark, 1, 0.6)],
      }
    }

    // An oil-slick band of the brand's colours where the sky meets the
    // horizon, the way coated chrome catches a film of colour.
    const film = across(box, tilt, [
      s("body", Math.max(hz - 0.34, 0), 0),
      s("body", hz - 0.24, 0.55),
      s("partner", hz - 0.14, 0.6),
      s("accent", hz - 0.07, 0.35),
      s("accent", hz - 0.03, 0),
      s("partner", Math.min(hz + 0.36, 0.98), 0),
      s("partner", Math.min(hz + 0.44, 0.99), 0.4),
      s("partner", 1, 0),
    ])

    const slide: Motion = {
      loop: {
        kind: "drift",
        dx: sin(radians(tilt)) * reach * 0.07,
        dy: cos(radians(tilt)) * reach * 0.07,
        period: 11,
      },
    }
    const sliding = (mark: Mark): Mark => (moves ? { ...mark, motion: slide } : mark)
    body = [
      ...reflection.map(sliding),
      sliding(solid("film", film, [cover])),
      solid("form", form, [outline]),
      // The brand's light is caught in the metal, strongest where it faces it.
      {
        kind: "pool",
        id: "tint",
        cx: glowX,
        cy: glowY,
        rx: reach * 0.7,
        ry: reach * 0.7,
        rotate: 0,
        tone: "body",
        opacity: 0.32,
        core: 0.1,
      },
      // A highlight where the light hits it hardest.
      {
        kind: "soften",
        id: "spark",
        radius: reach * 0.02,
        layers: [
          solid("spark-shape", { type: "solid", tone: light, opacity: 0.9 }, [
            {
              type: "ellipse",
              cx: box.x + box.w * 0.32,
              cy: box.y + box.h * 0.22,
              rx: box.w * 0.08,
              ry: box.h * 0.035,
            },
          ]),
        ],
      },
    ]
  } else {
    // What is behind the glass, magnified about its middle, dimmed, and
    // turned upside down, as a solid lens turns it.
    const seen: Pool[] = glow.map((pool) => ({
      ...pool,
      id: `${pool.id}-seen`,
      cx: cx - (pool.cx - cx) * p.lens,
      cy: cy - (pool.cy - cy) * p.lens,
      rx: pool.rx * p.lens * 0.7,
      ry: pool.ry * p.lens * 0.7,
      opacity: Math.min(1, pool.opacity * 1.3),
      core: 0.45,
      ...(moves
        ? { motion: { enter: arrive, loop: { kind: "drift", dx: -gx * p.lens, dy: -gy * p.lens, period: 18 } } as Motion }
        : null),
    }))
    // Glass is brightest where it turns away, the way a window glints edge
    // on. Strongest on black, where it is all that shows the edge.
    const k = theme === "dark" ? 1 : 0.6
    let glint: Paint
    if (outline.type === "ring") {
      const inner = outline.inner / outline.r
      const middle = (1 + inner) / 2
      glint = {
        type: "radial",
        cx,
        cy,
        r: outline.r,
        stops: [
          s(light, inner, 0.7 * k),
          s(light, inner + (middle - inner) * 0.5, 0),
          s(light, middle + (1 - middle) * 0.5, 0),
          s(light, 1, 0.75 * k),
        ],
      }
    } else if (outline.type === "circle") {
      glint = {
        type: "radial",
        cx,
        cy,
        r: box.w / 2,
        stops: [s(light, 0.7, 0), s(light, 0.92, 0.3 * k), s(light, 1, 0.75 * k)],
      }
    } else {
      const flat = box.w > box.h
      glint = {
        type: "linear",
        x1: flat ? cx : box.x,
        y1: flat ? box.y : cy,
        x2: flat ? cx : box.x + box.w,
        y2: flat ? box.y + box.h : cy,
        stops: [s(light, 0, 0.7 * k), s(light, 0.2, 0), s(light, 0.8, 0), s(light, 1, 0.7 * k)],
      }
    }
    body = [
      solid("tint", { type: "solid", tone: "ground", opacity: 0.55 }, [outline]),
      ...seen,
      // The far side of the glass, darker where it curves away.
      solid(
        "depth",
        { type: "radial", cx, cy, r: reach * 0.55, stops: [s(dark, 0.55, 0), s(dark, 1, 0.55)] },
        [outline]
      ),
      // Light focused through the glass lands on the side away from it.
      {
        kind: "pool",
        id: "caustic",
        cx: cx + (cx - glowX) * 0.9,
        cy: cy + (cy - glowY) * 0.9 + box.h * 0.18,
        rx: box.w * 0.22,
        ry: box.h * 0.1,
        rotate: 0,
        tone: light,
        opacity: 0.55,
        core: 0.15,
      },
      {
        kind: "soften",
        id: "spark",
        radius: reach * 0.015,
        layers: [
          solid("spark-shape", { type: "solid", tone: light, opacity: 0.85 }, [
            {
              type: "ellipse",
              cx: box.x + box.w * 0.3,
              cy: box.y + box.h * 0.2,
              rx: box.w * 0.07,
              ry: box.h * 0.025,
            },
          ]),
        ],
      },
      solid(
        "sheen",
        across(box, p.tilt, [s(light, 0, 0.32), s(light, 0.3, 0.05), s(light, 0.6, 0), s(light, 1, 0.12)]),
        [outline]
      ),
      solid("glint", glint, [outline]),
    ]
  }
  // A rim of light round the edge, brightest on the side facing the glow.
  const rimWidth = Math.max(1.5, reach * 0.008)
  const edge = (shape: Shape): Shape[] => {
    if (shape.type === "circle") {
      return [{ type: "ring", cx: shape.cx, cy: shape.cy, r: shape.r, inner: shape.r - rimWidth }]
    }
    if (shape.type === "ring") {
      return [
        { type: "ring", cx: shape.cx, cy: shape.cy, r: shape.r, inner: shape.r - rimWidth },
        { type: "ring", cx: shape.cx, cy: shape.cy, r: shape.inner + rimWidth, inner: shape.inner },
      ]
    }
    return []
  }
  const angle = radians(p.tilt + 180)
  const rimPaint: Paint = {
    type: "linear",
    x1: cx + sin(angle) * reach * 0.5,
    y1: cy - cos(angle) * reach * 0.5,
    x2: cx - sin(angle) * reach * 0.5,
    y2: cy + cos(angle) * reach * 0.5,
    stops: [s(light, 0, p.rim), s(light, 0.5, p.rim * 0.25), s(light, 1, p.rim * 0.6)],
  }
  const rims = edge(outline)

  // A soft shadow under the object grounds it.
  const shadow: Layer = {
    kind: "soften",
    id: "shadow",
    radius: reach * 0.05,
    layers: [
      {
        ...solid("shadow-shape", { type: "solid", tone: dark, opacity: theme === "dark" ? 0.6 : 0.22 }, [
          { type: "ellipse", cx, cy: box.y + box.h * 1.02, rx: box.w * 0.42, ry: box.h * 0.05 },
        ]),
        ...(moves ? { motion: appear } : null),
      },
    ],
  }

  return {
    under: [{ kind: "fill", id: "ground", tone: "ground" }, ...glow],
    marks: [],
    over: [
      shadow,
      { kind: "clip", id: "object", shape: outline, layers: body, ...(moves ? { motion: appear } : null) },
      { ...solid("rim", rimPaint, rims), ...(moves ? { motion: appear } : null) },
    ],
    subject: box,
  }
}
