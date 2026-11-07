import type { Rng } from "../core/random.ts"
import type { Frame } from "../core/recipe.ts"

// How a cover with nothing to keep clear frames its subject: most draw it
// large, seated on a third and running off the edges, as a poster crops its
// subject; the rest whole in the middle, as the layout would anyway. Each
// title draws its own, so a page of covers is one subject seen many ways.
//
// `reach` is how far the subject runs, as a share of the canvas's short
// side: past 1 it is larger than the canvas is tall. A layout sizes its
// subject from it and seats it at x, y; with no framing it draws as it would.
export type Framing = { x: number; y: number; reach: number }

export function framing(
  frame: Pick<Frame, "w" | "h" | "titled" | "fill" | "calm">,
  rng: Rng,
  // The most it may reach, for a subject that must stay whole on the canvas,
  // as a still life on its ledge does.
  { most = 1.4 }: { most?: number } = {}
): Framing | undefined {
  const { w, h } = frame
  if (frame.titled || frame.fill || frame.calm.length) return undefined
  const pick = rng.fork("frame")
  if (pick.next() >= 0.7) return undefined
  const reach = pick.between([1.05, 1.4]) * (most / 1.4)
  const third = pick.next() < 0.5 ? 1 / 3 : 2 / 3
  const x = w > h ? w * third : w / 2 + (pick.next() * 2 - 1) * w * 0.12
  const y = w > h ? h / 2 + (pick.next() * 2 - 1) * h * 0.18 : h * third
  return { x, y, reach }
}
