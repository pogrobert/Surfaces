import type { Box } from "./scene.ts"

// What a caller may ask for. These are decisions, not values: the recipe holds
// the values, so nobody has to invent a density or a blur. A size is not a look,
// so it can be anything, and content goes in areas the art arranges itself
// round.

export const MOODS = ["calm", "bold"] as const
export type Mood = (typeof MOODS)[number]

// How much grain a cover carries. Each style judges its own three levels; in
// some, the grain is what draws the tone, so "smooth" cleans it up rather than
// taking it away.
export const GRAINS = ["smooth", "natural", "heavy"] as const
export type Grain = (typeof GRAINS)[number]

// Small print over the art: none, or the marks of a technical drawing.
export const DETAILS = ["none", "micro"] as const
export type Detail = (typeof DETAILS)[number]

// none: a still cover. once: the art arrives and stays. loop: it arrives, then
// keeps moving gently.
export const MOTIONS = ["none", "once", "loop"] as const
export type MotionLevel = (typeof MOTIONS)[number]

export const THEMES = ["light", "dark"] as const
export type Theme = (typeof THEMES)[number]

// Where an area sits on the canvas.
export const PLACES = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const
export type Place = (typeof PLACES)[number]

export const AREA_SIZES = ["sm", "md", "lg"] as const
export type AreaSize = (typeof AREA_SIZES)[number]

// What the art does at an area. around: the content sits on the art, so the
// art keeps clear and the content's colour reads there. behind: the content
// covers the art, so the art may run on under it.
export const AREA_ART = ["around", "behind"] as const
export type AreaArt = (typeof AREA_ART)[number]

// A place for content. `box` is an exact one, in shares of the canvas, in
// place of `place` and `size`.
export type Area = {
  place?: Place
  size?: AreaSize
  box?: Box
  art?: AreaArt
}

// Sizes other platforms fix, to spread into an input.
export const formats = {
  og: { width: 1200, height: 630 },
} as const

// A cover with no size asked for.
export const DEFAULT_SIZE = { w: 1600, h: 900 }

// Beyond this a cover is a strip, and no recipe has been judged there.
export const MAX_RATIO = 4
// The longest side a scene is drawn at; a larger file is the same scene
// rasterised wider.
export const MOST_SIDE = 8192

// Every canvas has the area of a 1600x900 cover, so sizes in a recipe keep
// their proportion on any canvas.
export const CANVAS_SIDE = 1200

// A large area at four places, in shares of the canvas, as judged: the
// others are these turned round, and smaller areas are these drawn in toward
// the corner, edge or middle they hang from.
function large(place: "bottom-left" | "left" | "center" | "bottom", aspect: number): Box {
  const wide = aspect >= 1.3
  // On a strip an area takes a part of the length, not all of it, or nothing
  // is left for the art.
  const strip = aspect >= 2.4
  switch (place) {
    case "bottom-left":
      if (strip) return { x: 0.04, y: 0.48, w: 0.44, h: 0.44 }
      return wide ? { x: 0.06, y: 0.56, w: 0.6, h: 0.34 } : { x: 0.08, y: 0.62, w: 0.84, h: 0.3 }
    case "left":
      if (strip) return { x: 0.04, y: 0.2, w: 0.44, h: 0.6 }
      return wide ? { x: 0.07, y: 0.29, w: 0.56, h: 0.42 } : { x: 0.08, y: 0.34, w: 0.7, h: 0.32 }
    case "center":
      if (strip) return { x: 0.29, y: 0.24, w: 0.42, h: 0.52 }
      return wide ? { x: 0.22, y: 0.32, w: 0.56, h: 0.36 } : { x: 0.12, y: 0.36, w: 0.76, h: 0.28 }
    case "bottom":
      if (strip) return { x: 0.27, y: 0.5, w: 0.46, h: 0.42 }
      return wide ? { x: 0.08, y: 0.62, w: 0.84, h: 0.3 } : { x: 0.08, y: 0.66, w: 0.84, h: 0.26 }
  }
}

// How much of a large area's width and height a smaller one takes.
const SHRINK: Record<AreaSize, number> = { lg: 1, md: 0.75, sm: 0.42 }

// An area's box in shares of the canvas.
export function areaShare(place: Place, size: AreaSize, aspect: number): Box {
  const [row, column] =
    place === "center"
      ? ["middle", "middle"]
      : place === "left" || place === "right"
        ? ["middle", place]
        : place === "top" || place === "bottom"
          ? [place, "middle"]
          : (place.split("-") as [string, string])
  const base = row === "middle" ? (column === "middle" ? "center" : "left") : column === "middle" ? "bottom" : "bottom-left"
  let box = large(base, aspect)
  // Turned round for the right side and the top.
  if (column === "right") box = { ...box, x: 1 - box.x - box.w }
  if (row === "top") box = { ...box, y: 1 - box.y - box.h }
  const k = SHRINK[size]
  const w = box.w * k
  const h = box.h * k
  const x = column === "left" ? box.x : column === "right" ? box.x + box.w - w : box.x + (box.w - w) / 2
  const y = row === "top" ? box.y : row === "bottom" ? box.y + box.h - h : box.y + (box.h - h) / 2
  return { x, y, w, h }
}

export const scaleBox = (box: Box, w: number, h: number): Box => ({
  x: box.x * w,
  y: box.y * h,
  w: box.w * w,
  h: box.h * h,
})
