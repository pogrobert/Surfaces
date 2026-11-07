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
function logoCandidates(html: string, base: URL) {
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
  // customers' and partners', so one that names the site outranks one merely
  // called a logo, and that only counts in the page's header.
  const brand = base.hostname.replace(/^(?:www|open|app|web)\./, "").split(".")[0]!.toLowerCase()
  const word = /(?:^|[^a-z])(?:logo|logotype|wordmark|site-?mark)(?:[^a-z]|$)/i
  const names = (text: string | undefined) => Boolean(text && text.toLowerCase().includes(brand))
  const headerEnd = (() => {
    const close = html.search(/<\/header>/i)
    if (close >= 0) return close
    const main = html.search(/<main\b/i)
    return main >= 0 ? main : html.length * 0.2
  })()
  const scored = (named: boolean, called: boolean, place: number) => (named ? 3 : called && place <= headerEnd ? 1 : 0)
  for (const match of html.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)) {
    const open = match[0].slice(0, match[0].indexOf(">"))
    const label = attribute(open, "aria-label") ?? match[0].match(/<title>([\s\S]*?)<\/title>/i)?.[1]
    const score = scored(names(label), word.test(attribute(open, "class") ?? "") || word.test(attribute(open, "id") ?? ""), match.index!)
    if (score) found.push({ candidate: { inline: match[0] }, score, place: match.index! })
  }
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0]
    const src = attribute(tag, "src")
    const file = src?.split(/[?#]/)[0]?.split("/").pop()
    const href = at(src)
    const score = scored(names(attribute(tag, "alt")), word.test(file ?? "") || word.test(attribute(tag, "class") ?? "") || word.test(attribute(tag, "id") ?? ""), match.index!)
    if (href && score) found.push({ candidate: { href }, score, place: match.index! })
  }
  // An SVG inside a link home, as a header's logo usually is: one that says
  // it is the site's, by its label, class or title, so a nav's home icon, a
  // house, is passed over.
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const link = at(attribute(match[1]!, "href"))
    if (!link || link.host !== base.host || link.pathname !== "/" || !/<svg\b/i.test(match[2]!)) continue
    // The link's attributes, and what is inside it without its drawing's paths.
    const said = `${match[1]} ${match[2]!.replace(/\s(?:d|points)="[^"]*"/g, "")}`.toLowerCase()
    // The link home is where a site keeps its own mark, ahead of a product's
    // badge that happens to carry the name.
    const score = said.includes(brand) ? 3.5 : /logo|wordmark/.test(said) ? 2 : 0
    const svg = match[2]!.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0]
    if (svg && score) {
      found.push({ candidate: { inline: svg }, score, place: match.index! })
      break
    }
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0]
    const href = at(attribute(tag, "href"))
    if (href && /\bicon\b/i.test(attribute(tag, "rel") ?? "") && (/svg/i.test(attribute(tag, "type") ?? "") || /\.svg(\?|$)/i.test(href.pathname))) {
      found.push({ candidate: { href }, score: 0.5, place: match.index! })
    }
  }
  return found.sort((a, b) => b.score - a.score || a.place - b.place).map((entry) => entry.candidate)
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
  for (const candidate of logoCandidates(html, page.url)) {
    if ("inline" in candidate) {
      if (candidate.inline.length > MOST_LOGO) continue
      logo = { svg: standalone(resolveVariables(candidate.inline, `${html}\n${css.join("\n")}`)) }
      break
    }
    try {
      const image = await get(candidate.href, MOST_LOGO, "image/svg+xml,image/png")
      if (image.bytes.length >= MOST_LOGO) continue
      const body = text(image.bytes)
      if (/svg/i.test(image.type) || /^\s*(<\?xml[^>]*>\s*)?<svg/i.test(body)) {
        logo = { svg: standalone(resolveVariables(body, `${html}\n${css.join("\n")}`)) }
      } else if (image.bytes[0] === 0x89 && image.bytes[1] === 0x50) {
        logo = { png: Buffer.from(image.bytes).toString("base64"), from: candidate.href.href }
      } else continue
      read.push(candidate.href.href)
      break
    } catch {
      // On to the next.
    }
  }

  const mark = logo && "svg" in logo ? logoColour(logo.svg) : undefined
  // Named as typed: a redirect to open.spotify.com is still spotify.com.
  return { name: url.hostname.replace(/^www\./, ""), url: page.url.href, html, css: [mark ? `:root { --brand-logo: ${mark}; }` : "", ...css].join("\n"), ...(logo ? { logo } : null), read }
}
