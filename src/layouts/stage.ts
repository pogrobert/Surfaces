import { atan2, clamp, PI, radians } from "../core/math.ts"
import type { Art, Frame } from "../core/recipe.ts"
import type { Box, Enter, Motion } from "../core/scene.ts"
import { DRAW_SUBJECT } from "../shapes/subjects.ts"
import type { Subject, SubjectParams } from "../shapes/subjects.ts"
import { center, clearArea } from "./geometry.ts"

// One subject, set in the largest clear area beside the title, with its light
// coming from the side away from the text.
export type StageParams = SubjectParams & {
  size: number
  peak: number
  lightTurn: number
  glow: number
}

// The clear area beside the title, and the way out of the title toward it.
export function clearing({ w, h, keep }: Pick<Frame, "w" | "h" | "keep">, room = LEAST_ROOM) {
  const open = clearArea(keep, w, h)
  const from = center(keep)
  const to = center(open)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.sqrt(dx * dx + dy * dy)
  return { area: widen(open, w, h, room), away: { x: dx / length, y: dy / length } }
}

// The least share of the canvas's short side an open area is drawn as.
const LEAST_ROOM = 0.42

// A narrow open area, such as the band above a centred title or the end of a
// strip, would have the art drawn small to fit it. So it is carried on past
// the canvas edges it meets until it is `room` of the canvas across, and the
// art is drawn that size and runs off the edge. An area that wide already is
// returned as it is.
export function widen(area: Box, w: number, h: number, room = LEAST_ROOM): Box {
  const least = Math.min(w, h) * room
  const across = area.w <= area.h
  const short = across ? area.w : area.h
  if (short >= least) return area
  const more = least - short
  const edge = 0.5
  if (across) {
    const left = area.x < edge
    const right = area.x + area.w > w - edge
    if (!left && !right) return area
    const before = left && right ? more / 2 : left ? more : 0
    return { ...area, x: area.x - before, w: area.w + more }
  }
  const top = area.y < edge
  const bottom = area.y + area.h > h - edge
  if (!top && !bottom) return area
  const before = top && bottom ? more / 2 : top ? more : 0
  return { ...area, y: area.y - before, h: area.h + more }
}

export function stage(frame: Frame, subject: Subject, p: StageParams): Art {
  const { w, h, keep, theme, rng } = frame
  // Filling the canvas, the subject stands in its middle, lit from above.
  const { area, away } = frame.fill
    ? { area: { x: w * 0.12, y: h * 0.12, w: w * 0.76, h: h * 0.76 }, away: { x: 0.6, y: -0.8 } }
    : clearing(frame)

  // On black the grain is the lit side, on paper the shaded side, so the same
  // drawing turns over between themes instead of being redrawn.
  const lit = atan2(away.y, away.x) + radians(p.lightTurn)
  const light = theme === "dark" ? lit : lit + PI
  // Now and then a round subject is drawn larger, cropping off the edge. Only
  // on wide covers: on square and tall ones there isn't the room.
  const round = subject === "orb" || subject === "ring" || subject === "eclipse"
  const bold = rng.fork("scale").next() < 0.2 && round && w >= h * 1.3
  const drawn = DRAW_SUBJECT[subject](
    {
      w,
      h,
      safe: keep,
      area,
      away,
      lit,
      light,
      size: bold ? p.size * 1.25 : p.size,
      peak: p.peak,
      rng: rng.fork("subject"),
    },
    p
  )

  const glow = Math.min(area.w, area.h) * 1.1

  // The plate develops in place, its tone coming up slowly like a print in
  // the tray. Its grain then never moves: grain a pixel fine shimmers as it
  // crosses the pixels and goes soft where it stops between them. What moves
  // after is the glow behind the plate, circling slowly, seen through the
  // grain.
  let moves: Art["moves"]
  let glowMotion: Motion | undefined
  if (frame.motion !== "none") {
    const enter: Enter = { kind: "fade", delay: 0.1, duration: 2.4, even: true }
    moves = { plate: { enter } }
    const size = drawn.subject ? Math.max(drawn.subject.w, drawn.subject.h) : Math.min(w, h) * 0.5
    glowMotion = { loop: { kind: "orbit", rx: size * 0.12, ry: size * 0.12, period: 18, start: enter.delay + enter.duration } }
  }

  return {
    under: [
      { kind: "fill", id: "ground", tone: "ground" },
      {
        kind: "pool",
        id: "glow",
        cx: clamp(drawn.cx, 0, w),
        cy: clamp(drawn.cy, 0, h),
        rx: glow,
        ry: glow,
        rotate: 0,
        tone: "soft",
        opacity: p.glow,
        core: 0.12,
        ...(glowMotion ? { motion: glowMotion } : null),
      },
    ],
    marks: drawn.light,
    over: [],
    ...(moves ? { moves } : null),
    ...(drawn.subject ? { subject: drawn.subject } : null),
  }
}
