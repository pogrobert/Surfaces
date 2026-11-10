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
//
// A reader can stop it too: `data-paused` on the element, or on anything
// round it, holds the cover where it is, and taking it off lets it go on. A
// loop that runs longer than five seconds needs a control that does this
// (WCAG 2.2.2), and `mount` returns `pause` and `play` for one.
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
  let showing = true
  const sync = () => {
    const held = element.closest("[data-paused]") !== null
    for (const animation of element.getAnimations({ subtree: true })) {
      if (showing && !held) animation.play()
      else {
        animation.pause()
        // Not yet seen: back to the beginning, so it arrives when it is.
        if (!showing && !seen) animation.currentTime = 0
      }
    }
    if (showing) seen = true
  }
  const observer = new IntersectionObserver(([entry]) => {
    showing = entry?.isIntersecting ?? true
    sync()
  })
  observer.observe(element)
  const holding = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(sync)
  holding?.observe(element, { attributes: true, attributeFilter: ["data-paused"] })
  return () => {
    observer.disconnect()
    holding?.disconnect()
    element.removeEventListener("animationend", leave)
  }
}

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
