const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const sourceImage = path.join(__dirname, '../public/Original.png')
const iconsDir = path.join(__dirname, '../public/icons')
const appleIconsDir = path.join(__dirname, '../public/icons/apple')
const publicDir = path.join(__dirname, '../public')

// Ensure directories exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}
if (!fs.existsSync(appleIconsDir)) {
  fs.mkdirSync(appleIconsDir, { recursive: true })
}

// PWA icon sizes
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512]

// Apple touch icon size
const appleTouchIconSize = 180

async function generateIcons() {
  console.log('🚀 Generating PWA icons from Original.png...\n')

  // Use the app's darkest theme color for icon backgrounds
  const iconBackgroundColor = '#090d21' // Matches the app's darkest cool color

  try {
    // Generate standard PWA icons (with SOLID background - no transparency)
    for (const size of iconSizes) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`)

      // Step 1: Create a solid background canvas
      const background = Buffer.from(
        `<svg width="${size}" height="${size}">
          <rect width="${size}" height="${size}" fill="${iconBackgroundColor}"/>
        </svg>`
      )

      // Step 2: Resize logo to fit within the square
      const logo = await sharp(sourceImage)
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .flatten({ background: iconBackgroundColor })
        .png()
        .toBuffer()

      // Step 3: Composite logo on top of solid background
      await sharp(background)
        .resize(size, size)
        .composite([{ input: logo, blend: 'over' }])
        .png({ compressionLevel: 9, force: true })
        .toFile(outputPath)
      console.log(`✅ Generated: icon-${size}x${size}.png`)
    }

    // Generate maskable icon (512x512 with 20% padding for safe area)
    const maskableSize = 512
    const contentSize = Math.floor(maskableSize * 0.6)
    const padding = Math.floor((maskableSize - contentSize) / 2)

    const maskableBackground = Buffer.from(
      `<svg width="${maskableSize}" height="${maskableSize}">
        <rect width="${maskableSize}" height="${maskableSize}" fill="${iconBackgroundColor}"/>
      </svg>`
    )

    const maskableLogo = await sharp(sourceImage)
      .resize(contentSize, contentSize, {
        fit: 'cover',
        position: 'center',
      })
      .flatten({ background: iconBackgroundColor })
      .png()
      .toBuffer()

    await sharp(maskableBackground)
      .resize(maskableSize, maskableSize)
      .composite([
        {
          input: maskableLogo,
          blend: 'over',
          top: padding,
          left: padding,
        },
      ])
      .png({ compressionLevel: 9, force: true })
      .toFile(path.join(iconsDir, 'icon-512x512-maskable.png'))
    console.log('✅ Generated: icon-512x512-maskable.png (with safe area padding)')

    // Generate Apple touch icon (with SOLID background for iOS)
    const appleBackground = Buffer.from(
      `<svg width="${appleTouchIconSize}" height="${appleTouchIconSize}">
        <rect width="${appleTouchIconSize}" height="${appleTouchIconSize}" fill="${iconBackgroundColor}"/>
      </svg>`
    )

    const appleLogo = await sharp(sourceImage)
      .resize(appleTouchIconSize, appleTouchIconSize, {
        fit: 'cover',
        position: 'center',
      })
      .flatten({ background: iconBackgroundColor })
      .png()
      .toBuffer()

    await sharp(appleBackground)
      .resize(appleTouchIconSize, appleTouchIconSize)
      .composite([{ input: appleLogo, blend: 'over' }])
      .png({ compressionLevel: 9, force: true })
      .toFile(path.join(appleIconsDir, 'apple-touch-icon.png'))
    console.log('✅ Generated: apple-touch-icon.png (180x180)')

    // Generate favicons (keep transparent for browser tabs)
    await sharp(sourceImage)
      .resize(32, 32, {
        fit: 'cover',
        position: 'center',
      })
      .png({ compressionLevel: 9 })
      .toFile(path.join(publicDir, 'favicon-32x32.png'))

    await sharp(sourceImage)
      .resize(16, 16, {
        fit: 'cover',
        position: 'center',
      })
      .png({ compressionLevel: 9 })
      .toFile(path.join(publicDir, 'favicon-16x16.png'))
    console.log('✅ Generated: favicon-16x16.png and favicon-32x32.png (transparent)')

    console.log('\n🎉 All PWA icons generated successfully!')
    console.log('\nIcon locations:')
    console.log(`  - Standard icons: ${iconsDir}`)
    console.log(`  - Apple icon: ${appleIconsDir}`)
    console.log(
      '\n💡 Tip: Clear your browser cache and re-add to home screen to see the new icons.'
    )
  } catch (error) {
    console.error('❌ Error generating icons:', error)
    process.exit(1)
  }
}

generateIcons()
