import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;
          
          // Match grid libraries (only loaded on-demand with TableView)
          if (id.includes('@revolist') || id.includes('revogrid')) {
            return 'vendor-grid';
          }
          
          // Match markdown and syntax highlighting (only loaded on-demand with FieldHelp/MarkdownInput)
          if (
            id.includes('react-markdown') ||
            id.includes('remark') ||
            id.includes('rehype') ||
            id.includes('lowlight') ||
            id.includes('highlight.js') ||
            id.includes('micromark') ||
            id.includes('mdast') ||
            id.includes('unist') ||
            id.includes('hast') ||
            id.includes('vfile')
          ) {
            return 'vendor-markdown';
          }
          
          // Match date libraries (only loaded on-demand with DateInput)
          if (id.includes('react-day-picker') || id.includes('date-fns')) {
            return 'vendor-date';
          }
          
          // Match radix primitives
          if (id.includes('@radix-ui') || id.includes('@floating-ui')) {
            return 'vendor-radix';
          }

          // Match core React runtime (exact package path)
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },
})
