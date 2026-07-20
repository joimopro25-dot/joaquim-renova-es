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
          50: "#faf1ea",
          100: "#f0dac8",
          200: "#e0b48f",
          300: "#cc8c5c",
          400: "#b06d3e",
          500: "#95522c",
          600: "#7c4324",
          700: "#63361f",
          800: "#502b1c",
          900: "#432419",
        },
        copper: {
          50: "#fbf5ee",
          100: "#f1e0c8",
          200: "#e2bd8e",
          300: "#cf9a5f",
          400: "#b87f42",
          500: "#a06a34",
          600: "#83552a",
          700: "#674323",
          800: "#4f351f",
          900: "#3d2a1b",
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