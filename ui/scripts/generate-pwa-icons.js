const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceImage = path.join(__dirname, '../public/Original.png');
const iconsDir = path.join(__dirname, '../public/icons');
const appleIconsDir = path.join(__dirname, '../public/icons/apple');
const publicDir = path.join(__dirname, '../public');

// Ensure directories exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}
if (!fs.existsSync(appleIconsDir)) {
  fs.mkdirSync(appleIconsDir, { recursive: true });
}

// PWA icon sizes
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Apple touch icon size
const appleTouchIconSize = 180;

async function generateIcons() {
  console.log('🚀 Generating PWA icons from Original.png...\n');

  try {
    // Generate standard PWA icons (with background for mobile OS)
    for (const size of iconSizes) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .flatten({ background: '#1e293b' }) // Add background for iOS/Android
        .png({ compressionLevel: 9 })
        .toFile(outputPath);
      console.log(`✅ Generated: icon-${size}x${size}.png`);
    }

    // Generate maskable icon (512x512 with 20% padding for safe area)
    const maskableSize = 512;
    const contentSize = Math.floor(maskableSize * 0.6); // 40% padding total (20% on each side)
    const padding = Math.floor((maskableSize - contentSize) / 2);

    await sharp(sourceImage)
      .resize(contentSize, contentSize, {
        fit: 'cover',
        position: 'center'
      })
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: '#1e293b' // Match manifest background color
      })
      .png({ compressionLevel: 9 })
      .toFile(path.join(iconsDir, 'icon-512x512-maskable.png'));
    console.log('✅ Generated: icon-512x512-maskable.png (with safe area padding)');

    // Generate Apple touch icon (with background since iOS doesn't support transparency)
    await sharp(sourceImage)
      .resize(appleTouchIconSize, appleTouchIconSize, {
        fit: 'cover',
        position: 'center'
      })
      .flatten({ background: '#1e293b' }) // Flatten transparency for iOS
      .png({ compressionLevel: 9 })
      .toFile(path.join(appleIconsDir, 'apple-touch-icon.png'));
    console.log('✅ Generated: apple-touch-icon.png (180x180)');

    // Generate favicons (keep transparent for browser tabs)
    await sharp(sourceImage)
      .resize(32, 32, {
        fit: 'cover',
        position: 'center'
      })
      .png({ compressionLevel: 9 })
      .toFile(path.join(publicDir, 'favicon-32x32.png'));
    
    await sharp(sourceImage)
      .resize(16, 16, {
        fit: 'cover',
        position: 'center'
      })
      .png({ compressionLevel: 9 })
      .toFile(path.join(publicDir, 'favicon-16x16.png'));
    console.log('✅ Generated: favicon-16x16.png and favicon-32x32.png (transparent)');

    console.log('\n🎉 All PWA icons generated successfully!');
    console.log('\nIcon locations:');
    console.log(`  - Standard icons: ${iconsDir}`);
    console.log(`  - Apple icon: ${appleIconsDir}`);
    console.log('\n💡 Tip: Clear your browser cache and re-add to home screen to see the new icons.');

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
