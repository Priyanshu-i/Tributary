/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paypal: {
          blue: '#0070BA',
          darkBlue: '#003087',
          lightBlue: '#00CFDE',
          yellow: '#FFC439',
        },
        tributary: {
          navy: '#0F172A',
          slate: '#1E293B',
          cyan: '#06B6D4',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E',
        }
      }
    },
  },
  plugins: [],
}
