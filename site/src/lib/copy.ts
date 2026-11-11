// Copies, or where the page may not use the clipboard (plain http, a frame),
// copies the old way, through a selection.
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = Object.assign(document.createElement("textarea"), { value: text, readOnly: true })
    area.style.cssText = "position:fixed;left:-9999px;opacity:0"
    document.body.append(area)
    area.select()
    let done = false
    try {
      done = document.execCommand("copy")
    } catch {
      done = false
    }
    area.remove()
    return done
  }
}
// How long a button says it copied.
export const SAID = 1500
