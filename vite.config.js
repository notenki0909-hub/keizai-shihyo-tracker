import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// GitHub Pages 用に相対パスで出力（プロジェクトページのサブパス配信に対応）
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    rollupOptions: {
      input: {
        main: r("./index.html"),
        guide: r("./guide.html"),
      },
    },
  },
});
