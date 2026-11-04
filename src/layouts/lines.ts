import { cos, radians, sin, smoothstep } from "../core/math.ts"
import type { Frame } from "../core/recipe.ts"
import type { Shape } from "../core/scene.ts"

// A form, seen only through what it does to a page of parallel lines. `shift`
// says how far it pushes a line sideways at a point, `weight` how much it
// swells it, from 0 to 1.
export type LineForm = {
  shift(x: number, y: number): number
  weight(x: number, y: number): number
}

export type LineParams = {
  // Degrees the lines run at.
  angle: number
  spacing: number
  // Width of a line at weight 0 and at weight 1.
  hair: number
  swell: number
  // The shortest run worth keeping.
  shortest?: number
  // Whether a line ends cleanly where `presence` is nearly gone, coming to
  // a point as a burin's cut does, instead of thinning away. Every line then
  // stops on the same smooth curve, rather than each fading out at its own
  // place.
  pointed?: boolean
}

// Fine enough that a line swelling at a form's rim doesn't show as a stair.
const SAMPLES = 420
const FLAT = 0.45
// How hard a form may squeeze a line toward the next one. At -1 they touch, and
// past it they cross and clump.
const MOST_SQUEEZE = -0.7
const PROBES = 44
// Shorter than this, a line is a fleck, and flecks read as dirt on the plate.
const MIN_RUN = 300
const MIN_HALF_WIDTH = 0.22

// Every point on a straight run would cost bytes and show nothing. A point
// stays only if the line bends or swells there.
function simplify(line: number[]) {
  const kept = [line[0]!, line[1]!, line[2]!]
  const count = line.length / 3
  let anchor = 0
  for (let i = 1; i < count - 1; i++) {
    let flat = true
    const end = i + 1
    for (let k = anchor + 1; k < end && flat; k++) {
      const t = (k - anchor) / (end - anchor)
      for (let axis = 0; axis < 3; axis++) {
        const from = line[anchor * 3 + axis]!
        const to = line[end * 3 + axis]!
        if (Math.abs(from + (to - from) * t - line[k * 3 + axis]!) > FLAT) {
          flat = false
        }
      }
    }
    if (!flat) {
      kept.push(line[i * 3]!, line[i * 3 + 1]!, line[i * 3 + 2]!)
      anchor = i
    }
  }
  kept.push(...line.slice(-3))
  return kept
}

// Where a line runs nearly along the edge it fades at, what is left of it is a
// fleck, and flecks read as dirt on the plate.
function visible(run: number[], shortest: number) {
  let length = 0
  let widest = 0
  for (let i = 3; i < run.length; i += 3) {
    const dx = run[i]! - run[i - 3]!
    const dy = run[i + 1]! - run[i - 2]!
    length += Math.sqrt(dx * dx + dy * dy)
    widest = Math.max(widest, run[i + 2]!)
  }
  return length >= shortest && widest >= MIN_HALF_WIDTH
}

// The gain that keeps a form from pushing any two lines across each other.
function gainFor({ w, h }: Frame, form: LineForm, spacing: number, c: number, s: number) {
  let steepest = 0
  for (let i = 0; i <= PROBES; i++) {
    for (let j = 0; j <= PROBES; j++) {
      const x = (w * i) / PROBES
      const y = (h * j) / PROBES
      const next = form.shift(x - s * spacing, y + c * spacing)
      steepest = Math.min(steepest, (next - form.shift(x, y)) / spacing)
    }
  }
  return steepest < MOST_SQUEEZE ? MOST_SQUEEZE / steepest : 1
}

// `presence` says how much of a line's width survives at a point, from 0 to 1.
// A line comes to a point over this length at each end, as a burin's cut
// does, instead of stopping square.
const TIP = 70

function taperEnds(run: number[]) {
  const count = run.length / 3
  const along = [0]
  for (let i = 1; i < count; i++) {
    const dx = run[i * 3]! - run[i * 3 - 3]!
    const dy = run[i * 3 + 1]! - run[i * 3 - 2]!
    along.push(along[i - 1]! + Math.sqrt(dx * dx + dy * dy))
  }
  const total = along[count - 1]!
  for (let i = 0; i < count; i++) {
    const end = Math.min(along[i]!, total - along[i]!)
    run[i * 3 + 2] = run[i * 3 + 2]! * smoothstep(end / TIP)
  }
}

export function lines(
  frame: Frame,
  form: LineForm,
  p: LineParams,
  presence: (x: number, y: number) => number
): Shape[] {
  const { w, h } = frame
  const c = cos(radians(p.angle))
  const s = sin(radians(p.angle))
  // Long enough to cross the canvas at any angle.
  const reach = Math.sqrt(w * w + h * h) / 2 + p.spacing * 4
  const gain = gainFor(frame, form, p.spacing, c, s)
  const shapes: Shape[] = []

  for (let v = -reach; v <= reach; v += p.spacing) {
    let run: number[] = []
    const finish = () => {
      if (visible(run, p.shortest ?? MIN_RUN)) {
        if (p.pointed) taperEnds(run)
        shapes.push({ type: "ribbon", points: simplify(run) })
      }
      run = []
    }
    for (let i = 0; i <= SAMPLES; i++) {
      const u = -reach + (2 * reach * i) / SAMPLES
      const baseX = w / 2 + u * c - v * s
      const baseY = h / 2 + u * s + v * c
      const shift = form.shift(baseX, baseY) * gain
      const x = baseX - shift * s
      const y = baseY + shift * c
      const outside = x < -40 || y < -40 || x > w + 40 || y > h + 40
      // Pointed lines thin over a short band before the edge and stop on it, so
      // a thick line narrows instead of ending in a wedge.
      const there = presence(x, y)
      const fade = p.pointed
        ? there >= 0.12
          ? 0.25 + 0.75 * smoothstep((there - 0.12) / 0.4)
          : 0
        : there
      if (outside || fade <= 0) {
        finish()
        continue
      }
      const width = p.hair + p.swell * form.weight(baseX, baseY)
      run.push(x, y, (width * fade) / 2)
    }
    finish()
  }
  return shapes
}
