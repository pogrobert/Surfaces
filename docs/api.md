# Surfaces API

Agreed and built 2026-11-04; final since the contact sheet review on
2026-11-05, and reopened by the owner on 2026-11-06 for brands. The test for every name: does
the art behave differently because of it? If not, it doesn't belong in the
input. Most users reach the library through an AI agent, so there is one way
to do each thing, every value is a small set of words, and a wrong input fails
with an error that names the fix.

What it is for: the pictures a site repeats, which should look like one
brand and come out the same on every build: post covers and link previews,
docs, changelog and email headers, empty states, episode art, slides, the
backgrounds of tickets and wallpapers, and a profile's X or LinkedIn header, including the ones a site has now, hand-made,
stock or placeholder. A picture of one particular thing, a product, a person
or a place, is a photo's job, or an image model's.

## Brands

Added 2026-11-06, as the way most covers are made. A design studio makes a
few decisions once, a style, a colour, light or dark, a mood, and every image
after them follows from the content. A brand does the same:

```ts
const brand = createBrand({ name: "acme.dev", color: "#635bff" })

brand.cover({ title: post.title })      // a post's cover: the art, its title set by the page
brand.card({ title: post.title })       // a card in a list, title beside it
brand.hero({ title: "Pricing" })        // room for the title in the middle; the one cover that moves, where its style does
brand.og({ title: post.title })         // a link preview, 1200x630, room for the title at the brand's edge
brand.banner({ for: "x" })              // a header: "x" 1500x500, "linkedin" 1584x396, "email" 1200x400
brand.input("post", { title })          // the input any of those draws ("post" is cover's), to change before drawing
```

- A cover is given what it is about and nothing else: `title`, `id`, `tag`,
  `text` and `drawTitle`. Any other key throws and says where it belongs.
  Another size, shape or motion for one cover is its input, changed:
  `generate({ ...brand.input("post", { title }), width: 800, height: 800 })`.
- A link preview and a header are files other sites show, and a file has
  one theme: a brand that follows its reader (`theme: "auto"`) draws them
  light, ready for `toJpeg`. Its covers, cards and heroes follow the reader.

- `name`, such as the domain, is the one thing a brand must have. It is in
  every seed, so the same title in one brand is always the same art and two
  brands never share a drawing. There is no seed to choose.
- The pictures are art; the words are the site's, in its own type. Nothing
  is written into an image unless it is asked for (see "Titles in images").
  `text` says where words will go over the art, any place or `"none"`, and
  the art keeps a calm place there: by default a link preview keeps one at
  the brand's edge and a hero in the middle, and a post's cover, a card and
  a header keep none, their words sitting beside them on the page. The
  scene's first area is that place, with its box and the `ink` that reads
  there. React's `<Cover>` sets the title there in the page's own font, on
  a post's cover too, at its foot: it is the cover with its words on.
- A banner is art alone. An X header puts nothing that must be seen at
  its bottom left, where X lays the profile's photo; the art runs on under
  it. There is no icon: an icon is a brand's
  identity, and a site keeps its own.
- A link preview's layout is the brand's own, picked by its name and kept
  for all its previews, from four judged for every style: the title at the
  foot with the logo at the head, the title at the head with the logo at the
  foot, the two mirrored, or the logo locked up just over the title. A title
  over 45 characters takes a large area; a shorter one leaves the art large.
- `logo` is that identity, set as it is on the pictures a site shows of
  itself elsewhere: the link preview (where its layout puts it, on the
  title's edge), the email header (top left, over the title, as a
  letterhead's) and the profile headers (at the right, clear of the photo X
  and LinkedIn lay over the left). A post's cover goes on the site itself, which shows its logo
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

`readPage` reads source text, without a browser or a fetch: colours, the
background and text colours, a dark mode, the heading and body fonts, and
the title, description and first heading. Colours come in this order: the
one Safari's pinned tab is drawn in, a strong `theme-color`, variables named
for the brand or its primary (followed through any `var()` they are built
from; a plain name before a ramp's shade, the shade nearest its middle), the
strong colour the page uses most, accent names, and then every colour by
use. Names for text, borders, grounds, focus rings and muted states, a
widget's own variables, and a framework's whole palette are left out.
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
| `init` | Reads the site (its `DESIGN.md`, stylesheets, Tailwind config, root layout, fonts, metadata in code), writes the brand module (`surfaces.ts` in `src/`, `app/` or the root), a marked block in `AGENTS.md` (and `CLAUDE.md` when it doesn't already point there), Next.js's `app/opengraph-image.tsx` (its title in the site's own font when it finds the file), and a board of directions. `--pick <n>` takes another direction; `--name` names the brand; `--dry-run` writes nothing. Run again, it leaves what is set up. |
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
  partner?: string                      // the brand's second colour, as hex; its hue and strength are used, where a style has partner: true in catalog. Default: chosen from color

  width?: number                        // output size; the art only cares about the shape
  height?: number                       // default 1600 x 900
  areas?: Area[]                        // where content goes; none = art fills the canvas

  theme?: "light" | "dark" | "auto"     // auto draws both and follows the reader; a file has one, so not auto
  mood?: "calm" | "bold"                // the quiet or the loud end of the style; left out, the seed ranges over both
  grain?: "smooth" | "natural" | "heavy" // default "natural"; "smooth" is a little grain, never none
  detail?: "none" | "micro"             // the small marks of a technical drawing
  motion?: "none" | "once" | "loop"     // default "none"; shown by toHtml, on styles the catalog says move
  shape?: string                        // one of the style's approved shapes
  title?: string                        // words drawn into the art, in its largest area: for image files
  font?: "sans" | "serif" | TitleFont   // the face the title is drawn in; a TitleFont is from loadFont()
  logo?: { image, dark?, place }        // the brand's logo, as it is, in a small area the art keeps clear
}

type Area = {
  place:                                // needed, unless `box` is given
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
    the area. The clearing is only as strong as the art really under the
    area needs for words to read at 7:1, measured there: quiet art gets
    none. It covers the area because the words are the page's, which may
    set them anywhere in it. A title drawn in needs no clearing: it carries
    a halo instead (see "Titles in images"). Endpaper, Photocopy and
    Linework keep going round it instead (a pattern that already frames it,
    or lines of their own that would read as text).
  - Any area besides the largest gets a soft patch of ground under it; the
    art is composed round the largest. A logo's patch is no larger than the
    logo.
- `art: "behind"`: content covers the art (an opaque card). The art may run
  behind it and frames it.
- `box` is the only numeric escape hatch. It is validated: inside the canvas
  margins, not too small, not overlapping another area.
- An input has no `use` and no `text`: those are a brand's (`brand.og`,
  `text: "bottom-left"`), and it writes the size and areas they stand for.
  `validate` says so when one is given here.
- A cover is drawn from `color`. The ground and the shades are chosen from
  it, and so is the second colour where a style sets one, unless the brand
  gives its own as `partner`. Its hue and strength are used, and each style
  keeps its own lightness, so no colour given can make a seed unreadable.
  There is no background to give, and no transparent ground.

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

`theme: "auto"` draws one picture with both themes in it. Inline (`toHtml`,
`<Cover>`, `<Surface>`) it follows the reader's system setting, and a site's
own switch overrides that: `.dark` or `.light`, or `data-theme="dark"` or
`"light"`, on any element round it. A switch that only ever adds `.dark`
leaves the system setting in charge in light mode, so set `.light` too. An
SVG shown in `<img>` can only follow the system setting.


`generate(input)` returns a `Scene`: plain data, the same in every runtime.
`scene.areas[i]` is each area resolved, for anyone placing content themselves:

```ts
{ place, size, art, clear, x, y, width, height, ink }
// pixels; ink is a CSS colour that reads there; clear says whether the art keeps out of the box
```

- The box is in pixels of `scene.output`, the size that was asked for.
  `scene.size` is the canvas the layers are drawn on, in the library's own
  units, which an SVG's `viewBox` carries; nothing outside the renderers
  needs it.
- An area's `ink` is CSS: a hex colour, or on a cover drawn for both themes
  a `var(…, #hex)` that follows whichever shows. `scene.ink` is always hex,
  for an image renderer that can't read a variable.

### Titles in images

The best place for a title is the page, in the site's own type: over the
art in `scene.areas[0]`, in its `ink`, as `<Cover>` does, or in an image
renderer such as Satori or `@vercel/og` loading the site's font, with the
art as its background. Where neither can, an image can carry its title
itself: `title`, set into the largest area the art goes around, and `font`,
`"sans"` (Inter Bold, the default) or `"serif"` (Fraunces SemiBold). A
brand's cover takes `drawTitle: true`, as in
`toJpeg(brand.og({ title, drawTitle: true }))`, in the brand's face.

The site's own font sets it instead: `loadFont(bytes)` reads a TTF, an OTF
with TrueType outlines, a WOFF or a WOFF2, and `drawTitle: { font }` sets the
title in it (`generate` takes it as `font`). It is laid out from the font's
own advances and kerning and drawn from its outlines, exactly as the bundled
faces are.

```ts
const font = await loadFont(await readFile("public/fonts/Brand.woff2"))
toJpeg(brand.og({ title, drawTitle: { font } }))
```

- The decoding is the library's own; only WOFF's deflate and WOFF2's Brotli
  come from the runtime (`DecompressionStream`, or Node's zlib).
- A variable font is drawn at its default weight; a font with PostScript
  (CFF) outlines, or a collection (`.ttc`), is refused with what to give
  instead. A file over `MOST_FONT_BYTES` (8 MB) is too.
- A scene names the font by a key, `font.key`, and draws it in the process
  that loaded it; a font it hasn't been given is an error that says so.
- `init` finds the file the site's headings use (next/font/local, an
  `@font-face` rule, an `@fontsource` package) and writes its path into the
  brand module as `titleFont`; `preview`, `check` and `kit` draw in it.
  `next/font/google` keeps no file in the project, so its sites get the
  bundled faces until the file is added.

- It reads wherever it lands. The art under its lines is measured, and
  where that is too strong for the words the title gets a halo: ground laid
  softly round the letters themselves, drawn from their own shapes, only as
  strong as the art there calls for (7:1), so it reads as the letters' own
  shadow on a dark cover and their glow on a light one, and the art shows
  right up to them. On calm art, and beside art that keeps clear, there is
  none. It is `halo` on the scene's text layer, and every renderer draws it.
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

`toHtml` moves a cover asked to (`motion: "once"` or `"loop"`), on the
styles `catalog` gives `moves: true`; the rest are drawn still, and asking
them to move is a warning, not an error. A reader who asks for less motion
sees the still drawing. A loop can be stopped: `data-paused` on the cover or
on anything round it holds it, `paused` does the same on `<Surface>` and
`<Cover>`, and `mount` returns `pause()` and `play()`. A page that loops a
cover gives its readers a control for one of them.

Also: `mount(element, input, { label })` for plain DOM, the React `<Surface>`,
and the HTTP handler, `createHandler({ defaults, png, jpeg, brand, font, secret })`, a fetch handler whose
parameters are the input's own names:
`/cover?style=riso&seed=x&color=635bff&width=1200&height=630&area=bottom-left:lg`
(`area` repeats, as `place:size:art`; `title` and `font` set a title in;
`format=png` or `format=jpeg` when given a `png` or `jpeg` function).

With `brand`, the handler draws that brand's covers and a URL says only what
one is about: `title`, `id`, `use` (default `og`), `theme` for one side of a
brand that follows the reader, and `format`. The title is set into the image
wherever the cover keeps room for it, in `font` when the handler is given
one from `loadFont`. With `secret`, only URLs signed by
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

A cover with its title drawn into it is a picture of words, so it is not
hidden: `toSvg`, `toHtml`, `mount` and `<Surface>` read the title out unless
given a `label` of their own, and `describe` names it.

In React the label names the picture alone, never the element round it, so
a heading, a link or a card standing in an area stays what it is to a screen
reader.

## No drawing code on the page

A still cover needs no code in the browser: draw it where the page is
built and send the drawing, as markup or a file. The page then ships none
of Surfaces, where a `<Cover>` drawn in the browser adds about 45–55 KB
gzipped, depending on the style.

- **A server component** (Next.js App Router): `<Cover>` draws there, and a
  still cover sends only its markup.
- **A prerendered route** (React Router with `prerender`, or any loader run
  at build time): draw in the loader and render the string. Import
  Surfaces only in the loader, which never reaches the browser:

  ```tsx
  export async function loader({ params }) {
    const { brand } = await import("~/surfaces")   // the module init writes
    const { toHtml } = await import("@pogrobert/surfaces")
    const scene = brand.cover({ title: post.title, id: params.slug, text: "bottom-left" })
    return { art: toHtml(scene), area: scene.areas[0] }
  }
  export default function Post({ loaderData: { art, area } }) {
    return <div className="cover" dangerouslySetInnerHTML={{ __html: art }} />   // set the title over area
  }
  ```

- **A server-rendered or static page in any framework** (Astro, Nuxt,
  SvelteKit, Eleventy): `coverHtml({ brand, title })` in the frontmatter, the
  server route or the build, placed with `set:html`, `v-html` or `{@html}`
  (see "Any framework" below).
- **A build script**: write each cover as a file with `toSvg` and show it
  with `<img loading="lazy" alt="">`.

Draw in the browser only what has to be drawn there, as a cover whose
title is typed in.

## React

A brand's cover with its title on: `<Cover brand={brand} title={post.title} />`.
`use` is `"post"` (default), `"card"`, `"hero"` or `"og"`. The title is set
over the art where the cover keeps room for it, a post's at its foot, in the
page's own font, at a size that follows its length and the cover's width, so
the page adds no copy of it beside the cover. It is a plain block, not a
heading: `heading="h1"` (to `"h6"`) sets it as that heading, at the same
size. To set it any other way, give it as `children`,
`<Cover brand={brand} title={title}><h1 className="mine">{title}</h1></Cover>`,
which stand there instead. `text="none"` is the art alone, and a card shows
no title either way. `motion` and `paused` are taken as `<Surface>` takes
them. The rest of this section is the lower level, one exact cover:


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

`frames` gives a box that changes shape as it widens a drawing for each
shape, shown by the box's own width with CSS alone, no script:

```tsx
<Cover brand={brand} title={post.title}
  frames={[{ width: 1600, height: 1000 }, { width: 2400, height: 800, from: 720 }]} />
```

is 16:10 until the box is 720px wide and 3:1 from there. Each frame is drawn
for its own shape, so each is its own drawing in the page; the content, a
title or the children, is rendered once and moved into each frame's area,
so it is read once. `frames` replaces `width` and `height`.

`fill` makes it fill the box it is put in, a card's or a header's, instead of
keeping its own shape: placed over the whole of its nearest positioned
parent and cropped to fit, as a cover image is. Draw it at about the box's
shape and little is cropped.

`children` and `areas` together is an error: use one or the other. Content is
aligned to the side of its area it hangs from (a `top-left` area's content
sits top left) and, in an `around` area, coloured with the area's `ink`.

## Any framework

`coverHtml` and `surfaceHtml` are `<Cover>` and `<Surface>` as a string of
HTML, the same markup byte for byte, for Vue, Svelte, Astro, Solid, a
template or a build script. They take the same options as the components,
with two changes: `content`, a string of HTML, where React takes
`children` (and each area's `content` is a string too), and `css`, CSS as a
style attribute says it, such as `"border-radius:12px"`. The title, `use`,
`heading`, `text`, `fill`, `frames`, `label`, `paused` and `motion` work as
they do in React.

```ts
import { coverHtml, surfaceHtml } from "@pogrobert/surfaces"   // or a style's own import

coverHtml({ brand, title: post.title })                        // the title, set on the art
coverHtml({ brand, title: post.title, heading: "h1" })         // as the page's heading
coverHtml({ brand, title: post.title, use: "card" })           // a card in a list: art alone
surfaceHtml({ style: "riso", seed: "pricing", color: "#2b59c3", areas: [
  { place: "bottom-left", size: "lg", content: "<h1>Pricing</h1>" },
] })
```

```vue
<!-- Vue, Nuxt -->
<div v-html="coverHtml({ brand, title: post.title })" />
```

```svelte
<!-- Svelte, SvelteKit -->
{@html coverHtml({ brand, title: post.title })}
```

```astro
---
// Astro: drawn at build time, no drawing code on the page
import { coverHtml } from "@pogrobert/surfaces"
import { brand } from "../surfaces"
---
<Fragment set:html={coverHtml({ brand, title: post.title })} />
```

The title is escaped; `content` is placed as given, so escape what readers
wrote before it goes in. `coverHtml` draws with the styles its brand was made
with, so a brand from `@pogrobert/surfaces/<style>` keeps the page to that
style. A moving cover plays as soon as it loads; `watch(element)` from
`@pogrobert/surfaces/dom` keeps it to when it can be seen. Each component in
a framework is a few lines over these, if a page wants one.

## One style alone

Each style has an import of its own, `@pogrobert/surfaces/<style>`, with the
same functions as the package's (all but `directions`) drawing only that
style, and `@pogrobert/surfaces/<style>/react` for `<Cover>` and
`<Surface>`. A page that draws in the browser with one style carries that
style alone (its `coverHtml` and `surfaceHtml` too): a `<Cover>` adds about 45–55 KB gzipped, depending on the style,
instead of about 120, and `generate` about 30–50 KB instead of 105.

```tsx
import { createBrand } from "@pogrobert/surfaces/underpaint"
import { Cover } from "@pogrobert/surfaces/underpaint/react"

const brand = createBrand({ name: "acme.dev", color: "#635bff" })   // in underpaint without saying so
<Cover brand={brand} title={post.title} />
```

The pictures are the same as the full import's. Asked for another style,
these throw and say which import has it. The saving needs the brand to come
from the same import: a brand made with the root `createBrand` draws with
every style, and so does `mount` from `/dom` (draw with `toHtml` and `watch`
instead). The module `init` writes imports its style's own path already.
A brand there has no choice of
style to make, so `readPage` facts still choose its mood, grain and font but
not its style.

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
- A key that belongs elsewhere says where: `text` here is an area, `width`
  on a brand's cover is its input's, `slug` is `id`, a second colour is
  `partner`. A brand's covers and `createBrand` throw the same way; nothing
  given is ever quietly dropped.
- Unknown value: `Unknown grain "rough". Use "smooth", "natural" or "heavy".`
- Wrong shape for a style: lists that style's shapes.
- Trivial seeds (`42`, `1`, `"seed"`): a warning to use the page's slug.
- Overlapping or out-of-bounds areas: says which, and why.

`validate(input)` returns the same messages without drawing.

## For agents (ship with the package)

1. Done: strict types plus the validation above, and the input as JSON Schema
   (`@pogrobert/surfaces/schema.json`, also exported as `inputSchema`).
2. Done: `AGENTS.md`, a rules block of a dozen lines, shipped in the package.
3. Done: the examples-first README and `llms.txt`, both shipped.
4. Done: `catalog`, each style with what it looks like, what it suits, its
   shapes and whether it moves.
5. Done: the public types carry their own notes, so an editor or an agent
   reading a `.d.ts` sees each option's words, default and meaning.
6. Later: an MCP server whose `preview` returns an image.

## What changed inside

A history of the 2026-11-04 rewrite, for those who knew the names before it;
none of this is the current API.

- Every style's layout works around any set of areas instead of one title
  box, and routes art behind `behind` areas. Styles that moved the title
  (`safe` overrides) instead fit their subject into the free space.
- A narrow open area is carried on past the canvas edge, so art beside a
  wide title is drawn at a fair size and runs off the edge rather than
  shrinking to fit.
- Every style is checked at every size and place, both themes, five seeds,
  and over 13,000 random inputs: the text reads, nothing lands on kept
  content, and no cover is near blank.
- `ogCover`, `titleBox`, `inkClass`, `renderLayers`, `renderSvg`,
  `TEXT_PLACES` and the public `hash` and `STYLES` exports went; `catalog`,
  `formats`, `PLACES`, `toHtml`, `toSvg`, `toPng` and `validate` came in.
  (`USES` went too, and came back with brands, as the list of a brand's
  uses.)
