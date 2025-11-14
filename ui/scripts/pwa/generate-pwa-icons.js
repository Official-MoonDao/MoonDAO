const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const inputFile = path.join(__dirname, '../public/favicon.ico')
const outputDir = path.join(__dirname, '../public/icons')

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

async function generateIcons() {
  console.log('Generating PWA icons from favicon.ico...')
  
  // Check if input file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file not found at ${inputFile}`)
    process.exit(1)
  }
  
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`)
    
    try {
      await sharp(inputFile)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 30, g: 41, b: 59, alpha: 1 } // #1e293b
        })
        .png()
        .toFile(outputPath)
      
      console.log(`✓ Generated ${size}x${size} icon`)
    } catch (error) {
      console.error(`✗ Failed to generate ${size}x${size} icon:`, error.message)
    }
  }
  
  // Generate maskable icon (512x512 with padding for safe zone)
  const maskableSize = 512
  const maskableOutputPath = path.join(outputDir, 'icon-512x512-maskable.png')
  
  try {
    // Create a canvas with background color
    const canvas = sharp({
      create: {
        width: maskableSize,
        height: maskableSize,
        channels: 4,
        background: { r: 30, g: 41, b: 59, alpha: 1 }
      }
    })
    
    // Resize icon to 80% of canvas size (for safe zone) and center it
    const iconSize = Math.floor(maskableSize * 0.8)
    const padding = Math.floor((maskableSize - iconSize) / 2)
    
    const resizedIcon = await sharp(inputFile)
      .resize(iconSize, iconSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer()
    
    await canvas
      .composite([{
        input: resizedIcon,
        top: padding,
        left: padding
      }])
      .png()
      .toFile(maskableOutputPath)
    
    console.log(`✓ Generated maskable icon (512x512)`)
  } catch (error) {
    console.error('✗ Failed to generate maskable icon:', error.message)
  }
  
  console.log('\nPWA icons generation complete!')
}

generateIcons().catch(console.error)

