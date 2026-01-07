const sharp = require('sharp');
const path = require('path');

async function padLogo() {
  const inputPath = path.join(process.cwd(), 'client/src/assets/leaseshield-icon.png');
  const outputPath = path.join(process.cwd(), 'client/src/assets/leaseshield-icon-padded.png');
  
  // Get original image metadata
  const metadata = await sharp(inputPath).metadata();
  console.log('Original size:', metadata.width, 'x', metadata.height);
  
  // Calculate new size with 15% padding on each side (30% total increase)
  const paddingPercent = 0.15;
  const originalSize = Math.max(metadata.width, metadata.height);
  const newSize = Math.round(originalSize / (1 - 2 * paddingPercent));
  const padding = Math.round((newSize - originalSize) / 2);
  
  console.log('New size:', newSize, 'x', newSize);
  console.log('Padding:', padding, 'px on each side');
  
  // Create padded version
  await sharp(inputPath)
    .resize(originalSize, originalSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(outputPath);
  
  console.log('Created padded logo at:', outputPath);
}

padLogo().catch(console.error);
