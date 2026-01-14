
// Extract images from PDF using pdf-lib and sharp
const fs = require("fs");
const path = require("path");

async function extractPdfImages() {
    const pdfPath = path.join(__dirname, "P30-Plantilla_Informe_Elaboracion_Tarea_ia.pdf");
    const outputDir = path.join(__dirname, "public", "assets", "foc", "pdf_extracted");

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Read PDF as buffer and search for image markers
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfString = pdfBuffer.toString("binary");

    // Find PNG signatures (89 50 4E 47 = ‰PNG)
    const pngSignature = "\x89PNG";
    const pngEnd = "IEND";

    let startIndex = 0;
    let imageCount = 0;

    while ((startIndex = pdfString.indexOf(pngSignature, startIndex)) !== -1) {
        const endIndex = pdfString.indexOf(pngEnd, startIndex);
        if (endIndex !== -1) {
            const imageData = pdfBuffer.slice(startIndex, endIndex + 8); // +8 for IEND + CRC
            const outputPath = path.join(outputDir, `image_${imageCount + 1}.png`);
            fs.writeFileSync(outputPath, imageData);
            console.log(`Extracted PNG: image_${imageCount + 1}.png (${imageData.length} bytes)`);
            imageCount++;
            startIndex = endIndex + 8;
        } else {
            break;
        }
    }

    // Find JPEG signatures (FF D8 FF)
    const jpegSignature = "\xFF\xD8\xFF";
    const jpegEnd = "\xFF\xD9";
    startIndex = 0;

    while ((startIndex = pdfString.indexOf(jpegSignature, startIndex)) !== -1) {
        const endIndex = pdfString.indexOf(jpegEnd, startIndex);
        if (endIndex !== -1) {
            const imageData = pdfBuffer.slice(startIndex, endIndex + 2);
            const outputPath = path.join(outputDir, `image_${imageCount + 1}.jpg`);
            fs.writeFileSync(outputPath, imageData);
            console.log(`Extracted JPEG: image_${imageCount + 1}.jpg (${imageData.length} bytes)`);
            imageCount++;
            startIndex = endIndex + 2;
        } else {
            break;
        }
    }

    console.log(`\nTotal images extracted: ${imageCount}`);
    console.log("Output directory:", outputDir);
}

extractPdfImages().catch(console.error);
