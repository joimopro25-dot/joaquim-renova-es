import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf4ee",
          100: "#faE4d3",
          200: "#f3c6a1",
          300: "#eba26a",
          400: "#df7c3f",
          500: "#c2622f",
          600: "#a24f26",
          700: "#803e20",
          800: "#67331e",
          900: "#552c1c",
        },
        ink: {
          50: "#f6f6f7",
          100: "#e8e8ea",
          200: "#c9cacd",
          300: "#a2a4a9",
          400: "#71747b",
          500: "#565962",
          600: "#43454d",
          700: "#34363c",
          800: "#25262b",
          900: "#18191c",
        },
        sand: {
          50: "#fbf9f6",
          100: "#f5f0e9",
          200: "#ece3d6",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 6px -1px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;