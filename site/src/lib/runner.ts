// The package manager the reader uses, chosen in the row beside the command
// and kept in this browser. The command to run and the prompt for a coding
// agent both follow it, so what is copied is what the reader would type.
import { useSyncExternalStore } from "react"
import { RUNNERS } from "../data.ts"
import type { Runner } from "../data.ts"

const KEY = "surfaces-runner"

function stored(): Runner {
  try {
    const kept = localStorage.getItem(KEY)
    return RUNNERS.find(([name]) => name === kept)?.[0] ?? "npm"
  } catch {
    return "npm"
  }
}

let runner = stored()
const listeners = new Set<() => void>()

export function setRunner(next: Runner) {
  runner = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // A browser that keeps nothing still switches for this visit.
  }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener))

export function useRunner() {
  const name = useSyncExternalStore(subscribe, () => runner)
  return { runner: name, command: RUNNERS.find(([each]) => each === name)![1] }
}
