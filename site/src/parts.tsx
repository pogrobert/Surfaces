import { useEffect, useState } from "react"
import type { ComponentProps, ReactNode } from "react"
import { generate, toSvg } from "@pogrobert/surfaces"
import type { SurfaceInput } from "@pogrobert/surfaces"
import { Button } from "@/components/ui/button"
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockCopyButton, CodeBlockLine } from "@/components/ui/code-block"
import { highlightCode } from "@/lib/highlighter"

// A small picture as an <img> of its SVG: one element, drawn once at its size
// and kept, where the art inline would be hundreds of elements under filters,
// laid out again with the page. For the many small pictures; the large one on
// each page is the library's own <Surface> or <Cover>, as a site would use it.
const made = new Map<string, string>()
const later: (() => void)[] = []
let working = false
function work() {
  const until = performance.now() + 8
  while (later.length && performance.now() < until) later.shift()!()
  if (later.length) setTimeout(work, 4)
  else working = false
}
// Drawn a few at a time, so the page never stalls.
function soon(job: () => void) {
  later.push(job)
  if (!working) ((working = true), setTimeout(work))
}
function source(input: SurfaceInput) {
  const key = JSON.stringify(input)
  let src = made.get(key)
  if (!src) {
    if (made.size > 300) made.clear()
    src = URL.createObjectURL(new Blob([toSvg(generate(input))], { type: "image/svg+xml" }))
    made.set(key, src)
  }
  return src
}
export function Picture({ input, className = "" }: { input: SurfaceInput; className?: string }) {
  const key = JSON.stringify(input)
  const [src, setSrc] = useState(() => made.get(key))
  useEffect(() => {
    let gone = false
    soon(() => !gone && setSrc(source(input)))
    return () => void (gone = true)
  }, [key])
  return <span className={`relative block overflow-hidden tint ${className}`}>{src && <img alt="" decoding="async" src={src} className="absolute inset-0 size-full object-cover" />}</span>
}

// A button that copies, and says so for a moment.
export function CopyButton({ text, children, ...props }: { text: string; children: ReactNode } & Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => setDone(false), 1200)
    return () => clearTimeout(timer)
  }, [done])
  return (
    <Button {...props} onClick={() => navigator.clipboard?.writeText(text).then(() => setDone(true), () => {})}>
      <span aria-live="polite">{done ? "Copied" : children}</span>
    </Button>
  )
}

// Code to copy, coloured once its highlighter has loaded; plain until then,
// and plain for words that aren't code.
export function Code({ code, lang, className = "" }: { code: string; lang?: "typescript" | "bash"; className?: string }) {
  const [lines, setLines] = useState<ReactNode[] | null>(null)
  useEffect(() => {
    let gone = false
    setLines(null)
    if (lang) highlightCode(code, lang).then((result) => !gone && setLines(result), () => {})
    return () => void (gone = true)
  }, [code, lang])
  return (
    <CodeBlock className={`border-0 bg-secondary ${className}`}>
      <CodeBlockActions className="opacity-100!">
        <CodeBlockCopyButton value={code} />
      </CodeBlockActions>
      <CodeBlockContent wrap className="pr-12 text-[13px] leading-[1.6]">
        {(lines ?? code.split("\n")).map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}
