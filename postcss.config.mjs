/** @type {import('postcss-load-config').Config} */
// Tailwind CSS v4 ships as a PostCSS plugin under a new package name.
// Autoprefixer is no longer needed: v4 handles vendor prefixing itself.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
