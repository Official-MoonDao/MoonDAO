const sharp = require('sharp')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const inputFile = path.join(__dirname, '../public/favicon.ico')
const outputDir = path.join(__dirname, '../public/icons')
const tempPngFile = path.join(outputDir, 'temp-favicon.png')

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

async function convertIcoToPng() {
  console.log('Converting favicon.ico to PNG...')

  // Try sips first (macOS built-in)
  try {
    execSync(`sips -s format png "${inputFile}" --out "${tempPngFile}"`, {
      stdio: 'pipe',
    })
    console.log('✓ Converted .ico to .png using sips')
    return tempPngFile
  } catch (error) {
    // sips failed, try ImageMagick
    try {
      execSync(
        `convert "${inputFile}" -thumbnail 512x512 -alpha on -background none -flatten "${tempPngFile}"`,
        {
          stdio: 'pipe',
        }
      )
      console.log('✓ Converted .ico to .png using ImageMagick')
      return tempPngFile
    } catch (error2) {
      // ImageMagick not available, try manual PNG extraction
      console.log('Trying to extract PNG data from .ico file...')

      try {
        // Read the .ico file and try to extract PNG data
        const icoBuffer = fs.readFileSync(inputFile)

        // .ico files often contain PNG data - try to extract it
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        const pngStart = icoBuffer.indexOf(pngSignature)

        if (pngStart !== -1) {
          // Find PNG end (IEND chunk)
          const iendSignature = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
          const pngEnd = icoBuffer.indexOf(iendSignature, pngStart)

          if (pngEnd !== -1) {
            const pngData = icoBuffer.slice(pngStart, pngEnd + 8)
            fs.writeFileSync(tempPngFile, pngData)
            console.log('✓ Extracted PNG from .ico file')
            return tempPngFile
          }
        }

        throw new Error('No PNG data found in .ico file')
      } catch (extractError) {
        console.error('✗ Could not convert .ico file')
        console.error('Please install ImageMagick: brew install imagemagick')
        console.error('Or provide a PNG version of your favicon')
        throw extractError
      }
    }
  }
}

async function generateIcons() {
  console.log('Generating PWA icons from favicon.ico...')

  // Check if input file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file not found at ${inputFile}`)
    process.exit(1)
  }

  // Convert .ico to .png first
  let sourceFile
  try {
    sourceFile = await convertIcoToPng()
  } catch (error) {
    console.error('Failed to convert favicon.ico')
    process.exit(1)
  }

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`)

    try {
      await sharp(sourceFile)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 20, g: 20, b: 20, alpha: 1 }, // Solid dark grey (alpha 1 = opaque)
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
        background: { r: 20, g: 20, b: 20, alpha: 1 }, // Solid dark grey
      },
    })

    // Resize icon to 80% of canvas size (for safe zone) and center it
    const iconSize = Math.floor(maskableSize * 0.8)
    const padding = Math.floor((maskableSize - iconSize) / 2)

    const resizedIcon = await sharp(sourceFile)
      .resize(iconSize, iconSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer()

    await canvas
      .composite([
        {
          input: resizedIcon,
          top: padding,
          left: padding,
        },
      ])
      .png()
      .toFile(maskableOutputPath)

    console.log(`✓ Generated maskable icon (512x512)`)
  } catch (error) {
    console.error('✗ Failed to generate maskable icon:', error.message)
  }

  // Clean up temp file
  if (fs.existsSync(tempPngFile)) {
    fs.unlinkSync(tempPngFile)
  }

  console.log('\nPWA icons generation complete!')
}

generateIcons().catch(console.error)
