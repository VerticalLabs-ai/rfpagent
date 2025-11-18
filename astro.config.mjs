import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';

export default defineConfig({
  srcDir: './docs/src',
  publicDir: './docs/public',
  outDir: './docs/dist',
  integrations: [mdx(), starlight()],
  vite: {
    server: {
      fs: {
        allow: ['.']
      }
    }
  }
});
