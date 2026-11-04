import { createElement, useEffect, useMemo, useRef } from "react"
import type { CSSProperties, ReactElement, ReactNode } from "react"
import { avatar } from "./avatar.ts"
import type { AvatarInput } from "./avatar.ts"
import { describe } from "./core/describe.ts"
import { watch } from "./dom.ts"
import { generate } from "./core/generate.ts"
import type { SurfaceInput } from "./core/generate.ts"
import type { Area } from "./core/intent.ts"
import type { SceneArea } from "./core/scene.ts"
import { toHtml } from "./render/layers.ts"

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
  // Read out instead of the art, which is otherwise hidden from screen
  // readers. `true` reads out a description of the art itself.
  label?: string | true
}

// Content aligned to the side of its area that the area hangs from.
const align = (area: SceneArea): CSSProperties => {
  const place = area.place ?? "top-left"
  const row = place.startsWith("top") ? "flex-start" : place.startsWith("bottom") ? "flex-end" : "center"
  const column = place.endsWith("left") ? "flex-start" : place.endsWith("right") ? "flex-end" : "center"
  return { justifyContent: row, alignItems: column }
}

export function Surface({ className, css, children, label, areas, ...input }: SurfaceProps): ReactElement {
  if (children !== undefined && areas !== undefined) {
    throw new Error("Surface takes children or areas, not both: put the children in an area's content.")
  }
  const asked: SurfaceArea[] = areas
    ? [...areas]
    : children !== undefined
      ? [{ place: "bottom-left", size: "lg", content: children }]
      : []
  // Every input but the photo is plain data, so its JSON is the drawing's
  // identity; the photo counts by its own bytes.
  const plain = asked.map(({ content: _, ...area }) => area)
  const key = JSON.stringify({ ...input, areas: plain, image: input.image?.type })
  const scene = useMemo(() => generate({ ...input, ...(plain.length ? { areas: plain } : null) }), [key, input.image?.data])
  // Layers, so a moving cover is moved by the graphics card (see layers.ts).
  const art = useMemo(() => toHtml(scene, { fill: true }), [scene])
  // A moving cover arrives when it is scrolled to and rests off screen.
  const holder = useRef<HTMLDivElement>(null)
  const moves = input.motion !== undefined && input.motion !== "none"
  useEffect(() => (moves && holder.current ? watch(holder.current) : undefined), [art, moves])
  const spoken = label === true ? describe(scene) : label
  const { w, h } = scene.output
  const share = (value: number, of: number) => `${(value / of) * 100}%`
  return createElement(
    "div",
    {
      className,
      role: spoken ? "img" : undefined,
      "aria-label": spoken,
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
      "aria-hidden": true,
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
                // its own colours.
                ...(area.art === "around" ? { color: area.ink } : null),
              },
            },
            asked[index]!.content
          )
    )
  )
}

// <Avatar style="riso" seed={user.id} color="#635bff" size={40} />
//
// A person's mark, `size` pixels across, round unless `square`. Hidden from
// screen readers unless `label` names who it is: an avatar beside a name is
// decoration, and one standing alone is named for the person.
export type AvatarProps = AvatarInput & {
  className?: string
  css?: CSSProperties
  label?: string
}

export function Avatar({ className, css, label, ...input }: AvatarProps): ReactElement {
  const size = input.size ?? 40
  const key = JSON.stringify(input)
  const scene = useMemo(() => avatar({ ...input, size }), [key])
  const art = useMemo(() => toHtml(scene, { fill: true }), [scene])
  return createElement("div", {
    className,
    role: label ? "img" : undefined,
    "aria-label": label,
    "aria-hidden": label ? undefined : true,
    style: {
      position: "relative",
      width: size,
      height: size,
      flex: "none",
      overflow: "hidden",
      borderRadius: input.square ? undefined : "50%",
      lineHeight: 0,
      ...css,
    },
    dangerouslySetInnerHTML: { __html: art },
  })
}
