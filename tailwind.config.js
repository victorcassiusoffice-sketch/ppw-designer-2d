/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PPW brand palette — neutral wellness-clinic minimalism.
        // Locked in Week 1 from existing space-designer-pro.html aesthetic
        // (deep teal accent + sand neutrals + clinical white).
        ppw: {
          ink: '#0E1B1F',      // primary text, near-black with teal undertone
          slate: '#3B4A52',    // secondary text
          sand: '#F5F1EA',     // cream background
          mist: '#E9EDEF',     // panel background
          stone: '#C4CBCD',    // borders, grid lines
          teal: '#0F766E',     // primary accent (deep teal)
          tealLight: '#5EEAD4',// hover, active states
          coral: '#E76F51',    // CTA / warning
          leaf: '#84A98C',     // nature / plant accent
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
