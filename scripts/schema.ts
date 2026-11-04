// Writes the input's JSON Schema next to the built library, for tools and
// agents that read schemas. Run by `pnpm build`.
import { writeFileSync } from "node:fs"
import { inputSchema } from "../src/schema.ts"

writeFileSync(new URL("../dist/schema.json", import.meta.url), `${JSON.stringify(inputSchema, null, 2)}\n`)
