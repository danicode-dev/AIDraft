const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, 'public', 'assets', 'foc', 'footer_wave.png');
const outputPath = path.join(__dirname, 'public', 'assets', 'foc', 'footer_wave_solid.png');

async function removeTransparency() {
    console.log('Processing image to remove transparency...');
    console.log('Input:', inputPath);

    try {
        // Get image metadata first
        const metadata = await sharp(inputPath).metadata();
        console.log('Original image:', metadata.width, 'x', metadata.height, 'channels:', metadata.channels);

        // Create a white background and composite the image on top
        const processed = await sharp({
            create: {
                width: metadata.width,
                height: metadata.height,
                channels: 3, // RGB, no alpha
                background: { r: 255, g: 255, b: 255 } // White
            }
        })
            .composite([{
                input: inputPath,
                blend: 'over'
            }])
            .png()
            .toFile(outputPath);

        console.log('✓ Image processed successfully!');
        console.log('Output saved to:', outputPath);
        console.log('New size:', processed.width, 'x', processed.height);

        // Now copy to replace the original
        const fs = require('fs');
        fs.copyFileSync(outputPath, inputPath);
        console.log('✓ Original file replaced with solid version');

    } catch (err) {
        console.error('Error processing image:', err.message);
    }
}

removeTransparency();
