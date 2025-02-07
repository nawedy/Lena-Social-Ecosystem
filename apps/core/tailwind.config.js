/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Exo', 'system-ui', 'sans-serif'],
        display: ['Rajdhani', 'system-ui', 'sans-serif']
      },
      colors: {
        primary: {
          DEFAULT: '#00F0FF',
          50: '#E6FDFF',
          100: '#CCFBFF',
          200: '#99F7FF',
          300: '#66F4FF',
          400: '#33F0FF',
          500: '#00F0FF',
          600: '#00C0CC',
          700: '#009099',
          800: '#006066',
          900: '#003033'
        },
        secondary: {
          DEFAULT: '#FF00F0',
          50: '#FFE6FD',
          100: '#FFCCFB',
          200: '#FF99F7',
          300: '#FF66F4',
          400: '#FF33F0',
          500: '#FF00F0',
          600: '#CC00C0',
          700: '#990090',
          800: '#660060',
          900: '#330030'
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-mesh': 'url("/patterns/mesh-gradient.svg")'
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' }
        },
        glow: {
          '0%': { filter: 'brightness(100%) blur(0)' },
          '100%': { filter: 'brightness(150%) blur(2px)' }
        }
      },
      boxShadow: {
        'neon': '0 0 5px theme(colors.primary.400), 0 0 20px theme(colors.primary.500)',
        'neon-secondary': '0 0 5px theme(colors.secondary.400), 0 0 20px theme(colors.secondary.500)'
      }
    }
  },
  plugins: []
}; 