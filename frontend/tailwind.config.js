/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // BetterDresser palette
        navy: {
          DEFAULT: "#0B1957",
          soft: "#1B2C77",
          deep: "#071140",
        },
        blush: {
          DEFAULT: "#FA9EBC",
          soft: "#FDC9DA",
          deep: "#F2769F",
        },
        cream: {
          DEFAULT: "#FFF6EA",
          soft: "#FFFBF4",
          deep: "#F7E9D4",
        },
      },
      fontFamily: {
        // Branding/display font (loaded from Google Fonts in index.html)
        brand: ["Ramaraja", "serif"],
        // Body/UI font: a warm humanist sans that suits the clay aesthetic.
        // Deliberate pairing with Ramaraja; NOT the default Inter-alike stack.
        sans: [
          "Figtree",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        // Claymorphism: soft outer drop + bright inner top-left + dark inner bottom-right
        clay: "0 12px 24px -8px rgba(11, 25, 87, 0.22), inset 6px 6px 12px rgba(255, 255, 255, 0.85), inset -6px -6px 12px rgba(11, 25, 87, 0.08)",
        "clay-sm":
          "0 6px 14px -6px rgba(11, 25, 87, 0.20), inset 3px 3px 7px rgba(255, 255, 255, 0.8), inset -3px -3px 7px rgba(11, 25, 87, 0.07)",
        "clay-navy":
          "0 12px 22px -8px rgba(7, 17, 64, 0.55), inset 4px 4px 10px rgba(255, 255, 255, 0.22), inset -5px -5px 12px rgba(0, 0, 10, 0.35)",
        "clay-blush":
          "0 12px 22px -8px rgba(242, 118, 159, 0.5), inset 4px 4px 10px rgba(255, 255, 255, 0.55), inset -5px -5px 12px rgba(190, 60, 105, 0.3)",
      },
    },
  },
  plugins: [],
};
