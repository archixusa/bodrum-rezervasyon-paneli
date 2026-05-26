import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#ECF7F8",
          100: "#D2EDF1",
          200: "#A4DCE3",
          400: "#3FB2C2",
          600: "#1E8A9C",
          800: "#0E5F70",
          900: "#053C4A",
        },
        accent: {
          400: "#FF8A3D",
          500: "#F26A1E",
          600: "#C24A0D",
        },
        ink: "#0F1F26",
        muted: "#5C6B73",
        success: "#0F6E56",
        warning: "#C2750E",
        danger: "#A32D2D",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        md: "10px",
        lg: "14px",
        xl: "20px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(5 60 74 / 0.06), 0 1px 2px -1px rgb(5 60 74 / 0.05)",
        cardHover: "0 22px 45px -18px rgb(5 60 74 / 0.18), 0 8px 18px -10px rgb(5 60 74 / 0.12)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.8" },
          "100%": { transform: "scale(2)", opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
      },
    },
  },
  plugins: [],
};
export default config;
