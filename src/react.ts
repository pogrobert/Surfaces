import { createElement } from "react"
import type { CSSProperties, ReactElement, ReactNode } from "react"
import { Moving } from "./react-motion.ts"
import { generate } from "./core/generate.ts"
import type { Scene } from "./core/scene.ts"
import type { SurfaceInput } from "./core/generate.ts"
import type { Area, MotionLevel } from "./core/intent.ts"
import { askedAreas, coverParts, layout } from "./layout.ts"
import type { CoverContent, Frame, Piece } from "./layout.ts"

export type { Frame, Heading } from "./layout.ts"

// <Surface style="riso" seed={post.slug} color="#635bff">{post.title}</Surface>
//
// The art fills the element. Content goes in areas the art arranges itself
// round: `children` are one large area at the bottom left, and `areas` say
// where everything goes, each with its own `content`:
//
//   <Surface style="moire" seed="home" color="#7c3aed" areas={[
//     { place: "top-left", size: "sm", content: <Logo /> },
//     { place: "center", art: "behind", content: <Card /> },
//   ]} />
//
// `style` is the look, as everywhere in this library; the element's own CSS
// goes in `css`. The markup is laid out in layout.ts, where surfaceHtml and
// coverHtml (html.ts) lay out the same as a string.
export type SurfaceArea = Area & { content?: ReactNode }

export type SurfaceProps = Omit<SurfaceInput, "areas"> & {
  areas?: readonly SurfaceArea[]
  className?: string
  css?: CSSProperties
  children?: ReactNode
  /**
   * Read out instead of the art, which is otherwise hidden from screen
   * readers. `true` reads out a description of the art itself. A cover with
   * its `title` drawn in reads that out unless told otherwise.
   */
  label?: string | true
  /**
   * Holds a moving cover where it is. A loop runs for as long as the page is
   * open, so give readers a control that sets this (WCAG 2.2.2).
   */
  paused?: boolean
  /**
   * Fills the box it is put in, a card's or a header's, instead of keeping
   * its own shape: absolutely placed over the whole of its nearest positioned
   * parent, the art cropped to fit as a cover image is. Draw it at about the
   * box's own shape (`width`, `height`) and little is cropped.
   */
  fill?: boolean
  /**
   * A drawing for each shape the box takes as it widens, shown by the box's
   * own width with CSS alone: `[{ width: 1600, height: 1000 }, { width: 2400,
   * height: 800, from: 720 }]` is 16:10 until the box is 720px wide and 3:1
   * from there. Each is drawn for its own shape; the content is rendered once
   * and moved into each one's area. Replaces `width` and `height`.
   */
  frames?: readonly Frame[]
}

const named = (spoken: string | undefined) => (spoken ? { role: "img" as const, "aria-label": spoken } : { "aria-hidden": true as const })

// The layout as React elements. A still cover is plain markup, so it renders
// on a server with no client code; a moving one is watched in the browser
// (react-motion.ts).
function render(piece: Piece, content: (index: number) => ReactNode, key?: string, className?: string, css?: CSSProperties): ReactElement {
  switch (piece.kind) {
    case "box":
      return createElement(
        "div",
        { key, className: [piece.className, className].filter(Boolean).join(" ") || undefined, style: { ...(piece.style as CSSProperties), ...css } },
        ...piece.children.map((child, index) => render(child, content, `${child.kind}${index}`))
      )
    case "rules":
      return createElement("style", { key, dangerouslySetInnerHTML: { __html: piece.css } })
    case "art": {
      if (piece.moves) {
        const moving = createElement(Moving, { key: piece.className ? undefined : key, html: piece.html, paused: piece.paused, ...named(piece.spoken) })
        return piece.className ? createElement("div", { key, className: piece.className, style: { position: "absolute", inset: 0 } }, moving) : moving
      }
      return createElement("div", {
        key,
        className: piece.className,
        ...named(piece.spoken),
        "data-paused": piece.paused ? "" : undefined,
        style: { position: "absolute", inset: 0, lineHeight: 0 },
        dangerouslySetInnerHTML: { __html: piece.html },
      })
    }
    case "area":
      return createElement("div", { key, className: piece.className, style: piece.style as CSSProperties }, content(piece.index))
  }
}

export function Surface(props: SurfaceProps): ReactElement {
  return drawSurface(generate, props)
}

// What <Surface> renders, drawn by the `draw` given: every style's here, a
// style's own one in its import, so <Cover> there carries no other style.
export function drawSurface(draw: (input: SurfaceInput) => Scene, { className, css, children, label, paused, areas, fill, frames, ...input }: SurfaceProps): ReactElement {
  const { asked, plain } = askedAreas(areas, children, "Surface", "children")
  const tree = layout(draw, { ...input, ...(plain.length ? { areas: plain } : null) }, asked.map((area) => area.content !== undefined), { label, paused, fill, frames })
  return render(tree, (index) => asked[index]!.content, undefined, className, css)
}

// <Cover brand={brand} title={post.title} />
//
// A brand's cover for a page, with its title on it: a post's by default, or
// the `use` asked for. The title is shown over the art where the cover keeps
// room for it, in the page's own font and at a title's size, so the page
// needs no heading of its own beside it. `heading="h1"` makes it the page's
// heading; to set it any other way, give it as `children`: <Cover
// brand={brand} title={title}><h1>{title}</h1></Cover>. For the art alone,
// as beside a heading the page already has, `text="none"`; a card shows none
// either way, its title being beside it.
export type CoverProps = CoverContent & {
  /** Whether it moves. A hero loops by itself where its style moves; "none" keeps it still. */
  motion?: MotionLevel
  className?: string
  css?: CSSProperties
  /** Stands where the title would, in place of it: the page's own heading, or anything else. */
  children?: ReactNode
  /** Read out instead of the art; `true` reads out a description of it. Leave it out under a heading. */
  label?: string | true
  /** Holds a moving cover where it is: a loop needs a control that sets this. */
  paused?: boolean
  /** Fills the box it is put in instead of keeping the cover's own shape, cropped to fit; best for the art alone (`text="none"`) or a box of about the cover's shape. */
  fill?: boolean
  /** A drawing for each shape the box takes as it widens, chosen by its width with CSS alone, as on `<Surface>`; the title is rendered once. */
  frames?: readonly Frame[]
}

export function Cover(props: CoverProps): ReactElement {
  return drawCover(Surface, props)
}

// What <Cover> renders, on the <Surface> given.
export function drawCover(Surface: (props: SurfaceProps) => ReactElement, { brand, use, title, id, tag, text, heading, children, ...rest }: CoverProps): ReactElement {
  const parts = coverParts(
    { brand, ...(use ? { use } : null), ...(title !== undefined ? { title } : null), ...(id !== undefined ? { id } : null), ...(tag !== undefined ? { tag } : null), ...(text !== undefined ? { text } : null), ...(heading ? { heading } : null) },
    `<Cover> takes "brand", made by createBrand(): <Cover brand={brand} title={post.title} />`
  )
  // Right to left where the title is, so Arabic or Hebrew reads and is
  // punctuated as it should be.
  const set = parts.title ? createElement(parts.title.tag, { dir: "auto", style: parts.title.style as CSSProperties }, parts.title.text) : undefined
  const content = children ?? set
  return createElement(Surface, {
    ...parts.input,
    ...rest,
    ...(parts.areas ? { areas: parts.areas.map((area, index) => (index === 0 && parts.holds ? { ...area, content } : area)) } : null),
  })
}
