const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function fixIcons() {
  // Use the ORIGINAL logo (without padding) and add proper padding at each size
  const originalPath = path.join(process.cwd(), 'client/src/assets/leaseshield-icon-original.png');
  
  // Check if original exists, if not use current
  const inputPath = fs.existsSync(originalPath) 
    ? originalPath 
    : path.join(process.cwd(), 'client/src/assets/leaseshield-icon.png');
  
  console.log('Using source:', inputPath);
  
  const metadata = await sharp(inputPath).metadata();
  console.log('Source size:', metadata.width, 'x', metadata.height);
  
  // Function to create icon with padding by compositing onto larger canvas
  async function createPaddedIcon(targetSize, outputPath) {
    // Logo takes up 70% of the canvas (15% padding on each side = 30% total)
    const logoSize = Math.round(targetSize * 0.70);
    const offset = Math.round((targetSize - logoSize) / 2);
    
    // Create transparent background
    const background = await sharp({
      create: {
        width: targetSize,
        height: targetSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    }).png().toBuffer();
    
    // Resize logo to fit
    const resizedLogo = await sharp(inputPath)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    // Composite logo onto background with offset (centered)
    await sharp(background)
      .composite([{ input: resizedLogo, top: offset, left: offset }])
      .png()
      .toFile(outputPath);
    
    console.log(`Created ${targetSize}x${targetSize} icon at ${outputPath}`);
  }
  
  // Create master padded icon (1024x1024)
  const masterPath = path.join(process.cwd(), 'client/src/assets/leaseshield-icon.png');
  await createPaddedIcon(1024, masterPath);
  console.log('Created master padded icon');
  
  // Create favicon sizes for ICO
  const faviconSizes = [256, 128, 64, 48, 32, 16];
  const tempDir = '/tmp/favicon-layers';
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  
  for (const size of faviconSizes) {
    await createPaddedIcon(size, `${tempDir}/icon-${size}.png`);
  }
  
  // Create apple-touch-icon (180x180)
  const appleTouchPath = path.join(process.cwd(), 'server/public/apple-touch-icon.png');
  await createPaddedIcon(180, appleTouchPath);
  fs.copyFileSync(appleTouchPath, path.join(process.cwd(), 'client/public/apple-touch-icon.png'));
  
  // Create favicon.png (32x32 fallback)
  const faviconPngPath = path.join(process.cwd(), 'server/public/favicon.png');
  await createPaddedIcon(32, faviconPngPath);
  fs.copyFileSync(faviconPngPath, path.join(process.cwd(), 'client/public/favicon.png'));
  
  // Copy master to server/public for og:image use
  fs.copyFileSync(masterPath, path.join(process.cwd(), 'server/public/leaseshield-icon.png'));
  fs.copyFileSync(masterPath, path.join(process.cwd(), 'client/public/leaseshield-icon.png'));
  
  console.log('All icons created with proper padding!');
  console.log('Favicon layers saved to:', tempDir);
  console.log('Next: Use ImageMagick to create favicon.ico from layers');
}

fixIcons().catch(console.error);
