import { cos, radians, sin } from "../core/math.ts"
import type { Box, Layer, Motion, Scene, Shape } from "../core/scene.ts"
import { drawLayer, fraction, idPrefix, moving, num, shapePath, themeRules, themeVars } from "./svg.ts"
import type { Output, RenderOptions } from "./svg.ts"

// A moving cover as a stack of layers, for placing inline. Inside one SVG, a
// browser has to draw the whole SVG again on every frame anything in it
// moves, blurs and grain included, for as long as it moves. So here every
// piece that keeps moving is drawn once, into an SVG of its own, and held by
// HTML elements that do the moving: a browser moves and fades those on the
// graphics card, as a game moves a picture it has already drawn, and draws
// nothing again. Everything still is drawn into plain SVG sheets between
// them. A loop then costs about what showing the page costs.
//
// Every layer covers only the part of the canvas it draws, and as much more
// as it moves, since each one is a picture the graphics card keeps. An
// arrival may still draw inside its sheet; it plays once and is done.
//
//   el.innerHTML = toHtml(generate({ style, seed, motion: "loop" }))
export type HtmlOptions = Pick<RenderOptions, "label"> & {
  // Fills the element it is placed in, cropping as the SVG's "slice" does,
  // instead of taking the cover's own proportions.
  fill?: boolean
}

type Context = {
  // The scene with the colours this part is drawn in.
  scene: Scene
  // Starts the ids of what this part defines: the cover's own, or one side's.
  ids: string
  // Starts every class: the cover's own.
  root: string
  // One set of animation rules for the whole cover.
  out: Output
  // The shapes that clip moving layers, written once into a hidden SVG.
  clips: string[]
}

export function toHtml(scene: Scene, options: HtmlOptions = {}) {
  const root = idPrefix(scene)
  const { w, h } = scene.size
  const canvas: Box = { x: 0, y: 0, w, h }
  const out: Output = { defs: [], body: [], shared: new Map(), target: "browser", css: [], classes: new Map(), moving: { count: 0 } }
  const context: Context = { scene, ids: root, root, out, clips: [] }
  const dark = scene.dark
  let body: string
  if (!dark) {
    body = stack(scene.layers.map((layer) => ({ layer })), context, canvas, canvas)
  } else if (scene.layers.length !== dark.layers.length) {
    // Two drawings: each side whole, and only its own theme shows it.
    const side = (layers: Layer[], name: string, palette: Scene["palette"]) =>
      `<div class="${root}f ${root}${name}">${stack(
        layers.map((layer) => ({ layer })),
        { ...context, ids: `${root}${name}`, scene: { ...scene, palette } },
        canvas,
        canvas
      )}</div>`
    body = side(scene.layers, "l", scene.palette) + side(dark.layers, "d", dark.palette)
  } else {
    const items = scene.layers.map((layer, index): Item => {
      const other = dark.layers[index]!
      return JSON.stringify(layer) === JSON.stringify(other) ? { layer, both: true } : { layer, dark: other }
    })
    body = stack(items, context, canvas, canvas)
  }

  const rules =
    `.${root}f{position:absolute;left:0;top:0;width:100%;height:100%;display:block}` +
    // The drawing is centred and covers the element, as the SVG's own "slice".
    `.${root}c{position:absolute;left:50%;top:50%;width:max(100cqw,calc(100cqh * ${fraction(w / h)}));aspect-ratio:${num(w)}/${num(h)};transform:translate(-50%,-50%)}` +
    (dark ? themeRules(scene, dark, root).join("") : "") +
    (out.css.length ? `@media (prefers-reduced-motion:no-preference){${out.css.join("")}}` : "")
  const size = options.fill ? "width:100%;height:100%" : `width:100%;aspect-ratio:${num(w)}/${num(h)}`
  const clips = context.clips.length
    ? `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${context.clips.join("")}</defs></svg>`
    : ""
  const spoken = options.label ? ` role="img" aria-label="${escapeAttribute(options.label)}"` : ' aria-hidden="true"'
  return (
    `<div class="${root}k${dark ? ` ${root}t` : ""}" style="position:relative;overflow:hidden;isolation:isolate;container-type:size;${size}"${spoken}>` +
    `<style>${rules}</style>${clips}<div class="${root}c">${body}</div></div>`
  )
}

// A layer and how it differs between themes: the same in both, drawn once in
// colours the theme sets; different, drawn once for each side; or, with
// neither, a cover of one theme.
type Item = { layer: Layer; both?: boolean; dark?: Layer }

// The layers in order, as sheets of still drawing between layers that move.
// `frame` is the part of the canvas the element holding them covers, and
// `limit` the part worth drawing. A still layer that nothing moving above
// the last sheet comes near joins that sheet, under them, since it looks the
// same there: a field of tiles with a few turning is two layers, not dozens.
type Entry = { items: Item[] } | { html: string; box: Box | null }

function stack(items: Item[], context: Context, frame: Box, limit: Box): string {
  const entries: Entry[] = []
  let open = -1
  for (const item of items) {
    const layers = item.dark ? [item.layer, item.dark] : [item.layer]
    if (layers.some(loops) || layers.some(arrivesFiltered)) {
      for (const [part, show] of sides(item, context)) {
        const held = hold(part.layer, part.context, frame, limit)
        entries.push({ html: show(held.html), box: held.box })
      }
      continue
    }
    // A blend reaches only what its own SVG draws below it, so a blended
    // layer over other sheets is a sheet of its own, blended as a whole. Over
    // one sheet that holds everything below, it stays in it.
    const blend = layers.map(blendOf).find(Boolean)
    const alone = entries.length === 1 && open === 0
    if (blend && entries.length && !alone) {
      for (const [part, show] of sides(item, context)) {
        entries.push({ html: show(sheet([{ layer: part.layer }], part.context, frame, limit, blendOf(part.layer))), box: null })
      }
      continue
    }
    const reach = join(layers.map(bounds))
    const clear = open >= 0 && entries.slice(open + 1).every((entry) => "items" in entry || !overlaps(entry.box, reach))
    if (clear) (entries[open] as { items: Item[] }).items.push(item)
    else {
      entries.push({ items: [item] })
      open = entries.length - 1
    }
  }
  return entries.map((entry) => ("items" in entry ? sheet(entry.items, context, frame, limit) : entry.html)).join("")
}

// Whether two parts of the canvas meet; null is all of it.
const overlaps = (a: Box | null, b: Box | null) =>
  !a || !b || (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)

// An item's layers, each with the colours it is drawn in, and what shows it.
function sides(item: Item, context: Context) {
  const { scene, root } = context
  const none = (html: string) => html
  if (item.both) return [[{ layer: item.layer, context: { ...context, scene: { ...scene, palette: themeVars(scene) } } }, none]] as const
  if (!item.dark) return [[{ layer: item.layer, context }, none]] as const
  const only = (side: string) => (html: string) => (html ? `<div class="${root}f ${root}${side}">${html}</div>` : "")
  return [
    [{ layer: item.layer, context: { ...context, ids: `${root}l` } }, only("l")],
    [{ layer: item.dark, context: { ...context, ids: `${root}d`, scene: { ...scene, palette: scene.dark!.palette } } }, only("d")],
  ] as const
}

const fresh = (context: Context, blend?: string): Output => ({ ...context.out, defs: [], body: [], shared: new Map(), unblend: !!blend })

// Still layers drawn into one SVG, over the part of `limit` they reach.
function sheet(items: Item[], context: Context, frame: Box, limit: Box, blend?: string) {
  const { scene, root } = context
  const out = fresh(context, blend)
  const reach: (Box | null)[] = []
  for (const item of items) {
    if (item.both) {
      drawLayer(item.layer, context.ids, { ...scene, palette: themeVars(scene) }, out)
    } else if (item.dark) {
      for (const [layer, side, palette] of [
        [item.layer, "l", scene.palette],
        [item.dark, "d", scene.dark!.palette],
      ] as const) {
        const inner: Output = { ...out, body: [] }
        drawLayer(layer, `${root}${side}`, { ...scene, palette }, inner)
        out.body.push(`<g class="${root}${side}">${inner.body.join("")}</g>`)
        reach.push(bounds(layer))
      }
      continue
    } else {
      drawLayer(item.layer, context.ids, scene, out)
    }
    reach.push(bounds(item.layer))
  }
  const box = meet(join(reach), limit)
  if (!box || !out.body.length) return ""
  return svg(root, box, out, `${placed(box, frame)}${blend ? `;mix-blend-mode:${blend}` : ""}`)
}

// One SVG showing `box` of the canvas.
const svg = (root: string, box: Box, out: Output, style: string) =>
  `<svg class="${root}f" viewBox="${num(box.x)} ${num(box.y)} ${num(box.w)} ${num(box.h)}" preserveAspectRatio="none"${style ? ` style="${style}"` : ""}>` +
  `${out.defs.length ? `<defs>${out.defs.join("")}</defs>` : ""}${out.body.join("")}</svg>`

const share = (value: number) => `${Math.round(value * 100000) / 1000}%`
const placed = (box: Box, frame: Box) =>
  `left:${share((box.x - frame.x) / frame.w)};top:${share((box.y - frame.y) / frame.h)};width:${share(box.w / frame.w)};height:${share(box.h / frame.h)}`

// A layer that keeps moving, on HTML elements of its own.
// Returns the part of the canvas it can reach as it moves.
function hold(layer: Layer, context: Context, frame: Box, limit: Box): { html: string; box: Box | null } {
  const { scene, root } = context
  if (layer.kind === "clip") {
    // The shape stays put and clips; its motion moves what is inside, which
    // is laid out over the same frame.
    const motion = layer.motion
    const shown = meet(shapeBounds(layer.shape), limit)
    if (!shown) return { html: "", box: null }
    const centre = middle(join(layer.layers.map(bounds)) ?? shown)
    const content = stack(layer.layers.map((child) => ({ layer: child })), context, frame, seen(shown, motion, centre))
    const opacity = layer.opacity ?? 1
    const moved = moving(motion, content, root, context.out, 1, true, { base: opacity }, opacity, { box: frame, centre })
    const still = !motion && opacity < 1 ? `opacity:${fraction(opacity)};` : ""
    const whole = layer.shape.type === "rect" && layer.shape.radii.every((r) => r === 0) && contains(shapeBounds(layer.shape), limit)
    const clip = whole ? "" : clipStyle(layer, context, frame)
    return { html: `<div class="${root}f"${still || clip ? ` style="${still}${clip}"` : ""}>${moved}</div>`, box: shown }
  }
  if (layer.kind === "fill" || layer.kind === "grain" || layer.kind === "picture" || layer.kind === "text" || layer.kind === "logo" || !(layer.motion?.loop || arrivesFiltered(layer))) {
    // Its loop is inside a filter, which can't be lifted out without changing
    // the picture: drawn again on every frame. The styles avoid this, and the
    // tests hold them to it.
    return { html: sheet([{ layer }], context, frame, limit), box: null }
  }

  const motion = layer.motion!
  // Drawn whole and at full strength; the holders carry its still opacity,
  // so a fade replaces it rather than multiplying it.
  const base = layer.kind === "pool" ? layer.opacity : layer.kind === "shapes" || layer.kind === "stipple" ? layer.opacity ?? 1 : 1
  // A line drawn on is drawn inside its SVG; all that follows moves the holder.
  const drawOn = motion.enter?.kind === "draw"
  const still = {
    ...layer,
    motion: drawOn ? { enter: motion.enter } : undefined,
    ...(layer.kind === "pool" ? { opacity: 1 } : layer.kind === "shapes" || layer.kind === "stipple" ? { opacity: undefined } : null),
  } as Layer
  const blend = blendOf(layer)
  const out = fresh(context, blend)
  drawLayer(still, context.ids, scene, out)
  const drawn = bounds(still)
  const box = meet(drawn, seen(limit, motion, middle(drawn ?? limit)))
  if (!box || !out.body.length) return { html: "", box: null }
  const count = layer.kind === "shapes" ? layer.shapes.length : 1
  const moved = moving(motion, svg(root, box, out, ""), root, context.out, count, !drawOn, { base }, base, {
    box,
    centre: middle(drawn ?? box),
  })
  // Kept a layer of its own when its arrival is over too: folded back into
  // the page, it would be drawn again then, which stalls a frame and lands a
  // shade different.
  return {
    html: `<div class="${root}f" style="${placed(box, frame)};will-change:transform${blend ? `;mix-blend-mode:${blend}` : ""}">${moved}</div>`,
    box: covered(box, motion),
  }
}

// The part of the canvas a layer over `box` covers at some time as it moves.
function covered(box: Box, motion: Motion): Box {
  const enter = motion.enter
  const loop = motion.loop
  const centre = middle(box)
  const corner = length(box.w / 2, box.h / 2)
  const round = (x: number, y: number, r: number): Box => ({ x: x - r, y: y - r, w: r * 2, h: r * 2 })
  const scale = Math.max(1, enter?.kind === "fade" ? enter.scale ?? 1 : 1, loop?.kind === "breathe" ? Math.max(loop.scale, loop.low ?? 0) : 1, loop?.kind === "rise" ? loop.scale ?? 1 : 1, loop?.kind === "resize" ? Math.max(...loop.scales) : 1)
  let reach = scale > 1 || loop?.kind === "turns" ? round(centre.x, centre.y, corner * scale) : box
  if (loop?.kind === "swing" || loop?.kind === "spin") {
    // Round its pivot, as far as its furthest corner.
    const far = Math.max(
      ...[box.x, box.x + box.w].flatMap((x) => [box.y, box.y + box.h].map((y) => length(x - loop.cx, y - loop.cy)))
    )
    reach = round(loop.cx, loop.cy, far)
  }
  let shift = enter?.kind === "fade" ? length(enter.dx ?? 0, enter.dy ?? 0) : 0
  if (loop?.kind === "drift" || loop?.kind === "pass") shift = Math.max(shift, length(loop.dx, loop.dy))
  if (loop?.kind === "orbit") shift = Math.max(shift, 2 * length(loop.rx, loop.ry))
  return grow(reach, shift)
}

// A clip's shape, scaled to the element it clips.
function clipStyle(layer: Extract<Layer, { kind: "clip" }>, context: Context, frame: Box) {
  const id = `${context.ids}${layer.id}-hold`
  const rule = layer.shape.type === "ring" ? ' clip-rule="evenodd"' : ""
  // Scaled down to the unit square: a scale this small needs all its digits.
  context.clips.push(
    `<clipPath id="${id}" clipPathUnits="objectBoundingBox">` +
      `<path transform="scale(${1 / frame.w} ${1 / frame.h}) translate(${num(-frame.x)} ${num(-frame.y)})" d="${shapePath(layer.shape)}"${rule}/></clipPath>`
  )
  return `clip-path:url(#${id})`
}

// Whether a layer, or anything in it, moves on a loop.
export function loops(layer: Layer): boolean {
  if ("motion" in layer && layer.motion?.loop) return true
  return "layers" in layer && (layer.layers as Layer[]).some(loops)
}

// Whether a layer drawn through a filter arrives with motion. Faded or slid
// inside an SVG, a browser draws the filter soft while it moves and sharp
// again once it stops, so the picture jumps the moment the arrival ends; on
// a layer of its own the finished picture is faded instead.
function arrivesFiltered(layer: Layer): boolean {
  return (layer.kind === "stipple" || layer.kind === "soften" || layer.kind === "blur") && !!layer.motion?.enter
}

// The blend a layer is printed with over what is below it.
function blendOf(layer: Layer): string | undefined {
  if (layer.kind === "grain") return "soft-light"
  if (layer.kind === "stipple" && layer.ink && layer.ink.blend !== "normal") return layer.ink.blend
  return undefined
}

// The part of a layer's drawing that its motion can bring into `limit`: a
// slide brings in what lies beside it, turning what lies round its pivot.
function seen(limit: Box, motion: Motion | undefined, centre: { x: number; y: number }): Box {
  if (!motion) return limit
  const enter = motion.enter
  const loop = motion.loop
  let shift = enter?.kind === "fade" ? length(enter.dx ?? 0, enter.dy ?? 0) : 0
  if (loop?.kind === "drift" || loop?.kind === "pass") shift = Math.max(shift, length(loop.dx, loop.dy))
  if (loop?.kind === "orbit") shift = Math.max(shift, 2 * length(loop.rx, loop.ry))
  const smallest = Math.min(
    1,
    enter?.kind === "fade" ? enter.scale ?? 1 : 1,
    loop?.kind === "breathe" ? Math.min(loop.scale, loop.low ?? 1) : 1,
    loop?.kind === "resize" ? Math.min(...loop.scales) : 1
  )
  const pivot = loop?.kind === "swing" || loop?.kind === "spin" ? { x: loop.cx, y: loop.cy } : loop?.kind === "turns" || smallest < 1 ? centre : null
  if (!pivot) return grow(limit, shift)
  // As far as the furthest corner, and further for a layer drawn smaller.
  const far = Math.max(
    ...[limit.x, limit.x + limit.w].flatMap((x) => [limit.y, limit.y + limit.h].map((y) => length(x - pivot.x, y - pivot.y)))
  )
  const r = far / smallest + shift
  return { x: pivot.x - r, y: pivot.y - r, w: r * 2, h: r * 2 }
}

// The part of the canvas a layer draws on; null for all of it and beyond.
function bounds(layer: Layer): Box | null {
  switch (layer.kind) {
    case "fill":
    case "grain":
    case "picture":
    case "blur":
      return null
    case "logo":
      return { x: layer.x, y: layer.y, w: layer.w, h: layer.h }
    case "text": {
      const left = Math.min(...layer.lines.map((line) => line.x - (layer.align === "start" ? 0 : layer.align === "end" ? line.width : line.width / 2)))
      const right = Math.max(...layer.lines.map((line) => line.x + (layer.align === "end" ? 0 : layer.align === "start" ? line.width : line.width / 2)))
      const top = layer.lines[0]!.y - layer.size
      const bottom = layer.lines.at(-1)!.y + layer.size * 0.3
      return { x: left, y: top, w: right - left, h: bottom - top }
    }
    case "pool": {
      const turn = radians(layer.rotate ?? 0)
      const across = length(layer.rx * cos(turn), layer.ry * sin(turn))
      const down = length(layer.rx * sin(turn), layer.ry * cos(turn))
      return { x: layer.cx - across, y: layer.cy - down, w: across * 2, h: down * 2 }
    }
    case "shapes":
      return join(layer.shapes.map(shapeBounds))
    case "soften": {
      const inner = join(layer.layers.map(bounds))
      return inner && grow(inner, Math.max(layer.radius, layer.ry ?? layer.radius) * 3)
    }
    case "stipple": {
      const inner = join(layer.layers.map(bounds))
      return inner && grow(inner, length(layer.ink?.dx ?? 0, layer.ink?.dy ?? 0) + 2)
    }
    case "clip": {
      const edge = shapeBounds(layer.shape)
      return meet(join(layer.layers.map(bounds)), edge)
    }
  }
}

function shapeBounds(shape: Shape): Box {
  switch (shape.type) {
    case "rect":
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
    case "circle":
    case "ring":
      return { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 }
    case "ellipse":
      return { x: shape.cx - shape.rx, y: shape.cy - shape.ry, w: shape.rx * 2, h: shape.ry * 2 }
    default: {
      const step = shape.type === "polygon" ? 2 : 3
      let left = Infinity
      let top = Infinity
      let right = -Infinity
      let bottom = -Infinity
      for (let i = 0; i < shape.points.length; i += step) {
        const x = shape.points[i]!
        const y = shape.points[i + 1]!
        const third = step === 3 ? shape.points[i + 2]! : 0
        // A ribbon's third number is its half-width there; a block's, its width.
        const r = shape.type === "ribbon" ? third : 0
        left = Math.min(left, x - r)
        top = Math.min(top, y - r)
        right = Math.max(right, shape.type === "blocks" ? x + third : x + r)
        bottom = Math.max(bottom, shape.type === "blocks" ? y + shape.h : y + r)
      }
      return { x: left, y: top, w: right - left, h: bottom - top }
    }
  }
}

// Boxes together; null, everywhere, swallows the rest.
function join(boxes: (Box | null)[]): Box | null {
  if (!boxes.length || boxes.includes(null)) return null
  const all = boxes as Box[]
  const x = Math.min(...all.map((b) => b.x))
  const y = Math.min(...all.map((b) => b.y))
  return { x, y, w: Math.max(...all.map((b) => b.x + b.w)) - x, h: Math.max(...all.map((b) => b.y + b.h)) - y }
}

// Where two boxes overlap; a null box is everywhere, so the limit itself.
function meet(box: Box | null, limit: Box): Box | null {
  if (!box) return limit
  const x = Math.max(box.x, limit.x)
  const y = Math.max(box.y, limit.y)
  const right = Math.min(box.x + box.w, limit.x + limit.w)
  const bottom = Math.min(box.y + box.h, limit.y + limit.h)
  return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y } : null
}

const length = (x: number, y: number) => Math.sqrt(x * x + y * y)
const grow = (box: Box, by: number): Box => ({ x: box.x - by, y: box.y - by, w: box.w + by * 2, h: box.h + by * 2 })
const middle = (box: Box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 })
const contains = (outer: Box, inner: Box) =>
  outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.w >= inner.x + inner.w && outer.y + outer.h >= inner.y + inner.h

const escapeAttribute = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
