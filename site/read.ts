import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

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
    })
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = new URL(response.headers.get("location")!, url)
      continue
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
  const found: ({ inline: string } | { href: URL })[] = []
  const at = (href: string | undefined) => {
    try {
      return href ? new URL(href, base) : undefined
    } catch {
      return undefined
    }
  }
  for (const match of html.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)) {
    const open = match[0].slice(0, match[0].indexOf(">"))
    if (/logo|brand|wordmark/i.test(open)) found.push({ inline: match[0] })
  }
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = attribute(tag, "src")
    if (/logo|brand|wordmark/i.test(tag) && src) {
      const href = at(src)
      if (href) found.push({ href })
    }
  }
  // An SVG inside the first link home, as a header's logo usually is.
  const home = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].find((match) => {
    const link = at(attribute(match[1]!, "href"))
    return link && link.host === base.host && link.pathname === "/" && /<svg\b/i.test(match[2]!)
  })
  const svg = home?.[2]!.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0]
  if (svg) found.push({ inline: svg })
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attribute(tag, "rel") ?? ""
    const href = at(attribute(tag, "href"))
    if (!href) continue
    if (/\bicon\b/i.test(rel) && (/svg/i.test(attribute(tag, "type") ?? "") || /\.svg(\?|$)/i.test(href.pathname))) found.push({ href })
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const href = at(attribute(tag, "href"))
    if (href && /apple-touch-icon/i.test(attribute(tag, "rel") ?? "")) found.push({ href })
  }
  return found
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
      logo = { svg: standalone(candidate.inline) }
      break
    }
    try {
      const image = await get(candidate.href, MOST_LOGO, "image/svg+xml,image/png")
      if (image.bytes.length >= MOST_LOGO) continue
      const body = text(image.bytes)
      if (/svg/i.test(image.type) || /^\s*(<\?xml[^>]*>\s*)?<svg/i.test(body)) {
        logo = { svg: standalone(body) }
      } else if (image.bytes[0] === 0x89 && image.bytes[1] === 0x50) {
        logo = { png: Buffer.from(image.bytes).toString("base64"), from: candidate.href.href }
      } else continue
      read.push(candidate.href.href)
      break
    } catch {
      // On to the next.
    }
  }

  return { name: page.url.hostname.replace(/^www\./, ""), url: page.url.href, html, css: css.join("\n"), ...(logo ? { logo } : null), read }
}
