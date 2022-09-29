module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    fontFamily: {
      display: ['Poppins', 'sans-serif'],
      body: ['UniversalSans', 'sans-serif'],
    },
    fontWeight: {
      light: 200,
      normal: 300,
      medium: 400,
      semibold: 500,
      bold: 500,
    },
    extend: {
      colors: {
        n3blue: '#ffbc5c',
        n3green: '#d85c4c',
        'n3blue-100': '#DCFFFF',
        'n3green-100': '#D5FFFF',
        n3bg: '#F4FAFF',
        n3nav: '#7395B2',
      },
    },
  },
  plugins: [require('daisyui')],
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
