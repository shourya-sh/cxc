/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#09090b",
          card: "#111113",
          elevated: "#18181b",
          hover: "#1c1c1f",
        },
        accent: {
          DEFAULT: "#a78bfa",
          dim: "rgba(167, 139, 250, 0.12)",
          green: "#34d399",
          red: "#f87171",
          blue: "#60a5fa",
          amber: "#fbbf24",
          cyan: "#22d3ee",
          pink: "#f472b6",
        },
        text: {
          primary: "#fafafa",
          secondary: "#a1a1aa",
          muted: "#71717a",
        },
        border: {
          DEFAULT: "#27272a",
          light: "#3f3f46",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        glow: "0 0 30px rgba(167, 139, 250, 0.08)",
        "glow-green": "0 0 20px rgba(52, 211, 153, 0.12)",
      },
    },
  },
  plugins: [],
};
