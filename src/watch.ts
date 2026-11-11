// What keeps a moving cover's motion to when it can be seen, alone, so a
// React client component can use it without the rest of dom.ts.

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
