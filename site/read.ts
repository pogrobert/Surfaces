import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { toOklch } from "../src/core/color.ts"

// A public site as text, for the page's "read my site": its HTML, the
// stylesheets it links, and its logo, fetched once each and passed to
// readPage() in the browser. Only public addresses, only the web's own ports,
// a few redirects, and a cap on every size and wait, so a URL typed into the
// page can't reach into the machine serving it or hold it up.

export type Read = {
  name: string
  url: string
  html: string
  css: string
  // The logo as an SVG's text, or a PNG as base64.
  logo?: { svg: string } | { png: string; from: string }
  read: string[]
}

const MOST_HTML = 1_500_000
const MOST_CSS = 800_000
const MOST_LOGO = 200_000
// A sprite holds every icon a site has, so it may weigh more than one logo.
const MOST_SPRITE = 1_000_000
const MOST_SHEETS = 8
const WAIT = 8000

// Addresses that aren't the public internet: this machine, private networks,
// link-local (cloud metadata lives there), carrier NAT and the rest.
function isPrivate(address: string) {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase()
    if (lower === "::" || lower === "::1") return true
    if (lower.startsWith("::ffff:")) return isPrivate(lower.slice(7))
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower)
  }
  const [a, b] = address.split(".").map(Number) as [number, number]
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  )
}

async function checked(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`Only web addresses can be read, not ${url.protocol}`)
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Only sites on the web's usual ports can be read")
  if (url.username || url.password) throw new Error("Give the address without a name or password in it")
  const host = url.hostname.replace(/^\[|\]$/g, "")
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (!addresses.length) throw new Error(`${url.hostname} doesn't exist, or can't be found`)
  if (addresses.some(({ address }) => isPrivate(address))) throw new Error(`${url.hostname} isn't a public site`)
}

// One fetch, following redirects by hand so each hop is checked, and read
// only up to `most` bytes.
async function get(start: URL, most: number, accept: string) {
  let url = start
  for (let hop = 0; hop < 4; hop++) {
    await checked(url)
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(WAIT),
      headers: { accept, "user-agent": "Surfaces (reads a site's colours, type and logo)" },
    }).catch((error: Error) => {
      if (error.name === "TimeoutError") throw error
      throw new Error(`${url.hostname} couldn't be reached`)
    })
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = new URL(response.headers.get("location")!, url)
      continue
    }
    // A site that turns away tools reads as one that isn't there; say which.
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      throw new Error(`${url.hostname} doesn't let tools read it (it answered ${response.status}). Browse the styles and give its colour instead`)
    }
    if (!response.ok) throw new Error(`${url.hostname} answered ${response.status}`)
    const reader = response.body?.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value.subarray(0, most - size))
      size += chunks.at(-1)!.length
      if (size >= most) {
        await reader.cancel()
        break
      }
    }
    const bytes = new Uint8Array(size)
    let at = 0
    for (const chunk of chunks) {
      bytes.set(chunk, at)
      at += chunk.length
    }
    return { url, bytes, type: response.headers.get("content-type") ?? "" }
  }
  throw new Error(`${start.hostname} redirects too many times`)
}

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
const attribute = (tag: string, name: string) => tag.match(new RegExp(String.raw`\b${name}\s*=\s*["']([^"']*)["']`, "i"))?.[1]

// The site's logo: an image or inline SVG named for one, else the link home's
// SVG, else an SVG icon, else the touch icon. The first that loads is kept.
export function logoCandidates(html: string, base: URL) {
  const found: { candidate: { inline: string } | { href: URL }; score: number; place: number }[] = []
  const at = (href: string | undefined) => {
    try {
      return href ? new URL(href, base) : undefined
    } catch {
      return undefined
    }
  }
  // Said to be the site's logo: "logo" or "wordmark" as a word of its own,
  // not inside a class such as Primer_Brand__Testimonial, or a label or alt
  // that names the site. A page shows other companies' logos too, its
  // customers' and partners', and its own products', so one whose label is
  // the site's name and no more, "NASA Logo", outranks one that carries the
  // name among other words, "Asana Service Management", which outranks one
  // merely called a logo. Below the page's header, where a sub-brand's
  // sits, BBC Scotland's on the BBC's page, only the first kind counts, and
  // for less.
  const brand = base.hostname.replace(/^(?:www|open|app|web)\./, "").split(".")[0]!.toLowerCase()
  const word = /(?:^|[^a-z])(?:logo|logotype|wordmark|site-?mark)(?:[^a-z]|$)/i
  const naming = (text: string | undefined) => {
    // Run together, so "The Verge" names theverge.com.
    const said = (text ?? "").toLowerCase().replace(/[\s_-]+/g, "")
    if (!said.includes(brand)) return 0
    const rest = said.replace(brand, "").replace(/\.[a-z]{2,}\b|\b(?:the|logo|logotype|wordmark|mark|icon|home|homepage|page|go|to|back|link|official)\b|[^a-z]/g, "")
    return rest ? 2 : 3
  }
  const headerEnd = (() => {
    const close = html.search(/<\/header>/i)
    if (close >= 0) return close
    const main = html.search(/<main\b/i)
    return main >= 0 ? main : html.length * 0.2
  })()
  const scored = (named: number, called: boolean, place: number) => (place <= headerEnd ? named || (called ? 1 : 0) : named === 3 ? 1.5 : 0)
  for (const match of html.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)) {
    const open = match[0].slice(0, match[0].indexOf(">"))
    const label = attribute(open, "aria-label") ?? match[0].match(/<title>([\s\S]*?)<\/title>/i)?.[1]
    const score = scored(naming(label), word.test(attribute(open, "class") ?? "") || word.test(attribute(open, "id") ?? ""), match.index!)
    if (score) found.push({ candidate: { inline: match[0] }, score, place: match.index! })
  }
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0]
    // A drawing beside the bitmap, in the srcset, is the sharper of the two.
    const src = attribute(tag, "srcset")?.split(",").map((entry) => entry.trim().split(/\s+/)[0]).find((entry) => /\.svg(?:[?#]|$)/i.test(entry ?? "")) ?? attribute(tag, "src")
    const file = src?.split(/[?#]/)[0]?.split("/").pop()
    const href = at(src)
    const score = scored(naming(attribute(tag, "alt")), word.test(file ?? "") || word.test(attribute(tag, "class") ?? "") || word.test(attribute(tag, "id") ?? ""), match.index!)
    if (href && score) found.push({ candidate: { href }, score, place: match.index! })
  }
  // An SVG inside a link home, as a header's logo usually is, and where a
  // site keeps its own mark, ahead of a product's badge that carries the
  // name: one that says it is the site's, by its label, class or title, so a
  // nav's home icon, a house, is passed over. The link's address names the
  // site whatever the link holds, a search's arrow as much as the logo, so it
  // says less than a label does. One below the header, a footer's, still
  // says it is the site's own, so it counts for a little less.
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const address = attribute(match[1]!, "href")
    const link = at(address)
    if (!link || link.host !== base.host || link.pathname !== "/" || !/<svg\b/i.test(match[2]!)) continue
    // The link's attributes, and what is inside it without its drawing's paths.
    const said = `${match[1]!.replace(address!, "")} ${match[2]!.replace(/\s(?:d|points)="[^"]*"/g, "")}`.toLowerCase()
    const score = said.includes(brand) ? 3.5 : word.test(said) ? 2 : address!.toLowerCase().includes(brand) ? 2.5 : 0
    const svg = match[2]!.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0]
    if (svg && score) found.push({ candidate: { inline: svg }, score: match.index! <= headerEnd ? score : score - 1, place: match.index! })
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0]
    const href = at(attribute(tag, "href"))
    if (href && /\bicon\b/i.test(attribute(tag, "rel") ?? "") && (/svg/i.test(attribute(tag, "type") ?? "") || /\.svg(\?|$)/i.test(href.pathname))) {
      found.push({ candidate: { href }, score: 0.5, place: match.index! })
    }
  }
  return found.sort((a, b) => b.score - a.score || a.place - b.place)
}

// A logo's own colour: the one its SVG fills most with, leaving out black,
// white and greys, which a logo uses for type and outlines. Named for the
// brand, so readPage() ranks it first, as the command line does.
function logoColour(svg: string) {
  const counts = new Map<string, number>()
  for (const match of svg.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const hex = match[1]!.length === 3 ? `#${[...match[1]!].map((digit) => digit + digit).join("")}`.toLowerCase() : `#${match[1]!}`.toLowerCase()
    if (toOklch(hex).c < 0.06) continue
    counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
}

// An SVG drawn with the page's own variables, as a design system's logo is,
// fill="var(--color-ink)", with each set to what the page declares it as.
// Away from the page they mean nothing; one the page doesn't declare is
// drawn in the text's colour, which the library makes the cover's ink.
function resolveVariables(svg: string, source: string) {
  if (!/var\(/.test(svg)) return svg
  const declared = new Map<string, string>()
  for (const match of source.matchAll(/--([\w-]+)\s*:\s*([^;}"<>{]{1,200})/g)) {
    if (!declared.has(match[1]!)) declared.set(match[1]!, match[2]!.trim())
  }
  const follow = (value: string, depth = 0): string =>
    depth > 6 ? "currentColor" : value.replace(/var\(\s*--([\w-]+)\s*(?:,([^()]*))?\)/g, (_, name: string, fallback?: string) => follow(declared.get(name) ?? fallback?.trim() ?? "currentColor", depth + 1))
  return follow(svg)
}

// An inline SVG that leans on the page for its size or colour, given both.
// An SVG that draws by pointing into a sprite, <use href="/icons.svg#dots">,
// as Asana's does, with the sprite's symbol brought in, from the page or from
// the sprite's own file, since away from them it draws nothing. Nothing when
// a symbol it needs can't be found.
async function unsprite(svg: string, html: string, base: URL) {
  const uses = [...svg.matchAll(/<use\b[^>]*?\s(?:xlink:)?href\s*=\s*["']([^"'#]*)#([^"']+)["'][^>]*?(?:\/>|>\s*<\/use>)/gi)]
  let drawn = svg
  for (const [use, file, id] of uses) {
    let source = html
    if (file) {
      try {
        source = text((await get(new URL(file, base), MOST_SPRITE, "image/svg+xml")).bytes)
      } catch {
        return undefined
      }
    }
    const escaped = id!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const symbol = source.match(new RegExp(String.raw`<symbol\b([^>]*\sid\s*=\s*["']${escaped}["'][^>]*)>([\s\S]*?)<\/symbol>`, "i"))
    if (!symbol) return undefined
    const box = attribute(`<symbol ${symbol[1]}>`, "viewBox")
    drawn = drawn.replace(use, `<svg${box ? ` viewBox="${box}"` : ""} width="100%" height="100%">${symbol[2]}</svg>`)
  }
  // One with nothing left to draw is no logo.
  return /<(?:path|rect|circle|ellipse|polygon|polyline|line|text|image)\b/i.test(drawn) ? drawn : undefined
}

// An image written into the page itself, as a data URL, HubSpot's logo is.
function fromData(href: string) {
  const [, type = "", base64, body = ""] = href.match(/^data:([^;,]*)(;base64)?,(.*)$/s) ?? []
  const bytes = base64 ? Uint8Array.from(Buffer.from(body, "base64")) : new TextEncoder().encode(decodeURIComponent(body))
  return { type, bytes }
}

const standalone = (svg: string) => (/xmlns=/.test(svg) ? svg : svg.replace(/<svg\b/i, `<svg xmlns="http://www.w3.org/2000/svg"`))

export async function readSite(address: string): Promise<Read> {
  const typed = address.trim()
  if (!typed) throw new Error("Type your site's address, such as acme.com")
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(typed) ? typed : `https://${typed}`)
  } catch {
    throw new Error(`"${typed}" isn't a web address; type it as acme.com`)
  }
  const page = await get(url, MOST_HTML, "text/html")
  if (!/html|text\/plain|^$/i.test(page.type)) throw new Error(`${url.hostname} sent ${page.type.split(";")[0]}, not a web page`)
  const html = text(page.bytes)
  const read = [page.url.href]

  const sheets = (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((tag) => /\bstylesheet\b/i.test(attribute(tag, "rel") ?? "") && attribute(tag, "href"))
    .map((tag) => new URL(attribute(tag, "href")!, page.url))
    .slice(0, MOST_SHEETS)
  const css: string[] = []
  for (const sheet of sheets) {
    try {
      css.push(text((await get(sheet, MOST_CSS, "text/css")).bytes))
      read.push(sheet.href)
    } catch {
      // A sheet that won't load says nothing; the page's others still do.
    }
  }

  let logo: Read["logo"]
  for (const { candidate } of logoCandidates(html, page.url)) {
    if ("inline" in candidate) {
      const drawn = candidate.inline.length <= MOST_LOGO ? await unsprite(candidate.inline, html, page.url) : undefined
      if (!drawn) continue
      logo = { svg: standalone(resolveVariables(drawn, `${html}\n${css.join("\n")}`)) }
      break
    }
    try {
      const image = candidate.href.protocol === "data:" ? fromData(candidate.href.href) : await get(candidate.href, MOST_LOGO, "image/svg+xml,image/png")
      if (image.bytes.length >= MOST_LOGO) continue
      const body = text(image.bytes)
      if (/svg/i.test(image.type) || /^\s*(<\?xml[^>]*>\s*)?<svg/i.test(body)) {
        logo = { svg: standalone(resolveVariables(body, `${html}\n${css.join("\n")}`)) }
      } else if (image.bytes[0] === 0x89 && image.bytes[1] === 0x50) {
        logo = { png: Buffer.from(image.bytes).toString("base64"), from: candidate.href.protocol === "data:" ? page.url.href : candidate.href.href }
      } else continue
      if (candidate.href.protocol !== "data:") read.push(candidate.href.href)
      break
    } catch {
      // On to the next.
    }
  }

  const mark = logo && "svg" in logo ? logoColour(logo.svg) : undefined
  // Named as typed: a redirect to open.spotify.com is still spotify.com.
  return { name: url.hostname.replace(/^www\./, ""), url: page.url.href, html, css: [mark ? `:root { --brand-logo: ${mark}; }` : "", ...css].join("\n"), ...(logo ? { logo } : null), read }
}
