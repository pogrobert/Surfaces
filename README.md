# Surfaces

Generative art for every picture a site repeats: post covers and link
previews, docs, changelog and email headers, empty states, episode art,
slides, tickets, wallpapers, and the headers of its X and LinkedIn profiles.
Make a brand once, from a colour or from the site's own pages, and every
picture after it follows from what it is about. The same title always draws
the same art.

The pictures are art. The words on them are yours, set in your own font.
There is no API key, no cost per image and no model that drifts: the same
input gives the same bytes on every build, in Node, an edge runtime or the
browser. A picture of one particular thing, a product, a person or a place,
is a photo's job, or an image model's.

Not published yet. The whole design is in [docs/api.md](docs/api.md).

## Set up a site

```sh
npx @pogrobert/surfaces init
```

It reads the site's own files (its `DESIGN.md` first, then its stylesheets,
Tailwind config, root layout, fonts, logo and metadata), chooses a look with
a reason for each choice, and writes:

- `surfaces.ts` beside the source, the brand everything comes from;
- a short block in `AGENTS.md`, so coding agents use it rightly;
- on Next.js, `app/opengraph-image.tsx`, the site's link preview;
- `.surfaces/directions.jpg`, a board of other looks; `init --pick 3` takes one.

Nothing is sent anywhere, and nothing it didn't write is changed.

`npx @pogrobert/surfaces kit` then writes the site's link preview and its X,
LinkedIn and email headers into `public/`, all on one mark, with the site's
own logo set on them. `preview --title "A real title"` draws the brand into
`.surfaces/` to look at, and `check` says whether every picture holds, so an
agent can look, fix and look again.

## A brand

```ts
import { createBrand, readPage } from "@pogrobert/surfaces"

const brand = createBrand({ name: "acme.dev", color: "#635bff", logo: logoSvg })
// or let the site decide: createBrand({ name: "acme.dev", ...readPage(html, css, designMd) })

brand.cover({ title: post.title })          // a post's cover
brand.cover({ title, tag: post.category })  // a category's posts make one mark
brand.cover({ title, id: post.slug })       // the art stays when the title is edited
brand.og({ title: post.title })             // a link preview, 1200 × 630
brand.hero({ title: "Pricing" })            // the one picture on a page that moves
brand.card({ title: post.title })           // a card in a list
brand.banner({ for: "x" })                  // and "linkedin", "email"
```

`brand.look` is every choice it made, as plain data: keep it, and the brand
is rebuilt exactly. `brand.why` says why each was made. To show a person
other looks, each already checked, and keep the one they like:

```ts
const options = directions({ name: "acme.dev", ...readPage(html, css) })
const brand = createBrand({ name: "acme.dev", ...options[2].look })
```

## Your words, in your font

A picture keeps a calm place for words where its use carries them over the
art: a link preview at the brand's own edge, a hero in the middle. A post's
cover, a card and a header keep none, since their words sit beside them, so
the art has the whole frame. `text` moves the place, or takes it away:

```ts
brand.cover({ title, text: "bottom-left" })  // room for the title at the foot
brand.og({ title, text: "none" })            // the whole frame for the art
```

The scene's first area is that place, in pixels, with the colour that reads
there: `scene.areas[0]` is `{ place, x, y, width, height, ink }`. In React,
`<Cover>` sets the title there as text, in the page's own font:

```tsx
import { Cover } from "@pogrobert/surfaces/react"

<Cover brand={brand} title={post.title} />
```

## Link previews

A link preview is an image, so its title has to be in it. The best way is
an image renderer that takes your font, with the art as its background, as
Next.js's `ImageResponse` (Satori) does:

```tsx
import { ImageResponse } from "next/og"
import { toPng } from "@pogrobert/surfaces/png"

export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get("title") ?? "Acme"
  const scene = brand.og({ title })
  const art = `data:image/png;base64,${Buffer.from(await toPng(scene)).toString("base64")}`
  const { x, y, width, height, ink } = scene.areas[0]!
  return new ImageResponse(
    <div style={{ display: "flex", width: 1200, height: 630, position: "relative" }}>
      <img src={art} width={1200} height={630} style={{ position: "absolute" }} />
      <div style={{ position: "absolute", left: x, top: y, width, height, display: "flex", alignItems: "flex-end", color: ink, fontSize: 64, fontFamily: "Your Font" }}>
        {title}
      </div>
    </div>,
    { width: 1200, height: 630, fonts: [{ name: "Your Font", data: yourFontFile }] }
  )
}
```

Where that can't be done, `drawTitle: true` sets the title into the image
itself, in a bundled sans or serif drawn from its outlines, so no font is
needed anywhere:

```ts
import { toJpeg } from "@pogrobert/surfaces/png"

const jpeg = await toJpeg(brand.og({ title: post.title, drawTitle: true }))
```

A JPEG keeps a grainy picture to about 50–170 KB, under what chat apps show;
`toPng` gives it losslessly. On Node they use `@resvg/resvg-js` or
`@resvg/resvg-wasm`, whichever is installed; on an edge runtime or a Worker,
install the WASM one and pass its module: `toJpeg(scene, { wasm })`.

## Everywhere else

Any other picture is the brand's input at the size the place needs, so a
docs header, an empty state and an episode's art are one family:

```ts
import { generate } from "@pogrobert/surfaces"

const at = (id: string, width: number, height: number) => generate({ ...brand.input("card", { id }), width, height })

at("docs/webhooks", 1600, 400)   // a docs page's header
at("empty/inbox", 800, 800)      // an empty state
at("episode-42", 3000, 3000)     // podcast or episode art
at("slides/q3", 1920, 1080)      // a slide's background
at("wallpaper", 1170, 2532)      // a phone wallpaper
```

Draw any of them with `toHtml` (inline on a page, the only output that
moves), `toSvg` (files, `<img>`, email) or `toJpeg` and `toPng`.

## Styles

Nineteen, each with its own shapes, in a light or dark ground, calm or bold,
smooth, natural or heavy grain, and any colour.

- **Printed:** stencil, screenprint, riso, photocopy, halftone, dither
- **Engraved:** engraving, linework, moire, mezzotint, aquatint
- **Light:** underpaint (an aura of soft colour), sfumato, fluted (reeded glass), chrome, glass
- **Pattern:** marbling, strata, endpaper

`catalog` lists every style with what it looks like, what it suits and its
shapes. A brand picks one from the site's own type, words and colour; give
`style` to choose.

## Alt text

A picture under its page's heading is decoration and stays hidden from
screen readers; a list of covers reads as its titles. Label one only where it
stands alone: `label={post.title}` when the cover is itself the link, and
`describe(scene, { title })` for a link preview or a gallery.

## Link previews from a URL

```ts
import { createHandler, signUrl } from "@pogrobert/surfaces/http"
import { toJpeg } from "@pogrobert/surfaces/png"

export const GET = createHandler({ brand, jpeg: (input) => toJpeg(generate(input)), secret: process.env.OG_SECRET })
// <meta property="og:image" content={await signUrl(`https://acme.dev/og?title=${encodeURIComponent(title)}&format=jpeg`, secret)}>
```

With a brand, a URL says only what the picture is about: `title`, `id`, `use`
and `format`, and the title is drawn in. With a `secret`, only signed URLs
are drawn, so no one else can have it draw what they like.

## One exact picture

A brand is how a site keeps one look. For a single picture outside one,
every choice is made by hand:

```ts
import { generate, toSvg, describe } from "@pogrobert/surfaces"

const scene = generate({
  style: "riso",                 // see `catalog`
  seed: "my-post",               // the page's slug or id; never 42 or "test"
  color: "#635bff",              // the brand colour, as hex
  width: 1600, height: 900,      // optional; default 1600 by 900
  areas: [{ place: "bottom-left", size: "lg" }],  // where content goes
  theme: "light",                // "light", "dark" or "auto" (follows the reader)
  mood: "calm",                  // or "bold"
  grain: "natural",              // "smooth", "natural" or "heavy"
  motion: "none",                // "once" or "loop" (one hero per page at most)
})
const svg = toSvg(scene)
const alt = describe(scene, { title: "Changelog" })
```

Every value is a word from a fixed list. `place` is one of nine places
(`top-left` … `bottom-right`, `center`), `size` is `sm`, `md` or `lg`.
`art: "around"` (the default) keeps the art clear of the area so what sits
there reads; `art: "behind"` lays the content over the art, like an opaque
card. In React, `<Surface>` takes the same input, with each area's content:

```tsx
import { Surface } from "@pogrobert/surfaces/react"

<Surface style="riso" seed="pricing" color="#2b59c3" width={2400} height={1200}
  areas={[{ place: "center", size: "lg", content: <h1>Pricing</h1> }]} />
```

Plain DOM has `mount(element, input)` from `@pogrobert/surfaces/dom`, and
`createHandler` serves any input from a URL:
`/cover?style=riso&seed=launch&width=1200&height=630&area=bottom-left:lg`.

`generate` throws when the input is wrong, and the message names the fix
(`Unknown option "grian". Did you mean "grain"?`). `validate(input)` checks
without drawing.

## For agents

The package ships [AGENTS.md](AGENTS.md), a JSON Schema of the input
(`@pogrobert/surfaces/schema.json`, also `inputSchema`), [llms.txt](llms.txt)
and `catalog`.

## License

[MIT No Attribution](LICENSE): use it for anything, commercial or not, with
no credit needed. The bundled fonts, Inter and Fraunces, are under the SIL
Open Font License.
