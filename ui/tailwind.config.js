module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    fontFamily: {
      display: ['Poppins', 'sans-serif'],
      body: ['UniversalSans', 'sans-serif'],
      GoodTimes: ['Good Times', 'sans-serif'],
      RobotoMono: ['Roboto Mono', 'sans-serif'],
    },
    fontWeight: {
      light: 200,
      normal: 300,
      medium: 400,
      semibold: 500,
      bold: 500,
    },
    extend: {
      animation: {
        fadeIn: 'fadeIn 0.5s ease-in',
        fadeInTo75: 'fadeIn 0.5s ease-in',
        fadeInSlow: 'fadeIn 1s ease-in',
        fadeInSlowTo75: 'fadeInTo75 1s ease-in',
        notification: 'notification 5s',
        highlight: 'highlight 3s ease-out',
      },
      colors: {
        n3blue: '#ffbc5c',
        n3green: '#d85c4c',
        'n3blue-100': '#DCFFFF',
        'n3green-100': '#D5FFFF',
        n3bg: '#F4FAFF',
        n3nav: '#7395B2',
        moonBlue: '#0B3B8E',
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
  plugins: [require('daisyui'), require('tailwind-scrollbar-hide')],
  daisyui: {
    themes: [
      {
        mytheme: {
          primary: '#ffbc5c',
          secondary: '#ffbc5c',
          accent: '#ffbc5c',
          neutral: '#3d4451',
          'primary-content': '#ffffff',
          'base-100': '#ffffff',
          'base-content': '#ffffff',
        },
      },
    ],
  },
}
