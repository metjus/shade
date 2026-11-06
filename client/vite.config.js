import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` vytvorí jeden samostatný index.html (dá sa nahrať kamkoľvek, aj na Hostcreators).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2022' },
});
