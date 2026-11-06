# Surfaces

Generative covers for posts, pages and OG images. Make a brand once, then
every cover, link preview, hero and avatar follows from its title. The same
title always draws the same cover.

Not published yet. The full design is in [docs/api.md](docs/api.md).

## Brands

```ts
import { createBrand, readPage } from "@pogrobert/surfaces"

const brand = createBrand({ name: "acme.dev", color: "#635bff" })
// or let the site decide: createBrand({ name: "acme.dev", ...readPage(html, css) })

brand.cover({ title: post.title })   // a post's cover
brand.og({ title: post.title })      // its link preview
brand.hero({ title: "Pricing" })
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
import { generate, formats } from "@pogrobert/surfaces"
import { toPng } from "@pogrobert/surfaces/png"

const png = await toPng(
  generate({
    style: "aquatint",
    seed: post.slug,
    color: "#0f766e",
    ...formats.og,
    areas: [{ place: "bottom-left", size: "lg" }],
  })
)
```

On a server `toPng` needs `@resvg/resvg-js` installed next to this package.
The cover leaves the area clear; draw the title over the PNG yourself, at
`scene.areas[0]` (pixels), in `scene.areas[0].ink`.

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
style with what it looks like, what it suits, its shapes and whether it takes
a photo.

## Styles

underpaint, halftone, endpaper, aquatint, mezzotint, sfumato, engraving, riso,
moire, strata, marbling, linework, dither, fluted, photocopy, chrome, glass,
stencil.
