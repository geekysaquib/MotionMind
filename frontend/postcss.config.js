import { fileURLToPath } from 'node:url';

// Explicit config path: builds run from the repo root, where Tailwind would not find it on its own.
export default { plugins: { tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) }, autoprefixer: {} } };
