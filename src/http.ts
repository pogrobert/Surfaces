import { avatar } from "./avatar.ts"
import type { AvatarInput } from "./avatar.ts"
import { generate } from "./core/generate.ts"
import type { SurfaceInput } from "./core/generate.ts"
import { hash } from "./core/random.ts"
import { nearest } from "./core/validate.ts"
import { toSvg } from "./render/svg.ts"

// A cover from a URL, for <meta property="og:image"> and <img src>, and an
// avatar from one (createAvatarHandler, below):
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
  // server, toPng from "@pogrobert/surfaces/png" fits here.
  png?: (input: SurfaceInput) => Promise<Uint8Array>
}

class BadRequest extends Error {}

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
  read: (url: URL) => I
  draw: (input: I) => string
  theme: (input: I) => string | undefined
  png?: (input: I) => Promise<Uint8Array>
}

async function respond<I>(request: Request, { read, draw, theme, png }: Route<I>): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } })
  }
  const url = new URL(request.url)
  const format = url.searchParams.get("format") ?? "svg"
  let input: I
  let svg: string
  try {
    if (format !== "svg" && format !== "png") {
      throw new BadRequest(`Unknown format "${format}"; expected svg or png`)
    }
    if (format === "png" && !png) throw new BadRequest("This endpoint serves SVG only")
    input = read(url)
    if (format === "png" && theme(input) === "auto") {
      throw new BadRequest('A PNG has one theme; use theme=light or theme=dark')
    }
    // Drawing checks everything else, and everything it throws is about the
    // request.
    svg = draw(input)
  } catch (error) {
    return new Response(error instanceof Error ? error.message : String(error), {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }
  // A PNG is drawn from the same SVG, so the SVG names both.
  const etag = `"${format}-${hash(svg).toString(36)}"`
  const headers = {
    "content-type": format === "png" ? "image/png" : "image/svg+xml",
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
  if (format === "png") {
    // A failure here is the server's, such as resvg not being installed.
    try {
      body = (await png!(input)) as BodyInit
    } catch (error) {
      return new Response(error instanceof Error ? error.message : String(error), {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    }
  }
  return new Response(body, { headers })
}

export function createHandler({ defaults = {}, png }: HandlerOptions = {}) {
  return (request: Request) =>
    respond(request, {
      read: (url) => read(url, defaults),
      draw: (input) => toSvg(generate(input)),
      theme: (input) => input.theme,
      ...(png ? { png } : null),
    })
}

export type AvatarHandlerOptions = {
  defaults?: Partial<AvatarInput>
  png?: (input: AvatarInput) => Promise<Uint8Array>
}

const AVATAR_PARAMETERS = ["style", "seed", "color", "size", "theme", "mood", "grain", "square", "format"]

// An avatar from a URL, for <img src>: /avatar?style=riso&seed=user-42&color=635bff&size=96
export function createAvatarHandler({ defaults = {}, png }: AvatarHandlerOptions = {}) {
  const readAvatar = (url: URL): AvatarInput => {
    const query = url.searchParams
    for (const key of query.keys()) {
      if (!AVATAR_PARAMETERS.includes(key)) {
        throw new BadRequest(`Unknown parameter "${key}".${nearest(key, AVATAR_PARAMETERS) || ` Parameters are ${AVATAR_PARAMETERS.join(", ")}.`}`)
      }
    }
    const input: Record<string, unknown> = { ...defaults }
    for (const key of ["style", "seed", "theme", "mood", "grain"] as const) {
      const value = query.get(key)
      if (value !== null) input[key] = value
    }
    const color = query.get("color")
    if (color !== null) input.color = /^[0-9a-f]+$/i.test(color) ? `#${color}` : color
    const size = query.get("size")
    if (size !== null) input.size = Number(size)
    const square = query.get("square")
    if (square !== null) input.square = square === "" || square === "1" || square === "true"
    return input as AvatarInput
  }
  return (request: Request) =>
    respond(request, {
      read: readAvatar,
      draw: (input) => toSvg(avatar(input)),
      theme: (input) => input.theme,
      ...(png ? { png } : null),
    })
}
