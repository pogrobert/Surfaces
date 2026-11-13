import { titleAt, titleWidth } from "./brand.ts"
import type { Brand, Content } from "./brand.ts"
import { describe } from "./core/describe.ts"
import type { SurfaceInput } from "./core/generate.ts"
import type { Area } from "./core/intent.ts"
import { hash } from "./core/random.ts"
import { titleOf } from "./core/scene.ts"
import type { Scene, SceneArea } from "./core/scene.ts"
import type { Use } from "./page.ts"
import { toHtml } from "./render/layers.ts"

// How a cover sits in a page, with words over it, as plain data: what
// <Surface> and <Cover> render as React elements (react.ts) and surfaceHtml
// and coverHtml as a string of HTML (html.ts), so both are the same markup
// and any framework that can place HTML shows what React does.

/** One shape a responsive cover takes: drawn at `width` by `height`, from a box `from` pixels wide (the first from 0). */
export type Frame = { width: number; height: number; from?: number }

/** A heading to set a cover's title as, in place of a plain block. */
export type Heading = "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
export const HEADINGS: readonly Heading[] = ["h1", "h2", "h3", "h4", "h5", "h6"]

// CSS as React writes it: camelCase names, plain values.
export type Style = Record<string, string | number>

export type Piece =
  | { kind: "box"; className?: string; style: Style; children: Piece[] }
  | { kind: "rules"; css: string }
  // The art, built from numbers and palette colours: nothing a caller passes
  // reaches it as markup. One that moves is watched in the browser.
  | { kind: "art"; html: string; moves: boolean; spoken?: string; paused?: boolean; className?: string }
  // Where the content asked for in area `index` stands.
  | { kind: "area"; index: number; className?: string; style: Style }

/** What a cover is laid out with beyond what draws it. */
export type Placing = { label?: string | true; paused?: boolean; fill?: boolean; frames?: readonly Frame[] }

// Content aligned to the side of its area that the area hangs from.
function aligned(area: SceneArea) {
  const place = area.place ?? "top-left"
  const row = place.startsWith("top") ? "flex-start" : place.startsWith("bottom") ? "flex-end" : "center"
  const column = place.endsWith("left") ? "flex-start" : place.endsWith("right") ? "flex-end" : "center"
  return { justifyContent: row, alignItems: column }
}

// The drawing for an input, kept for the next render of the same one: a
// component that draws on every render, as a server component does, has no
// memo of its own, and a page draws the same few covers again and again.
// Kept per drawer, so a style's own import never answers with another's.
const kept = new WeakMap<(input: SurfaceInput) => Scene, Map<string, { scene: Scene; art: string }>>()
function drawn(draw: (input: SurfaceInput) => Scene, input: SurfaceInput) {
  const key = JSON.stringify(input)
  let these = kept.get(draw)
  if (!these) kept.set(draw, (these = new Map()))
  const known = these.get(key)
  if (known) return known
  const scene = draw(input)
  // Layers, so a moving cover is moved by the graphics card (see layers.ts).
  const made = { scene, art: toHtml(scene, { fill: true }) }
  if (these.size >= 64) these.delete(these.keys().next().value!)
  these.set(key, made)
  return made
}

// The content asked for, as one list of areas: `content` alone is one large
// area at the bottom left, as a post's title stands.
export function askedAreas<C>(areas: readonly (Area & { content?: C })[] | undefined, content: C | undefined, called: string, word: string) {
  if (content !== undefined && areas !== undefined) {
    throw new Error(`${called} takes ${word} or areas, not both: give it as one area's content.`)
  }
  const asked: (Area & { content?: C })[] = areas ? [...areas] : content !== undefined ? [{ place: "bottom-left", size: "lg", content }] : []
  // The input is plain data, so its JSON is the drawing's identity.
  const plain = asked.map(({ content: _, ...area }) => area)
  return { asked, plain }
}

/**
 * The layout of one cover: its art filling an element, and a place for the
 * content of each area in `filled` (by index). The art alone is named or
 * hidden, never the element round it: what stands in the areas is the
 * page's own content, and a role of "img" on its parent would hide it from
 * a screen reader.
 */
export function layout(draw: (input: SurfaceInput) => Scene, input: SurfaceInput, filled: readonly boolean[], { label, paused, fill, frames }: Placing): Piece {
  if (frames) return framed(draw, input, filled, { label, paused, fill }, frames)
  const { scene, art } = drawn(draw, input)
  const moves = input.motion !== undefined && input.motion !== "none"
  // A title drawn into the art is words in a picture, so it is read out.
  const spoken = label === true ? describe(scene) : label ?? titleOf(scene)
  const { w, h } = scene.output
  const share = (value: number, of: number) => `${(value / of) * 100}%`
  return {
    kind: "box",
    style: {
      ...(fill ? { position: "absolute", inset: 0 } : { position: "relative", aspectRatio: `${w} / ${h}` }),
      overflow: "hidden",
      containerType: "inline-size",
    },
    children: [
      { kind: "art", html: art, moves, ...(spoken ? { spoken } : null), ...(paused ? { paused } : null) },
      ...scene.areas.flatMap((area, index): Piece[] =>
        filled[index]
          ? [
              {
                kind: "area",
                index,
                style: {
                  position: "absolute",
                  left: share(area.x, w),
                  top: share(area.y, h),
                  width: share(area.width, w),
                  height: share(area.height, h),
                  display: "flex",
                  flexDirection: "column",
                  ...aligned(area),
                  // Content on the art reads in the cover's ink; a card brings
                  // its own colours. The art keeps its colours when a reader's
                  // system forces its own, so the ink chosen for it stays too.
                  ...(area.art === "around" ? { color: area.ink, forcedColorAdjust: "none" } : null),
                },
              },
            ]
          : []
      ),
    ],
  }
}

// A cover with a drawing for each shape its box takes. The box is a
// container, and CSS container queries show the frame for its width, give
// the box that frame's shape, and move each area's content into that
// frame's area: the content is rendered once, so it is read once, and the
// switch needs no script, so it renders on a server like any still cover.
function framed(
  draw: (input: SurfaceInput) => Scene,
  input: SurfaceInput,
  filled: readonly boolean[],
  { label, paused, fill }: Placing,
  frames: readonly Frame[]
): Piece {
  if (!Array.isArray(frames) || !frames.length) throw new Error(`"frames" is a list of shapes, such as [{ width: 1600, height: 1000 }, { width: 2400, height: 800, from: 720 }]`)
  const ordered = [...frames].sort((a, b) => (a.from ?? 0) - (b.from ?? 0))
  if ((ordered[0]!.from ?? 0) !== 0) throw new Error(`The first frame is for every width up to the next: leave its "from" out, or give 0`)
  for (const frame of ordered) {
    if (!(frame.width > 0 && frame.height > 0)) throw new Error(`Each frame needs a "width" and a "height" in pixels, got ${JSON.stringify(frame)}`)
  }
  const each = ordered.map((frame) => ({ frame, ...drawn(draw, { ...input, width: frame.width, height: frame.height }) }))
  const moves = input.motion !== undefined && input.motion !== "none"
  const spoken = label === true ? describe(each[0]!.scene) : label ?? titleOf(each[0]!.scene)
  // Named for its drawings, so two on one page never share their rules.
  const id = `surface-${hash(JSON.stringify([input, ordered])).toString(36)}`
  const share = (value: number, of: number) => `${((value / of) * 100).toFixed(3)}%`
  const shown = (index: number) => {
    const { scene } = each[index]!
    const { w, h } = scene.output
    const rules = [
      ...(fill ? [] : [`.${id}>.box{aspect-ratio:${w}/${h}}`]),
      ...each.map((_, other) => `.${id} .f${other}{display:${other === index ? "block" : "none"}}`),
      ...scene.areas.map((area, at) => {
        const { justifyContent, alignItems } = aligned(area)
        const ink = area.art === "around" ? `color:${area.ink};forced-color-adjust:none;` : ""
        return `.${id} .a${at}{left:${share(area.x, w)};top:${share(area.y, h)};width:${share(area.width, w)};height:${share(area.height, h)};justify-content:${justifyContent};align-items:${alignItems};${ink}}`
      }),
    ]
    const from = each[index]!.frame.from ?? 0
    return from ? `@container (min-width:${from}px){${rules.join("")}}` : rules.join("")
  }
  return {
    kind: "box",
    className: id,
    style: { containerType: "inline-size", ...(fill ? { position: "absolute", inset: 0 } : null) },
    children: [
      // The rules are built from numbers alone; nothing a caller passes reaches them.
      { kind: "rules", css: each.map((_, index) => shown(index)).join("") },
      {
        kind: "box",
        className: "box",
        style: { position: fill ? "absolute" : "relative", ...(fill ? { inset: 0 } : null), overflow: "hidden", containerType: "inline-size" },
        children: [
          ...each.map(({ art }, index): Piece => ({ kind: "art", html: art, moves, className: `f${index}`, ...(spoken ? { spoken } : null), ...(paused ? { paused } : null) })),
          ...filled.flatMap((has, at): Piece[] => (has ? [{ kind: "area", index: at, className: `a${at}`, style: { position: "absolute", display: "flex", flexDirection: "column" } }] : [])),
        ],
      },
    ],
  }
}

// A title's size on a cover, as a share of the cover's short side, set as a
// designer sets one: large when short, smaller as it runs on (see setTitle,
// which draws the same title into an image by the same rule).
// The length is how far it runs, so a title in Chinese, Japanese or Korean
// is set as a Latin one twice its count would be.
function titleSize(title: string) {
  const length = titleWidth(title)
  return length <= 18 ? 1 / 8 : length <= 36 ? 1 / 10 : length <= 60 ? 1 / 12.5 : length <= 90 ? 1 / 15 : 1 / 18
}

/** What a brand's cover is given, in React or as HTML. */
export type CoverContent = Omit<Content, "drawTitle"> & { brand: Brand; use?: Use; heading?: Heading }

/**
 * A brand's cover for a page, ready to lay out: what draws it, where its
 * title stands, and the title set as a title, sized to the cover, which is
 * its container, tight and balanced, in whatever font the page gives it.
 * Its words are the page's, in the page's own type, so the cover keeps room
 * for them where the use carries a title, as a post's cover does at its
 * foot; a card's and a header's have none.
 */
export function coverParts({ brand, use = "post", title, id, tag, text, heading }: CoverContent, called: string) {
  if (typeof brand?.input !== "function") throw new Error(called)
  if (heading !== undefined && !HEADINGS.includes(heading)) throw new Error(`Unknown heading "${String(heading)}". Use one of ${HEADINGS.map((one) => `"${one}"`).join(", ")}.`)
  const at = text ?? titleAt(brand.name, use) ?? "none"
  const { areas, ...input } = brand.input(use, { ...(title !== undefined ? { title } : null), ...(id !== undefined ? { id } : null), ...(tag !== undefined ? { tag } : null), text: at })
  const short = Math.min(input.width ?? 1600, input.height ?? 900) / (input.width ?? 1600)
  const set =
    typeof title === "string" && title.trim()
      ? {
          tag: heading ?? "div",
          text: title,
          style: {
            margin: 0,
            fontSize: `${(titleSize(title) * short * 100).toFixed(2)}cqw`,
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: "-0.02em",
            textWrap: "balance",
            overflowWrap: "break-word",
            maxWidth: "100%",
            textAlign: at.endsWith("left") ? "left" : at.endsWith("right") ? "right" : "center",
          } as Style,
        }
      : undefined
  // The title stands in the first area, the one the use keeps for it.
  return { input, areas, title: set, holds: at !== "none" }
}
