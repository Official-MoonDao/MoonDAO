const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const logoFile = path.join(__dirname, '../public/favicon.ico')
const loadingAnimationFile = path.join(__dirname, '../public/assets/MoonDAO-Loading-Animation.svg')
const outputDir = path.join(__dirname, '../public/icons/apple')

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// iOS splash screen sizes (portrait)
const splashScreenSizes = [
  { width: 1125, height: 2436, name: 'splash-1125x2436' }, // iPhone X, XS, 11 Pro
  { width: 1242, height: 2688, name: 'splash-1242x2688' }, // iPhone XS Max, 11 Pro Max
  { width: 828, height: 1792, name: 'splash-828x1792' },   // iPhone XR, 11
  { width: 1170, height: 2532, name: 'splash-1170x2532' }, // iPhone 12, 12 Pro, 13, 13 Pro
  { width: 1284, height: 2778, name: 'splash-1284x2778' }, // iPhone 12 Pro Max, 13 Pro Max
  { width: 1179, height: 2556, name: 'splash-1179x2556' }, // iPhone 14, 15
  { width: 1290, height: 2796, name: 'splash-1290x2796' }, // iPhone 14 Pro Max, 15 Pro Max
  { width: 750, height: 1334, name: 'splash-750x1334' },   // iPhone 8, SE
  { width: 1242, height: 2208, name: 'splash-1242x2208' }, // iPhone 8 Plus
  { width: 1536, height: 2048, name: 'splash-1536x2048' }, // iPad Mini, Air
  { width: 2048, height: 2732, name: 'splash-2048x2732' }, // iPad Pro 12.9"
]

async function generateAppleTouchIcon() {
  console.log('Generating Apple Touch Icon (180x180)...')
  
  const outputPath = path.join(outputDir, 'apple-touch-icon.png')
  
  try {
    await sharp(logoFile)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 30, g: 41, b: 59, alpha: 1 }
      })
      .png()
      .toFile(outputPath)
    
    console.log('✓ Generated Apple Touch Icon')
  } catch (error) {
    console.error('✗ Failed to generate Apple Touch Icon:', error.message)
  }
}

async function generateSplashScreens() {
  console.log('\nGenerating iOS splash screens with loading animation...')
  
  // Read the SVG file
  const svgBuffer = fs.readFileSync(loadingAnimationFile)
  
  for (const size of splashScreenSizes) {
    const outputPath = path.join(outputDir, `${size.name}.png`)
    
    try {
      // Calculate animation size (30% of screen height)
      const animationHeight = Math.floor(size.height * 0.3)
      const animationWidth = Math.floor(animationHeight * 0.95) // Maintain aspect ratio of SVG
      
      // Create gradient background similar to nav
      const gradientSvg = `
        <svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#1f2937;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#1e3a8a;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#581c87;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="${size.width}" height="${size.height}" fill="url(#grad)"/>
        </svg>
      `
      
      // Resize the loading animation
      const resizedAnimation = await sharp(svgBuffer)
        .resize(animationWidth, animationHeight, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toBuffer()
      
      // Calculate center position
      const left = Math.floor((size.width - animationWidth) / 2)
      const top = Math.floor((size.height - animationHeight) / 2)
      
      // Composite animation on gradient background
      await sharp(Buffer.from(gradientSvg))
        .composite([{
          input: resizedAnimation,
          top: top,
          left: left
        }])
        .png()
        .toFile(outputPath)
      
      console.log(`✓ Generated splash screen ${size.width}x${size.height}`)
    } catch (error) {
      console.error(`✗ Failed to generate splash screen ${size.width}x${size.height}:`, error.message)
    }
  }
}

async function generateAssets() {
  await generateAppleTouchIcon()
  await generateSplashScreens()
  console.log('\niOS assets generation complete!')
}

generateAssets().catch(console.error)

