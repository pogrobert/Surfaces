import { Component, useEffect, useState } from "react"
import type { ComponentProps, ReactNode } from "react"
import { generate, toSvg } from "@pogrobert/surfaces"
import type { SurfaceInput } from "@pogrobert/surfaces"
import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockCopyButton, CodeBlockLine } from "@/components/ui/code-block"
import { copyText, SAID } from "@/lib/copy"
import { loadHighlighter } from "@/lib/highlighter"
import { setTheme, useTheme } from "@/lib/theme"
import type { ThemeChoice } from "@/lib/theme"

// A small picture as an <img> of its SVG: one element, drawn once at its size
// and kept, where the art inline would be hundreds of elements under filters,
// laid out again with the page. For the many small pictures; the large one on
// each page is the library's own <Surface> or <Cover>, as a site would use it.
const made = new Map<string, string>()
const MOST = 300
const later: (() => void)[] = []
let working = false
function work() {
  const until = performance.now() + 8
  while (later.length && performance.now() < until) {
    // One picture that fails to draw is left blank; the rest still come.
    try {
      later.shift()!()
    } catch (error) {
      console.error(error)
    }
  }
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
  if (src) {
    // The most recently asked for are kept longest.
    made.delete(key)
    made.set(key, src)
    return src
  }
  src = URL.createObjectURL(new Blob([toSvg(generate(input))], { type: "image/svg+xml" }))
  made.set(key, src)
  // The oldest are let go, their memory with them. An <img> already showing
  // one keeps its picture; asked for again, it is drawn again.
  if (made.size > MOST) {
    for (const [old, url] of [...made].slice(0, made.size - MOST + 50)) {
      made.delete(old)
      URL.revokeObjectURL(url)
    }
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
  return (
    <span className={`relative block overflow-hidden tint ${className}`}>
      {src && <img alt="" decoding="async" draggable={false} src={src} className="pointer-events-none absolute inset-0 size-full object-cover" />}
    </span>
  )
}


// A button that copies, and says so for a moment. Both words stand in one
// place, so the button keeps its width and nothing beside it moves.
export function CopyButton({ text, children, ...props }: { text: string; children: ReactNode } & Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
  const [said, setSaid] = useState<"" | "Copied" | "Couldn't copy">("")
  useEffect(() => {
    if (!said) return
    const timer = setTimeout(() => setSaid(""), SAID)
    return () => clearTimeout(timer)
  }, [said])
  // The same swap as the code block's icon: the word going shrinks a little as
  // it fades, the one coming grows in. Asked for less motion, only the fade.
  const fade = "col-start-1 row-start-1 transition-[opacity,scale] duration-150 ease-out motion-reduce:scale-100!"
  return (
    <Button {...props} onClick={async () => setSaid((await copyText(text)) ? "Copied" : "Couldn't copy")}>
      <span className="grid justify-items-center">
        <span className={`${fade} ${said ? "scale-95 opacity-0" : ""}`}>{children}</span>
        <span aria-hidden className={`${fade} ${said ? "" : "scale-95 opacity-0"}`}>{said || "Copied"}</span>
      </span>
      <span aria-live="polite" className="sr-only">{said}</span>
    </Button>
  )
}

// Something that failed to draw shows `fallback` in its place instead of
// emptying the page, and tries again once `retry` changes.
export class Mend extends Component<{ fallback: ReactNode; retry: unknown; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error(error)
  }
  componentDidUpdate(before: { retry: unknown }) {
    if (this.state.failed && before.retry !== this.props.retry) this.setState({ failed: false })
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// Code to copy, coloured once its highlighter has loaded and plain until then.
// Once loaded it colours each new snippet as it is drawn, so a change never
// shows the code plain for a moment first.
type Highlighter = NonNullable<Awaited<ReturnType<typeof loadHighlighter>>>
const ready = new Map<string, Highlighter>()
export function Code({ code, lang, className = "" }: { code: string; lang?: "typescript" | "bash"; className?: string }) {
  const [, setLoaded] = useState(0)
  useEffect(() => {
    if (!lang || ready.has(lang)) return
    let gone = false
    loadHighlighter(lang).then((highlighter) => {
      if (highlighter) ready.set(lang, highlighter)
      if (!gone) setLoaded((n) => n + 1)
    }, () => {})
    return () => void (gone = true)
  }, [lang])
  const highlighter = lang ? ready.get(lang) : undefined
  const lines: ReactNode[] = highlighter ? highlighter.highlight(code).lines : code.split("\n")
  return (
    <CodeBlock className={`border-0 bg-secondary ${className}`}>
      <CodeBlockActions className="opacity-100!">
        <CodeBlockCopyButton value={code} />
      </CodeBlockActions>
      <CodeBlockContent wrap className="pr-12 text-[13px] leading-[1.6]">
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}

// The page's theme: follow the system, or keep it light or dark. Three icons
// in a row, the arrow keys moving along them, as every choice on the site is.
const THEMES = [
  ["system", "Follow the system", Monitor],
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
] as const
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { choice } = useTheme()
  return (
    <ToggleGroup type="single" aria-label="Theme" spacing={0} value={choice} onValueChange={(next) => next && setTheme(next as ThemeChoice)} className={className}>
      {THEMES.map(([value, label, Icon]) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} title={label} size="sm" className="text-current opacity-70 hover:bg-current/10 hover:text-current data-[state=on]:bg-current/12 data-[state=on]:opacity-100 pointer-coarse:size-10">
          <Icon />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

// GitHub's mark, beside the link to the repository.
export function GitHubMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}
