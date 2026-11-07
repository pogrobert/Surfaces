# Surfaces API

Agreed and built 2026-11-04; final since the contact sheet review on
2026-11-05, and reopened by the owner on 2026-11-06 for brands. The test for every name: does
the art behave differently because of it? If not, it doesn't belong in the
input. Most users reach the library through an AI agent, so there is one way
to do each thing, every value is a small set of words, and a wrong input fails
with an error that names the fix.

What it is for: the pictures a site repeats, its covers, link previews,
headers, email headers and avatars, which should look like one brand, carry
their titles exactly and come out the same on every build. A picture of one
particular thing, a product, a person or a place, is a photo's job, or an
image model's; a photo can still be printed in a style's inks (`image`).

## Brands

Added 2026-11-06, as the way most covers are made. A design studio makes a
few decisions once, a style, a colour, light or dark, a mood, and every image
after them follows from the content. A brand does the same:

```ts
const brand = createBrand({ name: "acme.dev", color: "#635bff" })

brand.cover({ title: post.title })      // a post's cover, title at the bottom left
brand.card({ title: post.title })       // a card in a list, title beside it: art only
brand.hero({ title: "Pricing" })        // title in the middle; the one cover that moves
brand.og({ title: post.title })         // a link preview, 1200x630
brand.banner({ for: "x", title })       // a header: "x" 1500x500, "linkedin" 1584x396, "email" 1200x400
brand.avatar(user.id)                   // a person's mark
brand.input("post", { title })          // the input any of those draws, for components
```

- `name`, such as the domain, is the one thing a brand must have. It is in
  every seed, so the same title in one brand is always the same art and two
  brands never share a drawing. There is no seed to choose.
- A banner's title is its own choice: with one it is set in, without one
  the banner is art alone. An X header puts nothing that must be seen at
  its bottom left, where X lays the profile's photo; the art runs on under
  it. There is no icon: an icon is a brand's
  identity, and a site keeps its own.
- `logo` is that identity, set as it is on the pictures a site shows of
  itself elsewhere: the link preview and the email header (top left, over the
  title, on its edge, as a letterhead's) and the profile headers (at the
  right, clear of the photo X and LinkedIn lay over the left). A post's cover goes on the site itself, which shows its logo
  already, so it has none. An SVG file's text, or `{ data, type }` for a PNG,
  JPEG or WebP; `{ light, dark }` gives one for each ground, and a logo whose
  colours all fall under 3:1 on its ground, with no `dark` given, is drawn
  reversed, in one colour, the cover's ink, as a brand's one-colour logo is,
  and says so. Otherwise it is drawn as an image, never recoloured, and
  nothing in it runs; only `currentColor`, the text's colour, which an image
  has none of, becomes the cover's ink, as the title's is.
- A cover is about its `title`. An `id`, such as the slug, keeps its art when
  the title is edited. A `tag`, such as the post's category, makes every
  cover with it the same mark, so a category reads as one family while each
  title still draws its own; a brand's own `shape` outranks it.
- `color`, `style`, `theme`, `mood`, `grain` and `shape` are decisions a brand
  may make. `shape` is one of the style's shapes for every cover, a mark the
  brand always makes; without it each title draws its own. Whatever it
  leaves out is chosen from the page it lives on, given as facts, most simply
  by `readPage(html, css)`:

```ts
const brand = createBrand({ name: "acme.dev", ...readPage(html, css) })
brand.look   // { style: "stencil", color: "#f59e0b", theme: "light" }: keep it to rebuild the brand
brand.why    // ["style stencil: the page is set in a rounded, friendly sans and sounds warm", ...]
```

`readPage` reads source text, without a browser or a fetch: colours (named
for the brand first, a ramp by its middle shade, then by use, leaving out a
framework's own palette), the background and text colours, a dark mode, the
heading and body fonts, and the title, description and first heading.
Variables may be hex, `rgb()`, `hsl()`, `oklch()` or shadcn's bare HSL
channels. A site's `DESIGN.md`, given third (`readPage(html, css, design)`),
says its brand outright: its colours, headings' and text's type, name,
description and overview come first, ahead of anything the page suggests.
Every fact is optional and can be corrected before the brand sees it:

```ts
type PageFacts = {
  colors?: string[]                     // hex, most used first
  background?: string
  text?: string
  darkMode?: boolean
  fonts?: { heading?: string; body?: string }
  words?: string
  covers?: { style: StyleName; color?: string }[]  // covers the site already has
}
```

The choices are rules, so one page always gives one brand:

- `color`: the first ink that is neither the background nor the text: real
  chroma at a middle lightness, or vivid; never a pale tint. A page of greys
  gives its deepest other one.
- `theme`: `auto` when the site has a dark mode, else `dark` or `light` by its
  background.
- `style`: the type (serif, mono, rounded, plain sans) and the words
  (technical, editorial, playful, warm, polished, calm) each lean toward
  styles, and the most leaned-toward wins. Covers the site already has win
  over both.
- `mood`, `grain`: only when one tone clearly leads.

### Directions

For people who want to choose, `directions(choices)` returns several brands,
the way a studio comes back with a few directions:

```ts
const options = directions({ name: "acme.dev", ...readPage(html, css) })   // six, best suited first
createBrand({ name: "acme.dev", ...options[2].look })                      // keep the one you like
directions({ name: "acme.dev", ...readPage(html, css), style: "riso" })    // more like it
```

- The first is what `createBrand` picks on its own, so not choosing is
  choosing it.
- They are varied: one of each kind of style (print, line, soft light, an
  object in light, pattern) before two of any.
- Each is tried on a short and a long title, as a post's cover and a link
  preview, in every theme it shows in, before it is offered: content reads
  at 4.5:1 and the art is neither blank nor a wall.
- Whatever the choices decide holds in every direction. With a style decided,
  they vary the mark it always makes first, one `shape` each, then its mood
  and grain: that is "more like this". `count` asks for fewer than six.
- `pnpm studio` serves a board of them at `/directions`.

`generate(input)` stays, for one exact cover outside a brand.

## Command line

`npx @pogrobert/surfaces <command>`, for a person or an agent in a project.
Everything it does is a rule on the project's own files; nothing is sent
anywhere, and it changes nothing it didn't write.

| Command | Does |
|---|---|
| `init` | Reads the site (its `DESIGN.md`, stylesheets, Tailwind config, root layout, fonts, metadata in code), writes the brand module (`surfaces.ts` in `src/`, `app/` or the root), a marked block in `AGENTS.md` (and `CLAUDE.md` when it doesn't already point there), Next.js's `app/opengraph-image.tsx`, and a board of directions. `--pick <n>` takes another direction; `--name` names the brand; `--dry-run` writes nothing. Run again, it leaves what is set up. |
| `kit` | Writes the pictures a site shows of itself that are art, not identity, into its public folder (`static/` for SvelteKit): the link preview, at the path its `og:image` already names or `og.jpg`, and X, LinkedIn and email headers, all on one mark, with the site's own logo SVG set on them as it is (`--logo <file>` for another, `--logo none` for none). It never draws an icon: a site's icon is its own. It leaves files that are there unless `--force`, and prints the `og:image` tag when the site has none. |
| `directions` | Prints the directions with their reasons and draws them as `.surfaces/directions.jpg`. |
| `preview` | Draws the brand's covers (`--use`, default `og`; `--title`, repeatable) into `.surfaces/`, each with its alt text. |
| `check` | One line of JSON for each cover in each use and theme: whether it holds, its contrast, coverage, problems and warnings. Exits 1 if any doesn't. |

The brand module keeps its look as a plain object (`export const look`), so
the CLI reads it without the project's build.

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
  logo?: { image, dark?, place }        // the brand's logo, as it is, in a small area the art keeps clear
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

### Titles in images

A link preview, an image file or an email has nowhere else to show a title,
so the input can carry one: `title`, set into the largest area the art goes
around, and `font`, `"sans"` (Inter Bold, the default) or `"serif"`
(Fraunces SemiBold). `brand.og({ title })` does this by itself, in the
brand's face; any other brand cover takes `drawTitle: true`.

- It is set as a designer would: large on one or two lines when short, down
  to four balanced lines when long, kerned, and against the side its area
  hangs from. A title that can't fit at the smallest size ends in an ellipsis.
- It is laid out from the faces' own metrics, so it fits exactly in every
  renderer. A PNG or JPEG draws the faces' outlines, which only the `/png`
  entry carries, so no font is installed anywhere and no page's bundle grows
  by them. An SVG names the face and holds every line to its measured width.
- Characters the faces can't draw (beyond Latin and Latin-1) are left out
  with a warning. The faces are under the SIL Open Font License, in
  `fonts/OFL.txt`.

PNG and JPEG export uses resvg: `@resvg/resvg-js` on Node, or
`@resvg/resvg-wasm` wherever a native module can't load. On Node either is
found by itself; on an edge runtime or a Worker, pass the WASM module:
`toJpeg(scene, { wasm })`.

Renderers, named by where the cover goes:

| Function | For |
|---|---|
| `toHtml(scene)` | Inline on a page. The only output that moves; still covers too. |
| `toSvg(scene)` | Files, `<img>`, email, anything that takes an image. Still. |
| `toJpeg(scene)` | Link previews: a grainy cover in about 50–170 KB. From `@pogrobert/surfaces/png`. |
| `toPng(scene)` | The same picture losslessly, anywhere an SVG won't do. From `@pogrobert/surfaces/png`. |
| `describe(scene, { title? })` | Alt text, for a cover seen without its page. |

Also: `mount(element, input, { label })` for plain DOM, the React `<Surface>`,
and the HTTP handler, `createHandler({ defaults, png })`, a fetch handler whose
parameters are the input's own names:
`/cover?style=riso&seed=x&color=635bff&width=1200&height=630&area=bottom-left:lg`
(`area` repeats, as `place:size:art`; `title` and `font` set a title in;
`format=png` or `format=jpeg` when given a `png` or `jpeg` function).

With `brand`, the handler draws that brand's covers and a URL says only what
one is about: `title`, `id`, `use` (default `og`), `theme` for one side of a
brand that follows the reader, and `format`. The title is set into the image
wherever the cover keeps room for it. With `secret`, only URLs signed by
`signUrl(url, secret)` are drawn; anything else gets a 403 that says how to
sign it. Signing is HMAC-SHA-256 through WebCrypto, so it runs wherever the
handler does.
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

A brand's cover: `<Cover brand={brand} title={post.title} use="post" />`.
`use` is `"post"` (default), `"card"`, `"hero"` or `"og"`; the title shows
where the cover keeps room for it, unless `children` stand there instead. The
rest of this section is the lower level, one exact cover:


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

A brand is how a site keeps one look. For a single cover outside one, keep
its input and spread it; the seed is then a stable name for that one drawing:

```ts
export const launch = { style: "aquatint", seed: "north-star", color: "#0f766e", mood: "calm" } as const
<Surface {...launch} />
toPng(generate({ ...launch, ...formats.og, areas: [{ place: "bottom-left", size: "lg" }] }))
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
