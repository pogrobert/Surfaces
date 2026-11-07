import assert from "node:assert/strict"
import { test } from "node:test"
import { logoCandidates } from "../site/read.ts"

// The first logo the page's reader would try on each page.
const first = (html: string, site = "https://www.acme.com/") => {
  const candidate = logoCandidates(html, new URL(site))[0]?.candidate
  return candidate && ("inline" in candidate ? candidate.inline : candidate.href.href)
}

test("the reader takes the logo a header names over a search's arrow home", () => {
  // As NASA's: a search suggestion links home with an icon in it.
  const html = `<header><img alt="Acme Logo" src="/logo.png" srcset="/logo.svg"><a href="https://www.acme.com/?search=rockets"><svg class="search-icon"><path d="M0 0"/></svg> Rockets</a></header>`
  assert.equal(first(html), "https://www.acme.com/logo.svg")
})

test("the reader passes over a product's or a sub-brand's logo for the site's own", () => {
  // A product named with the site in the header's menu, and the site's own
  // mark in a link home in the footer, as Asana's page has them.
  const asana = `<header><img alt="Acme Service Desk" src="/desk.svg"></header><main></main><footer><a href="/?noredirect"><span>Acme Home</span><svg viewBox="0 0 8 8"><path d="M0 0h8v8z"/></svg></a></footer>`
  assert.match(String(first(asana)), /^<svg viewBox="0 0 8 8">/)
  // A regional edition's logo far below the header: nothing beats it, and it
  // is still not the site's.
  const bbc = `<header></header><main><img alt="Acme Scotland logo" src="/scotland.png"></main>`
  assert.equal(first(bbc), undefined)
})

test("the reader knows a name run together, and a logo written into the page", () => {
  assert.match(String(first(`<header><svg><title>The Verge</title><path d="M0 0"/></svg></header>`, "https://www.theverge.com/")), /The Verge/)
  assert.equal(first(`<header><img alt="Acme" src="data:image/svg+xml;base64,PHN2Zy8+"></header>`), "data:image/svg+xml;base64,PHN2Zy8+")
})
