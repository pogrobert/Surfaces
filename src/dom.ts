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

// Keeps a cover's motion to when it can be seen. A cover that starts off
// screen waits there and arrives when it is scrolled to, so its entrance is
// not spent out of sight; one that leaves the screen rests until it is back.
// Anything that has left the cover for good, such as the cuts an engraving
// is drawn with, is taken out of the page: hidden, a browser would still
// redraw it every frame. Without script, or where a browser can't tell, the
// cover plays as soon as it loads.
export function watch(element: Element): () => void {
  const leave = (event: Event) => {
    const { target, animationName } = event as AnimationEvent
    if (target instanceof Element && target.getAttribute("data-surface-exit") === animationName) target.remove()
  }
  element.addEventListener("animationend", leave)
  if (typeof IntersectionObserver === "undefined" || !element.getAnimations) {
    return () => element.removeEventListener("animationend", leave)
  }
  let seen = false
  const observer = new IntersectionObserver(([entry]) => {
    const showing = entry?.isIntersecting ?? true
    for (const animation of element.getAnimations({ subtree: true })) {
      if (showing) animation.play()
      else {
        animation.pause()
        // Not yet seen: back to the beginning, so it arrives when it is.
        if (!seen) animation.currentTime = 0
      }
    }
    if (showing) seen = true
  })
  observer.observe(element)
  return () => {
    observer.disconnect()
    element.removeEventListener("animationend", leave)
  }
}

// Draws a cover into an element, inline, and watches it. The art is hidden
// from screen readers unless `label` says what to read out instead; `true`
// reads out a description of the art itself.
export function mount(
  element: Element,
  input: SurfaceInput,
  { label }: { label?: string | true } = {}
): { scene: Scene; stop: () => void } {
  const scene = generate(input)
  const spoken = label === true ? describe(scene) : label
  element.innerHTML = toHtml(scene, { fill: true, ...(spoken ? { label: spoken } : null) })
  return { scene, stop: watch(element) }
}
