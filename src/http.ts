import { createBrand } from "./brand.ts"
import type { Brand } from "./brand.ts"
import { generate } from "./core/generate.ts"
import type { SurfaceInput } from "./core/generate.ts"
import { hash } from "./core/random.ts"
import { nearest } from "./core/validate.ts"
import { USES } from "./page.ts"
import type { Use } from "./page.ts"
import { toSvg } from "./render/svg.ts"

// A cover from a URL, for <meta property="og:image"> and <img src>:
//
//   /cover?style=riso&seed=my-post&color=635bff&width=1200&height=630&area=bottom-left:lg
//
// With `title`, the title is set into the image, as a link preview needs:
// `&title=Notes%20on%20shipping&font=serif`.
//
// The parameters are the input's own names. Each `area` is a place, then
// optionally a size and what the art does there: `area=center:md:behind`.
// Repeat it for more than one. A colour may leave out its "#".
//
// Web-standard Request in, Response out, so it runs as a Next.js route
// handler, in Bun, Deno, Workers, or Node behind any adapter. A URL always
// draws the same bytes, so a cover is cached for good.

// A URL can ask for no bigger a drawing than this, either way.
const MOST_SIDE = 4096

const PARAMETERS = ["style", "seed", "color", "width", "height", "area", "theme", "mood", "grain", "detail", "motion", "shape", "title", "font", "format"]

export type HandlerOptions = {
  // Fills in anything the URL leaves out, such as the brand colour.
  defaults?: Partial<SurfaceInput>
  // Returns PNG bytes for ?format=png; leave it out to serve SVG only. On a
  // server, (input) => toPng(generate(input)) from "@pogrobert/surfaces/png"
  // fits here.
  png?: (input: SurfaceInput) => Promise<Uint8Array>
  // The same for ?format=jpeg, the size a link preview wants:
  // (input) => toJpeg(generate(input)).
  jpeg?: (input: SurfaceInput) => Promise<Uint8Array>
  // A brand's covers instead of any input: the URL then says only what a
  // cover is about (see readBrand, below).
  brand?: Brand
  // With it, only URLs signed with it are drawn, so no one else can have the
  // endpoint draw what they like; sign them with signUrl().
  secret?: string
}

class BadRequest extends Error {}
class Forbidden extends BadRequest {}

// A brand's cover from a URL: /og?title=Notes%20on%20shipping, with
// `use` (post, card, hero or og, default og), `id` to keep a cover's art
// when its title changes, `theme` for one side of a brand that follows the
// reader, and `format`. The title is set into the image wherever the cover
// keeps room for it, since an image has nowhere else to show it.
const BRAND_PARAMETERS = ["title", "id", "tag", "use", "theme", "format", "sig"]

function readBrand(url: URL, brand: Brand): SurfaceInput {
  const query = url.searchParams
  for (const key of query.keys()) {
    if (!BRAND_PARAMETERS.includes(key)) {
      throw new BadRequest(`Unknown parameter "${key}".${nearest(key, BRAND_PARAMETERS) || ` A brand's URL takes ${BRAND_PARAMETERS.join(", ")}.`}`)
    }
  }
  const use = (query.get("use") ?? "og") as Use
  if (!(USES as readonly string[]).includes(use)) throw new BadRequest(`Unknown use "${use}". Use ${USES.join(", ")}.`)
  const theme = query.get("theme")
  if (theme !== null && theme !== "light" && theme !== "dark") throw new BadRequest(`"theme" is light or dark, got "${theme}"`)
  const themed = theme ? createBrand({ name: brand.name, ...brand.look, theme }) : brand
  const title = query.get("title") ?? undefined
  const id = query.get("id") ?? undefined
  const tag = query.get("tag") ?? undefined
  return themed.input(use, { ...(title ? { title } : null), ...(id ? { id } : null), ...(tag ? { tag } : null), drawTitle: use !== "card" && Boolean(title) })
}

// The URL without its signature, its parameters in order, as both sides sign it.
const canonical = (url: URL) => {
  const query = new URLSearchParams([...url.searchParams].filter(([key]) => key !== "sig").sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  return `${url.pathname}?${query}`
}

async function signature(text: string, secret: string) {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error("Signing URLs needs WebCrypto (crypto.subtle), which Node 20+, Deno, Bun, Workers and edge runtimes have")
  const encode = (value: string) => new TextEncoder().encode(value)
  const key = await subtle.importKey("raw", encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const bytes = new Uint8Array(await subtle.sign("HMAC", key, encode(text)))
  let binary = ""
  for (const byte of bytes.subarray(0, 16)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// A URL with its signature added, for a handler made with a `secret`. Sign
// on the server, where the secret is: `og:image` = await signUrl(url, secret).
export async function signUrl(url: string, secret: string) {
  const parsed = new URL(url, "http://local")
  parsed.searchParams.delete("sig")
  parsed.searchParams.set("sig", await signature(canonical(parsed), secret))
  return /^https?:\/\//.test(url) ? parsed.toString() : `${parsed.pathname}${parsed.search}`
}

async function verify(url: URL, secret: string) {
  const given = url.searchParams.get("sig")
  if (!given) throw new Forbidden(`This endpoint draws only signed URLs: sign it with signUrl(url, secret)`)
  if (given !== (await signature(canonical(url), secret))) throw new Forbidden(`The URL's signature doesn't match: sign it again with signUrl(url, secret)`)
}

// Only what a URL can't say as the input does is checked here: everything
// else goes to generate, whose messages name the fix.
function read(url: URL, defaults: Partial<SurfaceInput>): SurfaceInput {
  const query = url.searchParams
  for (const key of query.keys()) {
    if (!PARAMETERS.includes(key)) {
      const hint = key === "w" ? ' Use "width".' : key === "h" ? ' Use "height".' : nearest(key, PARAMETERS)
      throw new BadRequest(`Unknown parameter "${key}".${hint || ` Parameters are ${PARAMETERS.join(", ")}.`}`)
    }
  }
  const size = (key: "width" | "height") => {
    const value = query.get(key)
    if (value === null) return undefined
    const number = Number(value)
    if (!Number.isInteger(number) || number < 16 || number > MOST_SIDE) {
      throw new BadRequest(`"${key}" must be a whole number of pixels from 16 to ${MOST_SIDE}, got "${value}".`)
    }
    return number
  }
  const input: Record<string, unknown> = { ...defaults }
  for (const key of ["style", "seed", "theme", "mood", "grain", "detail", "motion", "shape", "title", "font"] as const) {
    const value = query.get(key)
    if (value !== null) input[key] = value
  }
  const color = query.get("color")
  if (color !== null) input.color = /^[0-9a-f]+$/i.test(color) ? `#${color}` : color
  const width = size("width")
  const height = size("height")
  if (width !== undefined) input.width = width
  if (height !== undefined) input.height = height
  // place:size:art; generate checks each part and says what's wrong.
  const areas = query.getAll("area").map((value) => {
    const [place, size, art] = value.split(":")
    return { place, ...(size ? { size } : null), ...(art ? { art } : null) }
  })
  if (areas.length) input.areas = areas
  return input as SurfaceInput
}

// What a URL handler needs to know: how to read its input from the query,
// and how to draw it.
type Route<I> = {
  read: (url: URL) => I | Promise<I>
  draw: (input: I) => string
  theme: (input: I) => string | undefined
  png?: (input: I) => Promise<Uint8Array>
  jpeg?: (input: I) => Promise<Uint8Array>
}

const TYPES = { svg: "image/svg+xml", png: "image/png", jpeg: "image/jpeg" } as const

async function respond<I>(request: Request, { read, draw, theme, png, jpeg }: Route<I>): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } })
  }
  const url = new URL(request.url)
  const format = url.searchParams.get("format") ?? "svg"
  let input: I
  let svg: string
  try {
    if (format !== "svg" && format !== "png" && format !== "jpeg") {
      throw new BadRequest(`Unknown format "${format}"; expected svg, png or jpeg`)
    }
    if (format === "png" && !png) throw new BadRequest("This endpoint serves no PNG; give the handler a png function")
    if (format === "jpeg" && !jpeg) throw new BadRequest("This endpoint serves no JPEG; give the handler a jpeg function")
    input = await read(url)
    if (format !== "svg" && theme(input) === "auto") {
      throw new BadRequest(`A ${format.toUpperCase()} has one theme; use theme=light or theme=dark`)
    }
    // Drawing checks everything else, and everything it throws is about the
    // request.
    svg = draw(input)
  } catch (error) {
    return new Response(error instanceof Error ? error.message : String(error), {
      status: error instanceof Forbidden ? 403 : 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }
  // A PNG is drawn from the same SVG, so the SVG names both.
  const etag = `"${format}-${hash(svg).toString(36)}"`
  const headers = {
    "content-type": TYPES[format],
    "cache-control": "public, max-age=31536000, immutable",
    etag,
    // An SVG can carry scripts in general; these never do, and this says so.
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    "x-content-type-options": "nosniff",
  }
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers })
  }
  if (request.method === "HEAD") return new Response(null, { headers })
  let body: BodyInit = svg
  if (format !== "svg") {
    // A failure here is the server's, such as resvg not being installed.
    try {
      body = (await (format === "png" ? png : jpeg)!(input)) as BodyInit
    } catch (error) {
      return new Response(error instanceof Error ? error.message : String(error), {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    }
  }
  return new Response(body, { headers })
}

export function createHandler({ defaults = {}, png, jpeg, brand, secret }: HandlerOptions = {}) {
  return (request: Request) =>
    respond(request, {
      read: async (url) => {
        if (secret) await verify(url, secret)
        return brand ? readBrand(url, brand) : read(url, defaults)
      },
      draw: (input) => toSvg(generate(input)),
      theme: (input) => input.theme,
      ...(png ? { png } : null),
      ...(jpeg ? { jpeg } : null),
    })
}
