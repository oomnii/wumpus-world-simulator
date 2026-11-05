import { defineConfig } from 'vite';

// Set VITE_BASE=/your-repo-name/ when deploying to GitHub Pages (project site).
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  test: {
    globals: true,
  },
});
