# Surfaces API

Agreed and built 2026-11-04; final since the contact sheet review on
2026-11-05. The test for every name: does
the art behave differently because of it? If not, it doesn't belong in the
input. Most users reach the library through an AI agent, so there is one way
to do each thing, every value is a small set of words, and a wrong input fails
with an error that names the fix.

## Input

```ts
type SurfaceInput = {
  style: StyleName                      // which look: "halftone", "riso", ...
  seed: string | number                 // a stable name for one drawing; use the page's slug
  color?: string                        // the brand colour, as hex: "#635bff" or "#63f"; default "#5b5bd6"

  width?: number                        // output size; the art only cares about the shape
  height?: number                       // default 1600 x 900
  areas?: Area[]                        // where content goes; none = art fills the canvas

  theme?: "light" | "dark" | "auto"     // auto draws both and follows the reader
  mood?: "calm" | "bold"
  grain?: "smooth" | "natural" | "heavy"
  detail?: "none" | "micro"             // the small marks of a technical drawing
  motion?: "none" | "once" | "loop"     // default "none"
  shape?: string                        // one of the style's approved shapes
  image?: ImageInput                    // a photo printed in the style's inks
}

type Area = {
  place:
    | "top-left" | "top" | "top-right"
    | "left" | "center" | "right"
    | "bottom-left" | "bottom" | "bottom-right"
  size?: "sm" | "md" | "lg"             // default "md"
  box?: { x: number; y: number; w: number; h: number }  // exact, in shares of the canvas; replaces place and size
  art?: "around" | "behind"             // default "around"
}
```

- `art: "around"`: content sits on the art (text, a logo, a date), and its
  text colour is guaranteed to read. The art keeps clear of it. Two
  exceptions, both so the art isn't squeezed into slivers:
  - A large or medium area in the middle has the art drawn behind it, as on
    a cover with nothing to keep clear, with a soft clearing of ground under
    the area, only as strong as the text needs. Endpaper, Photocopy and
    Linework keep going round it instead (a pattern that already frames it,
    or lines of their own that would read as text).
  - Any area besides the largest gets a soft patch of ground under it; the
    art is composed round the largest.
- `art: "behind"`: content covers the art (an opaque card). The art may run
  behind it and frames it.
- `box` is the only numeric escape hatch. It is validated: inside the canvas
  margins, not too small, not overlapping another area.
- Gone: `use` (a shortcut that bundled a size and a title place) and `text`
  (one place from a list of five).

Sizes that other platforms fix are plain data, not a mode:

```ts
formats.og      // { width: 1200, height: 630 }
generate({ style: "riso", seed: post.slug, color, ...formats.og })
```

## Detail

`detail: "micro"` lays a technical drawing's small print over the art: crop
marks, a registration mark and, on styles that suit it, a ruler numbered in
the cover's pixels, a figure label in a free corner and a crosshair on the
subject. It is sized to the canvas's short side, so it still reads in a card
at a third of full size. Soft or busy styles (Underpaint, Sfumato, Marbling,
Endpaper, Moiré, Fluted, Halftone) take the corner marks alone, where a ruler
and label would read as noise. Everything keeps clear of content, and asking
for it never moves the art.

## Output

`generate(input)` returns a `Scene`: plain data, the same in every runtime.
`scene.areas[i]` is each area resolved, for anyone placing content themselves:

```ts
{ place, size, art, clear, x, y, width, height, ink }
// pixels; ink is a CSS colour that reads there; clear says whether the art keeps out of the box
```

Renderers, named by where the cover goes:

| Function | For |
|---|---|
| `toHtml(scene)` | Inline on a page. The only output that moves; still covers too. |
| `toSvg(scene)` | Files, `<img>`, email, anything that takes an image. Still. |
| `toPng(scene)` | OG images and anywhere an SVG won't do. From `@pogrobert/surfaces/png`. |
| `describe(scene, { title? })` | Alt text, for a cover seen without its page. |

Also: `mount(element, input, { label })` for plain DOM, the React `<Surface>`,
and the HTTP handler, `createHandler({ defaults, png })`, a fetch handler whose
parameters are the input's own names:
`/cover?style=riso&seed=x&color=635bff&width=1200&height=630&area=bottom-left:lg`
(`area` repeats, as `place:size:art`; `format=png` when given a `png` function).
A wrong URL gets a 400 with the same fix-it message `validate` gives.

## Alt text

A cover is decoration: the page's own heading says what it is about. So it is
hidden from screen readers unless it is given a `label` (on `<Surface>`,
`mount`, `toSvg` and `toHtml`). Which to use:

| Where the cover is | What it gets |
|---|---|
| Under or beside its page's heading, as on a post or a card in a list | Nothing: hidden. A list of ten covers reads as ten titles, not ten pictures. |
| Itself the link, with no text of its own | The page's title: `label={post.title}`. A linked picture is named for where it goes. |
| On its own: an OG image, a link preview, a gallery of covers | `describe(scene, { title })`, such as `og:image:alt`. |

`describe` says the art is abstract, so no one listens for information in it,
then what it looks like in everyday words, with no technique names or
positions: `Abstract art: a teal sun over orange stripes.` With a title it
names the page, which also tells apart two covers that look alike:
`Abstract cover art for "How the new search works": a grainy teal ring.`
`label: true` reads out `describe(scene)` without a title.

## React

```tsx
// Simplest: children are one area at the bottom left, size "lg".
<Surface style="halftone" seed={post.slug} color="#e4572e">
  <h1>{post.title}</h1>
</Surface>

// Any layout: each area takes its content.
<Surface style="riso" seed="pricing" color="#2b59c3" width={2400} height={1200} areas={[
  { place: "top-left", size: "sm", content: <Logo /> },
  { place: "bottom-left", size: "lg", content: <h1>Pricing</h1> },
]} />

// A centred opaque card, the art running behind it.
<Surface style="moire" seed="home" color="#7c3aed" theme="dark"
  areas={[{ place: "center", size: "md", art: "behind", content: <CodeCard /> }]} />
```

`children` and `areas` together is an error: use one or the other. Content is
aligned to the side of its area it hangs from (a `top-left` area's content
sits top left) and, in an `around` area, coloured with the area's `ink`.

## Avatars

A small mark for a person, a team or a project, from their id. Only the
styles that still read at 24 pixels make avatars: `AVATAR_STYLES` is Riso,
Marbling, Strata, Aquatint, Sfumato and Underpaint (`catalog` marks them with
`avatar: true`). Each fills its square, composed to the middle, and is cut to
a circle. People in a list are told apart: the seed turns the brand's hue a
little for each one, staying in the brand's family.

```ts
type AvatarInput = {
  style: AvatarStyle                     // one of AVATAR_STYLES
  seed: string | number                  // the person's id or handle
  color?: string                         // the brand's hex
  size?: number                          // pixels across, 16 to 2048; default 256 (40 in React)
  theme?: "light" | "dark" | "auto"
  mood?: "calm" | "bold"
  grain?: "smooth" | "natural" | "heavy"
  square?: boolean                       // keep the square instead of a circle
}

avatar({ style: "riso", seed: user.id, color: "#635bff" })   // a Scene, for toSvg, toHtml, toPng
<Avatar style="riso" seed={user.id} color="#635bff" size={40} />
createAvatarHandler()                    // /avatar?style=riso&seed=user-42&color=635bff&size=96
```

`validateAvatar(input)` gives the fix-it messages; a cover-only style says
which styles make avatars. An avatar beside a person's name is decoration
and stays hidden from screen readers; one standing alone takes
`label={user.name}`.

## One exact look

The seed is a stable name, never randomness: the same input draws the same
bytes forever. To reuse one look, keep it as an object and spread it:

```ts
export const brand = { style: "aquatint", seed: "north-star", color: "#0f766e", mood: "calm" } as const
<Surface {...brand} />
toPng(generate({ ...brand, ...formats.og, areas: [{ place: "bottom-left", size: "lg" }] }))
```

## Errors

`generate` validates everything and throws with the fix:

- Unknown key: `Unknown option "grian". Did you mean "grain"?`
- Unknown value: `Unknown grain "rough". Use "smooth", "natural" or "heavy".`
- Wrong shape for a style: lists that style's shapes.
- Trivial seeds (`42`, `1`, `"seed"`): a warning to use the page's slug.
- Overlapping or out-of-bounds areas: says which, and why.

`validate(input)` returns the same messages without drawing.

## For agents (ship with the package)

1. Done: strict types plus the validation above, and the input as JSON Schema
   (`@pogrobert/surfaces/schema.json`, also exported as `inputSchema`).
2. Done: `AGENTS.md`, a rules block under 1 KB, shipped in the package.
3. Done: the examples-first README and `llms.txt`, both shipped.
4. Done: `catalog`, each style with what it looks like, what it suits, its
   shapes, and whether it takes a photo.
5. Later: an MCP server whose `preview` returns an image.

## What changed inside

- Every style's layout works around any set of areas instead of one title
  box, and routes art behind `behind` areas. Styles that moved the title
  (`safe` overrides) instead fit their subject into the free space.
- A narrow open area is carried on past the canvas edge, so art beside a
  wide title is drawn at a fair size and runs off the edge rather than
  shrinking to fit.
- Every style is checked at every size and place, both themes, five seeds,
  and over 13,000 random inputs: the text reads, nothing lands on kept
  content, and no cover is near blank.
- `ogCover`, `titleBox`, `inkClass`, `renderLayers`, `renderSvg`, `USES`,
  `TEXT_PLACES` and the public `hash` and `STYLES` exports go; `catalog`,
  `formats`, `PLACES`, `toHtml`, `toSvg`, `toPng` and `validate` come in.
