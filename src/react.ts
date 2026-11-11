import { createElement, useEffect, useMemo, useRef } from "react"
import type { CSSProperties, ReactElement, ReactNode } from "react"
import { titleAt, titleWidth } from "./brand.ts"
import type { Brand, Content } from "./brand.ts"
import { describe } from "./core/describe.ts"
import { watch } from "./dom.ts"
import { generate } from "./core/generate.ts"
import type { SurfaceInput } from "./core/generate.ts"
import type { Area, MotionLevel } from "./core/intent.ts"
import { titleOf } from "./core/scene.ts"
import type { SceneArea } from "./core/scene.ts"
import { toHtml } from "./render/layers.ts"
import type { Use } from "./page.ts"

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
// goes in `css`.
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
}

// Content aligned to the side of its area that the area hangs from.
const align = (area: SceneArea): CSSProperties => {
  const place = area.place ?? "top-left"
  const row = place.startsWith("top") ? "flex-start" : place.startsWith("bottom") ? "flex-end" : "center"
  const column = place.endsWith("left") ? "flex-start" : place.endsWith("right") ? "flex-end" : "center"
  return { justifyContent: row, alignItems: column }
}

export function Surface({ className, css, children, label, paused, areas, ...input }: SurfaceProps): ReactElement {
  if (children !== undefined && areas !== undefined) {
    throw new Error("Surface takes children or areas, not both: put the children in an area's content.")
  }
  const asked: SurfaceArea[] = areas
    ? [...areas]
    : children !== undefined
      ? [{ place: "bottom-left", size: "lg", content: children }]
      : []
  // The input is plain data, so its JSON is the drawing's identity.
  const plain = asked.map(({ content: _, ...area }) => area)
  const key = JSON.stringify({ ...input, areas: plain })
  const scene = useMemo(() => generate({ ...input, ...(plain.length ? { areas: plain } : null) }), [key])
  // Layers, so a moving cover is moved by the graphics card (see layers.ts).
  const art = useMemo(() => toHtml(scene, { fill: true }), [scene])
  // A moving cover arrives when it is scrolled to and rests off screen.
  const holder = useRef<HTMLDivElement>(null)
  const moves = input.motion !== undefined && input.motion !== "none"
  useEffect(() => (moves && holder.current ? watch(holder.current) : undefined), [art, moves])
  // A title drawn into the art is words in a picture, so it is read out.
  const spoken = label === true ? describe(scene) : label ?? titleOf(scene)
  const { w, h } = scene.output
  const share = (value: number, of: number) => `${(value / of) * 100}%`
  return createElement(
    "div",
    {
      className,
      style: {
        position: "relative",
        aspectRatio: `${w} / ${h}`,
        overflow: "hidden",
        containerType: "inline-size",
        ...css,
      },
    },
    createElement("div", {
      ref: holder,
      // The picture alone is named or hidden, never the element round it:
      // what stands in the areas is the page's own content, and a role of
      // "img" on its parent would hide it from a screen reader.
      ...(spoken ? { role: "img", "aria-label": spoken } : { "aria-hidden": true }),
      "data-paused": paused ? "" : undefined,
      style: { position: "absolute", inset: 0, lineHeight: 0 },
      // The art is built here from numbers and palette colours; nothing a
      // caller passes reaches it as markup.
      dangerouslySetInnerHTML: { __html: art },
    }),
    ...scene.areas.map((area, index) =>
      asked[index]?.content === undefined
        ? null
        : createElement(
            "div",
            {
              key: index,
              style: {
                position: "absolute",
                left: share(area.x, w),
                top: share(area.y, h),
                width: share(area.width, w),
                height: share(area.height, h),
                display: "flex",
                flexDirection: "column",
                ...align(area),
                // Content on the art reads in the cover's ink; a card brings
                // its own colours. The art keeps its colours when a reader's
                // system forces its own, so the ink chosen for it stays too.
                ...(area.art === "around" ? { color: area.ink, forcedColorAdjust: "none" as const } : null),
              },
            },
            asked[index]!.content
          )
    )
  )
}

// <Cover brand={brand} title={post.title} />
//
// A brand's cover for a page, with its title on it: a post's by default, or
// the `use` asked for. The title is shown over the art where the cover keeps
// room for it, in the page's own font and at a title's size, so the page
// needs no heading of its own beside it. To make it the page's heading, or
// to set it any other way, give it as `children`: <Cover brand={brand}
// title={title}><h1>{title}</h1></Cover>. For the art alone, as beside a
// heading the page already has, `text="none"`; a card shows none either way,
// its title being beside it.
export type CoverProps = Omit<Content, "drawTitle"> & {
  brand: Brand
  /** Which of the brand's covers: "post" (the default), "card", "hero" or "og". */
  use?: Use
  /** Whether it moves. A hero loops by itself where its style moves; "none" keeps it still. */
  motion?: MotionLevel
  className?: string
  css?: CSSProperties
  /** Stands where the title would, in place of it: the page's own heading, or anything else. */
  children?: ReactNode
  label?: string | true
  paused?: boolean
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

export function Cover({ brand, use = "post", title, id, tag, text, children, ...rest }: CoverProps): ReactElement {
  // Its words are the page's, in the page's own type, so the cover keeps room
  // for them where the use carries a title, as a post's cover does at its
  // foot; a card's and a header's have none.
  if (typeof brand?.input !== "function") throw new Error(`<Cover> takes "brand", made by createBrand(): <Cover brand={brand} title={post.title} />`)
  const at = text ?? titleAt(brand.name, use) ?? "none"
  const { areas, ...input } = brand.input(use, { ...(title !== undefined ? { title } : null), ...(id !== undefined ? { id } : null), ...(tag !== undefined ? { tag } : null), text: at })
  // The title alone is set as a title: sized to the cover, which is its
  // container, tight and balanced, in whatever font the page gives it.
  const short = Math.min(input.width ?? 1600, input.height ?? 900) / (input.width ?? 1600)
  const set =
    typeof title === "string" && title.trim()
      ? createElement(
          "div",
          {
            // Right to left where the title is, so Arabic or Hebrew reads and
            // is punctuated as it should be.
            dir: "auto",
            style: {
              fontSize: `${(titleSize(title) * short * 100).toFixed(2)}cqw`,
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: "-0.02em",
              textWrap: "balance",
              overflowWrap: "break-word",
              maxWidth: "100%",
              textAlign: at.endsWith("left") ? "left" : at.endsWith("right") ? "right" : "center",
            } as CSSProperties,
          },
          title
        )
      : undefined
  const content = children ?? set
  return createElement(Surface, {
    ...input,
    ...rest,
    ...(areas ? { areas: areas.map((area, index) => (index === 0 && at !== "none" ? { ...area, content } : area)) } : null),
  })
}
