/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Audio platform colors
        'sonic-black': '#0A0A0A',
        'sonic-gray': '#1A1A1A',
        'sonic-silver': '#2A2A2A',
        'sonic-purple': '#6B46C1',
        'sonic-blue': '#3B82F6',
        'sonic-green': '#10B981',
        
        // UI Colors
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        'plus-jakarta': ['Plus Jakarta Sans', 'sans-serif'],
      },
      animation: {
        'waveform': 'waveform 1.5s ease-in-out infinite',
        'equalizer': 'equalizer 1.2s steps(6, end) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        waveform: {
          '0%, 100%': { height: '20%' },
          '50%': { height: '80%' },
        },
        equalizer: {
          '0%': { height: '20%' },
          '20%': { height: '40%' },
          '40%': { height: '60%' },
          '60%': { height: '80%' },
          '80%': { height: '100%' },
          '100%': { height: '20%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'gradient-sonic': 'linear-gradient(to right, var(--sonic-purple), var(--sonic-blue))',
        'gradient-waveform': 'linear-gradient(to top, var(--sonic-purple), var(--sonic-blue))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio'),
  ],
}; 