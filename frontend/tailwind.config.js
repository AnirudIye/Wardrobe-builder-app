/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Branding font (loaded from Google Fonts in index.html)
        brand: ["Ramaraja", "serif"],
      },
    },
  },
  plugins: [],
};
