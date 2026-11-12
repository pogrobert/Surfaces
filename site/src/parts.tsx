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
// emptying the page, and tries again once `retry` changes: put in it all that
// could make the next try draw, such as a size.
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
// Under a finger they are 40px, and 32px under 360px, so a header fits a 320px phone.
const THEMES = [
  ["system", "Follow the system", Monitor],
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
] as const
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { choice } = useTheme()
  // On a phone one button stands for all three, showing the one in use and
  // moving to the next on each press, so the header has room to breathe.
  const at = THEMES.findIndex(([value]) => value === choice)
  const [, label, Icon] = THEMES[at]!
  const [next, nextLabel] = THEMES[(at + 1) % THEMES.length]!
  return (
    <>
      <ToggleGroup type="single" aria-label="Theme" spacing={0} value={choice} onValueChange={(picked) => picked && setTheme(picked as ThemeChoice)} className={`max-[640px]:hidden ${className}`}>
        {THEMES.map(([value, name, Each]) => (
          <ToggleGroupItem key={value} value={value} aria-label={name} title={name} size="sm" className="rounded-[min(var(--radius-md),12px)]! text-current opacity-70 hover:bg-current/10 hover:text-current data-[state=on]:bg-current/12 data-[state=on]:opacity-100 pointer-coarse:size-10">
            <Each />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Theme: ${label}. Switch to ${nextLabel.toLowerCase()}`}
        title={`Theme: ${label}`}
        onClick={() => setTheme(next)}
        className={`text-current hover:bg-current/10 hover:text-current min-[641px]:hidden pointer-coarse:size-10 ${className}`}
      >
        <Icon />
      </Button>
    </>
  )
}

// npm's mark, beside the link to the package: its square "n", in the text's
// colour as GitHub's is, rather than its red.
export function NpmMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
    </svg>
  )
}

// The other package managers' marks, beside their names in the row that
// chooses one. Each is its maker's own mark in one colour, the text's.
export function PnpmMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M0 0v7.5h7.5V0zm8.25 0v7.5h7.498V0zm8.25 0v7.5H24V0zM8.25 8.25v7.5h7.498v-7.5zm8.25 0v7.5H24v-7.5zM0 16.5V24h7.5v-7.5zm8.25 0V24h7.498v-7.5zm8.25 0V24H24v-7.5z" />
    </svg>
  )
}

export function YarnMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 0C5.375 0 0 5.375 0 12s5.375 12 12 12 12-5.375 12-12S18.625 0 12 0zm.768 4.105c.183 0 .363.053.525.157.125.083.287.185.755 1.154.31-.088.468-.042.551-.019.204.056.366.19.463.375.477.917.542 2.553.334 3.605-.241 1.232-.755 2.029-1.131 2.576.324.329.778.899 1.117 1.825.278.774.31 1.478.273 2.015a5.51 5.51 0 0 0 .602-.329c.593-.366 1.487-.917 2.553-.931.714-.009 1.269.445 1.353 1.103a1.23 1.23 0 0 1-.945 1.362c-.649.158-.95.278-1.821.843-1.232.797-2.539 1.242-3.012 1.39a1.686 1.686 0 0 1-.704.343c-.737.181-3.266.315-3.466.315h-.046c-.783 0-1.214-.241-1.45-.491-.658.329-1.51.19-2.122-.134a1.078 1.078 0 0 1-.58-1.153 1.243 1.243 0 0 1-.153-.195c-.162-.25-.528-.936-.454-1.946.056-.723.556-1.367.88-1.71a5.522 5.522 0 0 1 .408-2.256c.306-.727.885-1.348 1.32-1.737-.32-.537-.644-1.367-.329-2.21.227-.602.412-.936.82-1.08h-.005c.199-.074.389-.153.486-.259a3.418 3.418 0 0 1 2.298-1.103c.037-.093.079-.185.125-.283.31-.658.639-1.029 1.024-1.168a.94.94 0 0 1 .328-.06zm.006.7c-.507.016-1.001 1.519-1.001 1.519s-1.27-.204-2.266.871c-.199.218-.468.334-.746.44-.079.028-.176.023-.417.672-.371.991.625 2.094.625 2.094s-1.186.839-1.626 1.881c-.486 1.144-.338 2.261-.338 2.261s-.843.732-.899 1.487c-.051.663.139 1.2.343 1.515.227.343.51.176.51.176s-.561.653-.037.931c.477.25 1.283.394 1.71-.037.31-.31.371-1.001.486-1.283.028-.065.12.111.209.199.097.093.264.195.264.195s-.755.324-.445 1.066c.102.246.468.403 1.066.398.222-.005 2.664-.139 3.313-.296.375-.088.505-.283.505-.283s1.566-.431 2.998-1.357c.917-.598 1.293-.76 2.034-.936.612-.148.57-1.098-.241-1.084-.839.009-1.575.44-2.196.825-1.163.718-1.742.672-1.742.672l-.018-.032c-.079-.13.371-1.293-.134-2.678-.547-1.515-1.413-1.881-1.344-1.997.297-.5 1.038-1.297 1.334-2.78.176-.899.13-2.377-.269-3.151-.074-.144-.732.241-.732.241s-.616-1.371-.788-1.483a.271.271 0 0 0-.157-.046z" />
    </svg>
  )
}

export function BunMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 22.596c6.628 0 12-4.338 12-9.688 0-3.318-2.057-6.248-5.219-7.986-1.286-.715-2.297-1.357-3.139-1.89C14.058 2.025 13.08 1.404 12 1.404c-1.097 0-2.334.785-3.966 1.821a49.92 49.92 0 0 1-2.816 1.697C2.057 6.66 0 9.59 0 12.908c0 5.35 5.372 9.687 12 9.687v.001ZM10.599 4.715c.334-.759.503-1.58.498-2.409 0-.145.202-.187.23-.029.658 2.783-.902 4.162-2.057 4.624-.124.048-.199-.121-.103-.209a5.763 5.763 0 0 0 1.432-1.977Zm2.058-.102a5.82 5.82 0 0 0-.782-2.306v-.016c-.069-.123.086-.263.185-.172 1.962 2.111 1.307 4.067.556 5.051-.082.103-.23-.003-.189-.126a5.85 5.85 0 0 0 .23-2.431Zm1.776-.561a5.727 5.727 0 0 0-1.612-1.806v-.014c-.112-.085-.024-.274.114-.218 2.595 1.087 2.774 3.18 2.459 4.407a.116.116 0 0 1-.049.071.11.11 0 0 1-.153-.026.122.122 0 0 1-.022-.083 5.891 5.891 0 0 0-.737-2.331Zm-5.087.561c-.617.546-1.282.76-2.063 1-.117 0-.195-.078-.156-.181 1.752-.909 2.376-1.649 2.999-2.778 0 0 .155-.118.188.085 0 .304-.349 1.329-.968 1.874Zm4.945 11.237a2.957 2.957 0 0 1-.937 1.553c-.346.346-.8.565-1.286.62a2.178 2.178 0 0 1-1.327-.62 2.955 2.955 0 0 1-.925-1.553.244.244 0 0 1 .064-.198.234.234 0 0 1 .193-.069h3.965a.226.226 0 0 1 .19.07c.05.053.073.125.063.197Zm-5.458-2.176a1.862 1.862 0 0 1-2.384-.245 1.98 1.98 0 0 1-.233-2.447c.207-.319.503-.566.848-.713a1.84 1.84 0 0 1 1.092-.11c.366.075.703.261.967.531a1.98 1.98 0 0 1 .408 2.114 1.931 1.931 0 0 1-.698.869v.001Zm8.495.005a1.86 1.86 0 0 1-2.381-.253 1.964 1.964 0 0 1-.547-1.366c0-.384.11-.76.32-1.079.207-.319.503-.567.849-.713a1.844 1.844 0 0 1 1.093-.108c.367.076.704.262.968.534a1.98 1.98 0 0 1 .4 2.117 1.932 1.932 0 0 1-.702.868Z" />
    </svg>
  )
}

// Surfaces' own mark, beside its name: three sheets, each turned a little
// more than the one in front, a stack of surfaces. Its colours are fixed,
// graphite and cream, so the same tile stands on a light page and a dark one.
// Each sheet's stroke is the tile's colour, painted under its fill: that cuts
// the gap out of the sheets behind it.
export function SurfacesMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="4 4 92 92" aria-hidden className={className}>
      <rect x="4" y="4" width="92" height="92" rx="26" fill="#1b1b1f" />
      <g fill="#f1ead9" stroke="#1b1b1f" strokeWidth="5.4" paintOrder="stroke">
        <rect x="27.1" y="27.1" width="45.8" height="45.8" rx="9.9" transform="rotate(-27 50 50)" />
        <rect x="28.9" y="28.9" width="42.2" height="42.2" rx="9.9" transform="rotate(-13 50 50)" />
        <rect x="32.5" y="32.5" width="35" height="35" rx="9.9" />
      </g>
    </svg>
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
