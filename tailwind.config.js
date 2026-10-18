/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        canvas: '#F8F9FA',
        surface: '#FFFFFF',
        hairline: '#DADCE0',
        'hairline-light': '#E8EAED',
        primary: {
          text: '#202124',
          secondary: '#5F6368',
          muted: '#80868B',
        },
        google: {
          blue: '#1A73E8',
          blueHover: '#1557B0',
          blueLight: '#E8F0FE',
          blueText: '#1967D2',
          green: '#137333',
          greenLight: '#E6F4EA',
          greenBorder: '#CEEAD6',
          amber: '#B06000',
          amberLight: '#FEF7E0',
          amberBorder: '#FEEFC3',
          red: '#C5221F',
          redLight: '#FCE8E6',
          redBorder: '#FAD2CF',
          grayBg: '#F1F3F4',
        },
        paypal: {
          blue: '#0070BA',
          darkBlue: '#003087',
        }
      }
    },
  },
  plugins: [],
}
