/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#0D9488',    // A vibrant, modern teal
        'secondary': '#0F766E',  // A darker teal for contrast
        'accent': '#F97316',     // A warm orange for calls-to-action
        'background': '#F3F4F6', // A very light, neutral grey
        'text-dark': '#1F2937',  // A deep, near-black for sharp text
        'text-light': '#F9FAFB', // An off-white for text on dark backgrounds
        'success': '#22C55E',    // A bright, lively green
        'error': '#DC2626',      // A strong, clear red
      }
    },
  },
  plugins: [],
}