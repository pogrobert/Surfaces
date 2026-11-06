// Finding and running resvg, for the PNG and JPEG export and the CLI: the
// native build where it loads, its WebAssembly where it doesn't (see png.ts).
// Not part of the public API.

type Resvg = new (
  svg: string,
  options: { fitTo: { mode: "width"; value: number }; font?: { loadSystemFonts: boolean } }
) => { render(): { asPng(): Uint8Array; pixels: Uint8Array; width: number; height: number } }

// What resvg's WebAssembly can start from: the compiled module, its bytes, or
// a fetch of them.
export type WasmSource = WebAssembly.Module | ArrayBuffer | Uint8Array | Response | Promise<Response>

const NATIVE = "@resvg/resvg-js"
const WASM = "@resvg/resvg-wasm"
const HOW = `PNG export needs resvg. On Node, install ${NATIVE} (fastest) or ${WASM}. On an edge runtime or a worker, install ${WASM} and pass its module: import wasm from "${WASM}/index_bg.wasm", then toPng(scene, { wasm }).`

let native: Promise<Resvg> | undefined
let wasm: Promise<Resvg> | undefined

// The names are held in variables so bundlers leave the imports alone when
// nobody asks for a PNG.
function loadNative() {
  const name = NATIVE
  native ??= import(name).then(
    (module: { Resvg: Resvg }) => module.Resvg,
    (error) => {
      native = undefined
      throw error
    }
  )
  return native
}

// resvg's WebAssembly starts once per process, from whatever it is given.
function loadWasm(source: WasmSource | Promise<WasmSource>) {
  const name = WASM
  wasm ??= import(name).then(
    async (module: { Resvg: Resvg; initWasm(source: unknown): Promise<void> }) => {
      await module.initWasm(await source)
      return module.Resvg
    },
    (error) => {
      wasm = undefined
      throw error
    }
  )
  return wasm
}

// The WebAssembly's bytes from the installed package, on Node.
async function wasmOnDisk(): Promise<Uint8Array> {
  const fs = "node:fs/promises"
  const nodeModule = "node:module"
  const { readFile } = await import(fs)
  const { createRequire } = await import(nodeModule)
  return readFile(createRequire(import.meta.url).resolve(`${WASM}/index_bg.wasm`))
}

async function renderer(source?: WasmSource): Promise<Resvg> {
  if (source) return loadWasm(source).catch(() => Promise.reject(new Error(HOW)))
  if (wasm) return wasm
  try {
    return await loadNative()
  } catch {
    try {
      return await loadWasm(wasmOnDisk())
    } catch {
      wasm = undefined
      throw new Error(HOW)
    }
  }
}

// An SVG drawn `width` pixels across: its pixels, and the same as a PNG.
export async function rasterize(svg: string, width: number, source?: WasmSource) {
  const Resvg = await renderer(source)
  return new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: false } }).render()
}
