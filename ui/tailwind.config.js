module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        '3xl': '1920px',
        '4xl': '2560px',
      },
      fontFamily: {
        display: ['Poppins', 'sans-serif'],
        body: ['UniversalSans', 'sans-serif'],
        GoodTimes: ['Good Times', 'sans-serif'],
        RobotoMono: ['Roboto Mono', 'sans-serif'],
        Montserrat: ['Montserrat', 'sans-serif'],
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-in',
        fadeInTo75: 'fadeIn 0.5s ease-in',
        fadeInSlow: 'fadeIn 1s ease-in',
        fadeInSlowTo75: 'fadeInTo75 1s ease-in',
        notification: 'notification 5s',
        highlight: 'highlight 3s ease-out',
      },
      colors: {
        'title-light': '#172554',
        'title-dark': '#fefce8',
        'light-text': '#071732',
        'dark-text': '#e5e7eb',
        faded: '#6b7280',
        'moon-gold': '#F9B95C',
        'moon-blue': '#3b82f6',
        'moon-indigo': '#3F3FA6',
        'moon-green': '#5C9572',
        'moon-orange': '#D7594F',
        'detail-light': '#60a5fa',
        'detail-dark': '#fef9c3',
        'stronger-light': '#1d4ed8',
        'stronger-dark': '#d97706',
        'background-light': '#f5f5f4',
        'background-dark': '#111827',
        'dark-highlight': '#f9fafb',
        'light-highlight': '#030712',

        'darkest-cool': '#020617',
        'dark-cool': '#090D21',
        'mid-cool': '#182254',
        'mid-cool-2': '#111C42',
        cool: '#121C42',
        'light-cool': '#425EEB',
        'dark-warm': '#2D121A',
        'light-warm': '#753F73',

        n3blue: '#ffbc5c',
        n3green: '#d85c4c',
        'n3blue-100': '#DCFFFF',
        'n3green-100': '#D5FFFF',
        n3bg: '#F4FAFF',
        n3nav: '#7395B2',
        moonBlue: '#0B3B8E',
        'moon-orange': '#D7594F',
      },
      keyframes: {
        notification: {
          '0%': {
            left: '350px',
            opacity: 1,
          },
          '15%': {
            left: '-15px',
            opacity: 1,
          },
          '80%': {
            left: '-10px',
            opacity: 1,
          },
          '100%': {
            left: '350px',
            opacity: 0,
          },
        },
        fadeIn: {
          '0%': {
            opacity: 0,
          },
          '100%': {
            opacity: 1,
          },
        },
        fadeInTo75: {
          '0%': {
            opacity: 0,
          },
          '100%': {
            opacity: 0.75,
          },
        },
        highlight: {
          '0%': { color: 'white' },
          '50%': { color: '#ffae42 ' },
          '100%': { color: 'white' },
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [
    require('daisyui'),
    require('tailwind-scrollbar-hide'),
    require('@tailwindcss/typography'),
  ],
  daisyui: {
    themes: [
      {
        mytheme: {
          primary: '#ffbc5c',
          secondary: '#ffbc5c',
          accent: '#753F73',
          neutral: '#3d4451',
          error: '#D7594F',
          'primary-content': '#ffffff',
          'base-100': '#ffffff',
          'base-content': '#ffffff',
          moon: '#D7594F',
        },
      },
    ],
  },
}
