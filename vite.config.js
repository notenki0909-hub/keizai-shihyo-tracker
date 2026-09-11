import { defineConfig } from "vite";

// GitHub Pages 用に相対パスで出力（プロジェクトページのサブパス配信に対応）
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
  },
});
