"use client"
// The one part of <Surface> that runs in the browser: a moving cover's art,
// watched so it arrives when it is scrolled to and rests off screen (see
// watch.ts). A still cover never renders it, so it needs no client code at
// all and renders in a React Server Component; a moving one gets only this,
// with plain props that cross from the server.
import { createElement, useEffect, useRef } from "react"
import type { ReactElement } from "react"
import { watch } from "./watch.ts"

export type MovingProps = {
  html: string
  paused?: boolean
  role?: "img"
  "aria-label"?: string
  "aria-hidden"?: true
}

export function Moving({ html, paused, ...named }: MovingProps): ReactElement {
  const holder = useRef<HTMLDivElement>(null)
  useEffect(() => (holder.current ? watch(holder.current) : undefined), [html])
  return createElement("div", {
    ref: holder,
    ...named,
    "data-paused": paused ? "" : undefined,
    style: { position: "absolute", inset: 0, lineHeight: 0 },
    // The art is built from numbers and palette colours; nothing a caller
    // passes reaches it as markup.
    dangerouslySetInnerHTML: { __html: html },
  })
}
