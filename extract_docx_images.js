
const AdmZip = require("adm-zip");
const path = require("path");
const fs = require("fs");

// DOCX files are ZIP archives - extract media folder
const docxPath = path.join(__dirname, "P30-Plantilla_Informe_Elaboracion_Tarea_ia.docx");
const outputDir = path.join(__dirname, "public", "assets", "foc", "extracted");

// Create output directory
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const zip = new AdmZip(docxPath);
const zipEntries = zip.getEntries();

console.log("Extracting images from DOCX template...\n");

zipEntries.forEach((entry) => {
    // Media files are in word/media/ folder
    if (entry.entryName.startsWith("word/media/")) {
        const fileName = path.basename(entry.entryName);
        const outputPath = path.join(outputDir, fileName);

        fs.writeFileSync(outputPath, entry.getData());
        console.log(`Extracted: ${fileName}`);
    }
});

console.log("\nDone! Check:", outputDir);
