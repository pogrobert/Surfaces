import { cos, sin, TAU } from "../core/math.ts"
import { hash } from "../core/random.ts"
import { poolAlpha } from "../core/scene.ts"
import type {
  Box,
  Enter,
  Fill,
  Layer,
  Mark,
  Motion,
  Paint,
  Palette,
  Pool,
  Scene,
  Shape,
  Shapes,
  Stop,
} from "../core/scene.ts"

// Two decimals is far below a device pixel at any size a cover is shown, and
// keeps the string short. Rounding before printing also means every number
// has one spelling, on every engine.
export function num(value: number) {
  return String(Math.round(value * 100) / 100)
}

export const fraction = (value: number) => String(Math.round(value * 1000) / 1000)

// A tenth of a unit is well under a pixel, and a field of cells is thousands of
// these numbers.
const tenth = (value: number) => String(Math.round(value * 10) / 10)

function roundedPath(
  x: number,
  y: number,
  w: number,
  h: number,
  [a, b, c, d]: readonly [number, number, number, number]
) {
  const arc = (r: number, dx: number, dy: number) =>
    r > 0 ? `a${tenth(r)} ${tenth(r)} 0 0 1 ${tenth(dx)} ${tenth(dy)}` : ""
  return [
    `M${tenth(x + a)} ${tenth(y)}`,
    `h${tenth(w - a - b)}`,
    arc(b, b, b),
    `v${tenth(h - b - c)}`,
    arc(c, -c, c),
    `h${tenth(-(w - c - d))}`,
    arc(d, -d, -d),
    `v${tenth(-(h - d - a))}`,
    arc(a, a, -a),
    "z",
  ].join("")
}

function circlePath(cx: number, cy: number, r: number) {
  const radius = num(r)
  return (
    `M${num(cx - r)} ${num(cy)}` +
    `a${radius} ${radius} 0 1 1 ${num(r * 2)} 0` +
    `a${radius} ${radius} 0 1 1 ${num(-r * 2)} 0z`
  )
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
  const radii = `${num(rx)} ${num(ry)}`
  return (
    `M${num(cx - rx)} ${num(cy)}` +
    `a${radii} 0 1 1 ${num(rx * 2)} 0` +
    `a${radii} 0 1 1 ${num(-rx * 2)} 0z`
  )
}

// One decimal and relative steps: a page of hairlines is mostly points, and this
// is what keeps it small. Each step is taken from the rounded position before
// it, so the small errors never add up.
function ribbonPath(points: number[]) {
  const count = points.length / 3
  const side = (direction: 1 | -1) => {
    const edge: [number, number][] = []
    for (let i = 0; i < count; i++) {
      const before = Math.max(i - 1, 0) * 3
      const after = Math.min(i + 1, count - 1) * 3
      const dx = points[after]! - points[before]!
      const dy = points[after + 1]! - points[before + 1]!
      const length = Math.sqrt(dx * dx + dy * dy) || 1
      const half = points[i * 3 + 2]! * direction
      edge.push([
        points[i * 3]! - (dy / length) * half,
        points[i * 3 + 1]! + (dx / length) * half,
      ])
    }
    return edge
  }
  const outline = [...side(1), ...side(-1).reverse()]
  const tenth = (value: number) => Math.round(value * 10)
  let x = tenth(outline[0]![0])
  let y = tenth(outline[0]![1])
  let d = `M${x / 10} ${y / 10}l`
  for (const [px, py] of outline.slice(1)) {
    const nextX = tenth(px)
    const nextY = tenth(py)
    d += `${(nextX - x) / 10} ${(nextY - y) / 10} `
    x = nextX
    y = nextY
  }
  return `${d.trimEnd()}z`
}

// Each block is a relative move from the one before and a box drawn in
// relative steps, rounded to tenths as it goes, so no error builds up.
function blocksPath(h: number, points: number[]) {
  const tenth = (value: number) => Math.round(value * 10)
  const height = tenth(h) / 10
  let x = 0
  let y = 0
  let d = ""
  for (let i = 0; i < points.length; i += 3) {
    const nextX = tenth(points[i]!)
    const nextY = tenth(points[i + 1]!)
    const width = tenth(points[i + 2]!) / 10
    d += `${i ? "m" : "M"}${(nextX - x) / 10} ${(nextY - y) / 10}h${width}v${height}h${-width}z`
    x = nextX
    y = nextY
  }
  return d
}

export function shapePath(shape: Shape) {
  switch (shape.type) {
    case "rect":
      return roundedPath(shape.x, shape.y, shape.w, shape.h, shape.radii)
    case "circle":
      return circlePath(shape.cx, shape.cy, shape.r)
    case "ellipse":
      return ellipsePath(shape.cx, shape.cy, shape.rx, shape.ry)
    case "ring":
      return (
        circlePath(shape.cx, shape.cy, shape.r) +
        circlePath(shape.cx, shape.cy, shape.inner)
      )
    case "ribbon":
      return ribbonPath(shape.points)
    case "blocks":
      return blocksPath(shape.h, shape.points)
    case "polygon": {
      // In whole tenths of a unit, each point as a step from the one before:
      // a marbled sheet is tens of thousands of points. The steps are taken
      // between rounded points, so rounding never adds up along the way.
      const tenths = shape.points.map((value) => Math.round(value * 10))
      let path = `M${tenths[0]! / 10} ${tenths[1]! / 10}l`
      for (let i = 2; i < tenths.length; i += 2) {
        const dx = (tenths[i]! - tenths[i - 2]!) / 10
        const dy = (tenths[i + 1]! - tenths[i - 1]!) / 10
        path += `${i > 2 && dx >= 0 ? " " : ""}${dx}${dy >= 0 ? " " : ""}${dy}`
      }
      return `${path}z`
    }
  }
}

// A colour as an attribute. A cover drawn for both themes names its colours
// as CSS variables, which only a style property can read.
const colour = (name: string, value: string) =>
  value.startsWith("var(") ? `style="${name}:${value}"` : `${name}="${value}"`

function stopTags(stops: Stop[], palette: Palette) {
  return stops
    .map(
      (stop) =>
        `<stop offset="${fraction(stop.at)}" ${colour("stop-color", palette[stop.tone])}` +
        (stop.opacity < 1 ? ` stop-opacity="${fraction(stop.opacity)}"` : "") +
        "/>"
    )
    .join("")
}

// Sampled finely enough that the falloff never shows a kink under the grain.
const POOL_STEPS = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 1]

function poolStops(pool: Pool): Stop[] {
  const span = 1 - pool.core
  return [
    { at: 0, tone: pool.tone, opacity: 1 },
    ...POOL_STEPS.map((step) => {
      const at = pool.core + span * step
      return { at, tone: pool.tone, opacity: poolAlpha(at, pool.core) }
    }),
  ]
}

// Gradients are shared by content: the same falloff drawn many times, as a
// fluted pane does, is one definition.
export type Output = {
  defs: string[]
  body: string[]
  shared: Map<string, string>
  target: Target
  // Drawn as a layer of a page of its own, which does the blending: a blend
  // inside an SVG only reaches what that same SVG draws below it.
  unblend?: boolean
  // Animation rules, a count that keeps their names apart, and the names
  // given so far by what they say, so marks that move alike share one rule.
  css: string[]
  classes: Map<string, string>
  moving: { count: number }
}

// Who will draw the SVG. Browsers draw every filter here. resvg, the usual
// rasteriser for PNG export, panics inside a turned group in the release npm
// ships (resvg-js 2.6.2, from 2024) and takes the whole process down with it,
// so for resvg the long exposure is drawn in its simplest form.
export type Target = "browser" | "resvg"

export type RenderOptions = {
  target?: Target
  // Read out by screen readers instead of hiding the art from them, for an
  // SVG placed inline as content. describe(scene) writes one.
  label?: string
}

// Perlin noise is zero on its lattice, so a frequency near a whole number beats
// against the pixel grid and shows as a woven texture. Recipes keep their
// scales away from 1, the axes differ, and two octaves stop the next doubling
// from landing on a whole number instead.
const noise = (scale: number, seed: number) =>
  `<feTurbulence type="fractalNoise" baseFrequency="${fraction(scale)} ${fraction(scale * 0.93)}" numOctaves="2" seed="${seed}" result="n"/>`

function drawPool(pool: Pool, prefix: string, palette: Palette, out: Output) {
  const stops = stopTags(poolStops(pool), palette)
  let id = out.shared.get(stops)
  if (!id) {
    id = `${prefix}${pool.id}`
    out.shared.set(stops, id)
    out.defs.push(`<radialGradient id="${id}">${stops}</radialGradient>`)
  }
  const rotate = pool.rotate
    ? ` transform="rotate(${num(pool.rotate)} ${num(pool.cx)} ${num(pool.cy)})"`
    : ""
  const opacity =
    pool.opacity < 1 ? ` opacity="${fraction(pool.opacity)}"` : ""
  out.body.push(
    `<ellipse cx="${num(pool.cx)}" cy="${num(pool.cy)}" rx="${num(pool.rx)}" ry="${num(pool.ry)}"` +
      `${rotate}${opacity} fill="url(#${id})"/>`
  )
}

function paintAttributes(
  paint: Paint,
  id: string,
  palette: Palette,
  out: Output
) {
  if (paint.type === "solid") {
    return (
      colour("fill", palette[paint.tone]) +
      (paint.opacity < 1 ? ` fill-opacity="${fraction(paint.opacity)}"` : "")
    )
  }
  const stops = stopTags(paint.stops, palette)
  if (paint.type === "linear") {
    out.defs.push(
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse"` +
        ` x1="${num(paint.x1)}" y1="${num(paint.y1)}" x2="${num(paint.x2)}" y2="${num(paint.y2)}">${stops}</linearGradient>`
    )
  } else {
    out.defs.push(
      `<radialGradient id="${id}" gradientUnits="userSpaceOnUse"` +
        ` cx="${num(paint.cx)}" cy="${num(paint.cy)}" r="${num(paint.r)}">${stops}</radialGradient>`
    )
  }
  return `fill="url(#${id})"`
}

const secs = (value: number) => `${fraction(value)}s`
// Quick to start and slow to settle, as a thing set down does.
const SETTLE = "cubic-bezier(.2,.7,.15,1)"

// A browser takes a moment to draw a cover the first time, and the
// animation clock runs meanwhile. Nothing moves until this has passed, so the
// stall falls while the art is still waiting, not in the middle of it.
export const LEAD = 0.35

// When an arrival is over, so a loop can start from the still drawing.
export function arrived(enter: Enter | undefined, count: number) {
  if (!enter) return LEAD
  return LEAD + enter.delay + enter.duration + (enter.kind === "draw" ? enter.stagger * (count - 1) : 0)
}

// Puts the motion on an element. Fading runs on the element itself when it
// is a single shape, since animating a group's opacity makes the renderer
// draw the group apart on every frame; on one shape it is only the shape's
// alpha. Moving runs on groups round it, one for its arrival and one for its
// loop, so neither transform overwrites the other; a moving group costs
// nothing extra. The rules sit behind prefers-reduced-motion with the rest.
//
// On a page of layers (see layers.ts) the motion goes on HTML elements round
// the layer instead, which a browser moves on the graphics card without
// drawing anything again. Their distances are shares of `box`, the part of
// the canvas the layer covers, so they hold at any size; `centre` is the
// middle of what the layer draws, which scaling and turning in place go round.
export type Holder = { box: Box; centre: { x: number; y: number } }

export function moving(
  motion: Motion | undefined,
  element: string,
  prefix: string,
  out: Output,
  count = 1,
  // False when the arrival is drawn elsewhere, and only times the loop.
  arrive = true,
  // For a single shape, the opacity it is drawn at when still.
  single?: { base: number },
  // For a group, the opacity it is drawn at when still, when that is not 1.
  groupBase?: number,
  html?: Holder
) {
  if (!motion) return element
  const share = (value: number) => `${Math.round(value * 100000) / 1000}%`
  const across = (dx: number, dy: number) =>
    html ? `translate(${share(dx / html.box.w)},${share(dy / html.box.h)})` : `translate(${num(dx)}px,${num(dy)}px)`
  const about = (x: number, y: number) =>
    html ? `;transform-origin:${share((x - html.box.x) / html.box.w)} ${share((y - html.box.y) / html.box.h)}` : `;transform-box:view-box;transform-origin:${num(x)}px ${num(y)}px`
  const inPlace = html ? about(html.centre.x, html.centre.y) : ";transform-box:fill-box;transform-origin:center"
  const { enter, loop, exit } = motion
  // A rule is written once and named by what it says; a second mark that
  // moves the same way takes the same name.
  const shared = (key: string, css: (id: string) => string[]) => {
    let id = out.classes.get(key)
    if (!id) {
      id = `${prefix}m${out.moving.count++}`
      out.classes.set(key, id)
      out.css.push(...css(id))
    }
    return id
  }
  const keyframes = (frames: string) => shared(`@${frames}`, (id) => [`@keyframes ${id}{${frames}}`])
  const runs = (animation: string) => shared(`.${animation}`, (id) => [`.${id}{animation:${animation}}`])
  // Animations on the element itself, and the groups to wrap it in, inside out.
  const own: string[] = []
  const groups: string[] = []
  // The group whose opacity is animated carries the still opacity too, so
  // the animation replaces it rather than multiplying it.
  let faded: string | undefined
  // The group that leaves for good, and its animation's name.
  let leaving: { group?: string; name: string } | undefined
  const fadeOn = (frames: string, run: (id: string) => string, leaves = false) => {
    const name = keyframes(frames)
    const animation = run(name)
    if (single && !html) {
      own.push(animation)
      if (leaves) leaving = { name }
    } else {
      const id = runs(animation)
      faded ??= id
      groups.push(id)
      if (leaves) leaving = { group: id, name }
    }
  }
  if (arrive && enter?.kind === "fade") {
    const timing = enter.pop ? "steps(1,start)" : enter.even ? "linear" : SETTLE
    const when = `${secs(enter.duration)} ${timing} ${secs(LEAD + enter.delay)} backwards`
    fadeOn("from{opacity:0}", (id) => `${id} ${when}`)
    const moves = [
      enter.dx || enter.dy ? across(enter.dx ?? 0, enter.dy ?? 0) : "",
      enter.scale !== undefined ? `scale(${fraction(enter.scale)})` : "",
    ].filter(Boolean)
    if (moves.length) {
      const origin = enter.scale !== undefined ? inPlace : ""
      groups.push(runs(`${keyframes(`from{transform:${moves.join(" ")}}`)} ${when}${origin}`))
    }
  }
  if (loop) {
    const start = secs(
      loop.start !== undefined
        ? LEAD + loop.start
        : arrived(enter, count) + (loop.kind === "breathe" ? loop.after ?? 0 : 0)
    )
    if (loop.kind === "fades") {
      // Two points a hair apart are a cut, not a fade: the value holds, then
      // jumps, so marks that take turns change over on the very same frame.
      const frames = loop.points
        .map(([at, opacity], i) => {
          const next = loop.points[i + 1]
          const cut = next && next[0] - at < 0.002 ? ";animation-timing-function:steps(1,end)" : ""
          return `${fraction(at * 100)}%{opacity:${fraction(opacity)}${cut}}`
        })
        .join("")
      fadeOn(frames, (id) => `${id} ${secs(loop.period)} linear ${start} infinite`)
    } else if (loop.kind === "rise") {
      const base = single?.base ?? 1
      const when = `${secs(loop.period)} ease-in-out ${start} infinite`
      fadeOn(`0%,100%{opacity:${fraction(base)}}50%{opacity:${fraction(loop.opacity)}}`, (id) => `${id} ${when}`)
      if (loop.scale !== undefined) {
        groups.push(
          runs(`${keyframes(`0%,100%{transform:none}50%{transform:scale(${fraction(loop.scale)})}`)} ${when}${inPlace}`)
        )
      }
    } else if (loop.kind === "blink") {
      const base = single?.base ?? 1
      const half = ((loop.width ?? 0.07) * 100) / 2
      const at = Math.min(Math.max(loop.at * 100, half + 1), 99 - half)
      // Going out altogether is a flicker; only dimming is a swell, eased.
      const timing = loop.low ? "ease-in-out" : "linear"
      fadeOn(
        `0%,${tenth(at - half)}%,${tenth(at + half)}%,100%{opacity:${fraction(base)}}${tenth(at)}%{opacity:${fraction(base * (loop.low ?? 0))}}`,
        (id) => `${id} ${secs(loop.period)} ${timing} ${start} infinite`
      )
    } else {
      let frames: string
      let timing = "ease-in-out"
      let origin = ""
      if (loop.kind === "drift") {
        frames = outAndBack(`transform:${across(loop.dx, loop.dy)}`, loop.hold)
      } else if (loop.kind === "swing") {
        frames = outAndBack(`transform:rotate(${fraction(loop.degrees)}deg)`, loop.hold)
        origin = about(loop.cx, loop.cy)
      } else if (loop.kind === "spin") {
        frames = `to{transform:rotate(360deg)}`
        timing = "linear"
        origin = about(loop.cx, loop.cy)
      } else if (loop.kind === "turns") {
        // Each turn takes this share of the period; between turns it holds.
        const swift = Math.min(0.9 / loop.period, 0.6 / loop.at.length)
        const marks = [`0%{transform:none}`]
        loop.at.forEach((at, i) => {
          const from = Math.min(Math.max(at, 0), 1 - swift) * 100
          marks.push(
            `${tenth(from)}%{transform:rotate(${fraction(loop.degrees * i)}deg)}`,
            `${tenth(from + swift * 100)}%{transform:rotate(${fraction(loop.degrees * (i + 1))}deg)}`
          )
        })
        frames = `${marks.join("")}100%{transform:rotate(${fraction(loop.degrees * loop.at.length)}deg)}`
        origin = inPlace
      } else if (loop.kind === "resize") {
        const steps = loop.scales.length
        frames =
          `0%,100%{transform:none}` +
          loop.scales
            .map((scale, i) => (i ? `${tenth((i / steps) * 100)}%{transform:scale(${fraction(scale)})}` : ""))
            .join("")
        timing = "linear"
        origin = inPlace
      } else if (loop.kind === "pass") {
        const to = `transform:${across(loop.dx, loop.dy)}`
        frames = `0%{transform:none}${tenth(loop.share * 100)}%,100%{${to}}`
      } else if (loop.kind === "breathe") {
        frames =
          loop.low === undefined
            ? `0%,100%{transform:none}50%{transform:scale(${fraction(loop.scale)})}`
            : `0%,100%{transform:none}25%{transform:scale(${fraction(loop.scale)})}75%{transform:scale(${fraction(loop.low)})}`
        origin = inPlace
      } else {
        // Eight points round an ellipse that passes through where it stands.
        const points = Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * TAU
          return `${tenth((i / 8) * 100)}%{transform:${across(loop.rx * (cos(a) - 1), loop.ry * sin(a))}}`
        })
        frames = `${points.join("")}100%{transform:none}`
        timing = "linear"
      }
      groups.push(runs(`${keyframes(frames)} ${secs(loop.period)} ${timing} ${start} infinite${origin}`))
    }
  }
  // Gone for good: hidden as well as clear, so the browser stops painting it,
  // where something merely clear is still drawn every frame anything moves.
  if (exit !== undefined) {
    fadeOn("to{opacity:0;visibility:hidden;display:none}", (id) => `${id} .001s linear ${secs(LEAD + exit)} forwards`, true)
  }
  // Something gone for good is still in the page, and a browser keeps
  // redrawing what is hidden there, masks above all. It says when it leaves,
  // so a page that watches the cover can take it out (see watch in dom.ts).
  const gone = (name: string) => ` data-surface-exit="${name}"`
  let result = element
  if (own.length) {
    const id = runs(own.join(","))
    const mark = leaving && !leaving.group ? gone(leaving.name) : ""
    result = result.replace(/^<([a-z]+)/, `<$1 class="${id}"${mark}`)
  }
  if (html) {
    // Every holder fills the one round it. The still opacity sits on the one
    // whose opacity moves, or on the outermost when none does.
    const base = groupBase !== undefined && groupBase < 1 ? groupBase : undefined
    groups.forEach((id, index) => {
      const still =
        base !== undefined && (id === faded || (!faded && index === groups.length - 1)) ? ` style="opacity:${fraction(base)}"` : ""
      const mark = leaving?.group === id ? gone(leaving.name) : ""
      result = `<div class="${prefix}f ${id}"${still}${mark}>${result}</div>`
    })
    return result
  }
  for (const id of groups) {
    const still = id === faded && groupBase !== undefined && groupBase < 1 ? ` opacity="${fraction(groupBase)}"` : ""
    const mark = leaving?.group === id ? gone(leaving.name) : ""
    result = `<g class="${id}"${still}${mark}>${result}</g>`
  }
  return result
}

// Out to `to` and back over a period. With `hold`, that share of it is spent
// still: out by `move`, still there to halfway, home again, still.
function outAndBack(to: string, hold?: number) {
  if (!hold) return `0%,100%{transform:none}50%{${to}}`
  const move = ((1 - hold) / 2) * 100
  return `0%,${tenth(50 + move)}%,100%{transform:none}${tenth(move)}%,50%{${to}}`
}

// The line a shape is drawn along, for drawing it on.
function centreLine(shape: Shape) {
  if (shape.type === "ribbon") {
    const at: string[] = []
    for (let i = 0; i < shape.points.length; i += 3) {
      at.push(`${num(shape.points[i]!)} ${num(shape.points[i + 1]!)}`)
    }
    return { d: `M${at.join("L")}`, width: Math.max(...shape.points.filter((_, i) => i % 3 === 2)) * 2 + 2 }
  }
  return null
}

// A mask that uncovers a mark shape by shape: lines are drawn on along their
// length, anything else appears whole in its turn.
function drawOn(layer: Shapes, enter: Extract<Enter, { kind: "draw" }>, prefix: string, scene: Scene, out: Output) {
  const id = `${prefix}${layer.id}-on`
  const name = `${prefix}m${out.moving.count++}`
  const appear = `${prefix}m${out.moving.count++}`
  out.css.push(
    `@keyframes ${name}{from{stroke-dashoffset:1}}`,
    `.${name}{animation:${name} ${secs(enter.duration)} ${SETTLE} backwards}`,
    `@keyframes ${appear}{from{opacity:0}}`,
    `.${appear}{animation:${appear} ${secs(enter.duration * 0.4)} ${SETTLE} backwards}`
  )
  const parts = layer.shapes.map((shape, index) => {
    const delay = `style="animation-delay:${secs(LEAD + enter.delay + enter.stagger * index)}"`
    const line = centreLine(shape)
    return line
      ? `<path d="${line.d}" pathLength="1" stroke-dasharray="1 1" stroke-width="${num(line.width)}" class="${name}" ${delay}/>`
      : `<path d="${shapePath(shape)}" fill="#fff" stroke="none" class="${appear}" ${delay}/>`
  })
  out.defs.push(
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${num(scene.size.w)}" height="${num(scene.size.h)}">` +
      `<g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">${parts.join("")}</g></mask>`
  )
  return id
}

function drawLight(
  layer: Mark,
  prefix: string,
  scene: Scene,
  out: Output
) {
  const palette = scene.palette
  if (layer.kind === "pool") {
    const inner: Output = { ...out, body: [] }
    drawPool(layer, prefix, palette, inner)
    out.body.push(moving(layer.motion, inner.body.join(""), prefix, out, 1, true, { base: layer.opacity }))
    return
  }
  const attributes = paintAttributes(
    layer.paint,
    `${prefix}${layer.id}`,
    palette,
    out
  )
  const d = layer.shapes.map(shapePath).join("")
  // Everything in one path, which keeps a field of tiles small on the wire.
  // A ring's hole needs the even-odd rule.
  const rule = layer.shapes.some((shape) => shape.type === "ring")
    ? ' fill-rule="evenodd"'
    : ""
  const enter = layer.motion?.enter
  if (enter?.kind === "draw" && layer.shapes.length) {
    const mask = drawOn(layer, enter, prefix, scene, out)
    const element = `<path d="${d}" ${attributes}${rule} mask="url(#${mask})"/>`
    // The mask draws the arrival; the loop and any leaving are still the
    // mark's own.
    const { loop, exit } = layer.motion ?? {}
    const rest = loop || exit !== undefined ? { enter, ...(loop ? { loop } : null), ...(exit !== undefined ? { exit } : null) } : undefined
    out.body.push(moving(rest, element, prefix, out, layer.shapes.length, false, { base: 1 }))
    return
  }
  const own = layer.opacity !== undefined && layer.opacity < 1 ? ` opacity="${fraction(layer.opacity)}"` : ""
  out.body.push(moving(layer.motion, `<path d="${d}" ${attributes}${rule}${own}/>`, prefix, out, 1, true, { base: layer.opacity ?? 1 }))
}

function region(scene: Scene) {
  return `filterUnits="userSpaceOnUse" x="0" y="0" width="${num(scene.size.w)}" height="${num(scene.size.h)}"`
}

function drawGrain(
  layer: Extract<Layer, { kind: "grain" }>,
  prefix: string,
  scene: Scene,
  out: Output
) {
  const id = `${prefix}${layer.id}`
  const { w, h } = scene.size
  out.defs.push(
    `<filter id="${id}" ${region(scene)} color-interpolation-filters="sRGB">` +
      noise(layer.scale, layer.seed) +
      `<feColorMatrix values="2.6 0 0 0 -.8 2.6 0 0 0 -.8 2.6 0 0 0 -.8 0 0 0 0 1"/>` +
      `</filter>`
  )
  out.body.push(
    `<rect width="${num(w)}" height="${num(h)}" filter="url(#${id})" opacity="${fraction(layer.amount)}"${out.unblend ? "" : ' style="mix-blend-mode:soft-light"'}/>`
  )
}

function drawStipple(
  layer: Extract<Layer, { kind: "stipple" }>,
  prefix: string,
  scene: Scene,
  out: Output
) {
  const id = `${prefix}${layer.id}`
  const color = scene.palette[layer.tone]
  // The noise goes into alpha, stretched until it covers nearly 0 to 1. Added
  // to the light and pushed through a steep curve, it makes grains that are
  // dense where the light is strong and scatter away as it falls off.
  // Past the frame, so that an ink out of line still bleeds off the edge.
  const { w, h } = scene.size
  out.defs.push(
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="-60" y="-60" width="${num(w + 120)}" height="${num(h + 120)}" color-interpolation-filters="sRGB">` +
      noise(layer.scale, layer.seed) +
      `<feColorMatrix in="n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3.4 0 0 0 -1.2" result="d"/>` +
      `<feComposite in="SourceAlpha" in2="d" operator="arithmetic" k2="1" k3="1" k4="-1" result="s"/>` +
      `<feComponentTransfer in="s" result="g"><feFuncA type="linear" slope="${num(layer.hardness)}"/></feComponentTransfer>` +
      `<feFlood ${colour("flood-color", color)} result="c"/>` +
      `<feComposite in="c" in2="g" operator="in" result="dots"/>` +
      `<feComposite in="c" in2="SourceAlpha" operator="in" result="l"/>` +
      `<feComponentTransfer in="l" result="w"><feFuncA type="linear" slope="${fraction(layer.wash)}"/></feComponentTransfer>` +
      `<feMerge><feMergeNode in="w"/><feMergeNode in="dots"/></feMerge>` +
      `</filter>`
  )
  const inner: Output = { ...out, body: [] }
  for (const light of layer.layers) {
    drawLight(light, prefix, scene, inner)
  }
  const still = layer.opacity !== undefined && layer.opacity < 1 ? ` opacity="${fraction(layer.opacity)}"` : ""
  const plate = `<g filter="url(#${id})"${still}>${inner.body.join("")}</g>`
  const { ink } = layer
  // The finished plate moves whole, inside the ink's own placing. resvg
  // (resvg-js 2.6.2) panics, taking the process with it, when an ink out of
  // line by a fraction of a unit is drawn smaller than its own size: the
  // filter's buffers round to different heights. A whole unit never shows.
  const place = (value: number) => num(out.target === "resvg" ? Math.round(value) : value)
  const moved = moving(layer.motion, plate, prefix, out, 1, true, { base: layer.opacity ?? 1 })
  out.body.push(
    ink
      ? `<g transform="translate(${place(ink.dx)} ${place(ink.dy)})"${out.unblend ? "" : ` style="mix-blend-mode:${ink.blend}"`}>${moved}</g>`
      : moved
  )
}

function drawBlur(
  layer: Extract<Layer, { kind: "blur" }>,
  prefix: string,
  scene: Scene,
  out: Output
) {
  const id = `${prefix}${layer.id}`
  const { w, h } = scene.size
  // Past the frame on every side, so nothing pulled in from the edge is cut
  // off, and turned to the angle of travel: a filter can only blur along its
  // own axes.
  const bleed = Math.max(w, h) * 0.6
  const c = `${num(w / 2)} ${num(h / 2)}`
  const { streak, bloom } = layer
  const blur = (x: number, y: number, input: string, result: string) =>
    `<feGaussianBlur in="${input}" stdDeviation="${num(x)} ${num(y)}" result="${result}"/>`
  const region = `filterUnits="userSpaceOnUse" x="${num(-bleed)}" y="${num(-bleed)}" width="${num(w + bleed * 2)}" height="${num(h + bleed * 2)}" color-interpolation-filters="sRGB"`
  if (out.target === "resvg") {
    // resvg-js 2.6.2 panics on any step that joins two results inside a
    // turned group, so it gets the pull alone: one long blur, no warp and no
    // glow. Flatter than the browser's, but the same drawing.
    out.defs.push(
      `<filter id="${id}" ${region}>${blur(streak * 0.7, streak / 9, "SourceGraphic", "far")}</filter>`
    )
  } else {
  // Three lengths of the same pull, because a real long exposure holds both
  // the smear and the shape it came from.
  out.defs.push(
    `<filter id="${id}" ${region}>` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.0016 0.0042" numOctaves="1" seed="${layer.seed}" result="n"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="n" scale="${num(layer.warp)}" xChannelSelector="R" yChannelSelector="G" result="bent"/>` +
      blur(streak, streak / 6, "bent", "far") +
      blur(streak / 2, streak / 11, "bent", "mid") +
      blur(streak / 5, streak / 16, "bent", "near") +
      `<feComposite in="far" in2="mid" operator="arithmetic" k2=".55" k3=".45" result="soft"/>` +
      `<feComposite in="soft" in2="near" operator="arithmetic" k2=".66" k3=".34" result="body"/>` +
      `<feColorMatrix in="body" values=".3 .59 .11 0 ${fraction(-bloom)} .3 .59 .11 0 ${fraction(-bloom - 0.04)} .3 .59 .11 0 ${fraction(-bloom - 0.12)} 0 0 0 0 1" result="bright"/>` +
      blur(streak * 0.9, streak * 0.5, "bright", "glow") +
      `<feBlend in="glow" in2="body" mode="screen"/>` +
      `</filter>`
  )
  }
  const inner: Output = { ...out, body: [] }
  for (const item of layer.layers) {
    if (item.kind === "fill") {
      inner.body.push(fillRect(item, scene, bleed))
    } else {
      drawLight(item, prefix, scene, inner)
    }
  }
  out.body.push(
    moving(
      layer.motion,
      `<g transform="rotate(${num(layer.angle)} ${c})"><g filter="url(#${id})">` +
        `<g transform="rotate(${num(-layer.angle)} ${c})">${inner.body.join("")}</g></g></g>`,
      prefix,
      out
    )
  )
}

function drawSoften(
  layer: Extract<Layer, { kind: "soften" }>,
  prefix: string,
  scene: Scene,
  out: Output
) {
  const id = `${prefix}${layer.id}`
  const { w, h } = scene.size
  const ry = layer.ry ?? layer.radius
  // Past the frame by the blur's own reach, so nothing fades at the edge.
  const bleed = Math.max(layer.radius, ry) * 3
  out.defs.push(
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="${num(-bleed)}" y="${num(-bleed)}" width="${num(w + bleed * 2)}" height="${num(h + bleed * 2)}" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur stdDeviation="${num(layer.radius)}${ry === layer.radius ? "" : ` ${num(ry)}`}"/></filter>`
  )
  const inner: Output = { ...out, body: [] }
  for (const item of layer.layers) drawLight(item, prefix, scene, inner)
  out.body.push(moving(layer.motion, `<g filter="url(#${id})">${inner.body.join("")}</g>`, prefix, out))
}

function fillRect(layer: Fill, scene: Scene, bleed = 0) {
  const { w, h } = scene.size
  const place = bleed ? ` x="${num(-bleed)}" y="${num(-bleed)}"` : ""
  return `<rect${place} width="${num(w + bleed * 2)}" height="${num(h + bleed * 2)}" ${colour("fill", scene.palette[layer.tone])}/>`
}

// The photo's luminance, or its darkness, into the alpha channel.
const lumaToAlpha = (invert: boolean) =>
  invert
    ? `<feColorMatrix in="SourceGraphic" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .2126 .7152 .0722 0 0" result="t"/>`
    : `<feColorMatrix in="SourceGraphic" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -.2126 -.7152 -.0722 0 1" result="t"/>`

// A tile of thresholds, as a small SVG of its own, for feImage to repeat. Dots
// are a grey ramp from the middle of each dot out; Bayer is 64 flat greys.
function screenTile(screen: "dots" | "bayer", cell: number) {
  if (screen === "bayer") {
    const order = [
      0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14,
      46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19,
      59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29,
      53, 21,
    ]
    const size = cell * 8
    const rects = order
      .map((rank, i) => {
        const grey = Math.round(((rank + 0.5) / 64) * 255)
        return `<rect x="${num((i % 8) * cell)}" y="${num(Math.floor(i / 8) * cell)}" width="${num(cell)}" height="${num(cell)}" fill="rgb(${grey},${grey},${grey})"/>`
      })
      .join("")
    return { size, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${num(size)}" height="${num(size)}" shape-rendering="crispEdges">${rects}</svg>` }
  }
  // Dots on a grid turned 45 degrees: one in each corner and one in the middle.
  // A dot's threshold is highest at its middle, so the lightest tones still
  // ink a speck there, and the dark between the dots never inks at all.
  const size = cell * 1.4142
  const r = size / 2
  const dot = (x: number, y: number) =>
    `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="url(#d)"/>`
  return {
    size,
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${num(size)}" height="${num(size)}">` +
      `<defs><radialGradient id="d"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient></defs>` +
      `<rect width="${num(size)}" height="${num(size)}" fill="#000"/>` +
      dot(0, 0) + dot(size, 0) + dot(0, size) + dot(size, size) + dot(r, r) +
      `</svg>`,
  }
}

const svgData = (svg: string) =>
  `data:image/svg+xml,${svg.replace(/#/g, "%23").replace(/"/g, "'").replace(/</g, "%3C").replace(/>/g, "%3E")}`

function drawPicture(
  layer: Extract<Layer, { kind: "picture" }>,
  prefix: string,
  scene: Scene,
  out: Output
) {
  const { w, h } = scene.size
  const region = `filterUnits="userSpaceOnUse" x="0" y="0" width="${num(w)}" height="${num(h)}" color-interpolation-filters="sRGB"`
  layer.treatments.forEach((treatment, index) => {
    const id = `${prefix}${layer.id}${index}`
    const color = scene.palette[treatment.tone]
    let steps: string
    if (treatment.type === "toner") {
      const span = Math.max(treatment.high - treatment.low, 0.01)
      steps =
        lumaToAlpha(treatment.invert) +
        // Only the stretch of tone between the two levels holds ink.
        `<feComponentTransfer in="t" result="a"><feFuncA type="linear" slope="${fraction(1 / span)}" intercept="${fraction(-treatment.low / span)}"/></feComponentTransfer>` +
        noise(treatment.scale, treatment.seed) +
        `<feColorMatrix in="n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3.4 0 0 0 -1.2" result="d"/>` +
        `<feComposite in="a" in2="d" operator="arithmetic" k2="1" k3="1" k4="-1" result="s"/>` +
        `<feComponentTransfer in="s" result="g"><feFuncA type="linear" slope="${num(treatment.hardness)}"/></feComponentTransfer>` +
        `<feFlood ${colour("flood-color", color)} result="c"/>` +
        `<feComposite in="c" in2="g" operator="in" result="dots"/>` +
        `<feComposite in="c" in2="a" operator="in" result="l"/>` +
        `<feComponentTransfer in="l" result="wash"><feFuncA type="linear" slope="${fraction(treatment.wash)}"/></feComponentTransfer>` +
        `<feMerge><feMergeNode in="wash"/><feMergeNode in="dots"/></feMerge>`
    } else {
      const tile = screenTile(treatment.screen, treatment.cell)
      // Each channel: the photo's tone, less the threshold, plus a half. Where
      // that falls under a half the cell takes ink.
      const luma = treatment.invert
        ? `<feColorMatrix in="SourceGraphic" values="-.2126 -.7152 -.0722 0 1 -.2126 -.7152 -.0722 0 1 -.2126 -.7152 -.0722 0 1 0 0 0 0 1" result="t"/>`
        : `<feColorMatrix in="SourceGraphic" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 0 1" result="t"/>`
      steps =
        luma +
        `<feImage href="${svgData(tile.svg)}" x="0" y="0" width="${num(tile.size)}" height="${num(tile.size)}" result="tile"/>` +
        `<feTile in="tile" result="screen"/>` +
        `<feComposite in="t" in2="screen" operator="arithmetic" k2="1" k3="-1" k4="0.5" result="v"/>` +
        `<feColorMatrix in="v" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -60 0 0 0 30" result="g"/>` +
        `<feFlood ${colour("flood-color", color)} result="c"/>` +
        `<feComposite in="c" in2="g" operator="in"/>`
    }
    out.defs.push(`<filter id="${id}" ${region}>${steps}</filter>`)
    const image = `<image href="${layer.href}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="${layer.fit}" filter="url(#${id})"/>`
    const offset = treatment.type === "toner" ? treatment.offset : undefined
    out.body.push(
      offset
        ? `<g transform="translate(${num(offset.dx)} ${num(offset.dy)})" style="mix-blend-mode:${offset.blend}">${image}</g>`
        : image
    )
  })
}

function drawClip(
  layer: Extract<Layer, { kind: "clip" }>,
  prefix: string,
  scene: Scene,
  out: Output
) {
  const id = `${prefix}${layer.id}`
  out.defs.push(
    `<clipPath id="${id}"><path d="${shapePath(layer.shape)}"${layer.shape.type === "ring" ? ' clip-rule="evenodd"' : ""}/></clipPath>`
  )
  const inner: Output = { ...out, body: [] }
  for (const item of layer.layers) drawLayer(item, prefix, scene, inner)
  out.body.push(
    `<g clip-path="url(#${id})">${moving(layer.motion, inner.body.join(""), prefix, out, 1, true, undefined, layer.opacity)}</g>`
  )
}

export function drawLayer(layer: Layer, prefix: string, scene: Scene, out: Output) {
  switch (layer.kind) {
    case "fill":
      out.body.push(fillRect(layer, scene))
      break
    case "pool":
    case "shapes":
      drawLight(layer, prefix, scene, out)
      break
    case "grain":
      drawGrain(layer, prefix, scene, out)
      break
    case "stipple":
      drawStipple(layer, prefix, scene, out)
      break
    case "blur":
      drawBlur(layer, prefix, scene, out)
      break
    case "soften":
      drawSoften(layer, prefix, scene, out)
      break
    case "clip":
      drawClip(layer, prefix, scene, out)
      break
    case "picture":
      drawPicture(layer, prefix, scene, out)
      break
  }
}

const escapeText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// Ids carry a hash of the drawing, so two covers inline on one page never
// reach into each other's gradients. One drawing at two sizes can share them.
export const idPrefix = (scene: Scene) =>
  `s${hash(JSON.stringify({ ...scene, output: null })).toString(36)}-`


// The colours of a cover drawn for both themes: a layer the same in both reads
// them from variables set on the cover's own root (the `t` class), and one
// that differs is drawn twice, each side showing only in its theme. The
// reader's system setting by default; inline on a page, a site's own switch
// wins: a dark or light class, or a data-theme attribute, on any element
// around the cover.
export function themeRules(scene: Scene, dark: NonNullable<Scene["dark"]>, prefix: string): string[] {
  const set = (palette: Palette) =>
    Object.entries(palette).map(([tone, value]) => `--sf-${tone}:${value}`).join(";")
  const root = `.${prefix}t`
  // The ink, as a variable set for the whole page, so content laid anywhere
  // over the cover can read it: on the page's root, or on whatever element
  // carries a site's own theme switch.
  const ink = (scope: string, value: string) => `${scope.trim() || ":root"}{${dark.inkVar}:${value}}`
  const lightRules = (scope: string) =>
    `${scope}${root}{${set(scene.palette)}}${scope}.${prefix}l{display:inline}${scope}.${prefix}d{display:none}` +
    ink(scope, scene.ink)
  const darkRules = (scope: string) =>
    `${scope}${root}{${set(dark.palette)}}${scope}.${prefix}l{display:none}${scope}.${prefix}d{display:inline}` +
    ink(scope, dark.ink)
  return [
    lightRules(""),
    `@media (prefers-color-scheme:dark){${darkRules("")}}`,
    lightRules(`:is(.light,[data-theme="light"]) `),
    darkRules(`:is(.dark,[data-theme="dark"]) `),
  ]
}

// The palette of a layer drawn once for both themes.
export const themeVars = (scene: Scene) =>
  Object.fromEntries(Object.keys(scene.palette).map((tone) => [tone, `var(--sf-${tone})`])) as Palette

export function toSvg(scene: Scene, options: RenderOptions = {}) {
  const prefix = idPrefix(scene)
  const { w, h } = scene.size
  const target = options.target ?? "browser"
  if (target !== "browser" && target !== "resvg") {
    throw new Error(`Unknown render target "${target}"`)
  }
  const out: Output = {
    defs: [],
    body: [],
    shared: new Map(),
    target,
    css: [],
    moving: { count: 0 },
    classes: new Map(),
  }
  // A rasteriser has no light or dark mode, so it draws the light side.
  const dark = target === "browser" ? scene.dark : undefined
  const themes: string[] = []
  if (!dark) {
    for (const layer of scene.layers) drawLayer(layer, prefix, scene, out)
  } else {
    // A layer the same in both themes is drawn once, its colours read from
    // variables that the theme sets on this SVG's own root, so they never
    // reach another cover. One that differs is drawn twice, and each shows
    // only in its own theme.
    const shared = { ...scene, palette: themeVars(scene) }
    const pairs = scene.layers.length === dark.layers.length
    const each = (layers: Layer[], palette: Palette, side: string) => {
      const inner: Output = { ...out, body: [] }
      for (const layer of layers) drawLayer(layer, `${prefix}${side}`, { ...scene, palette }, inner)
      out.body.push(`<g class="${prefix}${side}">${inner.body.join("")}</g>`)
    }
    if (!pairs) {
      each(scene.layers, scene.palette, "l")
      each(dark.layers, dark.palette, "d")
    } else {
      scene.layers.forEach((layer, index) => {
        const other = dark.layers[index]!
        if (JSON.stringify(layer) === JSON.stringify(other)) drawLayer(layer, prefix, shared, out)
        else {
          each([layer], scene.palette, "l")
          each([other], dark.palette, "d")
        }
      })
    }
    themes.push(...themeRules(scene, dark, prefix))
  }
  // Still, always. An SVG in an <img> can't be paused by its page or rested
  // off screen, and a browser draws the whole image again on every frame
  // anything in it moves; a moving cover is toHtml's. What a loop draws over
  // the still drawing waits at opacity 0, so leaving the rules out leaves the
  // still drawing.
  const rules = themes.join("")
  const style = rules ? `<style>${rules}</style>` : ""

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(w)} ${num(h)}" width="${scene.output.w}" height="${scene.output.h}"` +
    `${dark ? ` class="${prefix}t"` : ""} preserveAspectRatio="xMidYMid slice"${options.label ? ' role="img"' : ' aria-hidden="true"'}>` +
    (options.label ? `<title>${escapeText(options.label)}</title>` : "") +
    `${style}<defs>${out.defs.join("")}</defs>${out.body.join("")}</svg>`
  )
}
