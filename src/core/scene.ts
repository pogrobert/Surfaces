import { smoothstep } from "./math.ts"

// A scene is plain data: no SVG, no functions, nothing that needs a browser.
// It can be stored, sent as JSON and drawn by any renderer.

// Named by distance from the ground, so a recipe reads the same in light and
// dark: "strong" is the deepest tone on paper and the brightest on black.
export const TONES = [
  "ground",
  "quiet",
  "soft",
  "body",
  "strong",
  "accent",
  // A second colour, for the one style built on a colour pair. Other styles
  // leave it alone.
  "partner",
  "ink",
] as const

export type Tone = (typeof TONES)[number]

export type Palette = Record<Tone, string>

export type Box = { x: number; y: number; w: number; h: number }

export type Stop = { at: number; tone: Tone; opacity: number }

export type Paint =
  | { type: "solid"; tone: Tone; opacity: number }
  | {
      type: "linear"
      x1: number
      y1: number
      x2: number
      y2: number
      stops: Stop[]
    }
  | { type: "radial"; cx: number; cy: number; r: number; stops: Stop[] }

export type Shape =
  // Radii run clockwise from the top left.
  | {
      type: "rect"
      x: number
      y: number
      w: number
      h: number
      radii: readonly [number, number, number, number]
    }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { type: "ring"; cx: number; cy: number; r: number; inner: number }
  // Flat x, y pairs, so a renderer never has to parse a path string.
  | { type: "polygon"; points: number[] }
  // A line that swells: flat x, y, half-width triples along its centre.
  | { type: "ribbon"; points: number[] }
  // Many upright blocks of one height: flat x, y, width triples from their top
  // left corners. A screen of thousands of cells is mostly these.
  | { type: "blocks"; h: number; points: number[] }

// How a mark moves, on a cover asked to. Plain data like the rest: the
// renderer turns it into CSS animation, which a still render leaves out and a
// reader who asks for less motion never sees. Times are in seconds.
export type Enter =
  // Fades in from nothing, sliding the last of the way from `dx`, `dy`. With
  // `pop`, it appears at once after its delay, as a printed cell does.
  // `scale` grows it from that size about its own middle. `even` fades at an
  // even pace instead of settling, for marks that arrive one after another:
  // their overlapping fades then make one smooth front, not a row of steps.
  | {
      kind: "fade"
      delay: number
      duration: number
      dx?: number
      dy?: number
      scale?: number
      pop?: boolean
      even?: boolean
    }
  // Lines drawn on along their length, each `stagger` after the one before.
  | { kind: "draw"; delay: number; duration: number; stagger: number }

// Every loop starts and ends on the still drawing. A loop starts when its
// mark has arrived, unless `start` says when, in seconds from the beginning:
// marks that move as parts of one thing keep one clock.
export type Loop = { start?: number } & LoopKind

type LoopKind =
  // Out to `dx`, `dy` and back. With `hold`, that share of the period is
  // spent still, half out there and half back home, and the moves between
  // are quick: for something fine, like grain, which shimmers as it creeps
  // across the pixels.
  | { kind: "drift"; dx: number; dy: number; period: number; hold?: number }
  // Swings `degrees` round a point and back, with `hold` as a drift has it.
  | { kind: "swing"; degrees: number; cx: number; cy: number; period: number; hold?: number }
  // Turns all the way round a point, without stopping.
  | { kind: "spin"; cx: number; cy: number; period: number }
  // Dims briefly once a period, `at` a share of the way through it: to
  // `low` of its opacity, nothing unless given, for `width` of the period.
  | { kind: "blink"; period: number; at: number; low?: number; width?: number }
  // Swells to `scale` about its own middle and back; with `low`, shrinks to
  // that too, half a period later. `after` holds it that much longer before
  // it starts, so swells can travel across a drawing.
  | { kind: "breathe"; scale: number; low?: number; period: number; after?: number }
  // Turns about its own middle by `degrees` at each of the moments `at`
  // (shares of the period), quickly, holding still between. The turns add up
  // to whole turns, so the period ends where it began.
  | { kind: "turns"; degrees: number; at: number[]; period: number }
  // Its opacity through `points`, pairs of a share of the period and an
  // opacity, joined by straight lines. The only loop that need not return to
  // where it began: it may jump at the end of the period, for marks that take
  // turns.
  | { kind: "fades"; points: [number, number][]; period: number }
  // Grows and shrinks about its own middle through `scales`, spaced evenly
  // over the period, and back to its own size.
  | { kind: "resize"; scales: number[]; period: number }
  // Brightens to `opacity` and back, growing to `scale` about its own middle
  // as it does when given one.
  | { kind: "rise"; opacity: number; scale?: number; period: number }
  // Travels `dx`, `dy` over `share` of each period, then waits there until
  // the period ends and it starts again from the beginning: for something
  // that crosses the drawing from outside it, unseen at both ends.
  | { kind: "pass"; dx: number; dy: number; period: number; share: number }
  // Circles round where it stands, `rx` across and `ry` down, starting there.
  | { kind: "orbit"; rx: number; ry: number; period: number }

// `exit` hides it for good that many seconds in, as something else takes its
// place on a moving cover; a still render never runs it.
export type Motion = { enter?: Enter; loop?: Loop; exit?: number }

export type Pool = {
  kind: "pool"
  id: string
  cx: number
  cy: number
  rx: number
  ry: number
  rotate: number
  tone: Tone
  opacity: number
  // Share of the radius that stays solid before the colour starts to fall off.
  core: number
  motion?: Motion
}

export type Shapes = {
  kind: "shapes"
  id: string
  paint: Paint
  shapes: Shape[]
  // Its own opacity, apart from its paint's: 0 keeps it hidden in a still
  // drawing, for marks that only show while the cover moves.
  opacity?: number
  motion?: Motion
}

export type Fill = { kind: "fill"; id: string; tone: Tone }

export type Mark = Pool | Shapes

// Words set in one of the bundled faces, each line from its baseline at x, y
// and as wide as the face measures it, so any renderer keeps the layout: a
// PNG draws the face's own outlines, an SVG names the face and holds every
// line to its width. `align` is where x is, as SVG's text-anchor has it.
export type TextLayer = {
  kind: "text"
  id: string
  // A bundled face, or the key of a site's own font (see fontfile.ts).
  font: "sans" | "serif" | `font:${string}`
  size: number
  // Space added after each character, in ems: below zero for display type,
  // which is set tighter than text. Every line's width includes it.
  tracking?: number
  tone: Tone
  align: "start" | "middle" | "end"
  lines: { text: string; x: number; y: number; width: number }[]
}

export type Layer =
  | Fill
  | Mark
  | TextLayer
  // Film grain over everything drawn so far.
  | { kind: "grain"; id: string; amount: number; scale: number; seed: number }
  // Light drawn as grain: the opacity of `layers` sets how densely `tone` is
  // stippled, as an aquatint plate holds ink. `wash` lays the same light down
  // smoothly underneath, for the tones between the grains.
  | {
      kind: "stipple"
      id: string
      tone: Tone
      scale: number
      hardness: number
      wash: number
      seed: number
      layers: Mark[]
      // Printed as an ink of its own: laid over what is below, a little out of
      // line with it, the way a second pass through a press lands. "normal"
      // only moves it out of line.
      ink?: { blend: "multiply" | "screen" | "normal"; dx: number; dy: number }
      // Moves the finished plate whole. A browser blends and moves a finished
      // layer cheaply, where moving marks inside the filter redraws it.
      motion?: Motion
      // How strongly the finished plate shows when still.
      opacity?: number
    }
  // A brand's own logo, drawn as it is and never recoloured: its file, fitted
  // inside the box at x, y and set to `align` along it.
  | {
      kind: "logo"
      id: string
      href: string
      x: number
      y: number
      w: number
      h: number
      align: "start" | "middle" | "end"
    }
  // Marks seen out of focus, softened by `radius`, and by `ry` up and down
  // when that differs: a smear rather than a blur.
  | { kind: "soften"; id: string; radius: number; ry?: number; layers: Mark[]; motion?: Motion }
  // What is drawn inside, kept to a shape with a sharp edge. Its motion moves
  // what is inside; the shape stays put.
  | { kind: "clip"; id: string; shape: Shape; layers: Layer[]; motion?: Motion; opacity?: number }
  // A long exposure of `layers`: warped, pulled along `angle` by `streak`, and
  // with everything brighter than `bloom` glowing as it does on film.
  | {
      kind: "blur"
      id: string
      angle: number
      streak: number
      warp: number
      bloom: number
      seed: number
      layers: (Fill | Mark)[]
      motion?: Motion
    }

export type SceneArea = {
  // How it was asked for: a place and size, or null for an exact box.
  place: string | null
  size: string | null
  art: "around" | "behind"
  // Whether the art keeps out of the area. Content around the art sits on it
  // either way: a large area in the middle has the art pass behind it under
  // a clearing of ground, so it is not kept clear.
  clear: boolean
  // The colour content on the art reads in there; with both themes, a CSS
  // variable that follows whichever shows.
  ink: string
  x: number
  y: number
  width: number
  height: number
}

export type Scene = {
  format: 1
  style: string
  recipe: number
  seed: string
  // Every coordinate is in these units. A canvas always has the same area, so
  // a cover drawn at 1200x630 and at 2400x1260 is the same drawing.
  size: { w: number; h: number }
  // The size that was asked for, written on the SVG.
  output: { w: number; h: number }
  palette: Palette
  // The colour content on the art reads in, on `palette` already.
  ink: string
  // Where content goes, as asked, in output pixels. The art keeps clear of an
  // area it goes around, and runs on under one it goes behind.
  areas: SceneArea[]
  // The approved shape this cover drew, when its style has a choice of them.
  shape?: string
  // The box the art's one subject keeps inside, when it has one.
  subject?: Box
  layers: Layer[]
  // A cover drawn for both themes carries its dark side too. Light and dark
  // are one drawing, so this is only the colours and the few layers a dark
  // ground draws differently; the renderer shows whichever the reader uses.
  // `inkVar` is the CSS variable the cover's rules set to whichever ink shows,
  // which an area's `ink` reads.
  dark?: { palette: Palette; ink: string; layers: Layer[]; inkVar: string }
}

// How a pool's colour falls off, shared so every renderer draws the same pool.
export function poolAlpha(t: number, core: number) {
  if (t <= core) return 1
  return 1 - smoothstep((t - core) / (1 - core))
}
