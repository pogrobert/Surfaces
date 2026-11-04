import { cos, radians, sin } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Enter, Mark, Motion, Shape, Tone } from "../core/scene.ts"
import { center } from "./geometry.ts"
import { facing, veil } from "./veil.ts"
import type { VeilParams } from "./veil.ts"

// Shapes of colour, as a camera would see them through a moving window, placed
// so that a blur has something to smear: large masses for the tones, thin
// streaks along the direction of travel for the sense of speed. Each scene is
// placed by hand, in shares of the canvas for a title at the bottom left.
export type DriftBlob = {
  tone: Tone
  x: number
  y: number
  rx: number
  ry: number
}

export type DriftScene = {
  // Degrees of travel, before the seed turns it by up to `turn` either way.
  angle: number
  turn: number
  blobs: readonly DriftBlob[]
  streakTones: readonly Tone[]
}

export type DriftParams = VeilParams & {
  jitter: number
  scatter: number
  streaks: number
  streakLength: number
  shade: number
}

const toneLayer = (id: string, tone: Tone, shapes: Shape[], opacity = 1): Mark => ({
  kind: "shapes",
  id,
  paint: { type: "solid", tone, opacity },
  shapes,
})

export function drift(
  frame: Frame,
  scenes: readonly DriftScene[],
  p: DriftParams
): Art & { angle: number } {
  const { w, h, rng } = frame
  // On square and tall covers the scene is drawn into the upper part, where
  // the art has room, instead of being stretched down the whole height.
  // Filling the canvas, as an avatar does, it uses the whole height.
  const tall = w < h * 1.3 && !frame.fill
  const squeeze = tall ? 0.6 : 1
  const pick = rng.fork("scene")
  const scene = pick.pick(scenes)
  const side = facing(frame)
  const mirror = (x: number, y: number) => ({
    x: ((side.mirrorX ? 100 - x : x) / 100) * w,
    y: ((side.mirrorY ? 100 - y * squeeze : y * squeeze) / 100) * h,
  })

  const turned = scene.angle + (pick.next() * 2 - 1) * scene.turn
  const flipped = side.mirrorX !== side.mirrorY
  const angle = flipped ? -turned : turned

  const place = rng.fork("placement")
  const marks: Mark[] = []
  const masses: { tone: Tone; x: number; y: number }[] = []
  scene.blobs.forEach((blob, index) => {
    const at = mirror(
      blob.x + (place.next() * 2 - 1) * p.jitter,
      blob.y + (place.next() * 2 - 1) * p.jitter
    )
    masses.push({ tone: blob.tone, ...at })
    marks.push(
      toneLayer(`blob${index}`, blob.tone, [
        {
          type: "ellipse",
          cx: at.x,
          cy: at.y,
          rx: (blob.rx / 100) * w * (tall ? 1.25 : 1),
          ry: (blob.ry / 100) * h * squeeze,
        },
      ])
    )
  })

  // A few smaller masses that belong to no plan, so that no two covers share a
  // silhouette. They stay on the art's side of the canvas.
  const scatter = rng.fork("scatter")
  const palette = scene.streakTones
  for (let index = 0; index < 5; index++) {
    const x = 34 + scatter.next() * 76
    const y = -6 + scatter.next() * (frame.fill ? 106 : 62)
    const size = 6 + scatter.next() * 12
    const tone = scatter.pick(palette)
    const show = scatter.next() < p.scatter
    if (!show) continue
    const at = mirror(x, y)
    marks.push(
      toneLayer(`scatter${index}`, tone, [
        {
          type: "ellipse",
          cx: at.x,
          cy: at.y,
          rx: (size / 100) * Math.sqrt(w * h),
          ry: (size * 0.42 * Math.sqrt(w * h)) / 100,
        },
      ])
    )
  }

  // A few broad bars along the line of travel: what is left of an edge in a
  // long exposure, and what stops the art reading as soft blobs. Thin ones read
  // as scratches on the lens.
  const lines = rng.fork("streaks")
  const c = cos(radians(angle))
  const s = sin(radians(angle))
  const byTone = new Map<Tone, Shape[]>()
  for (let index = 0; index < 14; index++) {
    const x = -10 + lines.next() * 120
    const y = -10 + lines.next() * 90
    const half = (lines.next() * 0.5 + 0.5) * p.streakLength
    const thick = 5 + lines.next() * 22
    const tone = lines.pick(palette)
    if (index >= p.streaks) continue
    const at = mirror(x, y)
    const width = thick * 2.4 + 10
    const points = [
      [-half, -width],
      [half, -width],
      [half, width],
      [-half, width],
    ].flatMap(([u, v]) => [at.x + u! * c - v! * s, at.y + u! * s + v! * c])
    byTone.set(tone, [
      ...(byTone.get(tone) ?? []),
      { type: "polygon", points },
    ])
  }
  for (const tone of palette) {
    const shapes = byTone.get(tone)
    if (shapes) marks.push(toneLayer(`streak-${tone}`, tone, shapes, 0.6))
  }

  const diagonal = Math.sqrt(w * w + h * h)
  const moving = frame.motion !== "none" ? movement(frame, angle, mirror(70, 25), diagonal) : null

  const reach = diagonal * 0.62
  return {
    angle,
    under: [{ kind: "fill", id: "ground", tone: "ground" }],
    marks,
    ...(moving ? { moves: { plate: moving } } : null),
    over: [
      // The frame falls off a little, as a lens does.
      {
        kind: "shapes",
        id: "falloff",
        paint: {
          type: "radial",
          cx: w / 2,
          cy: h / 2,
          r: reach,
          stops: [
            { at: 0.55, tone: "quiet", opacity: 0 },
            { at: 1, tone: "quiet", opacity: p.shade },
          ],
        },
        shapes: [{ type: "rect", x: 0, y: 0, w, h, radii: [0, 0, 0, 0] }],
      },
      ...veil(frame, side, p),
    ],
  }
}

// How the exposure moves. The blur is far too heavy to run again on every
// frame, so nothing inside it moves: the finished plate is moved whole, which
// a browser does by sliding a picture it has already drawn. It arrives as a
// long exposure is made, the light dragging the last of the way into place
// along its own streak as it comes up; then it drifts a little further out
// along the streak and back, as if the camera were still moving when the
// shutter closed. Both go away from the title, never nearer than the still
// drawing; the veil over the title stays where it is.
function movement(frame: Frame, angle: number, heart: { x: number; y: number }, diagonal: number): Motion {
  const text = center(frame.safe)
  // The line of travel, pointed away from the title.
  const c = cos(radians(angle))
  const s = sin(radians(angle))
  const way = (heart.x - text.x) * c + (heart.y - text.y) * s < 0 ? -1 : 1
  const along = { x: c * way, y: s * way }
  const pull = diagonal * 0.07
  const enter: Enter = { kind: "fade", delay: 0.1, duration: 2.6, dx: -along.x * pull, dy: -along.y * pull }
  const drift = diagonal * 0.03
  return {
    enter,
    loop: { kind: "drift", dx: along.x * drift, dy: along.y * drift, period: 16, start: enter.delay + enter.duration },
  }
}
