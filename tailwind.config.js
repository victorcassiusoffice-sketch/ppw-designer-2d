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
          // Designer chrome (toolbar pass 2026-08-29) — the paper/charcoal
          // register the canvas already uses, plus the brand gold CTA.
          // `clay` was referenced by the paint palette's Erase toggle but
          // never defined (its active label rendered white on white).
          paper: '#F8F5EE',
          chrome: '#faf9f5',
          rail: '#efede8',
          rim: '#dcd9d0',
          charcoal: '#3D4655',
          inkDeep: '#2A2926',
          gold: '#FFBB58',
          navy: '#232C3B',
          clay: '#C9553F',
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
