/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f6ff",
          100: "#e2e8ff",
          200: "#c8d2ff",
          300: "#a4b3ff",
          400: "#7c8bff",
          500: "#5562f6",
          600: "#3c49d3",
          700: "#2f3aab",
          800: "#273288",
          900: "#222c6f",
        },
      },
    },
  },
  plugins: [],
};

