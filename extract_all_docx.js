
const AdmZip = require("adm-zip");
const path = require("path");
const fs = require("fs");

// DOCX files are ZIP archives - extract document.xml to see structure
const docxPath = path.join(__dirname, "P30-Plantilla_Informe_Elaboracion_Tarea_ia.docx");
const outputDir = path.join(__dirname, "docx_extracted");

// Create output directory
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const zip = new AdmZip(docxPath);
const zipEntries = zip.getEntries();

console.log("Extracting ALL files from DOCX...\n");

zipEntries.forEach((entry) => {
    const outputPath = path.join(outputDir, entry.entryName);
    const dir = path.dirname(outputPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!entry.isDirectory) {
        fs.writeFileSync(outputPath, entry.getData());
        console.log(`Extracted: ${entry.entryName}`);
    }
});

console.log("\nDone! Check:", outputDir);
