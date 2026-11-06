import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const page = (p: string) => resolve(import.meta.dirname, p);

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: page('index.html'),
        about: page('about/index.html'),
        privacy: page('privacy/index.html'),
        notFound: page('404.html'),
      },
    },
  },
});
