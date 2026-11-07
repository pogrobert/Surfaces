# Surfaces

Generative covers for posts, pages and OG images. Make a brand once, then
every cover, link preview, hero and avatar follows from its title. The same
title always draws the same cover.

It is for the pictures a site repeats, which should look like one brand,
carry their titles exactly and come out the same on every build: no API
key, no cost per image, nothing that drifts when a model changes. A picture
of one particular thing is a photo's job, or an image model's.

Not published yet. The full design is in [docs/api.md](docs/api.md).

## Set up a site

```sh
npx @pogrobert/surfaces init
```

It reads the site's own files (its `DESIGN.md` first, then its stylesheets,
Tailwind config, root layout, fonts, logo and metadata), chooses a look with a reason for each choice,
and writes:

- `surfaces.ts` beside the source, the brand everything comes from;
- a short block in `AGENTS.md`, so coding agents use it rightly;
- on Next.js, `app/opengraph-image.tsx`, the site's link preview;
- `.surfaces/directions.jpg`, a board of other looks; `init --pick 3` takes one.

Nothing is sent anywhere and nothing it didn't write is changed.
`npx @pogrobert/surfaces kit` then writes the link preview and the X,
LinkedIn and email headers into `public/`, all on one mark, with the site's
own logo set on them. It draws no icons: a site's icon is its own.
`npx @pogrobert/surfaces preview --title "A real title"` draws the brand's
covers into `.surfaces/` to look at, and `check` says whether they hold, so
an agent can look, fix and look again.

## Brands

```ts
import { createBrand, readPage } from "@pogrobert/surfaces"

const brand = createBrand({ name: "acme.dev", color: "#635bff", logo: logoSvg })
// or let the site decide: createBrand({ name: "acme.dev", ...readPage(html, css, designMd) })

brand.cover({ title: post.title })   // a post's cover: the art, its title set by the page
brand.cover({ title, tag: post.category })  // a category's posts make one mark
brand.og({ title: post.title })      // its link preview, with room for the title
brand.hero({ title: "Pricing" })
brand.banner({ for: "x" })           // and "linkedin", "email"
brand.avatar(user.id)
```

```tsx
import { Cover } from "@pogrobert/surfaces/react"

<Cover brand={brand} title={post.title} />
```

To choose a look instead of taking the brand's pick, ask for directions,
varied and each already checked, and keep the one you like:

```ts
const options = directions({ name: "acme.dev", ...readPage(html, css) })
const brand = createBrand({ name: "acme.dev", ...options[2].look })
```

The sections below are the lower level: one exact cover, with every choice
made by hand.

## React

```tsx
import { Surface } from "@pogrobert/surfaces/react"

// The children are one large title at the bottom left.
<Surface style="halftone" seed={post.slug} color="#e4572e">
  <h1>{post.title}</h1>
</Surface>
```

For any other layout, give each area its content:

```tsx
<Surface
  style="riso"
  seed="pricing"
  color="#2b59c3"
  width={2400}
  height={1200}
  areas={[
    { place: "top-left", size: "sm", content: <Logo /> },
    { place: "center", size: "lg", content: <h1>Pricing</h1> },
  ]}
/>
```

An opaque card over the art:

```tsx
<Surface
  style="moire"
  seed="home"
  color="#7c3aed"
  theme="dark"
  areas={[{ place: "center", size: "md", art: "behind", content: <CodeCard /> }]}
/>
```

## OG image

```ts
import { toJpeg } from "@pogrobert/surfaces/png"

const scene = brand.og({ title: post.title })   // 1200x630, room for the title in scene.areas[0]
const jpeg = await toJpeg(brand.og({ title: post.title, drawTitle: true }))
```

The pictures are art, and the words are the site's: set the title in the
site's own font over `scene.areas[0]`, in its `ink`, with Satori or
`@vercel/og` taking the art as their background. Where that can't be done,
`drawTitle: true` sets the title into the image in the brand's face (a
bundled sans or serif, drawn from its outlines, so no font is needed
anywhere). A
JPEG keeps a grainy cover to about 50–170 KB, under what chat apps show;
`toPng` gives the same picture losslessly, at around a megabyte.

On Node, `toJpeg` and `toPng` use `@resvg/resvg-js` or `@resvg/resvg-wasm`,
whichever is installed. On an edge runtime or a Worker, install the WASM one
and pass its module:

```ts
import wasm from "@resvg/resvg-wasm/index_bg.wasm"
await toJpeg(brand.og({ title }), { wasm })
```

## Link previews from a URL

```ts
import { createHandler, signUrl } from "@pogrobert/surfaces/http"
import { toJpeg } from "@pogrobert/surfaces/png"

export const GET = createHandler({ brand, jpeg: (input) => toJpeg(generate(input)), secret: process.env.OG_SECRET })
// <meta property="og:image" content={await signUrl(`https://acme.dev/og?title=${encodeURIComponent(title)}&format=jpeg`, secret)}>
```

With a brand, a URL says only what the cover is about: `title`, `id`,
`use` and `format`. With a `secret`, only signed URLs are drawn, so no one
else can have it draw what they like.

## Plain DOM, SVG, HTTP

```ts
import { mount } from "@pogrobert/surfaces/dom"
mount(document.querySelector("#cover")!, { style: "strata", seed: "about", color: "#0ea5e9" }, { label: true })
```

```ts
import { generate, toSvg, describe } from "@pogrobert/surfaces"
const scene = generate({ style: "engraving", seed: "changelog", color: "#111827" })
const svg = toSvg(scene)      // a still image, for <img>, files and email
const alt = describe(scene, { title: "Changelog" })
// 'Abstract cover art for "Changelog": fine black lines bending into a wave.'

```

```ts
import { createHandler } from "@pogrobert/surfaces/http"
// A fetch handler (Request in, Response out), for any route:
// GET /cover?style=riso&seed=launch&width=1200&height=630&area=bottom-left:lg
export const GET = createHandler({ defaults: { color: "#635bff" } })
```

## Avatars

```tsx
import { Avatar } from "@pogrobert/surfaces/react"

<Avatar style="marbling" seed={user.id} color="#635bff" size={40} />
```

Six styles make avatars (`AVATAR_STYLES`): riso, marbling, strata, aquatint,
sfumato and underpaint. Each person's avatar is different, in your brand's
colours. `avatar(input)` returns the scene for `toSvg` or `toPng`, and
`createAvatarHandler` serves `/avatar?style=riso&seed=user-42&size=96`.

## Alt text

A cover under its page's heading is decoration and stays hidden from screen
readers; a list of covers reads as its titles. Label a cover only where it
stands alone: `label={post.title}` when the cover is itself the link, and
`describe(scene, { title })` for an OG image or a gallery.

## The input

```ts
{
  style: "riso",                 // see `catalog` for every style
  seed: "my-post",               // the page's slug or id; never 42 or "test"
  color: "#635bff",              // the brand colour, as hex
  width: 1600, height: 900,      // optional; default 1600 by 900
  areas: [{ place: "bottom-left", size: "lg" }],  // where content goes
  theme: "light",                // "light", "dark" or "auto" (follows the reader)
  mood: "calm",                  // or "bold"
  grain: "natural",              // "smooth", "natural" or "heavy"
  motion: "none",                // "once" or "loop" (one hero per page at most)
}
```

Every value is a word from a fixed list. `place` is one of nine places
(`top-left` … `bottom-right`, `center`), `size` is `sm`, `md` or `lg`.

- `art: "around"` (the default): the content sits on the art and its colour
  is guaranteed to read. The art keeps clear of it; a large area in the
  middle has the art pass behind it under a soft clearing instead.
- `art: "behind"`: the content covers the art, like an opaque card.

`generate` throws when the input is wrong, and the message names the fix
(`Unknown option "grian". Did you mean "grain"?`). `validate(input)` checks
without drawing.

## For agents

The package ships [AGENTS.md](AGENTS.md), a JSON Schema of the input
(`@pogrobert/surfaces/schema.json`, also `inputSchema`), and `catalog`: every
style with what it looks like, what it suits and its shapes.

## Styles

underpaint, halftone, endpaper, aquatint, mezzotint, sfumato, engraving, riso,
moire, strata, marbling, linework, dither, fluted, photocopy, chrome, glass,
stencil, screenprint.
