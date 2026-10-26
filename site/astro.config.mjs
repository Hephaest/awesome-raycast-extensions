import { defineConfig } from 'astro/config';

export default defineConfig({
  // The site is served from a GitHub Pages project path, so every URL is built under this base.
  base: '/awesome-raycast-extensions',
  // Astro 7 defaults to JSX whitespace rules, which drop spaces between inline elements.
  compressHTML: true,
  vite: {
    build: {
      // Lightning CSS, Vite's default minifier, merges animation-timeline into the animation shorthand, which Chrome
      // then drops, so the wallpaper drift would stop. Unminified CSS ships as written.
      cssMinify: false,
    },
  },
});
