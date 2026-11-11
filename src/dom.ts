import { describe } from "./core/describe.ts"
import { generate } from "./core/generate.ts"
import type { SurfaceInput } from "./core/generate.ts"
import type { Scene } from "./core/scene.ts"
import { toHtml } from "./render/layers.ts"

// A moving cover in a page, drawn as a stack of layers so that what moves is
// moved by the graphics card and never drawn again (see layers.ts). An SVG
// inside an <img> would be drawn again whole on every frame it moves.
//
//   const cover = mount(document.querySelector("#cover"), { style: "halftone", seed, motion: "loop" })
//   // later: cover.stop()

export { watch } from "./watch.ts"
import { watch } from "./watch.ts"

// Draws a cover into an element, inline, and watches it. The art is hidden
// from screen readers unless `label` says what to read out instead; `true`
// reads out a description of the art itself. A cover with its title drawn in
// reads the title out unless told otherwise. `pause` and `play` stop a
// moving cover and let it go on, for the control a loop needs.
export function mount(
  element: Element,
  input: SurfaceInput,
  { label }: { label?: string | true } = {}
): { scene: Scene; stop: () => void; pause: () => void; play: () => void } {
  const scene = generate(input)
  const spoken = label === true ? describe(scene) : label
  element.innerHTML = toHtml(scene, { fill: true, ...(spoken ? { label: spoken } : null) })
  return {
    scene,
    stop: watch(element),
    pause: () => element.setAttribute("data-paused", ""),
    play: () => element.removeAttribute("data-paused"),
  }
}
