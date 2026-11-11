import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Two pages: the main page at / and the studio at /studio/. The library comes
// from this repo's own build (dist), as it ships.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("src", import.meta.url)) } },
  server: { port: Number(process.env.PORT ?? 4178), host: "127.0.0.1" },
  preview: { port: 4178, host: "127.0.0.1" },
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL("index.html", import.meta.url)),
        studio: fileURLToPath(new URL("studio/index.html", import.meta.url)),
      },
    },
  },
})
