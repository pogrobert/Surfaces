// The page's theme: the reader's system by default, or light or dark when
// they choose one, kept in this browser. The choice is set on <html> as
// data-theme, which the page's colours follow (styles.css), and pictures
// drawn for the page follow it too: `dark` is the theme in effect.
import { useSyncExternalStore } from "react"

export type ThemeChoice = "system" | "light" | "dark"
const KEY = "surfaces-theme"
const media = matchMedia("(prefers-color-scheme: dark)")

function stored(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY)
    return value === "light" || value === "dark" ? value : "system"
  } catch {
    return "system"
  }
}

let choice = stored()
const listeners = new Set<() => void>()
const tell = () => listeners.forEach((listener) => listener())
media.addEventListener("change", tell)

function apply() {
  if (choice === "system") delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = choice
}
apply()

export function setTheme(next: ThemeChoice) {
  choice = next
  try {
    if (next === "system") localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    // A browser that keeps nothing still switches for this visit.
  }
  apply()
  tell()
}

const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener))
const snapshot = () => `${choice}:${media.matches ? "dark" : "light"}`

export function useTheme() {
  const [current, system] = useSyncExternalStore(subscribe, snapshot).split(":") as [ThemeChoice, "dark" | "light"]
  return { choice: current, dark: current === "dark" || (current === "system" && system === "dark") }
}
