import { drawOf } from "./brand.ts"
import type { SurfaceInput } from "./core/generate.ts"
import type { Area, MotionLevel } from "./core/intent.ts"
import type { Scene } from "./core/scene.ts"
import { askedAreas, coverParts, layout } from "./layout.ts"
import type { CoverContent, Piece, Placing, Style } from "./layout.ts"

// <Cover> and <Surface> as a string of HTML, the same markup React renders,
// for any page that can place HTML: Vue's v-html, Svelte's {@html}, Astro's
// set:html, a template, a build script. Draw it on the server or at build
// time where you can, so no drawing code ships.
//
//   <div v-html="coverHtml({ brand, title: post.title })" />

/** An area of a surface and the HTML that stands in it. */
export type SurfaceHtmlArea = Area & { content?: string }

/** What surfaceHtml draws: one exact cover, with HTML in its areas. */
export type SurfaceHtmlOptions = Omit<SurfaceInput, "areas"> &
  Placing & {
    /** The page's own HTML, in one large area at the bottom left. Placed as given: escape what readers wrote. */
    content?: string
    /** Where each piece of HTML goes, each with its own `content`. */
    areas?: readonly SurfaceHtmlArea[]
    className?: string
    /** The element's own CSS, as a style attribute says it. `style` is the look. */
    css?: string
  }

/** What coverHtml draws: a brand's cover with its title on it. */
export type CoverHtmlOptions = CoverContent &
  Placing & {
    /** Whether it moves. A hero loops by itself where its style moves; "none" keeps it still. */
    motion?: MotionLevel
    /** HTML that stands where the title would, in place of it. Placed as given: escape what readers wrote. */
    content?: string
    className?: string
    /** The element's own CSS, as a style attribute says it. */
    css?: string
  }

const COVER = ["brand", "use", "title", "id", "tag", "text", "heading", "motion", "content", "className", "css", "label", "paused", "fill", "frames"] as const

// A word React takes that a string has no use for, said with what to give instead.
function mistaken(options: object, called: string) {
  if (typeof options !== "object" || options === null) throw new Error(`${called} takes one object of options`)
  if ("children" in options) throw new Error(`${called} takes "content", a string of HTML, where <${called === "coverHtml" ? "Cover" : "Surface"}> takes children`)
  if ("className" in options && typeof options.className !== "string") throw new Error(`"className" is a string of class names`)
  if ("css" in options && typeof options.css !== "string") throw new Error(`"css" is CSS as a style attribute says it, such as "border-radius:12px"`)
}

/** One exact cover as HTML, drawn by `draw`, with HTML in its areas. */
export function surfaceHtmlWith(draw: (input: SurfaceInput) => Scene, options: SurfaceHtmlOptions): string {
  mistaken(options, "surfaceHtml")
  const { content, areas, className, css, label, paused, fill, frames, ...input } = options
  if (content !== undefined && typeof content !== "string") throw new Error(`"content" is a string of HTML`)
  const { asked, plain } = askedAreas(areas, content, "surfaceHtml", "content")
  const tree = layout(draw, { ...input, ...(plain.length ? { areas: plain } : null) }, asked.map((area) => area.content !== undefined), { label, paused, fill, frames })
  return render(tree, (index) => asked[index]!.content ?? "", className, css)
}

/** A brand's cover with its title on it, as HTML: `coverHtml({ brand, title: post.title })`. */
export function coverHtml(options: CoverHtmlOptions): string {
  mistaken(options, "coverHtml")
  const unknown = Object.keys(options).filter((key) => !(COVER as readonly string[]).includes(key))
  if (unknown.length) {
    throw new Error(
      unknown
        .map((key) =>
          key === "style"
            ? `coverHtml has no "style": the brand's is its look, and the element's own CSS goes in "css".`
            : `Unknown option "${key}" for coverHtml. It takes ${COVER.map((one) => `"${one}"`).join(", ")}.`
        )
        .join("\n")
    )
  }
  const called = `coverHtml takes "brand", made by createBrand(): coverHtml({ brand, title: post.title })`
  const { brand, use, title, id, tag, text, heading, content, ...rest } = options
  const draw = drawOf(brand, called)
  const parts = coverParts({ brand, ...(use ? { use } : null), ...(title !== undefined ? { title } : null), ...(id !== undefined ? { id } : null), ...(tag !== undefined ? { tag } : null), ...(text !== undefined ? { text } : null), ...(heading ? { heading } : null) }, called)
  const set = parts.title ? `<${parts.title.tag} dir="auto" style="${escape(styleText(parts.title.style))}">${escape(parts.title.text)}</${parts.title.tag}>` : undefined
  const words = content ?? set
  return surfaceHtmlWith(draw, {
    ...parts.input,
    ...rest,
    ...(parts.areas ? { areas: parts.areas.map((area, index) => (index === 0 && parts.holds && words !== undefined ? { ...area, content: words } : area)) } : null),
  } as SurfaceHtmlOptions)
}

// The layout as markup. A moving cover plays as soon as it loads; `watch`
// from "@pogrobert/surfaces/dom" keeps it to when it can be seen.
function render(piece: Piece, content: (index: number) => string, className?: string, css?: string): string {
  switch (piece.kind) {
    case "box": {
      const names = [piece.className, className].filter(Boolean).join(" ")
      const style = [styleText(piece.style), css].filter(Boolean).join(";")
      return `<div${names ? ` class="${escape(names)}"` : ""} style="${escape(style)}">${piece.children.map((child) => render(child, content)).join("")}</div>`
    }
    case "rules":
      return `<style>${piece.css}</style>`
    case "art": {
      const named = piece.spoken ? ` role="img" aria-label="${escape(piece.spoken)}"` : ' aria-hidden="true"'
      const held = piece.paused ? ' data-paused=""' : ""
      const art = `<div${piece.moves ? "" : piece.className ? ` class="${piece.className}"` : ""}${named}${held} style="position:absolute;inset:0;line-height:0">${piece.html}</div>`
      return piece.moves && piece.className ? `<div class="${piece.className}" style="position:absolute;inset:0">${art}</div>` : art
    }
    case "area":
      return `<div${piece.className ? ` class="${piece.className}"` : ""} style="${escape(styleText(piece.style))}">${content(piece.index)}</div>`
  }
}

// React's style object as a style attribute: camelCase names in CSS's own
// spelling. Every number here is a zero or one a property takes bare.
const styleText = (style: Style) =>
  Object.entries(style)
    .map(([name, value]) => `${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value}`)
    .join(";")

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
