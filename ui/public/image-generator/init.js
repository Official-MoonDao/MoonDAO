/* Edited in 2024 for MoonDAO by Santiago Itzcoatl */

var mwColor = getRandomHSLuvColor(80)
var mwOpacity = 0.35 // 0.35
const e = ' * MoonDAO * PFP Generator * '
// console.log('%c' + e, 'background:' + mwColor + '; color: #fff')

var defaultImages = [
  'images/test-00.jpg',
  'images/test-01.jpg',
  'images/test-02.jpg',
  'images/test-03.jpg',
]

var randomIndex = Math.floor(Math.random() * defaultImages.length)
var randomImage = defaultImages[randomIndex]

document.getElementById('process-image').src = randomImage

// - - -

Celestial.display({
  location: true,
  moonDao: true,
  projection: 'airy',
  datapath: 'stars-data/', // Path/URL to data files
  controls: false, // zoom controls
  form: true,
  formFields: {
    location: false,
    general: false,
    stars: true,
    dsos: false,
    constellations: false,
    lines: false,
    other: false,
    download: false,
  }, // ----------------------------------------------------------
  lines: {
    // Display & styles
    graticule: {
      show: false,
    },
    equatorial: {
      show: true,
      stroke: '#ccc',
      width: 1.4,
      opacity: 0.25,
    },
    ecliptic: {
      show: true,
      stroke: mwColor,
      width: 3.2,
      opacity: 0.7,
    },
    galactic: {
      show: false,
    },
    supergalactic: {
      show: false,
    },
  }, // ----------------------------------------------------------
  planets: {
    // Planets
    show: true,
    symbolType: 'symbol',
    names: true,
    namesType: 'en',
  }, // ----------------------------------------------------------
  stars: {
    // Stars
    show: true,
    limit: 4.2, // Show only stars brighter than limit magnitude
    colors: false, // use style setting below if false
    style: {
      fill: '#ffffff',
      opacity: 1,
    },
    size: 8,
    exponent: -0.185,
    designation: false,
    designationType: 'desig',
    propername: true,
    propernameType: 'en',
  }, // ----------------------------------------------------------
  dsos: {
    // Deep Space Objects
    show: false,
    limit: 6, // Show only DSOs brighter than limit magnitude
    colors: true, // use style setting below if false
    style: {
      fill: '#cccccc',
      stroke: '#cccccc',
      width: 2,
      opacity: 1,
    }, // Default style for dsos
    size: 0.1,
    names: false, // DSO names
    exponent: 0.32, // Scale exponent for DSO size, larger = more non-linear
  }, // ----------------------------------------------------------
  constellations: {
    // Constellations
    names: false,
    lines: true,
    lineStyle: {
      stroke: '#fff',
      width: 0.75,
      opacity: 0.52,
    },
    bounds: false,
  }, // ----------------------------------------------------------
  mw: {
    show: true, // Milky Way
    style: {
      fill: mwColor,
      opacity: mwOpacity,
    },
  }, // ----------------------------------------------------------
  advanced: false,
  background: {
    fill: '#071536',
    opacity: 0,
    stroke: '#ffffff',
    width: 0.25,
  },
})

function getRandomColor() {
  var letters = '0123456789ABCDEF'
  var color = '#'
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

function getRandomHSLuvColor(saturation) {
  var cHSLuv = new Hsluv()
  cHSLuv.hsluv_h = Math.random() * 360
  cHSLuv.hsluv_l = Math.random() * 100
  cHSLuv.hsluv_s = saturation
  cHSLuv.hsluvToHex()
  return cHSLuv.hex
}

let passedBlurValue = 70

function blurValue(val) {
  passedBlurValue = val
}
