import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config: jen mapuje alias "@/" na kořen projektu, aby šlo testovat moduly,
// které ho používají (např. "@/lib/app-info"). Build (Next.js) tím neovlivníme.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd()),
    },
  },
});
