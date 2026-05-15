// Tailwind v4 uses a dedicated PostCSS plugin (the v3 `tailwindcss` plugin is gone).
// Required when the framework's CSS pipeline runs PostCSS — Next.js does.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
