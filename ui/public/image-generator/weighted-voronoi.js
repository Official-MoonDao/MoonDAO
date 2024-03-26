// Weighted Voronoi Stippling by Daniel Shiffman [MIT]
/* Edited in 2024 for MoonDAO by Santiago Itzcoatl */

let points = []
let delaunay, voronoi
let loadedIMG

function preload() {
  urlIMG = document.getElementById('process-image').src
  loadedIMG = loadImage(urlIMG, imgLoadSuccess, imgLoadFailure)
  // console.log('— bg img loaded: ' + urlIMG)
  // console.log('waiting...')
}

function imgLoadSuccess() {
  loadedIMG.resize(720, 720)
  // console.log('— bg img resized')
}

function imgLoadFailure(event) {
  console.error('— error while loading img', event)
}

function setup() {
  // console.log(' ★★ ')
  const canvas = createCanvas(loadedIMG.width, loadedIMG.height)
  canvas.parent('canvas-container')
  imageMode(CENTER)
  for (let i = 0; i < 320; i++) {
    let x = random(width)
    let y = random(height)
    let col = loadedIMG.get(x, y)
    if (random(100) > brightness(col)) {
      points.push(createVector(x, y))
    } else {
      i--
    }
  }

  delaunay = calculateDelaunay(points)
  voronoi = delaunay.voronoi([0, 0, width, height])
  //noLoop();
}

function draw() {
  clear()

  let contxt = canvas.getContext('2d', { willReadFrequently: true })
  contxt.filter = 'blur(' + passedBlurValue + 'px)'
  image(loadedIMG, width / 2, height / 2, 720, 720)
  contxt.filter = 'blur(0px)'

  let polygons = voronoi.cellPolygons()
  let cells = Array.from(polygons)

  let centroids = new Array(cells.length)
  let weights = new Array(cells.length).fill(0)
  let counts = new Array(cells.length).fill(0)
  let avgWeights = new Array(cells.length).fill(0)
  for (let i = 0; i < centroids.length; i++) {
    centroids[i] = createVector(0, 0)
  }

  loadedIMG.loadPixels()
  let delaunayIndex = 0
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      let index = (i + j * width) * 4
      let r = loadedIMG.pixels[index + 0]
      let g = loadedIMG.pixels[index + 1]
      let b = loadedIMG.pixels[index + 2]
      let bright = (r + g + b) / 3
      let weight = 1 - bright / 255
      delaunayIndex = delaunay.find(i, j, delaunayIndex)
      centroids[delaunayIndex].x += i * weight
      centroids[delaunayIndex].y += j * weight
      weights[delaunayIndex] += weight
      counts[delaunayIndex]++
    }
  }

  let maxWeight = 0
  for (let i = 0; i < centroids.length; i++) {
    if (weights[i] > 0) {
      centroids[i].div(weights[i])
      avgWeights[i] = weights[i] / (counts[i] || 1)
      if (avgWeights[i] > maxWeight) {
        maxWeight = avgWeights[i]
      }
    } else {
      centroids[i] = points[i].copy()
    }
  }

  for (let i = 0; i < points.length; i++) {
    points[i].lerp(centroids[i], 0.5)
  }

  for (let i = 0; i < points.length; i++) {
    let v = points[i]
    let nx = 2
    let mx = 40
    let col = loadedIMG.get(v.x, v.y)
    //stroke(0);
    stroke(col)
    let sw = map(avgWeights[i], 0, maxWeight, nx, mx, true)
    strokeWeight(sw)
    point(v.x, v.y)
  }

  delaunay = calculateDelaunay(points)
  voronoi = delaunay.voronoi([0, 0, width, height])
}

function calculateDelaunay(points) {
  let pointsArray = []
  for (let v of points) {
    pointsArray.push(v.x, v.y)
  }
  return new d3.Delaunay(pointsArray)
}

function hexToRgb(hex) {
  hex = hex.replace('#', '')

  var bigint = parseInt(hex, 16)

  var r = (bigint >> 16) & 255
  var g = (bigint >> 8) & 255
  var b = bigint & 255

  return color(r, g, b)
}
